import { useEffect, useRef, useState } from 'react'

// Severity encoding. Colors were run through the dataviz palette validator
// against the dark surface (lightness band, CVD separation, contrast). They are
// always paired with an icon + text label, never color alone.
export const SEV = {
  high: { label: 'High priority', short: 'High', icon: '▲', color: 'var(--sev-high)' },
  watch: { label: 'Watch', short: 'Watch', icon: '◆', color: 'var(--sev-watch)' },
  opportunity: { label: 'Opportunity', short: 'Upside', icon: '●', color: 'var(--sev-opp)' },
  none: { label: 'No signal', short: 'Quiet', icon: '○', color: 'var(--sev-none)' },
}
const SEV_RANK = { high: 0, watch: 1, opportunity: 2, none: 3 }

export function SevBadge({ severity, compact = false }) {
  const s = SEV[severity]
  return (
    <span className={`sev-badge sev-${severity}`}>
      <span className="sev-icon" aria-hidden="true">
        {s.icon}
      </span>
      {compact ? s.short : s.label}
    </span>
  )
}

// Worst severity per product key across every signal (suppressed included).
export function severityByItem(signals) {
  const map = {}
  for (const f of signals) {
    for (const it of f.items) {
      const cur = map[it.key]
      if (!cur || SEV_RANK[f.severity] < SEV_RANK[cur]) map[it.key] = f.severity
    }
  }
  return map
}

export function useElementWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)))
    ro.observe(el)
    setWidth(Math.floor(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

// "Nice" axis ticks: step of 1, 2 or 5 × 10^k giving ~count ticks.
export function niceTicks(min, max, count = 5) {
  const span = max - min || 1
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || 10 * mag
  const ticks = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(+v.toFixed(10))
  return ticks
}

export function Tooltip({ tip }) {
  if (!tip) return null
  return (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.content}
    </div>
  )
}

export function Card({ title, eyebrow, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {eyebrow && <span className="card-eyebrow">{eyebrow}</span>}
            {title && <h3 className="card-title">{title}</h3>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
const ICONS = {
  brief: <path {...P} d="M4 5h16M4 10h10M4 15h16M4 20h8" />,
  signals: <path {...P} d="M3 12h4l3-8 4 16 3-8h4" />,
  map: (
    <g {...P}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="2" />
    </g>
  ),
  bridge: <path {...P} d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  analyst: (
    <g {...P}>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M9 10h6" />
    </g>
  ),
  data: (
    <g {...P}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </g>
  ),
  upload: <path {...P} d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  download: <path {...P} d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
  chevron: <path {...P} d="M9 6l6 6-6 6" />,
  send: <path {...P} d="M5 12h14M13 6l6 6-6 6" />,
  spark: <path {...P} d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />,
  check: <path {...P} d="M5 12l5 5 9-10" />,
  dash: <path {...P} d="M6 12h12" />,
}

export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon">
      {ICONS[name]}
    </svg>
  )
}
