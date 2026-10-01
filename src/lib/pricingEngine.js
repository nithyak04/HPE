// ============================================================================
// Pricing Strategy Intelligence Engine
// ----------------------------------------------------------------------------
// Deterministic, client-side rules engine. Takes rows of pricing data (one row
// per SKU × region × channel × period), compares the latest period with the
// one before it, and returns a prioritized brief: flags, root-cause hypotheses,
// price/volume/mix decomposition, elasticity signals, competitor moves and
// trends.
//
// Ground rules the code follows:
//   - Nothing is invented. If a column is missing, the analyses that need it
//     are skipped and the gap is reported in `dataGaps`.
//   - Every number in an alert traces back to the input rows. Financial
//     exposure always carries its assumptions.
//   - Output is labeled FACT / SIGNAL / HYPOTHESIS / RECOMMENDATION so the
//     reader knows what was observed vs. inferred.
// ============================================================================

// Tunable thresholds. Percentages are fractions (0.05 = 5%); "Pts" values are
// percentage points.
export const THRESHOLDS = {
  compCut: -0.05, // competitor structural cut that counts as major
  compIncrease: 0.03, // competitor increase that counts as an opportunity
  compMoveNoise: 0.02, // competitor moves smaller than this are ignored
  premiumExpansionPts: 5,
  shareLossPts: -1,
  unitsLoss: -0.05,
  aspDropHigh: -0.05,
  aspDropWatch: -0.02,
  discountJumpPts: 3,
  flatUnits: 0.03,
  priceUp: 0.02,
  elasticUnitsDrop: -0.08,
  stableUnits: -0.02,
  underpriced: -0.1,
  gmDropHighPts: 3,
  gmDropWatchPts: 1.5,
  realizationGapPts: 4,
  realizationWidenPts: 2,
  strategyShiftProducts: 3,
  trendMinProducts: 2,
  maxAlerts: 10,
  defaultMaterialityShare: 0.001, // 0.1% of annualized revenue
}

export const REQUIRED_COLUMNS = ['period', 'sku', 'asp', 'units']

// What each optional column unlocks — used to explain data gaps.
export const OPTIONAL_COLUMNS = {
  product: 'Readable product names',
  family: 'Family-level price/volume/mix and trends',
  region: 'Regional pricing gaps',
  channel: 'Channel pricing gaps',
  list_price: 'Discount depth and price realization',
  unit_cost: 'Gross margin, margin compression and cost-vs-price split',
  competitor: 'Competitor attribution',
  competitor_product: 'Competitor product names and launches',
  competitor_price: 'Price positioning, competitor moves and crossings',
  competitor_promo: 'Separating promotional from structural competitor moves',
  market_share: 'Share loss/gain signals',
}

const HEADER_ALIASES = {
  average_selling_price: 'asp',
  avg_selling_price: 'asp',
  selling_price: 'asp',
  qty: 'units',
  quantity: 'units',
  volume: 'units',
  list: 'list_price',
  msrp: 'list_price',
  cost: 'unit_cost',
  cogs: 'unit_cost',
  unit_cogs: 'unit_cost',
  cogs_per_unit: 'unit_cost',
  product_family: 'family',
  geography: 'region',
  geo: 'region',
  comp_price: 'competitor_price',
  competitor_street_price: 'competitor_price',
  street_price: 'competitor_price',
  comp_promo: 'competitor_promo',
  promo: 'competitor_promo',
  share: 'market_share',
  our_share: 'market_share',
}

// ----------------------------------------------------------------------------
// Parsing
// ----------------------------------------------------------------------------
function normalizeHeader(h) {
  const k = h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return HEADER_ALIASES[k] || k
}

// Minimal RFC 4180 CSV parser: handles quoted fields, escaped quotes and CRLF.
export function parseCsv(text) {
  const records = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((v) => v.trim() !== '')) records.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some((v) => v.trim() !== '')) records.push(row)
  if (!records.length) return []

  const columns = records[0].map(normalizeHeader)
  return records.slice(1).map((r) => Object.fromEntries(columns.map((c, i) => [c, (r[i] ?? '').trim()])))
}

function num(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = Number(String(v).replace(/[$,%\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

function bool(v) {
  if (v == null || v === '') return null
  if (typeof v === 'boolean') return v
  return /^(y|yes|true|1)$/i.test(String(v).trim())
}

function str(v) {
  return v == null ? '' : String(v).trim()
}

function normalizeRows(rawRows) {
  const keys = new Set()
  rawRows.forEach((r) => Object.keys(r).forEach((k) => keys.add(normalizeHeader(k))))

  const records = []
  let skipped = 0
  for (const raw of rawRows) {
    const r = {}
    Object.entries(raw).forEach(([k, v]) => (r[normalizeHeader(k)] = v))
    const rec = {
      period: str(r.period),
      sku: str(r.sku),
      product: str(r.product),
      family: str(r.family),
      region: str(r.region),
      channel: str(r.channel),
      listPrice: num(r.list_price),
      asp: num(r.asp),
      units: num(r.units),
      unitCost: num(r.unit_cost),
      competitor: str(r.competitor),
      competitorProduct: str(r.competitor_product),
      compPrice: num(r.competitor_price),
      compPromo: bool(r.competitor_promo),
      share: num(r.market_share),
    }
    if (!rec.period || !rec.sku || rec.asp == null || rec.units == null || rec.asp <= 0 || rec.units < 0) {
      skipped++
      continue
    }
    records.push(rec)
  }

  // Market share can arrive as 0.23 or 23 — if every value is <= 1, treat as
  // fractions and convert to percentage points.
  const shares = records.map((r) => r.share).filter((s) => s != null)
  if (shares.length && Math.max(...shares) <= 1) records.forEach((r) => r.share != null && (r.share *= 100))

  const present = Object.fromEntries(
    Object.keys(OPTIONAL_COLUMNS).map((c) => [c, keys.has(c) && rawRows.some((r) => hasValue(r, c))])
  )
  const missingRequired = REQUIRED_COLUMNS.filter((c) => !keys.has(c))
  return { records, skipped, present, missingRequired }
}

function hasValue(raw, col) {
  return Object.entries(raw).some(([k, v]) => normalizeHeader(k) === col && v !== '' && v != null)
}

// ----------------------------------------------------------------------------
// Aggregation & per-product metrics
// ----------------------------------------------------------------------------
const keyOf = (r) => [r.sku, r.region || '—', r.channel || '—'].join('|')

// Collapse duplicate rows for the same key/period: units add up, prices are
// unit-weighted, descriptive/competitor fields take the first non-empty value.
function aggregate(records) {
  const map = new Map()
  for (const r of records) {
    const k = keyOf(r)
    const a = map.get(k)
    if (!a) {
      map.set(k, { ...r, _w: { list: 0, cost: 0, listU: 0, costU: 0 } })
      const m = map.get(k)
      if (r.listPrice != null) (m._w.list += r.listPrice * r.units), (m._w.listU += r.units)
      if (r.unitCost != null) (m._w.cost += r.unitCost * r.units), (m._w.costU += r.units)
      continue
    }
    const rev = a.asp * a.units + r.asp * r.units
    a.units += r.units
    a.asp = a.units ? rev / a.units : a.asp
    if (r.listPrice != null) (a._w.list += r.listPrice * r.units), (a._w.listU += r.units)
    if (r.unitCost != null) (a._w.cost += r.unitCost * r.units), (a._w.costU += r.units)
    for (const f of ['product', 'family', 'competitor', 'competitorProduct']) a[f] = a[f] || r[f]
    if (a.compPrice == null) a.compPrice = r.compPrice
    if (a.compPromo == null) a.compPromo = r.compPromo
    if (a.share == null) a.share = r.share
  }
  for (const a of map.values()) {
    if (a._w.listU) a.listPrice = a._w.list / a._w.listU
    if (a._w.costU) a.unitCost = a._w.cost / a._w.costU
    delete a._w
  }
  return map
}

function snapshot(a) {
  if (!a) return null
  const rev = a.asp * a.units
  const gm = a.unitCost != null ? (a.asp - a.unitCost) * a.units : null
  return {
    ...a,
    rev,
    gm,
    gmPct: gm != null && rev ? gm / rev : null,
    disc: a.listPrice ? 1 - a.asp / a.listPrice : null,
    premium: a.compPrice ? a.asp / a.compPrice - 1 : null,
  }
}

const chg = (a, b) => (a != null && b != null && a !== 0 ? b / a - 1 : null)
const pts = (a, b) => (a != null && b != null ? (b - a) * 100 : null)

function buildItem(key, prior, current, annual) {
  const p = snapshot(prior)
  const c = snapshot(current)
  const ref = c || p
  return {
    key,
    sku: ref.sku,
    product: ref.product || ref.sku,
    family: ref.family || '—',
    region: ref.region || '—',
    channel: ref.channel || '—',
    label: [ref.sku, ref.region, ref.channel].filter(Boolean).join(' · '),
    competitor: c?.competitor || p?.competitor || '',
    competitorProduct: c?.competitorProduct || p?.competitorProduct || '',
    p,
    c,
    status: p && c ? 'matched' : c ? 'new' : 'discontinued',
    aspChg: chg(p?.asp, c?.asp),
    listChg: chg(p?.listPrice, c?.listPrice),
    unitsChg: chg(p?.units, c?.units),
    costChg: chg(p?.unitCost, c?.unitCost),
    compChg: chg(p?.compPrice, c?.compPrice),
    revChg: chg(p?.rev, c?.rev),
    discChgPts: pts(p?.disc, c?.disc),
    gmChgPts: pts(p?.gmPct, c?.gmPct),
    premChgPts: pts(p?.premium, c?.premium),
    shareChgPts: p?.share != null && c?.share != null ? c.share - p.share : null,
    annRev: c ? c.rev * annual : 0,
  }
}

// ----------------------------------------------------------------------------
// Formatting (exported so the UI formats numbers the same way)
// ----------------------------------------------------------------------------
export function money(n, { compact = true } = {}) {
  if (n == null || !Number.isFinite(n)) return '—'
  const sign = n < 0 ? '−' : ''
  const a = Math.abs(n)
  if (!compact) return `${sign}$${Math.round(a).toLocaleString('en-US')}`
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}K`
  return `${sign}$${Math.round(a)}`
}

export function pct(n, { signed = true, digits = 1 } = {}) {
  if (n == null || !Number.isFinite(n)) return '—'
  const v = (n * 100).toFixed(digits)
  return `${signed && n > 0 ? '+' : ''}${v.replace('-', '−')}%`
}

export function ptsFmt(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n > 0 ? '+' : ''}${n.toFixed(1).replace('-', '−')} pts`
}

const price = (n) => money(n, { compact: false })

// ----------------------------------------------------------------------------
// Root-cause helpers
// ----------------------------------------------------------------------------
const STRENGTH_RANK = { strong: 3, moderate: 2, weak: 1, insufficient: 0 }
export const STRENGTH_LABEL = {
  strong: 'Strong evidence',
  moderate: 'Moderate evidence',
  weak: 'Weak evidence',
  insufficient: 'Insufficient evidence',
}

function rankDrivers(drivers) {
  return drivers
    .filter(Boolean)
    .sort((a, b) => STRENGTH_RANK[b.strength] - STRENGTH_RANK[a.strength])
    .slice(0, 4)
}

function confidenceFrom(corroborating, missingInputs) {
  if (missingInputs) return 'Low'
  if (corroborating >= 2) return 'High'
  if (corroborating === 1) return 'Medium'
  return 'Low'
}

function competitiveContext(it) {
  if (!it.c || it.c.compPrice == null) return 'No competitor price on file for this product, so positioning can’t be assessed.'
  const who = [it.competitor, it.competitorProduct].filter(Boolean).join(' ') || 'Comparable competitor'
  const move = it.compChg != null ? ` (${pct(it.compChg)} vs prior${it.c.compPromo ? ', on promotion' : ''})` : ''
  const pos = it.c.premium >= 0 ? 'premium' : 'discount'
  const prior = it.p?.premium != null ? `, was ${pct(it.p.premium)}` : ''
  return `${who} at ${price(it.c.compPrice)}${move}. Our ASP sits at a ${pct(Math.abs(it.c.premium), { signed: false })} ${pos} to it (${pct(it.c.premium)}${prior}).`
}

function crossedPrice(it) {
  return it.p?.premium != null && it.c?.premium != null && Math.sign(it.p.premium) !== Math.sign(it.c.premium) && it.c.premium !== 0
}

// ----------------------------------------------------------------------------
// Per-product rules
// ----------------------------------------------------------------------------
// Each rule claims one category (competitor / price / volume / margin) per
// product, so a single product can't flood the brief with near-duplicates.
function productFlags(it, ctx) {
  const T = THRESHOLDS
  const out = []
  const used = new Set()
  const { p, c } = it
  const add = (category, flag) => {
    if (used.has(category)) return
    used.add(category)
    out.push({ category, items: [it], context: competitiveContext(it), ...flag })
  }
  const unitsTxt = it.unitsChg != null ? `Units ${pct(it.unitsChg)} (${Math.round(p.units).toLocaleString()} → ${Math.round(c.units).toLocaleString()}).` : null
  const shareTxt = it.shareChgPts != null ? `Market share ${ptsFmt(it.shareChgPts)} (${p.share.toFixed(1)}% → ${c.share.toFixed(1)}%).` : null
  const crossTxt = crossedPrice(it)
    ? `Price crossover: we were ${p.premium > 0 ? 'above' : 'below'} the competitor, now ${c.premium > 0 ? 'above' : 'below'}.`
    : null
  const compStructural = it.compChg != null && c.compPromo !== true
  const compCutsByCompetitor = ctx.compCutsByCompetitor[it.competitor] || 0

  // --- Competitor structural price cut --------------------------------------
  if (compStructural && it.compChg <= T.compCut) {
    const lostVolume = it.unitsChg != null && it.unitsChg <= T.unitsLoss
    const lostShare = it.shareChgPts != null && it.shareChgPts <= T.shareLossPts
    add('competitor', {
      severity: 'high',
      type: 'competitor-cut',
      title: `${it.competitor || 'Competitor'} cut price ${pct(Math.abs(it.compChg), { signed: false })}`,
      what: [
        `${it.competitor || 'Competitor'} ${it.competitorProduct} moved ${price(p.compPrice)} → ${price(c.compPrice)} (${pct(it.compChg)}), not flagged as a promotion.`,
        `Our ASP ${pct(it.aspChg)} (${price(p.asp)} → ${price(c.asp)}); premium ${pct(p.premium)} → ${pct(c.premium)} (${ptsFmt(it.premChgPts)}).`,
        unitsTxt,
        shareTxt,
        crossTxt,
      ].filter(Boolean),
      why:
        lostVolume || lostShare
          ? 'Our relative price jumped and volume/share is already slipping — the classic early read of a structural competitive move.'
          : it.unitsChg != null && it.unitsChg >= T.flatUnits
            ? `Our units are still growing (${pct(it.unitsChg)})${it.aspChg <= -0.01 ? ` after we gave up ${pct(Math.abs(it.aspChg), { signed: false })} of ASP` : ''}, so there’s no volume evidence yet that we need to follow the cut.`
            : 'Our relative price jumped. Volume hasn’t moved materially yet, which buys time to decide whether to respond.',
      exposure: {
        amount: Math.abs(it.compChg) * it.annRev,
        basis: `Revenue at stake if we matched the ${pct(Math.abs(it.compChg), { signed: false })} cut at current volume`,
        assumptions: ['Current-period units held flat', `Annualized at ×${ctx.annual}`, 'Ignores any volume regained by matching'],
      },
      drivers: rankDrivers([
        {
          text: `Broad repricing by ${it.competitor || 'the competitor'}, not an isolated move`,
          strength: compCutsByCompetitor >= T.strategyShiftProducts ? 'strong' : compCutsByCompetitor === 2 ? 'moderate' : 'weak',
        },
        {
          text: 'Our volume is already responding to the wider price gap',
          strength: lostVolume && lostShare ? 'strong' : lostVolume || lostShare ? 'moderate' : 'weak',
        },
        {
          text: 'Move is actually a short-term promotion recorded as list/street change',
          strength: ctx.present.competitor_promo ? 'weak' : 'moderate',
        },
        { text: 'Competitor input-cost relief or inventory clearance ahead of a launch', strength: 'insufficient' },
      ]),
      distinguish:
        'A second period of competitor pricing (does the cut hold?), deal-level win/loss vs. this competitor, and any announced launch in this segment.',
      action: `Confirm next period whether the cut holds; model margin impact of matching 0%, 50% and 100% of it on ${it.label} before responding.`,
      // Confidence that this is a real structural move: promo flag present
      // to rule out a promotion, plus corroborating volume/share/breadth.
      confidence: confidenceFrom(
        (ctx.present.competitor_promo ? 1 : 0) + (lostVolume ? 1 : 0) + (lostShare ? 1 : 0) + (compCutsByCompetitor >= 2 ? 1 : 0),
        false
      ),
    })
  }

  // --- Premium expansion with share loss (we moved, or comp moved less) ----
  if (
    it.premChgPts != null &&
    it.premChgPts >= T.premiumExpansionPts &&
    ((it.shareChgPts != null && it.shareChgPts <= T.shareLossPts) || (it.unitsChg != null && it.unitsChg <= T.unitsLoss))
  ) {
    const lostRev = it.unitsChg < 0 ? (p.units - c.units) * c.asp * ctx.annual : 0
    add('competitor', {
      severity: 'high',
      type: 'premium-expansion',
      title: `Premium widened ${ptsFmt(it.premChgPts)} with share loss`,
      what: [`Premium vs ${it.competitor || 'competitor'} ${pct(p.premium)} → ${pct(c.premium)}.`, `Our ASP ${pct(it.aspChg)}; competitor ${pct(it.compChg)}.`, unitsTxt, shareTxt].filter(Boolean),
      why: 'A wider premium alongside falling share suggests the premium has outrun perceived value in this market.',
      exposure: {
        amount: lostRev,
        basis: 'Annualized revenue from units lost vs prior period, at current ASP',
        assumptions: [`Annualized at ×${ctx.annual}`, 'Treats the full unit decline as price-related, which is an upper bound'],
      },
      drivers: rankDrivers([
        { text: 'Our price increase outpaced the market', strength: it.aspChg >= T.priceUp ? 'strong' : 'weak' },
        { text: 'Competitor held or cut price', strength: it.compChg != null && it.compChg <= 0 ? 'moderate' : 'weak' },
        { text: 'Category demand softening', strength: 'insufficient' },
      ]),
      distinguish: 'Category unit growth for the same period and win/loss reasons tagged to price.',
      action: `Compare volume before/after our last price change on ${it.label}; evaluate trimming the premium by half the expansion.`,
      confidence: confidenceFrom(it.shareChgPts != null && it.unitsChg != null ? 2 : 1, false),
    })
  }

  // --- New competitor promotion --------------------------------------------
  if (c.compPromo === true && p.compPromo !== true && it.compChg != null && it.compChg <= -T.compMoveNoise) {
    add('competitor', {
      severity: 'watch',
      type: 'competitor-promo',
      title: `New ${it.competitor || 'competitor'} promotion (${pct(it.compChg)})`,
      what: [
        `${it.competitor} ${it.competitorProduct} observed at ${price(c.compPrice)} on promotion, from ${price(p.compPrice)}.`,
        `Our premium ${pct(p.premium)} → ${pct(c.premium)}.`,
        unitsTxt,
        crossTxt,
      ].filter(Boolean),
      why: 'Flagged as promotional, so likely temporary. Matching a promo with a permanent price change is the expensive mistake here.',
      exposure: {
        amount: Math.abs(it.compChg) * it.annRev,
        basis: 'Revenue at stake if we matched the promo depth for a full year at current volume',
        assumptions: ['Upper bound — promos are usually time-boxed', `Annualized at ×${ctx.annual}`],
      },
      drivers: rankDrivers([
        { text: 'Quarter-end / inventory-driven promotion', strength: 'moderate' },
        { text: 'Testing a lower price point before a structural cut', strength: compCutsByCompetitor >= 2 ? 'moderate' : 'weak' },
        { text: 'Our volume losing to the promo', strength: it.unitsChg != null && it.unitsChg <= -0.03 ? 'moderate' : 'weak' },
      ]),
      distinguish: 'Promo end date and whether street price returns to list next period.',
      action: 'Track weekly street price until the promo ends; hold list price and use targeted deal support only if win rates drop.',
      confidence: confidenceFrom(1, false),
    })
  }

  // --- Competitor crosses our price point -----------------------------------
  if (crossedPrice(it) && it.compChg != null && Math.abs(it.compChg) >= T.compMoveNoise) {
    const nowAbove = c.premium > 0
    add('competitor', {
      severity: nowAbove ? 'watch' : 'opportunity',
      type: 'crossover',
      title: nowAbove ? 'Competitor now priced below us' : 'Competitor now priced above us',
      what: [`Premium ${pct(p.premium)} → ${pct(c.premium)}.`, `Competitor ${pct(it.compChg)}; our ASP ${pct(it.aspChg)}.`, unitsTxt].filter(Boolean),
      why: nowAbove ? 'Losing a price-parity or value position changes how buyers frame the comparison.' : 'We’re now the value option — room to recover price without losing the position.',
      exposure: {
        amount: Math.abs(c.premium) * it.annRev,
        basis: nowAbove ? 'Revenue at stake to return to parity at current volume' : 'Revenue from returning to parity at current volume',
        assumptions: ['Current units held flat', `Annualized at ×${ctx.annual}`],
      },
      drivers: rankDrivers([{ text: 'Competitor price move', strength: 'strong' }, { text: 'Our own ASP drift', strength: Math.abs(it.aspChg ?? 0) >= 0.02 ? 'moderate' : 'weak' }]),
      distinguish: 'Whether the competitor move is promotional or structural.',
      action: `Review positioning for ${it.label} against the product’s intended price tier before reacting.`,
      confidence: 'Medium',
    })
  }

  // --- Competitor promotion expired ----------------------------------------
  if (p.compPromo === true && c.compPromo === false && it.compChg != null && it.compChg > T.compMoveNoise) {
    add('competitor', {
      severity: 'opportunity',
      type: 'promo-expired',
      title: `${it.competitor || 'Competitor'} promotion ended (${pct(it.compChg)})`,
      what: [`${it.competitor} back to ${price(c.compPrice)} from promotional ${price(p.compPrice)}.`, `Our premium ${pct(p.premium)} → ${pct(c.premium)}.`],
      why: 'Price pressure from the promo is off. If we discounted to defend, that support can come back out.',
      exposure: {
        amount: 0.02 * it.annRev,
        basis: 'A 2% ASP recovery at current volume',
        assumptions: ['Illustrative 2% — size to the discount actually given during the promo', `Annualized at ×${ctx.annual}`],
      },
      drivers: rankDrivers([{ text: 'Time-boxed promotion ending', strength: 'strong' }]),
      distinguish: 'Our deal-level discounts during the promo window.',
      action: `Pull discounts granted on ${it.label} during the promo window and unwind any defensive deal support.`,
      confidence: 'Medium',
    })
  }

  // --- Competitor structural price increase --------------------------------
  if (compStructural && it.compChg >= T.compIncrease) {
    add('competitor', {
      severity: 'opportunity',
      type: 'competitor-increase',
      title: `${it.competitor || 'Competitor'} raised price ${pct(it.compChg)}`,
      what: [
        `${it.competitor} ${it.competitorProduct} ${price(p.compPrice)} → ${price(c.compPrice)}, not promotional.`,
        `Our premium moved ${pct(p.premium)} → ${pct(c.premium)} without us changing price.`,
        unitsTxt,
      ].filter(Boolean),
      why: 'The market just moved up around us. Our relative position improved for free.',
      exposure: {
        amount: (it.compChg / 2) * it.annRev,
        basis: `Following half of the competitor’s increase (${pct(it.compChg / 2)}) at current volume`,
        assumptions: ['Current units held flat', `Annualized at ×${ctx.annual}`],
      },
      drivers: rankDrivers([
        { text: 'Competitor passing through input-cost inflation', strength: 'insufficient' },
        { text: 'Competitor repositioning upmarket', strength: 'weak' },
      ]),
      distinguish: 'Commodity / component cost trend for this category and whether other competitors followed.',
      action: `Evaluate a 2–3% increase on ${it.label}; check whether other competitors in the segment moved too.`,
      confidence: confidenceFrom(it.unitsChg != null && it.unitsChg >= T.stableUnits ? 2 : 1, false),
    })
  }

  // --- ASP deterioration / unexplained discounting --------------------------
  if (it.aspChg != null && it.aspChg <= T.aspDropWatch) {
    const listFlat = it.listChg != null && Math.abs(it.listChg) < 0.01
    const deepDisc = it.discChgPts != null && it.discChgPts >= T.discountJumpPts
    const unitsFlat = it.unitsChg != null && Math.abs(it.unitsChg) < T.flatUnits
    const incremental = it.unitsChg != null && it.unitsChg >= Math.abs(it.aspChg) * 1.5 && it.revChg > 0
    let severity = it.aspChg <= T.aspDropHigh || (deepDisc && unitsFlat) ? 'high' : 'watch'
    if (incremental) severity = 'watch'
    const why = incremental
      ? `Units ${pct(it.unitsChg)} and revenue ${pct(it.revChg)} — the lower price may be buying incremental demand. Worth confirming that before treating it as leakage.`
      : unitsFlat
        ? 'Price ↓ with units flat: discount isn’t buying volume — this reads as margin leakage.'
        : 'ASP is eroding faster than normal noise for this product.'
    add('price', {
      severity,
      type: 'asp-decline',
      title: deepDisc && listFlat ? `ASP ${pct(it.aspChg)} on deeper discounting` : `ASP ${pct(it.aspChg)}`,
      what: [
        `ASP ${price(p.asp)} → ${price(c.asp)} (${pct(it.aspChg)}).`,
        it.listChg != null ? `List price ${pct(it.listChg)}; discount off list ${pct(p.disc, { signed: false })} → ${pct(c.disc, { signed: false })} (${ptsFmt(it.discChgPts)}).` : null,
        unitsTxt,
        ...(ctx.gapNotes[it.key] || []),
      ].filter(Boolean),
      why,
      exposure: {
        amount: (p.asp - c.asp) * c.units * ctx.annual,
        basis: 'Annualized revenue given up vs prior-period ASP at current volume',
        assumptions: [
          `Annualized at ×${ctx.annual}`,
          `Another 2% decline at current volume would cost a further ${money(0.02 * it.annRev)}`,
        ],
      },
      drivers: rankDrivers([
        it.discChgPts != null && {
          text: `Deeper discounting (${ptsFmt(it.discChgPts)} off list)`,
          strength: listFlat && deepDisc ? 'strong' : it.discChgPts > 0.5 ? 'moderate' : 'weak',
        },
        it.listChg != null && it.listChg <= -0.03 && { text: `List price cut (${pct(it.listChg)})`, strength: 'strong' },
        it.compChg != null && {
          text: `Competitor price move (${pct(it.compChg)}${c.compPromo ? ', promo' : ''})`,
          strength: it.compChg <= T.compCut ? 'strong' : it.compChg <= -T.compMoveNoise ? 'moderate' : 'weak',
        },
        {
          text: 'Demand deterioration forcing price',
          strength: it.unitsChg != null && it.unitsChg <= T.unitsLoss && (it.compChg == null || it.compChg > -T.compMoveNoise) ? 'moderate' : 'insufficient',
        },
        { text: 'Customer / deal-size mix shift within this SKU', strength: 'insufficient' },
      ]),
      distinguish: 'Deal-level data (customer segment, deal size, approver) to separate discount depth from customer mix within the SKU.',
      action: deepDisc
        ? `Review discount approvals on ${it.label} by customer segment and deal size; check whether the extra ${ptsFmt(it.discChgPts)} is concentrated in a few deals.`
        : `Review channel-level and deal-level ASP for ${it.label} to see where the decline is concentrated.`,
      confidence: confidenceFrom((deepDisc ? 1 : 0) + (listFlat ? 1 : 0) + (it.compChg != null && it.compChg <= -T.compMoveNoise ? 1 : 0), it.listChg == null),
    })
  }

  // --- Price ↑ + units ↓ materially (elasticity concern) --------------------
  if (it.aspChg != null && it.aspChg >= T.priceUp && it.unitsChg != null && it.unitsChg <= T.elasticUnitsDrop) {
    const netRev = (c.rev - p.rev) * ctx.annual
    add('price', {
      severity: 'watch',
      type: 'elasticity-concern',
      title: `Price ${pct(it.aspChg)}, units ${pct(it.unitsChg)}`,
      what: [`ASP ${price(p.asp)} → ${price(c.asp)}; list ${pct(it.listChg)}.`, unitsTxt, shareTxt, `Revenue ${pct(it.revChg)}.`].filter(Boolean),
      why: `Early elasticity signal: units fell ${(Math.abs(it.unitsChg) / it.aspChg).toFixed(1)}× as fast as price rose. A signal, not proof — other factors may be moving volume.`,
      exposure: {
        amount: Math.max(0, -netRev),
        basis: netRev < 0 ? 'Annualized net revenue decline after the increase' : 'Revenue still up — no net exposure yet',
        assumptions: [`Annualized at ×${ctx.annual}`],
      },
      drivers: rankDrivers([
        { text: 'Customers responding to our price increase', strength: it.compChg != null && Math.abs(it.compChg) < T.compMoveNoise ? 'moderate' : 'weak' },
        { text: 'Share loss to competitor', strength: it.shareChgPts != null && it.shareChgPts <= T.shareLossPts ? 'moderate' : 'insufficient' },
        { text: 'Category demand down independently of price', strength: 'insufficient' },
      ]),
      distinguish: 'Category unit trend for the same period, and volume before/after the exact date of the increase.',
      action: `Run a before/after price-elasticity read on ${it.label} using weekly units around the increase date.`,
      confidence: confidenceFrom(it.shareChgPts != null ? 1 : 0, false),
    })
  }

  // --- Price ↑ + units stable (pricing power) --------------------------------
  if (it.aspChg != null && it.aspChg >= T.priceUp && it.unitsChg != null && it.unitsChg >= T.stableUnits) {
    add('price', {
      severity: 'opportunity',
      type: 'pricing-power',
      title: `Held volume through a ${pct(it.aspChg)} price increase`,
      what: [`ASP ${price(p.asp)} → ${price(c.asp)}.`, unitsTxt, shareTxt].filter(Boolean),
      why: 'Price ↑ with units stable is a pricing-power signal for this product/market.',
      exposure: {
        amount: 0.02 * it.annRev,
        basis: 'A further 2% increase at current volume',
        assumptions: ['Units held flat — the thing to test, not assume', `Annualized at ×${ctx.annual}`],
      },
      drivers: rankDrivers([
        { text: 'Low price sensitivity in this segment', strength: 'moderate' },
        { text: 'Competitor priced well above us, leaving room', strength: c.premium != null && c.premium < 0 ? 'moderate' : 'weak' },
      ]),
      distinguish: 'Whether the increase was list-driven or discount tightening, and how long it has held.',
      action: `Evaluate a further 2–3% increase scenario on ${it.label}; confirm win rates held through the last increase.`,
      confidence: confidenceFrom(it.shareChgPts != null && it.shareChgPts >= 0 ? 2 : 1, false),
    })
  }

  // --- Priced materially below comparable alternative ----------------------
  if (c.premium != null && c.premium <= T.underpriced && ((it.shareChgPts ?? -1) >= 0 || (it.unitsChg ?? -1) >= 0)) {
    const halfGap = (c.compPrice - c.asp) / 2
    add('price', {
      severity: 'opportunity',
      type: 'underpriced',
      title: `Priced ${pct(Math.abs(c.premium), { signed: false })} below ${it.competitor || 'competitor'} with share holding`,
      what: [`Our ASP ${price(c.asp)} vs ${it.competitor} ${price(c.compPrice)} (${pct(c.premium)}).`, unitsTxt, shareTxt].filter(Boolean),
      why: 'A deep discount to the comparable product while share is stable or growing suggests price may be left on the table.',
      exposure: {
        amount: halfGap * c.units * ctx.annual,
        basis: `Closing half the gap (+${price(halfGap)}/unit) at current volume`,
        assumptions: ['Units held flat', `Annualized at ×${ctx.annual}`, 'Assumes products are genuinely comparable on spec'],
      },
      drivers: rankDrivers([
        { text: 'Legacy price point never revisited', strength: 'moderate' },
        { text: 'Spec / positioning gap justifies the discount', strength: 'insufficient' },
      ]),
      distinguish: 'Spec-for-spec comparison and whether the discount is intentional positioning.',
      action: `Confirm spec comparability with ${it.competitorProduct || 'the competitor product'}; if comparable, evaluate a staged 3–5% increase on ${it.label}.`,
      confidence: confidenceFrom(it.shareChgPts != null && it.shareChgPts > 0 ? 2 : 1, false),
    })
  }

  // --- Margin compression ----------------------------------------------------
  if (it.gmChgPts != null && it.gmChgPts <= -T.gmDropWatchPts) {
    const dAsp = c.asp - p.asp
    const dCost = c.unitCost - p.unitCost
    const denom = dCost - dAsp // drop in unit margin
    const costShare = denom > 0 ? Math.max(0, Math.min(1, dCost / denom)) : 0
    // If price already explains it and a price flag fired, don't double-count.
    if (!(used.has('price') && costShare < 0.4)) {
      add('margin', {
        severity: it.gmChgPts <= -T.gmDropHighPts ? 'high' : 'watch',
        type: 'margin-compression',
        title: `Gross margin ${ptsFmt(it.gmChgPts)} — ${costShare >= 0.6 ? 'cost-driven' : costShare <= 0.4 ? 'price-driven' : 'price and cost'}`,
        what: [
          `GM% ${pct(p.gmPct, { signed: false })} → ${pct(c.gmPct, { signed: false })}.`,
          `Unit cost ${price(p.unitCost)} → ${price(c.unitCost)} (${pct(it.costChg)}); ASP ${pct(it.aspChg)}.`,
          `${Math.round(costShare * 100)}% of the unit-margin decline comes from cost, ${Math.round((1 - costShare) * 100)}% from price.`,
        ],
        why: costShare >= 0.6 ? 'This is a cost problem, not a price problem — cutting or holding price won’t fix it.' : 'Price realization is driving the margin decline.',
        exposure: {
          amount: (Math.abs(it.gmChgPts) / 100) * it.annRev,
          basis: 'Annualized gross-margin dollars lost if current GM% persists',
          assumptions: ['Current revenue run-rate', `Annualized at ×${ctx.annual}`],
        },
        drivers: rankDrivers([
          { text: `Input / component cost increase (${pct(it.costChg)})`, strength: costShare >= 0.6 ? 'strong' : costShare >= 0.3 ? 'moderate' : 'weak' },
          { text: `Lower price realization (${pct(it.aspChg)})`, strength: costShare <= 0.4 ? 'strong' : 'weak' },
          { text: 'Supply constraint / expedite costs', strength: 'insufficient' },
        ]),
        distinguish: 'Component cost bridge from supply-chain finance and whether the cost increase is contracted or spot.',
        action:
          costShare >= 0.6
            ? `Get the cost bridge for ${it.label}; size a cost-recovery price increase and check competitor headroom (${c.premium != null ? `currently ${pct(c.premium)} vs comp` : 'no comp price on file'}).`
            : `Review discounting on ${it.label} before touching list price.`,
        confidence: confidenceFrom(2, false),
      })
    }
  }

  return out
}

// ----------------------------------------------------------------------------
// Cross-product analyses
// ----------------------------------------------------------------------------

// Standard price / volume / mix bridge across matched products.
//   Volume = (ΣU1 − ΣU0) × avg P0
//   Mix    = ΣU1 × Σ (s1 − s0) × P0
//   Price  = Σ U1 × (P1 − P0)
// Margin bridge uses unit margin instead of price, plus a cost effect:
//   Cost   = −Σ U1 × (C1 − C0)
function pvm(items, annual) {
  const m = items.filter((it) => it.status === 'matched')
  const U0 = m.reduce((s, it) => s + it.p.units, 0)
  const U1 = m.reduce((s, it) => s + it.c.units, 0)
  const R0 = m.reduce((s, it) => s + it.p.rev, 0)
  const R1 = m.reduce((s, it) => s + it.c.rev, 0)
  if (!U0 || !U1) return null

  const share = (it, per) => it[per].units / (per === 'p' ? U0 : U1)
  const revenue = {
    prior: R0,
    current: R1,
    total: R1 - R0,
    volume: (U1 - U0) * (R0 / U0),
    mix: U1 * m.reduce((s, it) => s + (share(it, 'c') - share(it, 'p')) * it.p.asp, 0),
    price: m.reduce((s, it) => s + it.c.units * (it.c.asp - it.p.asp), 0),
  }

  let margin = null
  if (m.every((it) => it.p.unitCost != null && it.c.unitCost != null)) {
    const GM0 = m.reduce((s, it) => s + it.p.gm, 0)
    const GM1 = m.reduce((s, it) => s + it.c.gm, 0)
    const um0 = (it) => it.p.asp - it.p.unitCost
    margin = {
      prior: GM0,
      current: GM1,
      total: GM1 - GM0,
      volume: (U1 - U0) * (GM0 / U0),
      mix: U1 * m.reduce((s, it) => s + (share(it, 'c') - share(it, 'p')) * um0(it), 0),
      price: revenue.price,
      cost: -m.reduce((s, it) => s + it.c.units * (it.c.unitCost - it.p.unitCost), 0),
    }
  }

  const byFamily = [...new Set(m.map((it) => it.family))].map((family) => {
    const fm = m.filter((it) => it.family === family)
    const f0 = fm.reduce((s, it) => s + it.p.units, 0)
    const f1 = fm.reduce((s, it) => s + it.c.units, 0)
    const r0 = fm.reduce((s, it) => s + it.p.rev, 0)
    const r1 = fm.reduce((s, it) => s + it.c.rev, 0)
    return {
      family,
      prior: r0,
      current: r1,
      total: r1 - r0,
      volume: (f1 - f0) * (r0 / f0),
      mix: f1 * fm.reduce((s, it) => s + (it.c.units / f1 - it.p.units / f0) * it.p.asp, 0),
      price: fm.reduce((s, it) => s + it.c.units * (it.c.asp - it.p.asp), 0),
    }
  })

  const outside = items.filter((it) => it.status !== 'matched')
  return { revenue, margin, byFamily, annual, outside }
}

function largestDriver(bridge, keys) {
  return keys.map((k) => [k, bridge[k]]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]
}

function elasticitySignals(items) {
  return items
    .filter((it) => it.aspChg != null && it.unitsChg != null && Math.abs(it.aspChg) >= 0.01)
    .map((it) => {
      let signal
      if (it.aspChg > 0) signal = it.unitsChg >= THRESHOLDS.stableUnits ? 'Possible pricing power' : it.unitsChg <= THRESHOLDS.elasticUnitsDrop ? 'Possible elasticity concern' : 'Mild volume response'
      else signal = it.unitsChg >= Math.abs(it.aspChg) * 1.5 ? 'Lower price may be driving incremental demand' : Math.abs(it.unitsChg) < THRESHOLDS.flatUnits ? 'Potential margin leakage' : it.unitsChg < 0 ? 'Price and volume both down' : 'Modest volume response'
      return { label: it.label, aspChg: it.aspChg, unitsChg: it.unitsChg, signal }
    })
}

function competitorMoves(items, present) {
  const moves = []
  for (const it of items) {
    if (it.status !== 'matched') {
      if (it.status === 'new' && it.competitorProduct) moves.push({ competitor: it.competitor, product: it.competitorProduct, against: it.label, change: null, kind: 'Newly tracked (our new SKU)' })
      continue
    }
    const { p, c } = it
    if (!p.competitorProduct && c.competitorProduct) moves.push({ competitor: c.competitor, product: c.competitorProduct, against: it.label, change: null, kind: 'Launch / newly observed' })
    if (p.competitorProduct && !c.competitorProduct) moves.push({ competitor: p.competitor, product: p.competitorProduct, against: it.label, change: null, kind: 'No longer observed — possible exit' })
    if (it.compChg == null || Math.abs(it.compChg) < THRESHOLDS.compMoveNoise) continue
    let kind
    if (c.compPromo === true) kind = 'Promotional'
    else if (p.compPromo === true) kind = 'Promotion ended'
    else if (present.competitor_promo) kind = it.compChg < 0 ? 'Structural cut' : 'Structural increase'
    else kind = it.compChg < 0 ? 'Cut (promo status unknown)' : 'Increase (promo status unknown)'
    moves.push({ competitor: it.competitor || 'Unnamed', product: it.competitorProduct, against: it.label, change: it.compChg, kind })
  }
  return moves.sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0))
}

function strategyShifts(moves) {
  const byComp = {}
  for (const m of moves) {
    if (m.change == null || m.kind === 'Promotional' || m.kind === 'Promotion ended') continue
    const dir = m.change < 0 ? 'down' : 'up'
    const k = `${m.competitor}|${dir}`
    ;(byComp[k] ||= { competitor: m.competitor, dir, moves: [] }).moves.push(m)
  }
  return Object.values(byComp).filter((g) => g.moves.length >= THRESHOLDS.strategyShiftProducts)
}

// Price-realization gaps for the same SKU across regions (same channel) and
// across channels (same region). Falls back to raw ASP spread without list.
function pricingGaps(items) {
  const T = THRESHOLDS
  const gaps = []
  const scan = (dim, other) => {
    const groups = {}
    for (const it of items.filter((x) => x.status === 'matched')) (groups[`${it.sku}|${it[other]}`] ||= []).push(it)
    for (const g of Object.values(groups)) {
      if (g.length < 2) continue
      const useReal = g.every((it) => it.p.listPrice && it.c.listPrice)
      const val = (it, per) => (useReal ? it[per].asp / it[per].listPrice : it[per].asp)
      const spread = (per) => {
        const vs = g.map((it) => val(it, per))
        return useReal ? (Math.max(...vs) - Math.min(...vs)) * 100 : (Math.max(...vs) / Math.min(...vs) - 1) * 100
      }
      const sCur = spread('c')
      const sPrior = spread('p')
      if (sCur >= T.realizationGapPts && sCur - sPrior >= T.realizationWidenPts) {
        const low = g.reduce((a, b) => (val(b, 'c') < val(a, 'c') ? b : a))
        const high = g.reduce((a, b) => (val(b, 'c') > val(a, 'c') ? b : a))
        gaps.push({ dim, sku: g[0].sku, low, high, sCur, sPrior, metric: useReal ? 'price realization' : 'ASP' })
      }
    }
  }
  scan('region', 'channel')
  scan('channel', 'region')
  return gaps
}

function trends(items, moves, shifts, gaps) {
  const T = THRESHOLDS
  const out = []
  const matched = items.filter((it) => it.status === 'matched')
  for (const dim of ['region', 'channel', 'family']) {
    const groups = {}
    matched.forEach((it) => (groups[it[dim]] ||= []).push(it))
    for (const [name, g] of Object.entries(groups)) {
      if (name === '—') continue
      const aspDown = g.filter((it) => it.aspChg <= T.aspDropWatch)
      if (aspDown.length >= T.trendMinProducts) {
        const viaDisc = aspDown.filter((it) => it.discChgPts >= 2).length
        out.push(
          `ASP down ≥2% on ${aspDown.length} of ${g.length} ${name} product lines (${aspDown.map((i) => i.sku).join(', ')})${viaDisc === aspDown.length ? ', all through deeper discounting with list price unchanged' : ''}.`
        )
      }
      const gmDown = g.filter((it) => it.gmChgPts <= -T.gmDropWatchPts)
      if (dim === 'family' && gmDown.length >= T.trendMinProducts) out.push(`Gross margin down ≥${T.gmDropWatchPts} pts on ${gmDown.length} of ${g.length} ${name} product lines.`)
    }
  }
  for (const s of shifts) {
    const avg = s.moves.reduce((a, m) => a + m.change, 0) / s.moves.length
    out.push(`${s.competitor} moved price ${s.dir} on ${s.moves.length} products (avg ${pct(avg)}) in the same period — looks like a pricing-strategy change, not isolated moves.`)
  }
  const promos = moves.filter((m) => m.kind === 'Promotional')
  if (promos.length >= T.trendMinProducts) out.push(`${promos.length} competitor promotions active this period.`)
  for (const g of gaps) {
    out.push(`${g.sku}: ${g.metric} gap across ${g.dim === 'region' ? 'regions' : 'channels'} widened to ${g.sCur.toFixed(1)} pts (from ${g.sPrior.toFixed(1)}); ${g.low[g.dim]} is lowest.`)
  }
  return out
}

// Merge competitor-cut flags from the same competitor into one alert when the
// competitor is repricing broadly — one strategic issue, not N alerts.
function consolidateShifts(flags, shifts) {
  let out = [...flags]
  for (const s of shifts.filter((x) => x.dir === 'down')) {
    const group = out.filter((f) => f.type === 'competitor-cut' && f.items[0].competitor === s.competitor)
    if (group.length < 2) continue
    out = out.filter((f) => !group.includes(f))
    const items = group.map((f) => f.items[0])
    const amount = group.reduce((a, f) => a + f.exposure.amount, 0)
    const families = [...new Set(items.map((i) => i.family))].join(', ')
    out.push({
      ...group[0],
      items,
      type: 'competitor-strategy',
      title: `${s.competitor} repricing across ${items.length} ${families} products`,
      what: items.map(
        (i) => `${i.label}: ${i.competitor} ${pct(i.compChg)} to ${price(i.c.compPrice)}; our premium ${pct(i.p.premium)} → ${pct(i.c.premium)}; units ${pct(i.unitsChg)}.`
      ),
      why: 'Several non-promotional cuts by the same competitor in one period points to a deliberate change in pricing strategy, not isolated moves.',
      context: `${s.competitor} cut on ${items.length} of our product lines in one period; our volume moved ${items.map((i) => pct(i.unitsChg)).join(' / ')} on them.`,
      exposure: { ...group[0].exposure, amount, basis: 'Revenue at stake if we matched each cut at current volume (sum across products)' },
      action: `Treat as one strategic decision: map ${s.competitor}’s new price architecture, then model hold / partial-match / match scenarios across all ${items.length} products before any single-SKU response.`,
      confidence: 'High',
    })
  }
  return out
}

function niceRound(n) {
  if (!n) return 0
  const mag = 10 ** Math.floor(Math.log10(n))
  return Math.round(n / mag) * mag
}

// ----------------------------------------------------------------------------
// Main entry point
// ----------------------------------------------------------------------------
export function analyze(rawRows, { periodType = 'quarter', materialityFloor } = {}) {
  const annual = { month: 12, quarter: 4, year: 1 }[periodType] ?? 4
  const { records, skipped, present, missingRequired } = normalizeRows(rawRows)
  if (missingRequired.length) return { error: `Missing required column${missingRequired.length > 1 ? 's' : ''}: ${missingRequired.join(', ')}.` }
  if (!records.length) return { error: 'No usable rows. Each row needs period, sku, a positive asp and units.' }

  const periods = [...new Set(records.map((r) => r.period))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const current = periods.at(-1)
  const prior = periods.length > 1 ? periods.at(-2) : null
  const curMap = aggregate(records.filter((r) => r.period === current))
  const priorMap = prior ? aggregate(records.filter((r) => r.period === prior)) : new Map()
  const keys = [...new Set([...priorMap.keys(), ...curMap.keys()])]
  const items = keys.map((k) => buildItem(k, priorMap.get(k), curMap.get(k), annual))

  const totalAnnRev = items.reduce((s, it) => s + it.annRev, 0)
  const floor = materialityFloor ?? niceRound(totalAnnRev * THRESHOLDS.defaultMaterialityShare)

  const moves = competitorMoves(items, present)
  const shifts = strategyShifts(moves)
  const gaps = pricingGaps(items)

  const compCutsByCompetitor = {}
  items
    .filter((it) => it.compChg != null && it.compChg <= -0.03 && it.c?.compPromo !== true)
    .forEach((it) => (compCutsByCompetitor[it.competitor] = (compCutsByCompetitor[it.competitor] || 0) + 1))

  // Attach cross-region/channel gap facts to the low product's price flag.
  const gapNotes = {}
  for (const g of gaps) {
    ;(gapNotes[g.low.key] ||= []).push(
      `${g.metric === 'price realization' ? 'Realization' : 'ASP'} now ${g.sCur.toFixed(1)} pts below ${g.high[g.dim]} on the same SKU (gap was ${g.sPrior.toFixed(1)} pts).`
    )
  }

  const ctx = { annual, present, compCutsByCompetitor, gapNotes }
  let flags = items.filter((it) => it.status === 'matched').flatMap((it) => productFlags(it, ctx))

  // Regional/channel gaps become their own alert only if the low product
  // didn't already get a price flag carrying the same fact.
  for (const g of gaps) {
    if (flags.some((f) => f.category === 'price' && f.items.includes(g.low))) continue
    const listRef = g.low.c.listPrice || g.low.c.asp
    flags.push({
      category: 'gap',
      items: [g.low, g.high],
      severity: 'watch',
      type: 'pricing-gap',
      title: `Emerging ${g.dim} pricing gap on ${g.sku}`,
      context: competitiveContext(g.low),
      what: [`${g.metric} spread ${g.sPrior.toFixed(1)} → ${g.sCur.toFixed(1)} pts; ${g.low.label} lowest, ${g.high.label} highest.`],
      why: 'A widening gap on the same SKU is either intentional local pricing or leakage — worth knowing which.',
      exposure: {
        amount: (g.sCur / 200) * listRef * g.low.c.units * annual,
        basis: `Closing half the gap in ${g.low[g.dim]} at current volume`,
        assumptions: ['Units held flat', `Annualized at ×${annual}`],
      },
      drivers: rankDrivers([
        { text: 'Local competitive pressure', strength: g.low.compChg != null && g.low.compChg <= -THRESHOLDS.compMoveNoise ? 'moderate' : 'weak' },
        { text: 'Discount approval discipline differs by ' + g.dim, strength: g.low.discChgPts > 1 ? 'moderate' : 'weak' },
      ]),
      distinguish: 'Deal-level discount approvals by region/channel.',
      action: `Review ${g.dim}-level ASP and discount approvals for ${g.sku}.`,
      confidence: 'Medium',
    })
  }

  flags = consolidateShifts(flags, shifts)

  const sevRank = { high: 0, watch: 1, opportunity: 2 }
  const material = flags.filter((f) => f.exposure.amount >= floor)
  const belowFloor = flags.filter((f) => f.exposure.amount < floor)
  material.sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || b.exposure.amount - a.exposure.amount)
  const alerts = material.slice(0, THRESHOLDS.maxAlerts).map((f, i) => ({ ...f, id: `alert-${i}` }))
  const overflow = material.slice(THRESHOLDS.maxAlerts)

  const bridge = pvm(items, annual)
  const trendList = trends(items, moves, shifts, gaps)

  const dataGaps = Object.entries(OPTIONAL_COLUMNS)
    .filter(([c]) => !present[c])
    .map(([c, what]) => `No ${c} column — skipped: ${what.toLowerCase()}.`)
  if (!prior) dataGaps.unshift('Only one period in the data — period-over-period analysis (ASP trend, PVM, elasticity, competitor moves) needs at least two.')
  if (present.competitor_price) {
    const noComp = items.filter((it) => it.c && it.c.compPrice == null).length
    if (noComp) dataGaps.push(`${noComp} current product line${noComp > 1 ? 's have' : ' has'} no competitor price — positioning not assessed for ${noComp > 1 ? 'them' : 'it'}.`)
  }
  if (skipped) dataGaps.push(`${skipped} row${skipped > 1 ? 's' : ''} skipped (missing period/sku or non-positive asp/units).`)

  const result = {
    meta: { periods, prior, current, annual, periodType, rows: records.length, products: items.length, totalAnnRev, floor },
    items,
    alerts,
    overflow,
    belowFloor,
    pvm: bridge,
    elasticity: elasticitySignals(items),
    moves,
    shifts,
    trends: trendList,
    dataGaps,
    present,
  }
  result.summary = executiveSummary(result)
  result.opportunities = flags.filter((f) => f.severity === 'opportunity').sort((a, b) => b.exposure.amount - a.exposure.amount)
  result.questions = humanReviewQuestions(result)
  return result
}

// ----------------------------------------------------------------------------
// Brief narrative
// ----------------------------------------------------------------------------
function executiveSummary(r) {
  const s = []
  const { pvm: b, alerts, meta } = r
  if (b) {
    const [dk, dv] = largestDriver(b.revenue, ['price', 'volume', 'mix'])
    s.push(
      `Revenue on continuing products is ${b.revenue.total >= 0 ? 'up' : 'down'} ${money(Math.abs(b.revenue.total))} (${pct(b.revenue.total / b.revenue.prior)}) ${meta.current} vs ${meta.prior}; the ${dk} effect is the largest driver at ${money(dv)}.`
    )
    if (b.margin) {
      const [mk, mv] = largestDriver(b.margin, ['price', 'volume', 'mix', 'cost'])
      s.push(`Gross margin ${b.margin.total >= 0 ? 'rose' : 'fell'} ${money(Math.abs(b.margin.total))} over the same period, driven mostly by ${mk} (${money(mv)}).`)
    }
  }
  const n = (sev) => alerts.filter((a) => a.severity === sev).length
  const top = alerts[0]
  if (top) {
    s.push(
      `${n('high')} high-priority, ${n('watch')} watch and ${n('opportunity')} opportunity flags cleared the ${money(meta.floor)} materiality floor; the largest is “${top.title}” on ${top.items.length > 1 ? `${top.items.length} products` : top.items[0].label} (~${money(top.exposure.amount)} annualized).`
    )
  } else {
    s.push(`No developments cleared the ${money(meta.floor)} materiality floor this period.`)
  }
  const shift = r.shifts[0]
  if (shift) s.push(`${shift.competitor} moved price ${shift.dir} on ${shift.moves.length} products at once — treat it as a strategy change, not noise.`)
  const opp = alerts.filter((a) => a.severity === 'opportunity')[0]
  if (opp) s.push(`Biggest upside: “${opp.title}” on ${opp.items[0].label} (~${money(opp.exposure.amount)}).`)
  return s.slice(0, 5)
}

function humanReviewQuestions(r) {
  const q = []
  for (const a of r.alerts) {
    if (a.type === 'competitor-strategy' || a.type === 'competitor-cut') {
      q.push(`Respond to ${a.items[0].competitor || 'the competitor'} on ${a.items.length > 1 ? `${a.items.length} products` : a.items[0].label}, or hold the premium? Matching costs up to ~${money(a.exposure.amount)} a year at current volume; holding risks further share loss.`)
    } else if (a.type === 'competitor-promo') {
      q.push(`Do we defend ${a.items[0].label} against a temporary promotion, or wait it out?`)
    } else if (a.type === 'margin-compression' && a.title.includes('cost-driven')) {
      q.push(`Pass the cost increase on ${a.items[0].label} through to price, absorb it, or wait for cost relief?`)
    } else if (a.type === 'asp-decline' && a.severity === 'high') {
      q.push(`Is the extra discounting on ${a.items[0].label} approved strategy or leakage?`)
    } else if (a.type === 'elasticity-concern') {
      q.push(`Keep, partially roll back or hold the increase on ${a.items[0].label} given the volume response?`)
    }
  }
  const opps = r.alerts.filter((a) => a.severity === 'opportunity')
  if (opps.length) q.push(`Appetite to test price increases on ${opps.map((o) => o.items[0].sku).filter((v, i, arr) => arr.indexOf(v) === i).join(', ')}?`)
  if (!r.present.competitor_promo && r.present.competitor_price) q.push('Can CI add a promo flag to competitor prices? Without it, temporary and structural moves look the same.')
  return q.slice(0, 6)
}

// ----------------------------------------------------------------------------
// Interactive analyst mode — preset questions answered from the result
// ----------------------------------------------------------------------------
export const ANALYST_QUESTIONS = [
  { id: 'first', q: 'What should the pricing team investigate first?', keywords: ['first', 'priorit', 'investigate', 'today', 'know'] },
  { id: 'losing-price', q: 'Where are we losing price?', keywords: ['losing price', 'asp', 'realization', 'erosion', 'losing'] },
  { id: 'comp-risk', q: 'Which products have the biggest competitive pricing risk?', keywords: ['competitive', 'risk', 'threat'] },
  { id: 'margin', q: 'Why is margin declining?', keywords: ['margin', 'gm', 'gross'] },
  { id: 'aggressive', q: 'Where are competitors becoming more aggressive?', keywords: ['aggressive', 'competitors'] },
  { id: 'increase', q: 'Which products could potentially support a price increase?', keywords: ['increase', 'raise', 'support', 'headroom'] },
  { id: 'discounting', q: 'Are we discounting unnecessarily?', keywords: ['discount', 'unnecessar', 'leak'] },
  { id: 'comp-changed', q: 'Show me products where competitor pricing changed but ours didn’t.', keywords: ['but ours', "didn't", 'didn’t', 'changed but', 'ours didn'] },
  { id: 'premium', q: 'Where has our price premium expanded?', keywords: ['premium', 'expanded'] },
  { id: 'opportunities', q: 'What are the largest pricing opportunities by estimated financial impact?', keywords: ['opportunit', 'upside', 'largest'] },
  { id: 'changed', q: 'What changed this period?', keywords: ['what changed', 'this week', 'this period', 'this month', 'this quarter', 'changed'] },
]

export function matchQuestion(text) {
  const t = text.toLowerCase()
  let best = null
  let bestScore = 0
  for (const q of ANALYST_QUESTIONS) {
    const score = q.keywords.reduce((s, k) => (t.includes(k) ? s + k.length : s), 0)
    if (score > bestScore) (best = q), (bestScore = score)
  }
  return best
}

const col = (key, label, fmt) => ({ key, label, fmt })

export function answerQuestion(r, id) {
  const matched = r.items.filter((it) => it.status === 'matched')
  const A = r.meta.annual
  switch (id) {
    case 'first': {
      const top = r.alerts.filter((a) => a.severity !== 'opportunity').slice(0, 3)
      return {
        answer: top.length
          ? `Start with “${top[0].title}” on ${top[0].items.length > 1 ? `${top[0].items.length} products` : top[0].items[0].label} — it carries the largest exposure among the risk flags.${top.length > 1 ? ` Then the ${top.length - 1} below it.` : ''}`
          : 'Nothing at risk-level cleared the materiality floor. Start with the opportunities list.',
        columns: [col('title', 'Alert'), col('where', 'Where'), col('exposure', 'Est. exposure', money), col('action', 'First step')],
        rows: top.map((a) => ({ title: a.title, where: a.items.length > 1 ? `${a.items.length} products` : a.items[0].label, exposure: a.exposure.amount, action: a.action })),
      }
    }
    case 'losing-price': {
      const rows = matched
        .filter((it) => it.aspChg < -0.005)
        .map((it) => ({ label: it.label, asp: it.aspChg, disc: it.discChgPts, units: it.unitsChg, lost: (it.p.asp - it.c.asp) * it.c.units * A }))
        .sort((a, b) => b.lost - a.lost)
      return {
        answer: rows.length
          ? `${rows.length} product line${rows.length > 1 ? 's' : ''} lost price this period, ${money(rows.reduce((s, x) => s + x.lost, 0))} annualized in total. ${rows[0].label} is the biggest.`
          : 'No product line saw ASP decline more than 0.5%.',
        columns: [col('label', 'Product'), col('asp', 'ASP Δ', pct), col('disc', 'Discount Δ', ptsFmt), col('units', 'Units Δ', pct), col('lost', 'Annualized $ lost', money)],
        rows,
      }
    }
    case 'comp-risk': {
      const rows = matched
        .filter((it) => it.c.compPrice != null && ((it.compChg ?? 0) <= -THRESHOLDS.compMoveNoise || (it.premChgPts ?? 0) >= 3))
        .map((it) => ({ label: it.label, comp: it.competitor, compChg: it.compChg, prem: it.c.premium, premChg: it.premChgPts, atRisk: (Math.max(0, it.premChgPts ?? 0) / 100) * it.annRev }))
        .sort((a, b) => b.atRisk - a.atRisk)
      return {
        answer: rows.length ? `${rows.length} product lines saw the competitor move down or our premium widen by 3+ pts. Ranked by annualized revenue at stake if we cut price to restore the prior premium.` : 'No product line has a material adverse competitive price move.',
        columns: [col('label', 'Product'), col('comp', 'Competitor'), col('compChg', 'Comp Δ', pct), col('prem', 'Our premium now', pct), col('premChg', 'Premium Δ', ptsFmt), col('atRisk', 'Rev. at stake', money)],
        rows,
      }
    }
    case 'margin': {
      const m = r.pvm?.margin
      const rows = matched
        .filter((it) => it.gmChgPts != null && it.gmChgPts < -0.5)
        .map((it) => ({ label: it.label, gm: it.gmChgPts, asp: it.aspChg, cost: it.costChg, dollars: it.c.gm - it.p.gm }))
        .sort((a, b) => a.dollars - b.dollars)
      if (!m) return { answer: 'Margin analysis needs unit_cost for every product in both periods.', columns: [], rows: [] }
      const parts = ['price', 'volume', 'mix', 'cost'].map((k) => `${k} ${money(m[k])}`).join(', ')
      return {
        answer: `Gross margin ${m.total >= 0 ? 'rose' : 'fell'} ${money(Math.abs(m.total))}, ${r.meta.current} vs ${r.meta.prior}. Bridge: ${parts}. ${rows.length ? `Biggest single contributor: ${rows[0].label}.` : ''}`,
        columns: [col('label', 'Product'), col('gm', 'GM% Δ', ptsFmt), col('asp', 'ASP Δ', pct), col('cost', 'Unit cost Δ', pct), col('dollars', 'GM$ Δ (period)', money)],
        rows,
      }
    }
    case 'aggressive': {
      const byComp = {}
      r.moves.filter((m) => m.change != null && m.change < 0).forEach((m) => (byComp[m.competitor] ||= []).push(m))
      const rows = Object.entries(byComp)
        .map(([comp, ms]) => ({ comp, n: ms.length, avg: ms.reduce((s, m) => s + m.change, 0) / ms.length, kinds: [...new Set(ms.map((m) => m.kind))].join(', '), where: ms.map((m) => m.against).join('; ') }))
        .sort((a, b) => b.n - a.n || a.avg - b.avg)
      return {
        answer: rows.length ? `${rows[0].comp} is the most active, cutting on ${rows[0].n} product line${rows[0].n > 1 ? 's' : ''}.` : 'No competitor price reductions above noise this period.',
        columns: [col('comp', 'Competitor'), col('n', 'Cuts'), col('avg', 'Avg Δ', pct), col('kinds', 'Type'), col('where', 'Against')],
        rows,
      }
    }
    case 'increase':
    case 'opportunities': {
      const rows = r.opportunities.map((o) => ({ title: o.title, where: o.items[0].label, amount: o.exposure.amount, basis: o.exposure.basis }))
      return {
        answer: rows.length
          ? `${rows.length} opportunit${rows.length > 1 ? 'ies' : 'y'}, ${money(rows.reduce((s, x) => s + x.amount, 0))} combined on the stated assumptions (not additive with any risk responses). Includes ones below the materiality floor.`
          : 'No price-increase signals in this data.',
        columns: [col('title', 'Signal'), col('where', 'Product'), col('amount', 'Est. upside', money), col('basis', 'Basis')],
        rows,
      }
    }
    case 'discounting': {
      const rows = matched
        .filter((it) => it.discChgPts != null && it.discChgPts >= 1 && (it.unitsChg ?? 0) < Math.max(0.03, (it.discChgPts / 100) * 1.5))
        .map((it) => ({ label: it.label, disc: it.discChgPts, now: it.c.disc, units: it.unitsChg, cost: (it.discChgPts / 100) * it.c.listPrice * it.c.units * A }))
        .sort((a, b) => b.cost - a.cost)
      return {
        answer: rows.length
          ? `${rows.length} product line${rows.length > 1 ? 's' : ''} deepened discounts without a matching volume response — ${money(rows.reduce((s, x) => s + x.cost, 0))} annualized. That’s a signal of leakage, not proof; deal-level data would confirm.`
          : r.present.list_price ? 'No product line deepened discounts without a volume response.' : 'Needs list_price to measure discount depth.',
        columns: [col('label', 'Product'), col('disc', 'Discount Δ', ptsFmt), col('now', 'Discount now', (v) => pct(v, { signed: false })), col('units', 'Units Δ', pct), col('cost', 'Annualized cost', money)],
        rows,
      }
    }
    case 'comp-changed': {
      const rows = matched
        .filter((it) => it.compChg != null && Math.abs(it.compChg) >= THRESHOLDS.compMoveNoise && Math.abs(it.aspChg) < 0.01)
        .map((it) => ({ label: it.label, comp: it.competitor, compChg: it.compChg, promo: it.c.compPromo ? 'Promo' : 'Structural', asp: it.aspChg, prem: it.c.premium }))
      return {
        answer: rows.length ? `${rows.length} product line${rows.length > 1 ? 's' : ''} where the competitor moved ≥2% and our ASP moved <1%.` : 'None — wherever a competitor moved, our ASP moved too.',
        columns: [col('label', 'Product'), col('comp', 'Competitor'), col('compChg', 'Comp Δ', pct), col('promo', 'Type'), col('asp', 'Our ASP Δ', pct), col('prem', 'Premium now', pct)],
        rows,
      }
    }
    case 'premium': {
      const rows = matched
        .filter((it) => it.premChgPts != null && it.premChgPts >= 2)
        .map((it) => ({ label: it.label, from: it.p.premium, to: it.c.premium, d: it.premChgPts, why: Math.abs(it.compChg) > Math.abs(it.aspChg) ? 'Competitor moved' : 'We moved', share: it.shareChgPts }))
        .sort((a, b) => b.d - a.d)
      return {
        answer: rows.length ? `Premium widened 2+ pts on ${rows.length} product line${rows.length > 1 ? 's' : ''}. A wider premium isn’t bad on its own — check the share column.` : 'No premium expanded by 2+ pts.',
        columns: [col('label', 'Product'), col('from', 'Was', pct), col('to', 'Now', pct), col('d', 'Δ', ptsFmt), col('why', 'Mostly'), col('share', 'Share Δ', ptsFmt)],
        rows,
      }
    }
    case 'changed':
    default: {
      const rows = matched
        .map((it) => ({ label: it.label, asp: it.aspChg, units: it.unitsChg, comp: it.compChg, gm: it.gmChgPts, rev: it.c.rev - it.p.rev }))
        .sort((a, b) => Math.abs(b.rev) - Math.abs(a.rev))
      const nNew = r.items.filter((i) => i.status === 'new').length
      const nGone = r.items.filter((i) => i.status === 'discontinued').length
      return {
        answer: `${r.meta.prior} → ${r.meta.current}: ${matched.length} continuing product lines${nNew ? `, ${nNew} new` : ''}${nGone ? `, ${nGone} discontinued` : ''}. Sorted by size of revenue change.`,
        columns: [col('label', 'Product'), col('asp', 'ASP Δ', pct), col('units', 'Units Δ', pct), col('comp', 'Comp Δ', pct), col('gm', 'GM% Δ', ptsFmt), col('rev', 'Revenue Δ (period)', money)],
        rows,
      }
    }
  }
}
