// ============================================================================
// Pricing Intelligence 101 — content data
// ----------------------------------------------------------------------------
// Same pattern as the other modules. The `pricing-engine` section is the live
// tool (src/components/sections/PricingEngineSection.jsx); its rules live in
// src/lib/pricingEngine.js and its sample data in src/data/pricingSample.js.
// ============================================================================

export const pricingIntelligence = {
  id: 'pricing-intelligence',
  navLabel: 'Pricing Intelligence',
  title: 'Pricing Intelligence 101',
  tagline: 'An early-warning engine for pricing risk and upside — load pricing and competitor data, get a prioritized brief.',
  icon: '🎯',
  estMinutes: 25,
  sections: [
    // --------------------------------------------------------------------
    // 0. Orientation
    // --------------------------------------------------------------------
    {
      id: 'orientation',
      navLabel: 'Start here',
      type: 'intro',
      eyebrow: 'Orientation',
      title: 'From dashboards to a prioritized pricing brief',
      content: {
        body: [
          'Pricing work usually means flipping between ASP reports, discount files, competitor price pulls and margin dashboards, then trying to spot what actually moved. This module gives you an engine that does that first pass for you.',
          'It reads one table of internal pricing and competitive data, compares the latest period with the one before it, and returns a brief: what changed, why it might matter, what it could be worth, which explanations the data supports, and what to look at next.',
          'It doesn’t make pricing decisions and it doesn’t invent numbers. If a column is missing, the analyses that need it are skipped and the brief tells you what’s missing. Every statement is labeled as a fact, a signal, a hypothesis or a recommendation, so you always know which is which.',
        ],
        bullets: [
          { num: '01', title: 'Vocabulary', body: 'Eight pricing terms the engine (and the pricing team) uses constantly.' },
          { num: '02', title: 'Run the engine', body: 'Load the sample or your own CSV and read the brief.' },
          { num: '03', title: 'How it thinks', body: 'The formulas and thresholds behind each flag.' },
          { num: '04', title: 'Questions + guardrails', body: 'What to ask it, and the traps it’s built to avoid.' },
        ],
      },
    },

    // --------------------------------------------------------------------
    // 1. Vocabulary
    // --------------------------------------------------------------------
    {
      id: 'vocabulary',
      navLabel: 'Vocabulary',
      type: 'flipgrid',
      eyebrow: 'Pricing vocabulary',
      title: 'Eight terms behind every pricing conversation',
      lede: 'Click each card. The brief uses all of these.',
      content: {
        cards: [
          {
            front: 'ASP vs. list price',
            back: 'List is the published price. ASP (average selling price) is what customers actually paid after discounts, rebates and promos. ASP falling while list stays flat is almost always a discounting story.',
          },
          {
            front: 'Price realization',
            back: 'ASP ÷ list price. 85% realization means the average deal closes 15% off list. Watching it by region and channel catches leakage that a single ASP number hides.',
          },
          {
            front: 'Premium / discount %',
            back: '(Our price − competitor price) ÷ competitor price. +10% means we’re 10% above the comparable product. A premium isn’t bad on its own — it’s only a problem if share or win rates say it’s outrun our value.',
          },
          {
            front: 'Promotional vs. structural',
            back: 'A promo is a temporary street-price drop that should snap back. A structural change is a new permanent price. Responding to a promo with a permanent cut is one of the most expensive mistakes in pricing.',
          },
          {
            front: 'Price / volume / mix',
            back: 'Splits a revenue (or margin) change into three parts: price (we charged more or less per unit), volume (we sold more or fewer units) and mix (we sold more of the expensive or the cheap products). Tells you which problem you actually have.',
          },
          {
            front: 'Elasticity signal',
            back: 'How units respond when price moves. Price up with units stable suggests pricing power; price up with units down sharply suggests elasticity. It’s a signal, not proof — plenty of other things move volume.',
          },
          {
            front: 'Margin compression',
            back: 'Gross margin % falling. It can come from price (we charged less) or cost (inputs got more expensive). The fix is completely different for each, so the engine always splits the two.',
          },
          {
            front: 'Materiality floor',
            back: 'The minimum annualized dollar impact before something becomes an alert. Keeps the brief focused on what’s economically meaningful rather than every statistically noticeable wiggle.',
          },
        ],
      },
    },

    // --------------------------------------------------------------------
    // 2. The engine itself
    // --------------------------------------------------------------------
    {
      id: 'engine',
      navLabel: 'Run the engine',
      type: 'pricing-engine',
      eyebrow: 'Live tool',
      title: 'Pricing Strategy Intelligence Engine',
      lede: 'It opens on a synthetic sample built so every rule fires at least once. Upload your own CSV (download the template for the exact columns) to run it on real data. Everything runs in your browser, so nothing is uploaded anywhere.',
    },

    // --------------------------------------------------------------------
    // 3. How it works
    // --------------------------------------------------------------------
    {
      id: 'how-it-works',
      navLabel: 'How it thinks',
      type: 'walkthrough',
      eyebrow: 'Under the hood',
      title: 'How the engine reads your data',
      lede: 'Same steps an analyst would take by hand, in the same order.',
      content: {
        steps: [
          {
            title: 'One row per product, market and period',
            body: 'Each row is a SKU × region × channel for one period. Only period, sku, asp and units are required. Everything else unlocks more analysis: list_price for discount depth, unit_cost for margin, competitor_price for positioning, competitor_promo to separate promos from structural moves, market_share for share signals. The latest two periods (sorted by label, so use 2026-Q2 / 2026-Q3 or 2026-07 / 2026-08) are compared.',
            snippet: 'period,sku,product,family,region,channel,list_price,asp,units,unit_cost,\ncompetitor,competitor_product,competitor_price,competitor_promo,market_share',
          },
          {
            title: 'Position against the competitor',
            body: 'For every product with a competitor price, it computes our premium or discount now and last period, and flags when the premium widens materially, when the competitor crosses our price, or when we sit well below a comparable product while share holds.',
            snippet: 'Premium % = (Our ASP − Competitor price) / Competitor price',
          },
          {
            title: 'Decompose the change',
            body: 'Revenue and gross margin changes are split into price, volume and mix (plus cost, for margin) across continuing products. New and discontinued products are reported separately so they don’t distort the bridge.',
            snippet: 'Volume = (ΣU₁ − ΣU₀) × avg P₀\nMix    = ΣU₁ × Σ (share₁ − share₀) × P₀\nPrice  = Σ U₁ × (P₁ − P₀)\nCost   = −Σ U₁ × (C₁ − C₀)        (margin bridge only)',
          },
          {
            title: 'Run the flag rules',
            body: 'High priority: competitor structural cut ≥5%, premium up ≥5 pts with share or volume loss, ASP down ≥5% (or deeper discounts with flat units), GM% down ≥3 pts. Watch: new competitor promo, ASP down 2–5%, price up ≥2% with units down ≥8%, emerging regional/channel realization gap. Opportunity: competitor increase ≥3%, price up ≥2% with units stable, priced ≥10% below a competitor with share holding, competitor promo ending.',
          },
          {
            title: 'Size it, then filter for materiality',
            body: 'Each flag gets an annualized dollar estimate with its assumptions spelled out (usually “current volume held flat”). Anything under the materiality floor — 0.1% of annualized revenue unless you set one — is suppressed and listed in a footnote, and the brief caps at ten alerts. Several cuts by the same competitor in one period are merged into a single “strategy change” alert.',
          },
          {
            title: 'Rank explanations by evidence',
            body: 'For every alert it lists 2–4 possible drivers and grades each one strong, moderate, weak or insufficient based on what’s actually in the data. It also says what extra data would separate them. Confidence goes up when independent signals agree (volume and share both falling, say) and down when inputs are missing.',
          },
        ],
      },
    },

    // --------------------------------------------------------------------
    // 4. Questions to ask
    // --------------------------------------------------------------------
    {
      id: 'questions',
      navLabel: 'Questions to ask',
      type: 'cheatsheet',
      eyebrow: 'Analyst mode',
      title: 'Questions the engine can answer',
      lede: 'All of these work in the Analyst mode tab. Type them or click them, and the answer is calculated from the loaded data.',
      content: {
        prompts: [
          { prompt: 'What should the pricing team investigate first?', when: 'Monday morning. The top risk alerts by exposure, each with a first step.' },
          { prompt: 'Where are we losing price?', when: 'Every product line with ASP down, ranked by annualized dollars given up.' },
          { prompt: 'Which products have the biggest competitive pricing risk?', when: 'Where the competitor cut or our premium widened, ranked by revenue at stake.' },
          { prompt: 'Why is margin declining?', when: 'The margin bridge (price, volume, mix, cost) plus the product lines behind it.' },
          { prompt: 'Where are competitors becoming more aggressive?', when: 'Competitor cuts grouped by competitor, with promo vs. structural.' },
          { prompt: 'Which products could potentially support a price increase?', when: 'Before a pricing review. All upside signals, including ones below the floor.' },
          { prompt: 'Are we discounting unnecessarily?', when: 'Deeper discounts that didn’t buy proportional volume.' },
          { prompt: 'Show me products where competitor pricing changed but ours didn’t.', when: 'To catch positioning drift we haven’t reacted to yet, deliberately or not.' },
          { prompt: 'Where has our price premium expanded?', when: 'Read with the share column. A wider premium with stable share is fine.' },
        ],
      },
    },

    // --------------------------------------------------------------------
    // 5. Guardrails
    // --------------------------------------------------------------------
    {
      id: 'guardrails',
      navLabel: 'Guardrails',
      type: 'gotchas',
      eyebrow: 'Read before you act on it',
      title: 'What the engine won’t do, and why',
      lede: 'It’s an early-warning layer, not a pricing decision. These are the traps it’s built to avoid, and the ones you still need to watch for.',
      content: {
        items: [
          {
            title: 'Correlation isn’t causation',
            body: 'A competitor cut and our volume drop in the same quarter is a hypothesis, not a finding. Drivers are graded by evidence, and “insufficient evidence” means exactly that. Validate before you present a driver as the reason.',
          },
          {
            title: 'A premium isn’t automatically a problem',
            body: 'The engine only escalates a widening premium when share or volume is also falling. A premium that holds share is pricing power, and that’s an opportunity.',
          },
          {
            title: 'Don’t answer a promo with a permanent cut',
            body: 'Without a competitor_promo column, temporary and structural moves look identical. The brief says so and lowers confidence. Ask CI for the promo flag before responding to any competitor move.',
          },
          {
            title: 'Exposure figures are scenarios, not forecasts',
            body: 'Most hold current volume flat, which is exactly the thing that changes when you move price. Use them to rank issues and size the conversation, not as a P&L number.',
          },
          {
            title: 'Mix inside a SKU is invisible at this grain',
            body: 'If ASP falls because more volume went to big-deal customers, the engine sees it as price, not mix. That’s why “customer / deal-size mix” always shows up as a driver needing deal-level data.',
          },
          {
            title: 'Garbage in, confident-looking garbage out',
            body: 'Check that periods sort correctly, prices share a currency, and the competitor product really is comparable on spec. The engine checks structure, not meaning.',
          },
        ],
      },
    },
  ],
}
