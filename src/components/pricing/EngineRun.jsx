import { useEffect, useState } from 'react'
import { money } from '../../lib/pricingEngine'

// The engine's pipeline, shown as it runs. Each stage reports what it
// actually did on this dataset — the counts are real, only the reveal is
// staggered so you can follow the steps.
export default function EngineRun({ result, runKey, ms }) {
  const { meta, items, signals, alerts, moves } = result
  const withComp = items.filter((i) => i.c?.compPrice != null).length
  const hypotheses = signals.reduce((s, f) => s + f.drivers.length, 0)

  const stages = [
    { label: 'Ingest', detail: `${meta.rows} rows · ${meta.periods.length} period${meta.periods.length > 1 ? 's' : ''}` },
    { label: 'Position', detail: `${withComp} of ${items.length} lines vs competitor` },
    { label: 'Detect', detail: `${signals.length} signals · ${moves.length} competitor moves` },
    { label: 'Decompose', detail: result.pvm ? 'price · volume · mix · cost' : 'needs 2 periods' },
    { label: 'Diagnose', detail: `${hypotheses} hypotheses graded` },
    { label: 'Prioritize', detail: `${alerts.length} cleared ${money(meta.floor)} floor` },
  ]

  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [step, setStep] = useState(reduce ? stages.length : 0)

  useEffect(() => {
    if (reduce) return setStep(stages.length)
    setStep(0)
    let i = 0
    const t = setInterval(() => {
      i += 1
      setStep(i)
      if (i >= stages.length) clearInterval(t)
    }, 170)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey])

  const done = step >= stages.length
  return (
    <div className="engine-run" aria-live="polite">
      <div className="engine-run-head">
        <span className={`engine-pulse${done ? ' done' : ''}`} aria-hidden="true" />
        <span className="engine-run-title">{done ? 'Engine run complete' : 'Running engine…'}</span>
        <span className="engine-run-meta">
          {meta.prior ? `${meta.current} vs ${meta.prior}` : meta.current} · {done ? `${ms < 1 ? '<1' : Math.round(ms)} ms` : '—'}
        </span>
      </div>
      <ol className="engine-stages">
        {stages.map((s, i) => (
          <li key={s.label} className={i < step ? 'done' : i === step ? 'active' : ''}>
            <span className="stage-dot" aria-hidden="true" />
            <span className="stage-label">{s.label}</span>
            <span className="stage-detail">{i < step ? s.detail : ' '}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
