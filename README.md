# Pricing Strategy Intelligence Engine

An early-warning and decision-support layer for the pricing organization. Load internal pricing and competitive data; get a prioritized brief of pricing risks and opportunities, their likely drivers, estimated financial impact, and the next analysis to run. It doesn't make pricing decisions — the pricing team does.

Single-page React app (Vite), no backend. Data you load never leaves the browser.

## What it produces

- **Decision brief** — three columns a director can read in a minute: *what you need to know*, *what needs a decision*, *what to watch*.
- **Priority signals** — each one runs the full chain FACT → SIGNAL → HYPOTHESIS → RECOMMENDATION → ACTION → OUTCOME: what changed, why it matters, 2–4 likely drivers ranked by evidence, then a verdict (HOLD, RESPOND, INVESTIGATE, TEST INCREASE, RECOVER, ADDRESS COST, REASSESS, MONITOR), the next analytical step, the condition that should trigger a reassessment, and the money at stake with its assumptions.
- **Outcome loop** — with three or more periods, the engine reruns itself on the previous pair, takes the calls it would have made then, and grades each against the latest period (held up / trigger hit / open). It checks whether the data still supports a call, not whether the team acted on it.
- **Engine-detected patterns** — cross-product issues quantified as one card, e.g. discount leakage across a region (realized ASP, list-price movement, discount depth, exposure, likely driver, where to look) or a competitor repricing several products at once.
- **Price paths** — competitor price, our ASP, units and share across every period for each signal.
- **Analyst mode** — answers questions like "Where are we losing price?", "Why is margin declining?", "Which products could support a price increase?" from the loaded data. Free text is matched to the closest supported question; answers are calculated, never generated.
- **Price / volume / mix** — revenue and gross-margin bridges (price, volume, mix, cost), by-family breakdown, and elasticity signals.

Every statement is labeled FACT (observed), SIGNAL (pattern detected), HYPOTHESIS (needs validation) or RECOMMENDATION (suggested next step). Nothing is invented: missing inputs are reported, not filled in. Confidence is High / Medium / Low from corroborating evidence — deliberately not a percentage, since nothing here is a calibrated probability.

The engine is deterministic: every number (price/volume/mix, competitor deltas, exposure, materiality, thresholds) is calculated, not generated. That's the layer an LLM reasoning step would sit on top of, not replace.

## Input data

CSV, one row per SKU × region × channel × period. The latest two periods drive the brief (sorted by label, so use sortable labels like `2026-Q2` / `2026-Q3`); a third or earlier period adds the outcome loop and price paths.

| Column | Required | Unlocks |
|---|---|---|
| `period`, `sku`, `asp`, `units` | yes | ASP trend, volume, revenue PVM, elasticity |
| `product`, `family`, `region`, `channel` | no | Readable names, family PVM, regional/channel gaps, trends |
| `list_price` | no | Discount depth, price realization |
| `unit_cost` | no | Gross margin, margin compression, cost-vs-price split |
| `competitor`, `competitor_product`, `competitor_price` | no | Price positioning, competitor moves, crossovers |
| `competitor_promo` (Y/N) | no | Separating promotional from structural competitor moves |
| `market_share` | no | Share loss/gain signals |

"Download template" in the app exports the built-in sample in this exact shape. The sample (`src/data/pricingSample.js`) is synthetic — made-up products, "Competitor A/B/C", and numbers — across three quarters, with Q1 set up so the outcome loop has calls that both hold up and fail.

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

- **Cloudflare Workers** (`https://pricing-intelligence.<account>.workers.dev`): `wrangler.jsonc` serves `dist/` as static assets. Cloudflare's Git integration runs `npm run build`, then `npx wrangler deploy`. The `name` in `wrangler.jsonc` must match the Worker's name in the dashboard.
- **GitHub Pages** (`https://nithyak04.github.io/HPE/`): `.github/workflows/deploy-pages.yml` builds and deploys on every push to the default branch. One-time setup: repo Settings → Pages → Source: **GitHub Actions**.
- **Vercel**: connected to the repo; production deploys from the default branch.
- **Offline**: the build can also be inlined into a single HTML file that opens straight from disk.

Asset paths are relative (`base: './'` in `vite.config.js`), so the same build works at a domain root or under a sub-path.
