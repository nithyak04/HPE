import { money, pct } from '../../lib/pricingEngine'

export default function KpiStrip({ result }) {
  const { meta, alerts, opportunities, pvm } = result
  const risk = alerts.filter((a) => a.severity !== 'opportunity')
  const nHigh = risk.filter((a) => a.severity === 'high').length
  const nWatch = risk.length - nHigh
  const riskAmt = risk.reduce((s, a) => s + a.exposure.amount, 0)
  const oppAmt = opportunities.reduce((s, o) => s + o.exposure.amount, 0)
  const gm = pvm?.margin
  const gmDriver = gm && ['price', 'volume', 'mix', 'cost'].sort((a, b) => Math.abs(gm[b]) - Math.abs(gm[a]))[0]
  const rev = pvm?.revenue

  return (
    <div className="kpi-strip">
      <div className="kpi">
        <span className="kpi-label">Annualized revenue</span>
        <span className="kpi-value">{money(meta.totalAnnRev)}</span>
        <span className="kpi-sub">
          {meta.products} product lines
          {rev && (
            <>
              {' · '}
              <span className={rev.total >= 0 ? 'pos' : 'neg'}>{pct(rev.total / rev.prior)}</span> vs {meta.prior}
            </>
          )}
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Exposure in risk signals</span>
        <span className="kpi-value">{money(riskAmt)}</span>
        <span className="kpi-sub">
          <span className="kpi-sev high">▲ {nHigh} high</span>
          <span className="kpi-sev watch">◆ {nWatch} watch</span>
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Upside identified</span>
        <span className="kpi-value">{money(oppAmt)}</span>
        <span className="kpi-sub">
          <span className="kpi-sev opportunity">● {opportunities.length} opportunities</span>
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Gross margin change</span>
        <span className="kpi-value">{gm ? (gm.total > 0 ? `+${money(gm.total)}` : money(gm.total)) : '—'}</span>
        <span className="kpi-sub">{gm ? `mostly ${gmDriver} (${money(gm[gmDriver])}), per period` : 'needs unit_cost'}</span>
      </div>
    </div>
  )
}
