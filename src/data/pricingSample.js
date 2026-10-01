// ============================================================================
// Pricing Intelligence — illustrative sample dataset
// ----------------------------------------------------------------------------
// SYNTHETIC DATA for learning the engine. Product names, competitors
// ("Competitor A/B/C"), prices, units and shares are all made up and are not
// real HPE or competitor figures. Two quarters, one row per
// SKU × region × channel × period.
//
// Each row is shaped so a different engine rule fires (competitor structural
// cut, competitor promo, discount-driven ASP erosion, cost-driven margin
// compression, pricing power, elasticity, etc.), plus one "quiet" product,
// one discontinued and one new SKU.
// ============================================================================

export const SAMPLE_COLUMNS = [
  'period',
  'sku',
  'product',
  'family',
  'region',
  'channel',
  'list_price',
  'asp',
  'units',
  'unit_cost',
  'competitor',
  'competitor_product',
  'competitor_price',
  'competitor_promo',
  'market_share',
]

// [sku, product, family, region, channel,
//  prior: list, asp, units, cost, compPrice, promo, share,
//  current: list, asp, units, cost, compPrice, promo, share,
//  competitor, competitorProduct]
const PAIRS = [
  ['CMP-2U-STD', '2U rack server, standard', 'Compute', 'NA', 'Direct',
    14000, 11900, 3200, 7600, 11500, 'N', 31.0,
    14000, 11850, 2900, 7650, 10580, 'N', 28.6, 'Competitor A', 'A-2U Series'],
  ['CMP-2U-STD', '2U rack server, standard', 'Compute', 'EMEA', 'Direct',
    14000, 12100, 1800, 7700, 11800, 'N', 22.0,
    14000, 11250, 1850, 7750, 11750, 'N', 22.4, 'Competitor A', 'A-2U Series'],
  ['CMP-1U-ENT', '1U server, enterprise', 'Compute', 'NA', 'Channel',
    9800, 8300, 4100, 5200, 8400, 'N', 26.0,
    9800, 8250, 3950, 5220, 7560, 'Y', 25.1, 'Competitor A', 'A-1U Pro'],
  ['CMP-1U-ENT', '1U server, enterprise', 'Compute', 'EMEA', 'Channel',
    9800, 8400, 2600, 5250, 8600, 'N', 20.5,
    9800, 8380, 2480, 5260, 8080, 'N', 19.6, 'Competitor A', 'A-1U Pro'],
  ['CMP-1U-ENT', '1U server, enterprise', 'Compute', 'APJ', 'Channel',
    9500, 7900, 2100, 5100, 8000, 'N', 18.0,
    9500, 7880, 2050, 5110, 7600, 'N', 17.6, 'Competitor A', 'A-1U Pro'],
  ['STR-AF-200', 'All-flash array, 200TB', 'Storage', 'NA', 'Direct',
    98000, 82000, 620, 47000, 85000, 'N', 24.0,
    98000, 81800, 640, 52800, 85000, 'N', 24.3, 'Competitor B', 'B-Flash 200'],
  ['STR-AF-200', 'All-flash array, 200TB', 'Storage', 'APJ', 'Channel',
    96000, 78000, 410, 46500, 84000, 'N', 19.0,
    99000, 81200, 415, 46800, 84500, 'N', 19.2, 'Competitor B', 'B-Flash 200'],
  ['STR-HY-100', 'Hybrid array, 100TB', 'Storage', 'NA', 'Channel',
    42000, 36500, 980, 24000, 37000, 'N', 27.0,
    42000, 36600, 990, 24100, 39300, 'N', 27.4, 'Competitor B', 'B-Hybrid 100'],
  ['STR-HY-100', 'Hybrid array, 100TB', 'Storage', 'EMEA', 'Direct',
    42000, 37200, 540, 24300, 34000, 'Y', 21.0,
    42000, 37100, 545, 24400, 37400, 'N', 21.3, 'Competitor B', 'B-Hybrid 100'],
  ['NET-SW-48', '48-port switch', 'Networking', 'NA', 'Direct',
    6200, 4900, 5200, 2600, 5700, 'N', 18.0,
    6200, 4920, 5600, 2610, 5750, 'N', 19.5, 'Competitor C', 'C-Switch 48'],
  ['NET-SW-48', '48-port switch', 'Networking', 'EMEA', 'Channel',
    6200, 5050, 3300, 2650, 5400, 'N', 15.0,
    6200, 4730, 3340, 2660, 5380, 'N', 15.1, 'Competitor C', 'C-Switch 48'],
  ['NET-SW-24', '24-port switch', 'Networking', 'NA', 'Channel',
    3400, 2780, 6100, 1500, 2850, 'N', 22.0,
    3400, 2775, 6150, 1505, 2860, 'N', 22.1, 'Competitor C', 'C-Switch 24'],
  ['AI-ACC-8G', '8-GPU AI accelerator node', 'AI Accelerators', 'NA', 'Direct',
    265000, 236000, 410, 178000, 240000, 'N', 14.0,
    265000, 229000, 470, 179000, 225600, 'N', 15.2, 'Competitor C', 'C-AI 8'],
  ['AI-ACC-8G', '8-GPU AI accelerator node', 'AI Accelerators', 'EMEA', 'Direct',
    265000, 238000, 220, 179000, 242000, 'N', 11.0,
    279000, 250000, 188, 180000, 242000, 'N', 9.4, 'Competitor C', 'C-AI 8'],
]

const PRIOR = '2026-Q2'
const CURRENT = '2026-Q3'

function row(period, sku, product, family, region, channel, list, asp, units, cost, comp, promo, share, competitor, compProduct) {
  return {
    period,
    sku,
    product,
    family,
    region,
    channel,
    list_price: list,
    asp,
    units,
    unit_cost: cost,
    competitor,
    competitor_product: compProduct,
    competitor_price: comp,
    competitor_promo: promo,
    market_share: share,
  }
}

export const SAMPLE_ROWS = [
  ...PAIRS.flatMap((p) => {
    const [sku, product, family, region, channel] = p
    const [competitor, compProduct] = p.slice(19)
    return [
      row(PRIOR, sku, product, family, region, channel, ...p.slice(5, 12), competitor, compProduct),
      row(CURRENT, sku, product, family, region, channel, ...p.slice(12, 19), competitor, compProduct),
    ]
  }),
  // Discontinued after Q2
  row(PRIOR, 'NET-SW-24', '24-port switch', 'Networking', 'APJ', 'Channel',
    3400, 2700, 900, 1520, 2800, 'N', 12.0, 'Competitor C', 'C-Switch 24'),
  // Launched in Q3
  row(CURRENT, 'AI-ACC-4G', '4-GPU AI accelerator node', 'AI Accelerators', 'NA', 'Direct',
    138000, 124000, 150, 92000, 126000, 'N', 6.0, 'Competitor C', 'C-AI 4'),
]

// Build a CSV string from row objects — used for the "download template"
// button so people can see the exact shape the engine expects.
export function rowsToCsv(rows, columns = SAMPLE_COLUMNS) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\n')
}
