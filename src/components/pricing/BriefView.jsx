import { money, pct } from '../../lib/pricingEngine'
import EngineRun from './EngineRun'
import KpiStrip from './KpiStrip'
import SignalFeed, { Verdict } from './SignalFeed'
import PositioningMap from './PositioningMap'
import { Card, SevBadge } from './shared'

const OUTCOME = {
  held: { label: 'Held up', cls: 'ok' },
  missed: { label: 'Trigger hit', cls: 'bad' },
  open: { label: 'Open', cls: 'open' },
  nodata: { label: 'No data', cls: 'open' },
}

function DecisionBrief({ brief, onNavigate }) {
  return (
    <section className="decision-brief">
      <div className="db-col">
        <span className="db-label">What you need to know</span>
        <ul className="db-know">
          {brief.know.map((k, i) => (
            <li key={i}>{k}</li>
          ))}
        </ul>
      </div>
      <div className="db-col db-decide">
        <span className="db-label">
          What needs a decision <span className="db-count">{brief.decisionCount}</span>
        </span>
        <ul className="db-decisions">
          {brief.decide.map((a) => (
            <li key={a.id}>
              <Verdict verdict={a.decision.verdict} />
              <span className="db-decision-body">
                <strong>{a.decision.headline}</strong>
                <span className="muted small">
                  {a.items.length > 1 ? `${a.items.length} products` : a.items[0].label} · {money(a.decision.outcome.amount)} {a.decision.outcome.label}
                </span>
              </span>
            </li>
          ))}
        </ul>
        {brief.decisionCount > brief.decide.length && (
          <button className="btn ghost small" onClick={() => onNavigate('signals')}>
            All {brief.decisionCount} decisions →
          </button>
        )}
      </div>
      <div className="db-col">
        <span className="db-label">
          What to watch <span className="db-count">{brief.watch.length}</span>
        </span>
        <p className="muted small">Below intervention thresholds or already self-correcting. No action yet.</p>
        <ul className="db-watch">
          {brief.watch.slice(0, 4).map((w) => (
            <li key={w.id}>
              {w.title} <span className="muted">· {w.items[0].sku}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function TrackRecord({ t }) {
  return (
    <Card eyebrow="Outcome loop" title={`Calls made on ${t.issuedIn} data, checked against ${t.checkedIn}`}>
      <div className="tr-summary">
        <span className="tr-stat ok">{t.held} held up</span>
        <span className="tr-stat bad">{t.missed} trigger hit</span>
        {t.rows.length - t.held - t.missed > 0 && <span className="tr-stat open">{t.rows.length - t.held - t.missed} open</span>}
      </div>
      <ul className="tr-list">
        {t.rows.map((r) => (
          <li key={r.id}>
            <span className={`tr-badge ${OUTCOME[r.status].cls}`}>{OUTCOME[r.status].label}</span>
            <span className="tr-body">
              <span>
                <Verdict verdict={r.verdict} /> <strong>{r.where}</strong>
              </span>
              <span className="muted small">{r.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="muted small tr-note">
        The engine reruns itself on {t.basis} and grades each call against the latest period. It checks whether the data still supports the call, not
        whether the team acted on it.
      </p>
    </Card>
  )
}

function PatternCard({ p }) {
  return (
    <article className={`pattern p-${p.severity}`}>
      <div className="pattern-head">
        <SevBadge severity={p.severity} compact />
        <span className="card-eyebrow">Engine-detected pattern</span>
      </div>
      <h4>{p.title}</h4>
      <p className="muted small">{p.scope}</p>
      <dl className="pattern-metrics">
        {p.metrics.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="pattern-exposure">
        <strong>{money(p.exposure)}</strong> <span className="muted small">{p.exposureLabel}</span>
      </div>
      <p className="small">
        <span className="tag tag-hypothesis">HYPOTHESIS</span> {p.driver}
      </p>
      <p className="small">
        <span className="tag tag-recommendation">INVESTIGATE</span> {p.investigate}
      </p>
    </article>
  )
}

export default function BriefView({ result, runKey, ms, onNavigate }) {
  const { alerts, signals, moves, questions, meta, brief, patterns, trackRecord } = result
  const topMoves = moves.filter((m) => m.change != null).slice(0, 5)

  return (
    <div className="stack">
      <EngineRun result={result} runKey={runKey} ms={ms} />
      <KpiStrip result={result} />
      <DecisionBrief brief={brief} onNavigate={onNavigate} />

      <Card
        eyebrow="Priority signals"
        title={`Top ${Math.min(6, alerts.length)} of ${signals.length}, ranked by severity then exposure`}
        actions={
          <button className="btn ghost small" onClick={() => onNavigate('signals')}>
            All signals →
          </button>
        }
      >
        <SignalFeed signals={alerts.slice(0, 6)} initialOpen={alerts[0]?.id} />
      </Card>

      <div className="grid-2">
        {trackRecord && trackRecord.rows.length > 0 && <TrackRecord t={trackRecord} />}
        {patterns.length > 0 && (
          <div className="stack">
            {patterns.map((p) => (
              <PatternCard key={p.title} p={p} />
            ))}
          </div>
        )}
      </div>

      <div className="grid-2">
        <Card eyebrow="Competitive moves" title={`${moves.length} competitor price events`}>
          <ul className="move-list">
            {topMoves.map((m, i) => (
              <li key={i}>
                <span className={`move-delta ${m.change < 0 ? 'neg' : 'pos'}`}>
                  {m.change < 0 ? '↓' : '↑'} {pct(Math.abs(m.change), { signed: false })}
                </span>
                <span className="move-body">
                  <strong>{m.competitor}</strong> {m.product}
                  <span className="muted small">
                    vs {m.against} · {m.kind}
                  </span>
                </span>
              </li>
            ))}
            {!topMoves.length && <li className="muted">No moves above the ±2% noise band.</li>}
          </ul>
        </Card>

        <Card eyebrow="Needs your call" title="Questions for human review" className="review-card">
          <ol className="question-list">
            {questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </Card>
      </div>

      <Card
        eyebrow="Competitive positioning"
        title={`Where each product line sits vs its competitor, ${meta.current}`}
        actions={
          <button className="btn ghost small" onClick={() => onNavigate('map')}>
            Full map →
          </button>
        }
      >
        <PositioningMap result={result} compact />
      </Card>
    </div>
  )
}
