import { useState } from 'react'
import { money, pct, ptsFmt, STRENGTH_LABEL } from '../../lib/pricingEngine'
import { SevBadge, Icon } from './shared'

const STRENGTH_LEVEL = { strong: 3, moderate: 2, weak: 1, insufficient: 0 }
const CONF_LEVEL = { High: 3, Medium: 2, Low: 1 }

function Tag({ kind }) {
  return <span className={`tag tag-${kind.toLowerCase()}`}>{kind}</span>
}

export function Verdict({ verdict, size }) {
  return <span className={`verdict v-${verdict.toLowerCase().replace(/\s+/g, '-')}${size ? ` ${size}` : ''}`}>{verdict}</span>
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

const CHAIN = ['FACT', 'SIGNAL', 'HYPOTHESIS', 'RECOMMENDATION', 'ACTION', 'OUTCOME']

// Price path across every period in the file: competitor vs us, plus volume
// and share, so a multi-period move reads as one story.
function PricePath({ items }) {
  const withPath = items.filter((i) => i.series?.length >= 3).slice(0, 3)
  if (!withPath.length) return null
  return (
    <div className="detail-block">
      <h5>
        Price path <Tag kind="FACT" />
      </h5>
      {withPath.map((it) => {
        const s = it.series
        const first = s[0]
        const last = s.at(-1)
        const compCum = first.compPrice && last.compPrice ? last.compPrice / first.compPrice - 1 : null
        const aspCum = last.asp / first.asp - 1
        const shareCum = first.share != null && last.share != null ? last.share - first.share : null
        const rows = [
          first.compPrice != null && { label: it.competitor || 'Competitor', key: 'compPrice', fmt: (v, p) => `${money(v)}${p.compPromo ? ' ᴾ' : ''}` },
          { label: 'Our ASP', key: 'asp', fmt: (v) => money(v) },
          { label: 'Units', key: 'units', fmt: (v) => Math.round(v).toLocaleString() },
          first.share != null && { label: 'Share', key: 'share', fmt: (v) => `${v.toFixed(1)}%` },
        ].filter(Boolean)
        return (
          <div key={it.key} className="path">
            {items.length > 1 && <div className="path-title">{it.label}</div>}
            <div className="table-wrap">
              <table className="data-table path-table">
                <thead>
                  <tr>
                    <th />
                    {s.map((p) => (
                      <th key={p.period} className="num">
                        {p.period}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td>{r.label}</td>
                      {s.map((p, i) => {
                        const prev = s[i - 1]?.[r.key]
                        const d = prev ? p[r.key] / prev - 1 : null
                        return (
                          <td key={p.period} className="num">
                            {p[r.key] != null ? r.fmt(p[r.key], p) : '—'}
                            {d != null && Math.abs(d) >= 0.005 && r.key !== 'share' && (
                              <span className={`path-d ${d < 0 ? 'neg' : 'pos'}`}>{pct(d, { digits: 0 })}</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="path-story">
              Since {first.period}: {compCum != null && `${it.competitor || 'competitor'} ${pct(compCum)}, `}our ASP {pct(aspCum)}
              {shareCum != null && `, share ${ptsFmt(shareCum)}`}.
              {s.some((p) => p.compPromo) && <span className="muted"> ᴾ = promotional price.</span>}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export function SignalDetail({ signal }) {
  const d = signal.decision
  return (
    <div className="signal-detail">
      <ol className="chain" aria-label="Reasoning chain">
        {CHAIN.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>

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
        <PricePath items={signal.items} />
        <div className="detail-block">
          <h5>
            Competitive context <Tag kind="FACT" />
          </h5>
          <p>{signal.context}</p>
        </div>
      </div>

      <div className="signal-col">
        <div className="detail-block">
          <h5>
            Why it matters <Tag kind="SIGNAL" />
          </h5>
          <p>{signal.why}</p>
        </div>
        <div className="detail-block">
          <h5>
            Likely drivers <Tag kind="HYPOTHESIS" />
          </h5>
          <ol className="driver-list">
            {signal.drivers.map((dr, i) => (
              <li key={i}>
                <span className="driver-rank">{i + 1}</span>
                <span className="driver-text">{dr.text}</span>
                <span className={`driver-strength s-${dr.strength}`}>
                  <Meter level={STRENGTH_LEVEL[dr.strength]} label={STRENGTH_LABEL[dr.strength]} />
                  {STRENGTH_LABEL[dr.strength].replace(' evidence', '')}
                </span>
              </li>
            ))}
          </ol>
          <p className="muted small">To separate them: {signal.distinguish}</p>
        </div>
      </div>

      <section className="decision" aria-label="Engine recommendation">
        <div className="decision-col decision-main">
          <span className="decision-label">Recommendation</span>
          <Verdict verdict={d.verdict} size="lg" />
          <p className="decision-headline">{d.headline}</p>
          <p className="decision-why">
            <strong>Why:</strong> {d.why}
          </p>
          <span className="decision-conf">
            <Meter level={CONF_LEVEL[signal.confidence]} label={`Confidence ${signal.confidence}`} /> {signal.confidence} confidence
          </span>
        </div>
        <div className="decision-col">
          <span className="decision-label">Action</span>
          <p>{signal.action}</p>
          <p className="decision-trigger">
            <strong>Reassess if</strong> {d.reassess.join(' or ')}.
          </p>
        </div>
        <div className="decision-col">
          <span className="decision-label">Outcome</span>
          <div className="exposure-figure">
            {money(d.outcome.amount)}
            <span>/ yr</span>
          </div>
          <p>{signal.exposure.basis}.</p>
          <p className="muted small">Assumes {signal.exposure.assumptions.join('; ').toLowerCase()}.</p>
        </div>
      </section>
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
              <span className="signal-verdict">
                <Verdict verdict={s.decision.verdict} />
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
