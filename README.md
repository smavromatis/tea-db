# Tea Catalog

> *Disclaimer: Proceed with caution. Browsing this catalog and analyzing these flavor profiles for too long has been known to cause an irresistible urge to boil water, acquire far too many teapots, and start a rapidly expanding tea collection of your own.*

A personal catalog of fine teas, curated to share with family and guests. 

https://smavromatis.github.io/tea-db/

A React app for browsing the tea collection. Has categories, search, filters, and brew details for every tea. Hosted statically on GitHub Pages.

In dev mode, the admin panel writes directly to `teas.json`. In production, the site is fully static.

## Smart Search

This catalog uses a fully local Semantic Search engine (all-MiniLM-L12). It runs entirely in your browser, keeping everything fast and private without relying on any external servers.

Instead of searching for exact words, the engine understands concepts. You can type how you feel or what you are doing, and it finds the perfect tea for you.

*   **Build Time:** A script reads through all your teas and maps them against a massive dictionary of 350+ concepts, moods, scenarios, and health benefits to generate mathematical fingerprints (embeddings). 
*   **Search Time:** When you type, your search becomes a fingerprint too. The NLP model overlays your fingerprint onto the tea database, scales the similarity into a human-friendly percentage, and returns the best matches!

### What it can do:

*   **Vibe & Scenario Matching:** Search for "cozy rainy day," "3pm slump," or "stomach ache."
*   **Hybrid Search:** Blends deep semantic understanding with exact keyword boosts to get the most accurate results.
*   **Match Confidence:** Automatically filters out low-quality results and visually ranks teas with clear percentages like "85% Match."
*   **Compound & Negative:** Combine ideas ("floral and bold") or exclude things ("without caffeine").
*   **Intent-Aware:** Searching for "sleepy" automatically demotes caffeinated teas.
*   **Semantic Badges:** Top results show visual badges (like `stress relief` or `soothing`) explaining exactly why the model chose them.

### Customizing

Teach the model new tricks by editing `teas.json` or using the Dev Admin Panel. Just add keywords to a tea's `aiSemanticProfile` field and run `npm run update-ai` to recalculate its fingerprint!

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with admin panel |
| `npm run build` | Recalculate vectors + build for production |
| `npm run update-ai` | Recalculate vectors only |
| `npm run preview` | Preview the production build |

## Built With

This project was built using the following open-source technologies:

*   **[React](https://react.dev/) & [Vite](https://vitejs.dev/)**: The fast foundation powering the UI.
*   **[Transformers.js](https://huggingface.co/docs/transformers.js/index)**: Enables running machine learning directly inside the browser.
*   **[all-MiniLM-L12-v2](https://huggingface.co/Xenova/all-MiniLM-L12-v2)**: The Natural Language Processing (NLP) model that gives the catalog its semantic understanding.
*   **[Framer Motion](https://www.framer.com/motion/)**: The animation engine making interactions smooth.
*   **[Lenis](https://lenis.studiofreight.com/)**: For the buttery smooth scrolling experience.
*   **[Lucide Icons](https://lucide.dev/)**: Beautiful, consistent icons for the app.

A big thank you to the creators and communities behind these tools!
