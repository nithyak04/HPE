import { pct } from '../../lib/pricingEngine'
import EngineRun from './EngineRun'
import KpiStrip from './KpiStrip'
import SignalFeed from './SignalFeed'
import PositioningMap from './PositioningMap'
import { Card } from './shared'

export default function BriefView({ result, runKey, ms, onNavigate }) {
  const { alerts, signals, moves, trends, questions, meta, summary } = result
  const topMoves = moves.filter((m) => m.change != null).slice(0, 6)

  return (
    <div className="stack">
      <EngineRun result={result} runKey={runKey} ms={ms} />
      <KpiStrip result={result} />

      <div className="grid-main">
        <div className="stack">
          <Card eyebrow="Executive summary" title="What the pricing team should know today" className="summary-card">
            <ol className="summary-list">
              {summary.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </Card>

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
        </div>

        <div className="stack">
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

          <Card eyebrow="Emerging trends" title="Patterns across products">
            {trends.length ? (
              <ul className="plain-list">
                {trends.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            ) : (
              <p className="empty">No pattern repeats across two or more products, regions or competitors.</p>
            )}
          </Card>

          <Card eyebrow="Needs your call" title="Questions for human review" className="review-card">
            <ol className="question-list">
              {questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </Card>
        </div>
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
