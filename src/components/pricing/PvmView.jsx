import { money, pct } from '../../lib/pricingEngine'

// Horizontal diverging bars for a price/volume/mix bridge. Favorable bars
// extend right in green, unfavorable left in red; every bar also carries a
// signed value label so polarity never relies on color alone.
function Bridge({ title, bridge, keys }) {
  const rows = [...keys.map((k) => [k, bridge[k]]), ['total', bridge.total]]
  const max = Math.max(...rows.map(([, v]) => Math.abs(v))) || 1
  return (
    <div className="pi-bridge">
      <div className="pi-bridge-head">
        <h5>{title}</h5>
        <span className="pi-meta">
          {money(bridge.prior)} → {money(bridge.current)}
        </span>
      </div>
      {rows.map(([k, v]) => (
        <div className={`pi-bar-row${k === 'total' ? ' total' : ''}`} key={k} title={`${k}: ${money(v, { compact: false })}`}>
          <span className="pi-bar-label">{k === 'total' ? 'Total change' : `${k[0].toUpperCase()}${k.slice(1)} effect`}</span>
          <div className="pi-bar-track">
            <div className="pi-bar-mid" />
            <div
              className={`pi-bar ${v >= 0 ? 'pos' : 'neg'}`}
              style={{ width: `${(Math.abs(v) / max) * 50}%`, [v >= 0 ? 'left' : 'right']: '50%' }}
            />
          </div>
          <span className="pi-bar-value">{v > 0 ? `+${money(v)}` : money(v)}</span>
        </div>
      ))}
    </div>
  )
}

export default function PvmView({ result }) {
  const { pvm, elasticity, meta } = result
  if (!pvm) return <p>Price/volume/mix needs at least two periods with the same products in both.</p>

  return (
    <div className="pi-pvm">
      <p className="pi-meta">
        {meta.current} vs {meta.prior}, period dollars (not annualized), continuing products only.
        {pvm.outside.length > 0 &&
          ` Excludes ${pvm.outside.map((i) => `${i.label} (${i.status})`).join(', ')}.`}
      </p>
      <div className="pi-bridge-grid">
        <Bridge title="Revenue bridge" bridge={pvm.revenue} keys={['price', 'volume', 'mix']} />
        {pvm.margin ? (
          <Bridge title="Gross margin bridge" bridge={pvm.margin} keys={['price', 'volume', 'mix', 'cost']} />
        ) : (
          <div className="pi-bridge">
            <h5>Gross margin bridge</h5>
            <p>Needs unit_cost for every continuing product in both periods.</p>
          </div>
        )}
      </div>

      <h5 className="pi-sub">By product family (revenue)</h5>
      <div className="pi-table-wrap">
        <table className="pi-table">
          <thead>
            <tr>
              <th>Family</th>
              <th className="num">Price</th>
              <th className="num">Volume</th>
              <th className="num">Mix</th>
              <th className="num">Total</th>
              <th>Biggest driver</th>
            </tr>
          </thead>
          <tbody>
            {pvm.byFamily.map((f) => {
              const top = ['price', 'volume', 'mix'].sort((a, b) => Math.abs(f[b]) - Math.abs(f[a]))[0]
              return (
                <tr key={f.family}>
                  <td>{f.family}</td>
                  <td className="num">{money(f.price)}</td>
                  <td className="num">{money(f.volume)}</td>
                  <td className="num">{money(f.mix)}</td>
                  <td className="num">{money(f.total)}</td>
                  <td>{top}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h5 className="pi-sub">Elasticity signals</h5>
      <p className="pi-meta">Signals, not causal conclusions. Only products whose ASP moved at least 1%.</p>
      <div className="pi-table-wrap">
        <table className="pi-table">
          <thead>
            <tr>
              <th>Product</th>
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
                <td>{e.signal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
