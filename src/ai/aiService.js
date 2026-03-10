export class AISearchService {
    constructor() {
        this.worker = null;
        this.isReady = false;
        this.resolves = {};
    }

    init(teas, onReady) {
        if (!this.worker) {
            this.worker = new Worker(new URL('./aiWorker.js', import.meta.url), {
                type: 'module'
            });

            this.worker.addEventListener('message', (event) => {
                const { type, payload } = event.data;

                if (type === 'INIT_DONE') {
                    this.isReady = true;
                    if (onReady) onReady();
                } else if (type === 'SEARCH_RESULTS') {
                    const { query, results, explanations } = payload;
                    if (this.resolves[query]) {
                        this.resolves[query]({ results, explanations: explanations || {} });
                        delete this.resolves[query];
                    }
                } else if (type === 'ERROR') {
                    console.error("AI Search Error:", payload);
                }
            });

            this.worker.postMessage({ type: 'INIT', payload: teas });
        }
    }

    async search(query) {
        if (!this.isReady) return null; // Fallback to basic search if not ready
        if (!query.trim()) return { results: [], explanations: {} };

        return new Promise((resolve) => {
            this.resolves[query] = resolve;
            this.worker.postMessage({ type: 'SEARCH', payload: { query } });
        });
    }
}

export const aiSearch = new AISearchService();
