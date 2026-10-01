import { money, pct } from '../../lib/pricingEngine'
import Waterfall from './Waterfall'
import { Card } from './shared'

const cap = (s) => s[0].toUpperCase() + s.slice(1)

export default function PvmView({ result }) {
  const { pvm, elasticity, meta } = result
  if (!pvm) return <Card title="Price / volume / mix"><p className="empty">Needs at least two periods with the same products in both.</p></Card>

  const revKeys = ['price', 'volume', 'mix']
  const gmKeys = ['price', 'volume', 'mix', 'cost']
  const top = (b, keys) => [...keys].sort((x, y) => Math.abs(b[y]) - Math.abs(b[x]))[0]

  return (
    <div className="stack">
      <p className="muted">
        {meta.current} vs {meta.prior}, period dollars (not annualized), continuing products only.
        {pvm.outside.length > 0 && ` Excludes ${pvm.outside.map((i) => `${i.label} (${i.status})`).join(', ')}.`}
      </p>
      <div className="grid-2">
        <Card
          eyebrow="Revenue bridge"
          title={`${money(pvm.revenue.prior)} → ${money(pvm.revenue.current)}`}
          actions={<span className="chip">Driver: {top(pvm.revenue, revKeys)}</span>}
        >
          <Waterfall steps={revKeys.map((k) => ({ label: cap(k), value: pvm.revenue[k] }))} total={pvm.revenue.total} />
        </Card>
        <Card
          eyebrow="Gross margin bridge"
          title={pvm.margin ? `${money(pvm.margin.prior)} → ${money(pvm.margin.current)}` : 'Needs unit_cost'}
          actions={pvm.margin && <span className="chip">Driver: {top(pvm.margin, gmKeys)}</span>}
        >
          {pvm.margin ? (
            <Waterfall steps={gmKeys.map((k) => ({ label: cap(k), value: pvm.margin[k] }))} total={pvm.margin.total} />
          ) : (
            <p className="empty">Add unit_cost for every product in both periods to split margin into price, volume, mix and cost.</p>
          )}
        </Card>
      </div>

      <Card eyebrow="Decomposition" title="By product family">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Family</th>
                <th className="num">Price</th>
                <th className="num">Volume</th>
                <th className="num">Mix</th>
                <th className="num">Net</th>
                <th>Biggest driver</th>
              </tr>
            </thead>
            <tbody>
              {pvm.byFamily.map((f) => (
                <tr key={f.family}>
                  <td>{f.family}</td>
                  {['price', 'volume', 'mix', 'total'].map((k) => (
                    <td key={k} className={`num ${f[k] >= 0 ? 'pos' : 'neg'}`}>
                      {f[k] > 0 ? `+${money(f[k])}` : money(f[k])}
                    </td>
                  ))}
                  <td>{top(f, revKeys)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card eyebrow="Elasticity signals" title="How volume responded to price" actions={<span className="chip">Signals, not causal conclusions</span>}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product line</th>
                <th className="num">ASP Δ</th>
                <th className="num">Units Δ</th>
                <th>Read</th>
              </tr>
            </thead>
            <tbody>
              {elasticity.map((e) => (
                <tr key={e.label}>
                  <td>{e.label}</td>
                  <td className="num">{pct(e.aspChg)}</td>
                  <td className="num">{pct(e.unitsChg)}</td>
                  <td>
                    <span className="chip subtle">{e.signal}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
