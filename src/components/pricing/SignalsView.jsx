import { useState } from 'react'
import { money } from '../../lib/pricingEngine'
import SignalFeed from './SignalFeed'
import { Card, SEV } from './shared'

const FILTERS = ['all', 'high', 'watch', 'opportunity']

export default function SignalsView({ result }) {
  const [filter, setFilter] = useState('all')
  const [showSuppressed, setShowSuppressed] = useState(true)
  const { signals, meta } = result
  const count = (f) => signals.filter((s) => f === 'all' || s.severity === f).length
  const list = signals.filter(
    (s) => (filter === 'all' || s.severity === filter) && (showSuppressed || s.exposure.amount >= meta.floor)
  )
  const suppressed = signals.filter((s) => s.exposure.amount < meta.floor).length

  return (
    <Card
      eyebrow="Signal feed"
      title={`${signals.length} signals detected · ${result.alerts.length} in the brief`}
      actions={
        <label className="switch">
          <input type="checkbox" checked={showSuppressed} onChange={(e) => setShowSuppressed(e.target.checked)} />
          Show {suppressed} below the {money(meta.floor)} floor
        </label>
      }
    >
      <div className="filter-row" role="tablist">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} className={`filter${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f !== 'all' && <span className="legend-dot" style={{ background: SEV[f].color }} />}
            {f === 'all' ? 'All' : SEV[f].label}
            <span className="filter-count">{count(f)}</span>
          </button>
        ))}
      </div>
      <SignalFeed signals={list} floor={meta.floor} />
    </Card>
  )
}
