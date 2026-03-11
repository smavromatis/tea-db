import { pipeline, env } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Strictly disallow remote downloads
env.allowRemoteModels = false;
env.localModelPath = path.join(__dirname, '..', '..', 'public', 'models');

const teasPath = path.join(__dirname, '..', 'data', 'teas.json');
const outPath = path.join(__dirname, '..', 'data', 'embeddings.json');

const teas = JSON.parse(fs.readFileSync(teasPath, 'utf8'));

// ── Expanded concept dictionary ──────────────────────────────────────────
const CONCEPT_DICTIONARY = [
    // Moods & emotions
    'happy', 'sad', 'calm', 'anxious', 'peaceful', 'energetic', 'lazy', 'romantic',
    'nostalgic', 'melancholy', 'cheerful', 'contemplative', 'cozy', 'refreshed',
    'comforted', 'inspired', 'focused', 'dreamy', 'grounded', 'uplifted',
    'overwhelmed', 'grateful', 'bored', 'excited', 'lonely', 'content',
    'hopeful', 'frustrated', 'serene', 'adventurous', 'homesick', 'gloomy',
    'confident', 'vulnerable', 'playful', 'sentimental', 'moody',
    'stressed', 'burnt out', 'hyper', 'groggy', 'sluggish', 'restless', 'tense',
    'creative', 'motivated', 'introverted', 'extroverted', 'social', 'reflective',

    // Scenarios & moments
    'morning routine', 'late night studying', 'rainy afternoon', 'sunny garden',
    'fireside reading', 'meditation', 'yoga', 'waking up', 'winding down',
    'catching up with friends', 'solo quiet time', 'sick day recovery',
    'brunch', 'after dinner', 'midday break', 'road trip', 'camping',
    'working from home', 'exam preparation', 'creative work', 'journaling',
    'lazy sunday', 'book club', 'movie night', 'first date', 'date night',
    'job interview', 'office meeting', 'lunch break', 'waiting room',
    'airport lounge', 'train ride', 'beach day', 'picnic', 'stargazing',
    'Sunday morning', 'midnight snack', 'power nap', 'long drive',
    'rainy walk', 'snow day', 'pajama day', 'garden party',
    'baby shower', 'housewarming', 'game night', 'spa day',
    '3pm slump', 'commute', 'post lunch dip', 'all nighter', 'early riser',
    'weekend getaway', 'staycation', 'digital detox', 'self care sunday',
    'reading a novel', 'writing emails', 'scrolling', 'watching tv', 'studying for finals',

    // Seasons & weather
    'winter', 'spring', 'summer', 'autumn', 'fall', 'rainy', 'snowy', 'stormy',
    'sunny', 'cold weather', 'hot day', 'cool breeze', 'foggy morning',
    'crisp autumn', 'humid', 'overcast', 'frost', 'heatwave',
    'blizzard', 'monsoon', 'breezy', 'mild', 'golden hour', 'twilight', 'dawn', 'dusk',

    // Physical & wellness (Health gaps)
    'sore throat', 'headache', 'digestion', 'sleep aid', 'immune boost',
    'stress relief', 'detox', 'hydration', 'warming up', 'cooling down',
    'post workout', 'hangover', 'nausea', 'cold remedy', 'flu season',
    'sore muscles', 'menstrual cramps', 'bloating', 'allergy season',
    'eye strain', 'fatigue', 'recovery', 'cleansing', 'inflammation',
    'skin health', 'antioxidant', 'weight loss', 'metabolism',
    'gut health', 'microbiome', 'acid reflux', 'indigestion', 'blood sugar',
    'joint pain', 'brain fog', 'cognitive function', 'memory', 'focus',
    'heartburn', 'cramps', 'immunity', 'anti-aging', 'blood pressure',
    'stomach ache', 'stuffy nose', 'congestion', 'laryngitis', 'chills',

    // Social & occasions & Cultural
    'hosting guests', 'dinner party', 'gift', 'sharing', 'celebration',
    'holiday', 'christmas', 'thanksgiving', 'family gathering',
    'birthday', 'anniversary', 'graduation', 'reunion', 'potluck',
    'tea ceremony', 'afternoon tea', 'high tea', 'bridal shower',
    'welcome gift', 'thank you gift', 'get well soon', 'sympathy',
    'new year', 'valentines', 'mothers day', 'fathers day',
    'london fog', 'masala chai', 'golden milk', 'boba culture', 'dim sum',
    'tapas', 'izakaya', 'bistro', 'cafe culture', 'fika', 'hygge', 'siesta',
    'gongfu cha', 'chanoyu', 'matcha ceremony', 'kombucha', 'mate circle',

    // Taste & sensory
    'dessert', 'sweet tooth', 'bitter', 'savory', 'light', 'bold', 'strong',
    'mild', 'floral', 'earthy', 'smoky', 'fruity', 'spicy', 'citrus', 'nutty',
    'creamy', 'crisp', 'smooth', 'rich', 'delicate', 'tangy', 'woody',
    'grassy', 'vegetal', 'honey', 'vanilla', 'chocolate', 'caramel',
    'minty', 'herbal', 'peppery', 'toasty', 'malty', 'brisk', 'astringent',
    'buttery', 'tropical', 'berry', 'stone fruit', 'fresh',
    'umami', 'marine', 'seaweed', 'pine', 'cedar', 'leather', 'tobacco',
    'malt', 'roasted', 'burnt', 'caramelized', 'syrupy', 'velvety', 'silky',
    'tart', 'sour', 'zesty', 'punchy', 'robust', 'full bodied', 'light bodied',

    // Activities
    'reading', 'cooking', 'baking', 'painting', 'writing', 'coding',
    'walking', 'hiking', 'traveling', 'relaxing', 'sleeping', 'thinking',
    'gardening', 'crafting', 'knitting', 'drawing', 'photography',
    'stretching', 'swimming', 'cycling', 'running', 'dancing',
    'cleaning', 'organizing', 'studying', 'brainstorming', 'daydreaming',
    'gaming', 'board games', 'video games', 'podcasting', 'listening to music',
    'yoga', 'pilates', 'meditating', 'praying', 'journaling', 'scrapbooking',

    // Pairing & food
    'with milk', 'with honey', 'iced tea', 'latte', 'boba',
    'pastry pairing', 'cheese pairing', 'chocolate pairing', 'breakfast',
    'dessert pairing', 'scone', 'cookie', 'cake', 'light snack',
    'spicy food pairing', 'savory food pairing', 'seafood pairing', 'meat pairing',
    'vegan', 'gluten free', 'keto friendly', 'sugar free', 'mocktail', 'cocktail mixer'
];

// ── Field weights for embedding ──────────────────────────────────────────
const FIELD_WEIGHTS = {
    name: 1.5,
    description: 1.0,
    flavourNotes: 1.2,
    semanticProfile: 2.0,
    metadata: 0.5,
};

// ── Helpers ──────────────────────────────────────────────────────────────

function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function normalize(vec) {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm === 0) return vec;
    return vec.map(v => v / norm);
}

function weightedAverage(vectors, weights) {
    if (vectors.length === 0) return [];
    const dim = vectors[0].length;
    const result = new Array(dim).fill(0);
    let totalWeight = 0;

    for (let v = 0; v < vectors.length; v++) {
        const w = weights[v];
        totalWeight += w;
        for (let i = 0; i < dim; i++) {
            result[i] += vectors[v][i] * w;
        }
    }

    for (let i = 0; i < dim; i++) result[i] /= totalWeight;
    return normalize(result);
}

async function embed(extractor, text) {
    if (!text || !text.trim()) return null;
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

// ── Main ─────────────────────────────────────────────────────────────────

async function run() {
    console.log('Loading model...');
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L12-v2');

    // Step 1: Embed every concept in the dictionary
    console.log(`Embedding ${CONCEPT_DICTIONARY.length} concept words...`);
    const conceptEmbeddings = {};
    for (const concept of CONCEPT_DICTIONARY) {
        const vec = await embed(extractor, concept);
        // Round to 4 decimals to save space
        conceptEmbeddings[concept] = vec.map(v => Number(v.toFixed(4)));
    }

    // Step 2: Process each tea
    console.log(`Processing ${teas.length} teas...`);
    const teaEmbeddings = {};
    let enrichedCount = 0;

    for (const tea of teas) {
        // Build base text for concept matching
        const baseParts = [
            tea.name,
            tea.description,
            tea.flavourNotes || '',
            tea.tips || '',
            tea.categories ? tea.categories.join(', ') : '',
        ].filter(Boolean);
        const baseText = baseParts.join('. ');
        const baseVec = await embed(extractor, baseText);

        // Auto-generate semantic concepts by comparing against dictionary
        const matchedConcepts = [];
        if (baseVec) {
            for (const [concept, conceptVec] of Object.entries(conceptEmbeddings)) {
                const sim = cosineSimilarity(baseVec, conceptVec);
                if (sim > 0.35) {
                    matchedConcepts.push({ word: concept, score: sim });
                }
            }
            matchedConcepts.sort((a, b) => b.score - a.score);
        }

        // Combine hand-written profile with auto-generated concepts
        const manualProfile = tea.aiSemanticProfile || '';
        const autoWords = matchedConcepts
            .slice(0, 20)
            .map(c => c.word)
            .filter(w => !manualProfile.toLowerCase().includes(w.toLowerCase()));
            
        // Embed scale meanings
        const scaleWords = [];
        if (tea.scales) {
            if (tea.scales.intensity >= 65) scaleWords.push("strong", "bold", "high intensity", "robust");
            else if (tea.scales.intensity <= 35) scaleWords.push("mild", "easy", "low intensity", "delicate", "light");
            
            if (tea.scales.mouthfeel >= 65) scaleWords.push("crisp", "punchy", "brisk", "astringent", "dry");
            else if (tea.scales.mouthfeel <= 35) scaleWords.push("smooth", "silky", "buttery", "mellow");
            
            if (tea.scales.flavor >= 65) scaleWords.push("deep", "roasted", "dark");
            else if (tea.scales.flavor <= 35) scaleWords.push("bright", "fresh", "light flavor");
            
            if (tea.scales.sweetness >= 65) scaleWords.push("savory", "earthy", "spiced");
            else if (tea.scales.sweetness <= 35) scaleWords.push("sweet", "fruity", "dessert");
        }
        
        const fullProfile = [manualProfile, ...autoWords, ...scaleWords].filter(Boolean).join(', ');

        if (autoWords.length > 0) enrichedCount++;

        // Embed each field separately for weighted combination
        const fieldVectors = [];
        const fieldWeights = [];

        const nameVec = await embed(extractor, tea.name);
        if (nameVec) { fieldVectors.push(nameVec); fieldWeights.push(FIELD_WEIGHTS.name); }

        const descVec = await embed(extractor, [tea.description, tea.tips].filter(Boolean).join('. '));
        if (descVec) { fieldVectors.push(descVec); fieldWeights.push(FIELD_WEIGHTS.description); }

        const flavourVec = await embed(extractor, tea.flavourNotes);
        if (flavourVec) { fieldVectors.push(flavourVec); fieldWeights.push(FIELD_WEIGHTS.flavourNotes); }

        const profileVec = await embed(extractor, fullProfile);
        if (profileVec) { fieldVectors.push(profileVec); fieldWeights.push(FIELD_WEIGHTS.semanticProfile); }

        const metaParts = [
            tea.categories ? `Category: ${tea.categories.join(', ')}` : '',
            tea.origin && tea.origin !== 'Unknown' ? `Origin: ${tea.origin}` : '',
            tea.caffeinated ? `Caffeine: ${tea.caffeinated}` : '',
            tea.brand && tea.brand !== 'Unknown' ? `Brand: ${tea.brand}` : '',
        ].filter(Boolean).join('. ');
        const metaVec = await embed(extractor, metaParts);
        if (metaVec) { fieldVectors.push(metaVec); fieldWeights.push(FIELD_WEIGHTS.metadata); }

        const finalVec = weightedAverage(fieldVectors, fieldWeights);
        teaEmbeddings[tea.id] = finalVec.map(v => Number(v.toFixed(4)));
    }

    // Save both tea embeddings and concept embeddings
    const output = {
        teas: teaEmbeddings,
        concepts: conceptEmbeddings,
    };

    fs.writeFileSync(outPath, JSON.stringify(output));
    const sizeKB = Math.round(JSON.stringify(output).length / 1024);
    console.log(`Done. ${teas.length} teas embedded, ${enrichedCount} auto-enriched. ${CONCEPT_DICTIONARY.length} concepts stored. (${sizeKB}KB)`);
}

run().catch(console.error);
