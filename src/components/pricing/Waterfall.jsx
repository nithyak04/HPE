import { useState } from 'react'
import { money } from '../../lib/pricingEngine'
import { useElementWidth, niceTicks, Tooltip } from './shared'

const signed = (v) => (v > 0 ? `+${money(v)}` : money(v))

// Change bridge: each effect steps up or down from the prior period, ending in
// the net change. Favorable steps green, unfavorable red, net in neutral ink;
// every bar is also labeled with its signed value.
export default function Waterfall({ steps, total }) {
  const [ref, width] = useElementWidth()
  const [tip, setTip] = useState(null)

  let cum = 0
  const bars = steps.map((s) => {
    const from = cum
    cum += s.value
    return { ...s, from, to: cum }
  })
  bars.push({ label: 'Net change', value: total, from: 0, to: total, net: true })

  const H = 260
  const m = { l: 56, r: 10, t: 22, b: 34 }
  const W = Math.max(width, 260)
  const iw = W - m.l - m.r
  const ih = H - m.t - m.b
  const vals = bars.flatMap((b) => [b.from, b.to, 0])
  let lo = Math.min(...vals)
  let hi = Math.max(...vals)
  const padV = (hi - lo || 1) * 0.15
  lo -= lo < 0 ? padV : 0
  hi += hi > 0 ? padV : 0
  const sy = (v) => m.t + (1 - (v - lo) / (hi - lo)) * ih
  const slot = iw / bars.length
  const bw = Math.min(56, slot * 0.56)

  return (
    <div className="chart-wrap" ref={ref} onMouseLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={W} height={H} role="img" aria-label={`Bridge: ${bars.map((b) => `${b.label} ${signed(b.value)}`).join(', ')}`}>
          {niceTicks(lo, hi, 4).map((t) => (
            <g key={t}>
              <line x1={m.l} x2={m.l + iw} y1={sy(t)} y2={sy(t)} className={t === 0 ? 'axis-zero' : 'grid'} />
              <text x={m.l - 8} y={sy(t) + 4} className="axis-label" textAnchor="end">
                {money(t)}
              </text>
            </g>
          ))}
          {bars.map((b, i) => {
            const x = m.l + slot * i + (slot - bw) / 2
            const top = sy(Math.max(b.from, b.to))
            const h = Math.max(2, Math.abs(sy(b.from) - sy(b.to)))
            const cls = b.net ? 'net' : b.value >= 0 ? 'pos' : 'neg'
            const labelY = b.value >= 0 ? top - 6 : top + h + 14
            return (
              <g
                key={b.label}
                className="wf-bar"
                tabIndex={0}
                onMouseEnter={() => setTip({ x: x + bw / 2, y: top - 8, content: <><strong>{signed(b.value)}</strong><span className="tip-row">{b.label}</span></> })}
                onFocus={() => setTip({ x: x + bw / 2, y: top - 8, content: <><strong>{signed(b.value)}</strong><span className="tip-row">{b.label}</span></> })}
                onBlur={() => setTip(null)}
              >
                <rect x={m.l + slot * i} y={m.t} width={slot} height={ih} className="hit" />
                <rect x={x} y={top} width={bw} height={h} rx={3} className={`wf ${cls}`} />
                <text x={x + bw / 2} y={labelY} textAnchor="middle" className="bar-value">
                  {signed(b.value)}
                </text>
                <text x={x + bw / 2} y={H - 10} textAnchor="middle" className="axis-label">
                  {b.label}
                </text>
                {i < bars.length - 2 && (
                  <line x1={x + bw} x2={x + slot} y1={sy(b.to)} y2={sy(b.to)} className="wf-connector" />
                )}
              </g>
            )
          })}
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  )
}
