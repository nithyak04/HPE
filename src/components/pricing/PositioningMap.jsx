import { useState } from 'react'
import { money, pct } from '../../lib/pricingEngine'
import { SEV, useElementWidth, niceTicks, Tooltip, severityByItem } from './shared'

// Competitive positioning map.
//   x  = our price premium vs the comparable competitor product (current period)
//   y  = unit change vs prior period
//   size = annualized revenue, color = worst signal on that product line
//   trail = where the premium sat last period
export default function PositioningMap({ result, compact = false }) {
  const [wrapRef, width] = useElementWidth()
  const [tip, setTip] = useState(null)
  const sev = severityByItem(result.signals)

  const pts = result.items.filter((it) => it.c?.premium != null && it.unitsChg != null)
  const excluded = result.items.length - pts.length
  if (!pts.length) return <p className="empty">Positioning needs competitor_price and two periods of units.</p>

  const H = compact ? 320 : 420
  const m = { l: 52, r: 18, t: 18, b: 42 }
  const W = Math.max(width, 300)
  const iw = W - m.l - m.r
  const ih = H - m.t - m.b

  const xs = pts.flatMap((p) => [p.c.premium, p.p?.premium ?? p.c.premium])
  const ys = pts.map((p) => p.unitsChg)
  const pad = (lo, hi) => {
    const span = Math.max(hi - lo, 0.04)
    return [Math.min(lo - span * 0.12, -0.02), Math.max(hi + span * 0.12, 0.02)]
  }
  const [x0, x1] = pad(Math.min(...xs), Math.max(...xs))
  const [y0, y1] = pad(Math.min(...ys), Math.max(...ys))
  const sx = (v) => m.l + ((v - x0) / (x1 - x0)) * iw
  const sy = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * ih
  const maxRev = Math.max(...pts.map((p) => p.annRev))
  const r = (p) => 5 + 15 * Math.sqrt(p.annRev / maxRev)

  // Direct-label the flagged high/opportunity lines plus the largest one,
  // capped so labels don't pile up.
  const labelled = new Set(
    [...pts]
      .sort((a, b) => b.annRev - a.annRev)
      .filter((p, i) => i === 0 || sev[p.key] === 'high' || sev[p.key] === 'opportunity')
      .slice(0, compact ? 4 : 6)
      .map((p) => p.key)
  )
  const short = (p) => `${p.sku} ${p.region !== '—' ? p.region : ''}`.trim()

  const show = (p, e) => {
    const box = wrapRef.current.getBoundingClientRect()
    const cx = sx(p.c.premium)
    const cy = sy(p.unitsChg)
    setTip({
      x: Math.min(Math.max(cx, 110), box.width - 110),
      y: cy - r(p) - 8,
      content: (
        <>
          <strong>{p.label}</strong>
          <span className="tip-row">
            <b>{pct(p.c.premium)}</b> vs {p.competitor || 'competitor'} · was {pct(p.p?.premium)}
          </span>
          <span className="tip-row">
            <b>{pct(p.unitsChg)}</b> units · <b>{money(p.annRev)}</b> /yr
          </span>
          <span className="tip-row">
            <span className="tip-key" style={{ background: SEV[sev[p.key] || 'none'].color }} />
            {SEV[sev[p.key] || 'none'].label}
          </span>
        </>
      ),
    })
    if (e?.type === 'focus') e.target.scrollIntoView?.({ block: 'nearest' })
  }

  const quad = [
    { x: m.l + iw - 8, y: m.t + 14, a: 'end', t: 'Premium · growing' },
    { x: m.l + iw - 8, y: m.t + ih - 8, a: 'end', t: 'Premium · losing volume' },
    { x: m.l + 8, y: m.t + 14, a: 'start', t: 'Value · growing' },
    { x: m.l + 8, y: m.t + ih - 8, a: 'start', t: 'Value · losing volume' },
  ]

  return (
    <div className="posmap">
      <div className="chart-legend">
        {['high', 'watch', 'opportunity', 'none'].map((k) => (
          <span key={k} className="legend-item">
            <span className="legend-dot" style={{ background: SEV[k].color }} />
            {SEV[k].label}
          </span>
        ))}
        <span className="legend-note">Bubble = annualized revenue · trail = premium last period</span>
      </div>
      <div className="chart-wrap" ref={wrapRef} onMouseLeave={() => setTip(null)}>
        {width > 0 && (
          <svg width={W} height={H} role="img" aria-label="Price premium versus unit change by product line">
            {niceTicks(x0, x1, W < 500 ? 4 : 6).map((t) => (
              <g key={`x${t}`}>
                <line x1={sx(t)} x2={sx(t)} y1={m.t} y2={m.t + ih} className={t === 0 ? 'axis-zero' : 'grid'} />
                <text x={sx(t)} y={H - m.b + 18} className="axis-label" textAnchor="middle">
                  {pct(t, { digits: 0 })}
                </text>
              </g>
            ))}
            {niceTicks(y0, y1, 5).map((t) => (
              <g key={`y${t}`}>
                <line x1={m.l} x2={m.l + iw} y1={sy(t)} y2={sy(t)} className={t === 0 ? 'axis-zero' : 'grid'} />
                <text x={m.l - 8} y={sy(t) + 4} className="axis-label" textAnchor="end">
                  {pct(t, { digits: 0 })}
                </text>
              </g>
            ))}
            <text x={m.l + iw / 2} y={H - 4} className="axis-title" textAnchor="middle">
              Price premium vs competitor →
            </text>
            <text transform={`translate(12 ${m.t + ih / 2}) rotate(-90)`} className="axis-title" textAnchor="middle">
              Units vs prior period →
            </text>
            {quad.map((q) => (
              <text key={q.t} x={q.x} y={q.y} textAnchor={q.a} className="quad-label">
                {q.t}
              </text>
            ))}

            {pts.map((p) => {
              const c = SEV[sev[p.key] || 'none'].color
              const px = p.p?.premium
              return (
                px != null &&
                Math.abs(sx(px) - sx(p.c.premium)) > 3 && (
                  <g key={`t${p.key}`} className="trail">
                    <line x1={sx(px)} x2={sx(p.c.premium)} y1={sy(p.unitsChg)} y2={sy(p.unitsChg)} stroke={c} />
                    <circle cx={sx(px)} cy={sy(p.unitsChg)} r={3} stroke={c} />
                  </g>
                )
              )
            })}

            {[...pts]
              .sort((a, b) => b.annRev - a.annRev)
              .map((p) => (
                <g
                  key={p.key}
                  className="bubble"
                  tabIndex={0}
                  onMouseEnter={(e) => show(p, e)}
                  onFocus={(e) => show(p, e)}
                  onBlur={() => setTip(null)}
                >
                  <circle cx={sx(p.c.premium)} cy={sy(p.unitsChg)} r={Math.max(12, r(p) + 4)} className="hit" />
                  <circle cx={sx(p.c.premium)} cy={sy(p.unitsChg)} r={r(p)} fill={SEV[sev[p.key] || 'none'].color} className="dot" />
                </g>
              ))}

            {pts
              .filter((p) => labelled.has(p.key))
              .map((p) => {
                const right = sx(p.c.premium) < m.l + iw - 110
                return (
                  <text
                    key={`l${p.key}`}
                    x={sx(p.c.premium) + (right ? r(p) + 6 : -(r(p) + 6))}
                    y={sy(p.unitsChg) + 4}
                    textAnchor={right ? 'start' : 'end'}
                    className="point-label"
                  >
                    {short(p)}
                  </text>
                )
              })}
          </svg>
        )}
        <Tooltip tip={tip} />
      </div>
      {excluded > 0 && (
        <p className="muted small">{excluded} line{excluded > 1 ? 's' : ''} not plotted (no competitor price or no prior period).</p>
      )}
      <details className="table-toggle">
        <summary>View as table</summary>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product line</th>
                <th className="num">Premium now</th>
                <th className="num">Premium prior</th>
                <th className="num">Units Δ</th>
                <th className="num">Revenue /yr</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {pts.map((p) => (
                <tr key={p.key}>
                  <td>{p.label}</td>
                  <td className="num">{pct(p.c.premium)}</td>
                  <td className="num">{pct(p.p?.premium)}</td>
                  <td className="num">{pct(p.unitsChg)}</td>
                  <td className="num">{money(p.annRev)}</td>
                  <td>{SEV[sev[p.key] || 'none'].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
