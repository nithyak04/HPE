# HPE Onboarding

Interactive onboarding app for new hires on the Chips/AI finance team at HPE. Built as a single-page React app (Vite), no backend, deployable as a static site.

Three modules, selectable from the landing page or the top nav:

- **HPE 101** — org structure, product lines, the GreenLake consumption billing model (with a live bill simulator), why hybrid cloud exists, and where finance fits in.
- **Copilot & Power BI 101** — vocabulary, a real variance-analysis (actual vs. budget) walkthrough with the actual DAX formula, a Copilot-for-FP&A walkthrough, a finance prompt cheat sheet, and common beginner gotchas.
- **Pricing Intelligence 101** — pricing vocabulary plus a working Pricing Strategy Intelligence Engine: load a CSV of internal pricing and competitor data (or the built-in synthetic sample) and get a prioritized brief with 🔴/🟠/🟢 alerts, financial exposure, ranked root-cause hypotheses, price/volume/mix bridges, elasticity signals, competitor moves, and an analyst Q&A mode.

## Pricing engine

The engine is a deterministic rules engine in `src/lib/pricingEngine.js` — no LLM, no backend; uploaded data never leaves the browser. It compares the latest two periods in the file.

Input is one row per SKU × region × channel × period. Required columns: `period`, `sku`, `asp`, `units`. Optional columns unlock more analysis, and anything missing is reported in the brief's "Data gaps" section rather than guessed: `product`, `family`, `region`, `channel`, `list_price`, `unit_cost`, `competitor`, `competitor_product`, `competitor_price`, `competitor_promo` (Y/N), `market_share`. The "Download template" button in the app exports the sample in this exact shape.

Flag thresholds live in the `THRESHOLDS` object at the top of `pricingEngine.js`. The sample dataset (`src/data/pricingSample.js`) is synthetic — made-up products, "Competitor A/B/C", and numbers.

## Local development

```bash
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview   # serve the production build locally to sanity-check it
```

## Deploying to Vercel

1. Push this repo to GitHub (already configured to push to `github.com/nithyak04/HPE`).
2. In Vercel, "Add New Project" → import the GitHub repo.
3. Framework preset: **Vite**. Build command `npm run build`, output directory `dist` (Vercel auto-detects both). No environment variables are required.
4. Deploy. `vercel.json` is already set up to rewrite all routes to `index.html` so client-side routing (`/hpe-101`, `/copilot-powerbi-101`) works on refresh and direct links.

## Updating content

All copy lives in the module data files, structured as a commented array of section objects — no JSX or markup editing required to change text:

- `src/data/hpe101.js`
- `src/data/copilotPowerBi.js`
- `src/data/pricingIntelligence.js`

All are registered in `src/data/modules.js`. To add another module, create a new data file following the same shape and add it to the `modules` array there; the landing page, nav, and progress tracker all pick it up automatically.

Each section has a `type` (e.g. `intro`, `flipgrid`, `simulator`, `toggle`, `reasons`, `finance-role`, `walkthrough`, `cheatsheet`, `gotchas`, `pricing-engine`) that maps to a renderer component in `src/components/sections/SectionRenderer.jsx`. Add a new section type by adding a component there plus an entry in `TYPE_MAP`.

## Progress tracking

Progress is stored in the browser's `localStorage` (key `hpe-onboarding-progress-v1`), keyed by module id and section id. A section is marked complete when it's scrolled into view (or, for interactive sections, on first interaction — flipping a card, moving the slider). This is per-device, not synced across devices or shared with a backend.

## Print / PDF

Use the browser's print dialog (Cmd/Ctrl+P) on any module page for a clean, static handout: nav and sidebar are hidden, flip cards show both sides stacked, and the bill simulator shows its default value instead of a slider control.

## Stack

- React 18 + Vite 5
- React Router (client-side routing between the landing page and modules)
- Plain CSS (`src/styles/global.css`) — no CSS framework, custom design tokens for the HPE green / dark ink theme
- Fonts: Space Grotesk (display), Inter (body), IBM Plex Mono (labels/data), loaded from Google Fonts in `index.html`
