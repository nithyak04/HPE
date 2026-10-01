import { useState } from 'react'
import { money, STRENGTH_LABEL } from '../../lib/pricingEngine'
import { SevBadge, Icon } from './shared'

const STRENGTH_LEVEL = { strong: 3, moderate: 2, weak: 1, insufficient: 0 }
const CONF_LEVEL = { High: 3, Medium: 2, Low: 1 }

function Tag({ kind }) {
  return <span className={`tag tag-${kind.toLowerCase()}`}>{kind}</span>
}

function Meter({ level, max = 3, label }) {
  return (
    <span className="meter" role="img" aria-label={label}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < level ? 'on' : ''} />
      ))}
    </span>
  )
}

function where(signal) {
  return signal.items.length > 1 ? `${signal.items.length} product lines` : signal.items[0].label
}

export function SignalDetail({ signal }) {
  return (
    <div className="signal-detail">
      <div className="signal-col">
        <div className="detail-block">
          <h5>
            Observed <Tag kind="FACT" />
          </h5>
          <ul className="fact-list">
            {signal.what.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
        <div className="detail-block">
          <h5>
            Why it matters <Tag kind="SIGNAL" />
          </h5>
          <p>{signal.why}</p>
        </div>
        <div className="detail-block">
          <h5>
            Competitive context <Tag kind="FACT" />
          </h5>
          <p>{signal.context}</p>
        </div>
      </div>
      <div className="signal-col">
        <div className="detail-block exposure-block">
          <h5>Estimated exposure</h5>
          <div className="exposure-figure">
            {money(signal.exposure.amount)}
            <span>/ yr</span>
          </div>
          <p>{signal.exposure.basis}.</p>
          <p className="muted small">Assumes {signal.exposure.assumptions.join('; ').toLowerCase()}.</p>
        </div>
        <div className="detail-block">
          <h5>
            Likely drivers <Tag kind="HYPOTHESIS" />
          </h5>
          <ol className="driver-list">
            {signal.drivers.map((d, i) => (
              <li key={i}>
                <span className="driver-rank">{i + 1}</span>
                <span className="driver-text">{d.text}</span>
                <span className={`driver-strength s-${d.strength}`}>
                  <Meter level={STRENGTH_LEVEL[d.strength]} label={STRENGTH_LABEL[d.strength]} />
                  {STRENGTH_LABEL[d.strength].replace(' evidence', '')}
                </span>
              </li>
            ))}
          </ol>
          <p className="muted small">To separate them: {signal.distinguish}</p>
        </div>
      </div>
      <div className="next-step">
        <Tag kind="RECOMMENDATION" />
        <p>{signal.action}</p>
      </div>
    </div>
  )
}

export default function SignalFeed({ signals, floor, initialOpen }) {
  const [open, setOpen] = useState(initialOpen ?? null)
  const max = Math.max(...signals.map((s) => s.exposure.amount), 1)

  if (!signals.length) return <p className="empty">No signals match.</p>

  return (
    <ul className="signal-feed">
      {signals.map((s) => {
        const isOpen = open === s.id
        const suppressed = floor != null && s.exposure.amount < floor
        return (
          <li key={s.id} className={`signal sev-line-${s.severity}${isOpen ? ' open' : ''}`}>
            <button className="signal-row" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
              <SevBadge severity={s.severity} compact />
              <span className="signal-main">
                <span className="signal-title">{s.title}</span>
                <span className="signal-where">
                  {s.items[0].family} · {where(s)}
                  {suppressed && <span className="suppressed-tag">below floor</span>}
                </span>
              </span>
              <span className="signal-exposure">
                <span className="signal-amount">{money(s.exposure.amount)}</span>
                <span className="exposure-track">
                  <span className={`exposure-fill f-${s.severity}`} style={{ width: `${Math.max(2, (s.exposure.amount / max) * 100)}%` }} />
                </span>
              </span>
              <span className="signal-conf" title={`Confidence: ${s.confidence}`}>
                <Meter level={CONF_LEVEL[s.confidence]} label={`Confidence ${s.confidence}`} />
                <span>{s.confidence}</span>
              </span>
              <span className="signal-chevron">
                <Icon name="chevron" size={16} />
              </span>
            </button>
            {isOpen && <SignalDetail signal={s} />}
          </li>
        )
      })}
    </ul>
  )
}
