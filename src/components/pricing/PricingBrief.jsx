import { money, pct } from '../../lib/pricingEngine'
import AlertCard, { SEVERITY } from './AlertCard'

// Renders the engine result as the PRICING INTELLIGENCE BRIEF.
export default function PricingBrief({ result }) {
  const { meta, alerts, overflow, belowFloor, moves, trends, opportunities, questions, dataGaps } = result

  return (
    <div className="pi-brief">
      <div className="pi-brief-masthead">
        <span className="eyebrow">Pricing Intelligence Brief</span>
        <h3>
          {meta.prior ? `${meta.current} vs ${meta.prior}` : meta.current}
        </h3>
        <p className="pi-meta">
          {meta.products} product lines · {meta.rows} rows · {money(meta.totalAnnRev)} annualized revenue · materiality floor{' '}
          {money(meta.floor)}
        </p>
      </div>

      <section className="pi-block">
        <h4 className="pi-block-title">Executive summary</h4>
        <p className="pi-summary">{result.summary.join(' ')}</p>
      </section>

      <section className="pi-block">
        <h4 className="pi-block-title">Priority alerts</h4>
        {alerts.length === 0 && <p>Nothing cleared the materiality floor.</p>}
        <div className="pi-alert-list">
          {alerts.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </div>
        {(overflow.length > 0 || belowFloor.length > 0) && (
          <p className="pi-footnote">
            {overflow.length > 0 && `${overflow.length} more material flag${overflow.length > 1 ? 's' : ''} beyond the top ${alerts.length} (${overflow.map((f) => f.title).join('; ')}). `}
            {belowFloor.length > 0 &&
              `${belowFloor.length} signal${belowFloor.length > 1 ? 's' : ''} suppressed below the ${money(meta.floor)} floor (${belowFloor
                .map((f) => `${f.title}, ${money(f.exposure.amount)}`)
                .join('; ')}).`}
          </p>
        )}
      </section>

      <section className="pi-block">
        <h4 className="pi-block-title">Competitive moves</h4>
        {moves.length === 0 ? (
          <p>No competitor price moves above the ±2% noise band.</p>
        ) : (
          <div className="pi-table-wrap">
            <table className="pi-table">
              <thead>
                <tr>
                  <th>Competitor</th>
                  <th>Product</th>
                  <th>Against our</th>
                  <th className="num">Change</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m, i) => (
                  <tr key={i}>
                    <td>{m.competitor}</td>
                    <td>{m.product || '—'}</td>
                    <td>{m.against}</td>
                    <td className="num">{pct(m.change)}</td>
                    <td>{m.kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="pi-block">
        <h4 className="pi-block-title">Emerging trends</h4>
        {trends.length ? (
          <ul className="pi-list">
            {trends.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        ) : (
          <p>No pattern repeats across two or more products, regions or competitors.</p>
        )}
      </section>

      <section className="pi-block">
        <h4 className="pi-block-title">Opportunities</h4>
        {opportunities.length ? (
          <ul className="pi-list">
            {opportunities.map((o, i) => (
              <li key={i}>
                {SEVERITY.opportunity.icon} <strong>{o.title}</strong> — {o.items[0].label}. ~{money(o.exposure.amount)}: {o.exposure.basis.toLowerCase()}.
              </li>
            ))}
          </ul>
        ) : (
          <p>No pricing-upside signals in this data.</p>
        )}
      </section>

      <section className="pi-block">
        <h4 className="pi-block-title">Questions requiring human review</h4>
        <ul className="pi-list">
          {questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </section>

      {dataGaps.length > 0 && (
        <section className="pi-block">
          <h4 className="pi-block-title">Data gaps</h4>
          <ul className="pi-list pi-list-muted">
            {dataGaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
