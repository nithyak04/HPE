# HPE — Pricing Strategy Intelligence Engine

An early-warning and decision-support layer for the pricing organization. Load internal pricing and competitive data; get a prioritized brief of pricing risks and opportunities, their likely drivers, estimated financial impact, and the next analysis to run. It doesn't make pricing decisions — the pricing team does.

Single-page React app (Vite), no backend. Data you load never leaves the browser.

## What it produces

- **Pricing Intelligence Brief** — executive summary, priority alerts (🔴 high / 🟠 watch / 🟢 opportunity), competitive moves, emerging trends, opportunities, questions requiring human review, and data gaps.
- Each alert: what changed, why it matters, estimated annualized exposure (with assumptions), competitive context, 2–4 likely drivers ranked by evidence, what data would separate them, a concrete next step, and a confidence level.
- **Analyst mode** — answers questions like "Where are we losing price?", "Why is margin declining?", "Which products could support a price increase?" from the loaded data. Free text is matched to the closest supported question; answers are calculated, never generated.
- **Price / volume / mix** — revenue and gross-margin bridges (price, volume, mix, cost), by-family breakdown, and elasticity signals.

Every statement is labeled FACT (observed), SIGNAL (pattern detected), HYPOTHESIS (needs validation) or RECOMMENDATION (suggested next step). Nothing is invented: missing inputs are reported, not filled in.

## Input data

CSV, one row per SKU × region × channel × period. The latest two periods are compared (sorted by label, so use sortable labels like `2026-Q2` / `2026-Q3`).

| Column | Required | Unlocks |
|---|---|---|
| `period`, `sku`, `asp`, `units` | yes | ASP trend, volume, revenue PVM, elasticity |
| `product`, `family`, `region`, `channel` | no | Readable names, family PVM, regional/channel gaps, trends |
| `list_price` | no | Discount depth, price realization |
| `unit_cost` | no | Gross margin, margin compression, cost-vs-price split |
| `competitor`, `competitor_product`, `competitor_price` | no | Price positioning, competitor moves, crossovers |
| `competitor_promo` (Y/N) | no | Separating promotional from structural competitor moves |
| `market_share` | no | Share loss/gain signals |

"Download template" in the app exports the built-in sample in this exact shape. The sample (`src/data/pricingSample.js`) is synthetic — made-up products, "Competitor A/B/C", and numbers.

## Tuning

Flag thresholds (e.g. competitor cut ≥5% = high priority, ASP down 2–5% = watch) live in the `THRESHOLDS` object at the top of `src/lib/pricingEngine.js`. The materiality floor defaults to 0.1% of annualized revenue and can be overridden in the UI; anything below it is suppressed and footnoted, and the brief caps at ten alerts.

## Development

```bash
npm install
npm run dev       # local dev server
npm run build     # production build to dist/
npm run preview   # serve the build locally
```

## Deploying

It builds to plain static files, so any static host works.

- **GitHub Pages** (`https://nithyak04.github.io/HPE/`): `.github/workflows/deploy-pages.yml` builds and deploys on every push to the default branch. One-time setup: repo Settings → Pages → Source: **GitHub Actions**.
- **Vercel**: connected to the repo; production deploys from the default branch.
- **Offline**: the build can also be inlined into a single HTML file that opens straight from disk.

Asset paths are relative (`base: './'` in `vite.config.js`), so the same build works at a domain root or under a sub-path.
