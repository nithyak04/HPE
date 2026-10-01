import { money, STRENGTH_LABEL } from '../../lib/pricingEngine'

export const SEVERITY = {
  high: { icon: '🔴', label: 'High priority' },
  watch: { icon: '🟠', label: 'Watch' },
  opportunity: { icon: '🟢', label: 'Opportunity' },
}

// Tag marking what kind of statement each row is — the engine's
// FACT / SIGNAL / HYPOTHESIS / RECOMMENDATION guardrail, made visible.
function Tag({ kind }) {
  return <span className={`pi-tag pi-tag-${kind.toLowerCase()}`}>{kind}</span>
}

export default function AlertCard({ alert }) {
  const sev = SEVERITY[alert.severity]
  const where = alert.items.length > 1 ? alert.items.map((i) => i.label).join(' · ') : alert.items[0].label
  const families = [...new Set(alert.items.map((i) => i.family))].join(', ')

  return (
    <article className={`pi-alert pi-alert-${alert.severity}`}>
      <header className="pi-alert-head">
        <span className="pi-sev">
          {sev.icon} {sev.label}
        </span>
        <span className="pi-confidence">Confidence: {alert.confidence}</span>
      </header>
      <h4 className="pi-alert-title">{alert.title}</h4>
      <p className="pi-alert-where">
        {families} — {where}
      </p>

      <dl className="pi-alert-grid">
        <dt>
          What changed <Tag kind="FACT" />
        </dt>
        <dd>
          <ul>
            {alert.what.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </dd>

        <dt>
          Why it matters <Tag kind="SIGNAL" />
        </dt>
        <dd>{alert.why}</dd>

        <dt>Estimated exposure</dt>
        <dd>
          <span className="pi-exposure">~{money(alert.exposure.amount)}</span> annualized — {alert.exposure.basis}.
          <span className="pi-assumptions">Assumes: {alert.exposure.assumptions.join('; ')}.</span>
        </dd>

        <dt>
          Competitive context <Tag kind="FACT" />
        </dt>
        <dd>{alert.context}</dd>

        <dt>
          Likely drivers <Tag kind="HYPOTHESIS" />
        </dt>
        <dd>
          <ol className="pi-drivers">
            {alert.drivers.map((d, i) => (
              <li key={i}>
                {d.text} — <span className={`pi-strength pi-strength-${d.strength}`}>{STRENGTH_LABEL[d.strength]}</span>
              </li>
            ))}
          </ol>
          <span className="pi-assumptions">To tell these apart: {alert.distinguish}</span>
        </dd>

        <dt>
          Recommended next step <Tag kind="RECOMMENDATION" />
        </dt>
        <dd>{alert.action}</dd>
      </dl>
    </article>
  )
}
