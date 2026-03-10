import { pipeline, env } from '@xenova/transformers';
import precomputedData from '../data/embeddings.json';

// Disallow loading from the Hugging Face hub
env.allowRemoteModels = false;
env.localModelPath = (import.meta.env.BASE_URL || '/') + 'models/';

let pipelineInstance = null;
let initialized = false;

// ── Math helpers ─────────────────────────────────────────────────────────

const cosineSimilarity = (vecA, vecB) => {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const normalize = (vec) => {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm === 0) return vec;
    return vec.map(v => v / norm);
};

const subtractVectors = (a, b, weight = 0.5) => {
    return normalize(a.map((v, i) => v - weight * b[i]));
};

const averageVectors = (vectors, weights) => {
    if (vectors.length === 0) return [];
    const dim = vectors[0].length;
    const result = new Array(dim).fill(0);
    let totalWeight = 0;
    for (let v = 0; v < vectors.length; v++) {
        const w = weights ? weights[v] : 1;
        totalWeight += w;
        for (let i = 0; i < dim; i++) result[i] += vectors[v][i] * w;
    }
    for (let i = 0; i < dim; i++) result[i] /= totalWeight;
    return normalize(result);
};

// ── Fuzzy matching (Levenshtein) ─────────────────────────────────────────

const levenshtein = (a, b) => {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[m][n];
};

const fuzzyMatch = (query, text, threshold = 0.35) => {
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    if (t.includes(q)) return 1.0;
    const qWords = q.split(/\s+/);
    const tWords = t.split(/\s+/);
    let totalScore = 0;
    for (const qw of qWords) {
        let bestWordScore = 0;
        for (const tw of tWords) {
            const maxLen = Math.max(qw.length, tw.length);
            if (maxLen === 0) continue;
            const dist = levenshtein(qw, tw);
            const similarity = 1 - dist / maxLen;
            bestWordScore = Math.max(bestWordScore, similarity);
        }
        totalScore += bestWordScore;
    }
    const avgScore = totalScore / qWords.length;
    return avgScore >= threshold ? avgScore : 0;
};

// ── Negation parsing ─────────────────────────────────────────────────────

const NEGATION_PATTERNS = [
    /\bnot\s+(.+)/i,
    /\bno\s+(.+)/i,
    /\bwithout\s+(.+)/i,
    /\bnon[- ](.+)/i,
    /\bavoid\s+(.+)/i,
    /\bexcept\s+(.+)/i,
];

const parseNegation = (query) => {
    const butParts = query.split(/\s+but\s+/i);
    let positive = query;
    let negative = '';

    if (butParts.length > 1) {
        positive = butParts[0].trim();
        const rest = butParts.slice(1).join(' ');
        for (const pattern of NEGATION_PATTERNS) {
            const match = rest.match(pattern);
            if (match) { negative = match[1].trim(); break; }
        }
        if (!negative) negative = rest.trim();
    } else {
        for (const pattern of NEGATION_PATTERNS) {
            const match = query.match(pattern);
            if (match) {
                const negStart = query.toLowerCase().indexOf(match[0].toLowerCase());
                positive = query.substring(0, negStart).trim();
                negative = match[1].trim();
                break;
            }
        }
    }

    return { positive: positive || query, negative };
};

// ── Multi-query blending ─────────────────────────────────────────────────

const splitCompoundQuery = (query) => {
    // Split on "and", commas, "&", "+" but not "but" (handled by negation parser)
    return query
        .split(/\s*(?:,|\band\b|&|\+)\s*/i)
        .map(s => s.trim())
        .filter(s => s.length > 0);
};

// ── Intent detection ─────────────────────────────────────────────────────

const CALM_SLEEP_KEYWORDS = [
    'sleep', 'sleepy', 'bedtime', 'insomnia', 'night', 'nighttime', 'nightly',
    'relax', 'relaxing', 'relaxation', 'calm', 'calming', 'wind down', 'winding down',
    'unwind', 'destress', 'de-stress', 'stress free', 'anxiety', 'anxious',
    'soothing', 'peaceful', 'restful', 'tranquil', 'mellow', 'gentle evening',
    'before bed', 'late night', 'evening', 'lullaby',
];

const ENERGY_KEYWORDS = [
    'energy', 'energize', 'energizing', 'wake up', 'waking up', 'morning',
    'alert', 'focus', 'focused', 'concentration', 'boost', 'stimulating',
    'productive', 'power', 'kick', 'strong caffeine', 'caffeine',
    'study', 'studying', 'exam', 'workout', 'pre-workout', 'active',
];

const detectIntent = (query) => {
    const q = query.toLowerCase();
    const wantsCalmSleep = CALM_SLEEP_KEYWORDS.some(kw => q.includes(kw));
    const wantsEnergy = ENERGY_KEYWORDS.some(kw => q.includes(kw));
    return { wantsCalmSleep, wantsEnergy };
};

// ── Pipeline ─────────────────────────────────────────────────────────────

async function getPipeline() {
    if (!pipelineInstance) {
        pipelineInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L12-v2', {
            pretrained_model_name_or_path: 'Xenova/all-MiniLM-L12-v2'
        });
    }
    return pipelineInstance;
}

// ── Message handler ──────────────────────────────────────────────────────

self.addEventListener('message', async (event) => {
    const { type, payload } = event.data;

    try {
        if (type === 'INIT') {
            const teas = payload;
            await getPipeline(); // Warm up the pipeline without assigning to unused variable

            // Load pre-computed tea embeddings
            const teaEmbs = precomputedData.teas || precomputedData;
            self.teaCollection = teas.map(tea => ({
                id: tea.id,
                embedding: teaEmbs[tea.id] || [],
                caffeinated: (tea.caffeinated || '').toLowerCase() === 'yes',
                searchText: [
                    tea.name, tea.flavourNotes, tea.description,
                    tea.categories?.join(' '), tea.origin, tea.brand,
                    tea.aiSemanticProfile,
                ].filter(Boolean).join(' '),
                name: tea.name || '',
            }));

            // Load pre-computed concept embeddings for query expansion & explanations
            self.conceptEmbeddings = precomputedData.concepts || {};

            initialized = true;
            self.postMessage({ type: 'INIT_DONE' });

        } else if (type === 'SEARCH') {
            if (!initialized) {
                self.postMessage({ type: 'SEARCH_RESULTS', payload: { query: payload.query, results: null } });
                return;
            }

            const { query } = payload;
            if (!query.trim()) {
                self.postMessage({ type: 'SEARCH_RESULTS', payload: { query, results: [] } });
                return;
            }

            // Step 1: Parse negation
            const extractor = await getPipeline();
            const { positive, negative } = parseNegation(query);

            // Step 2: Multi-query blending - split compound queries
            const subQueries = splitCompoundQuery(positive);
            const subVectors = [];

            for (const sq of subQueries) {
                const output = await extractor(sq, { pooling: 'mean', normalize: true });
                subVectors.push(Array.from(output.data));
            }

            // Blend sub-query vectors with equal weight
            let queryEmbedding = subVectors.length === 1
                ? subVectors[0]
                : averageVectors(subVectors);

            // Step 3: Query expansion - find top 3 closest concepts and blend in
            if (self.conceptEmbeddings && Object.keys(self.conceptEmbeddings).length > 0) {
                const conceptScores = Object.entries(self.conceptEmbeddings)
                    .map(([word, vec]) => ({ word, score: cosineSimilarity(queryEmbedding, vec) }))
                    .sort((a, b) => b.score - a.score);

                const topConcepts = conceptScores.slice(0, 3);
                // Blend top concepts at 20% weight each (so query stays dominant)
                const expansionVectors = topConcepts
                    .filter(c => c.score > 0.3)
                    .map(c => self.conceptEmbeddings[c.word]);

                if (expansionVectors.length > 0) {
                    const allVecs = [queryEmbedding, ...expansionVectors];
                    const allWeights = [1.0, ...expansionVectors.map(() => 0.15)];
                    queryEmbedding = averageVectors(allVecs, allWeights);
                }
            }

            // Step 4: Subtract negative vector if present
            if (negative) {
                const negOutput = await extractor(negative, { pooling: 'mean', normalize: true });
                const negEmbedding = Array.from(negOutput.data);
                queryEmbedding = subtractVectors(queryEmbedding, negEmbedding, 0.5);
            }

            // Step 5: Detect intent for caffeine-aware ranking
            const { wantsCalmSleep, wantsEnergy } = detectIntent(query);

            // Step 6: Score all teas
            const scored = self.teaCollection.map(tea => {
                let baseScore = tea.embedding.length > 0 ? cosineSimilarity(queryEmbedding, tea.embedding) : 0;

                if (wantsCalmSleep && tea.caffeinated) baseScore *= 0.3;
                if (wantsEnergy && !tea.caffeinated) baseScore *= 0.4;

                // Lexical keyword boost (Hybrid Search)
                // Adds a bonus for exact words found in descriptions/profiles
                const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
                const searchTextLower = tea.searchText.toLowerCase();

                let wordMatchBonus = 0;
                for (const qw of queryWords) {
                    if (new RegExp(`\\b${qw}\\b`, 'i').test(searchTextLower)) wordMatchBonus += 0.15;
                    else if (searchTextLower.includes(qw)) wordMatchBonus += 0.05;
                }

                // Scale dense score to human-readable % confidence 
                // e.g. 0.35 pure semantic similarity scales to an ~84% match visually
                let displayScore = Math.pow(Math.max(0, baseScore), 0.5) * 1.25;
                displayScore += wordMatchBonus;

                if (displayScore < 0) displayScore = 0;
                if (displayScore > 0.99) displayScore = 0.99; // Cap at 99% 

                return { id: tea.id, score: displayScore, baseScore };
            }).sort((a, b) => b.score - a.score);

            // Thresholds mapped to the new display scale
            const MIN_SCORE = 0.45; // Below ~45% confidence gets cut off
            const RELATIVE_CUTOFF = 0.75;
            const MAX_RESULTS = 12;

            const topScore = scored.length > 0 ? scored[0].score : 0;
            const dynamicFloor = topScore * RELATIVE_CUTOFF;
            const effectiveThreshold = Math.max(MIN_SCORE, dynamicFloor);

            let matchedTeas = scored
                .filter(res => res.score >= effectiveThreshold)
                .slice(0, MAX_RESULTS);

            // Step 7: Generate explanation badges for each matched tea
            const explanations = {};
            if (self.conceptEmbeddings && Object.keys(self.conceptEmbeddings).length > 0) {
                for (const match of matchedTeas) {
                    const tea = self.teaCollection.find(t => t.id === match.id);
                    if (!tea || tea.embedding.length === 0) continue;

                    // Find top concepts that both the query AND this tea agree on
                    const teaConcepts = Object.entries(self.conceptEmbeddings)
                        .map(([word, vec]) => ({
                            word,
                            teaSim: cosineSimilarity(tea.embedding, vec),
                            querySim: cosineSimilarity(queryEmbedding, vec),
                        }))
                        .filter(c => c.teaSim > 0.25 && c.querySim > 0.20)
                        .sort((a, b) => (b.teaSim + b.querySim) - (a.teaSim + a.querySim))
                        .slice(0, 3)
                        .map(c => c.word);

                    if (teaConcepts.length > 0) {
                        explanations[match.id] = teaConcepts;
                    }
                }
            }

            let results = matchedTeas.map(res => ({ id: res.id, score: res.score }));

            // Fuzzy fallback
            if (results.length === 0 && query.trim().length >= 2) {
                const fuzzyScored = self.teaCollection
                    .map(tea => ({
                        id: tea.id,
                        score: Math.max(
                            fuzzyMatch(query, tea.name, 0.55),
                            fuzzyMatch(query, tea.searchText, 0.45)
                        )
                    }))
                    .filter(r => r.score > 0)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, MAX_RESULTS);

                if (fuzzyScored.length > 0) {
                    results = fuzzyScored.map(r => ({ id: r.id, score: r.score }));
                }
            }

            self.postMessage({
                type: 'SEARCH_RESULTS',
                payload: { query, results, explanations }
            });
        }
    } catch (error) {
        self.postMessage({ type: 'ERROR', payload: error.message });
    }
});
