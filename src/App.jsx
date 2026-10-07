import { useMemo, useRef, useState } from 'react'
import { analyze, parseCsv, money } from './lib/pricingEngine'
import { SAMPLE_ROWS, rowsToCsv } from './data/pricingSample'
import BriefView from './components/pricing/BriefView'
import SignalsView from './components/pricing/SignalsView'
import PositioningMap from './components/pricing/PositioningMap'
import PvmView from './components/pricing/PvmView'
import AnalystMode from './components/pricing/AnalystMode'
import DataView from './components/pricing/DataView'
import { Card, Icon } from './components/pricing/shared'

const VIEWS = [
  { id: 'brief', label: 'Brief', icon: 'brief', title: 'Pricing Intelligence Brief' },
  { id: 'signals', label: 'Signals', icon: 'signals', title: 'Signal feed' },
  { id: 'map', label: 'Positioning', icon: 'map', title: 'Competitive positioning' },
  { id: 'pvm', label: 'Price / volume / mix', icon: 'bridge', title: 'Price / volume / mix' },
  { id: 'analyst', label: 'Analyst', icon: 'analyst', title: 'Analyst console' },
  { id: 'data', label: 'Data', icon: 'data', title: 'Data' },
]

const SAMPLE = { name: 'Sample dataset', rows: SAMPLE_ROWS, sample: true }

export default function App() {
  const [dataset, setDataset] = useState(SAMPLE)
  const [periodType, setPeriodType] = useState('quarter')
  const [floorInput, setFloorInput] = useState('')
  const [view, setView] = useState('brief')
  const [runKey, setRunKey] = useState(0)
  const [loadError, setLoadError] = useState(null)
  const fileRef = useRef(null)

  const floor = floorInput === '' ? undefined : Number(floorInput.replace(/[$,\s]/g, ''))
  const { result, ms } = useMemo(() => {
    const t0 = performance.now()
    const r = analyze(dataset.rows, { periodType, materialityFloor: Number.isFinite(floor) ? floor : undefined })
    return { result: r, ms: performance.now() - t0 }
  }, [dataset, periodType, floor])

  const load = (ds) => {
    setDataset(ds)
    setFloorInput('')
    setLoadError(null)
    setRunKey((k) => k + 1)
    setView('brief')
  }
  const loadCsv = (name, text) => {
    try {
      const rows = parseCsv(text)
      if (!rows.length) throw new Error('no data rows found')
      load({ name, rows, sample: false })
    } catch (err) {
      setLoadError(`Couldn’t read ${name}: ${err.message}.`)
    }
  }
  const onFile = (file) => {
    const reader = new FileReader()
    reader.onload = () => loadCsv(file.name, String(reader.result))
    reader.onerror = () => setLoadError(`Couldn’t read ${file.name}.`)
    reader.readAsText(file)
  }
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([rowsToCsv(SAMPLE_ROWS)], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'pricing-engine-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const current = VIEWS.find((v) => v.id === view)
  const ok = !result.error
  const badge = ok ? result.signals.filter((s) => s.severity === 'high' && s.exposure.amount >= result.meta.floor).length : 0

  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          <span className="brand-mark">PI</span>
          <span className="brand-text">
            <strong>Pricing Intelligence</strong>
            <span>Strategy engine</span>
          </span>
        </div>
        <nav className="rail-nav" aria-label="Views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={`rail-item${view === v.id ? ' active' : ''}`}
              onClick={() => setView(v.id)}
              disabled={!ok && v.id !== 'data'}
              aria-current={view === v.id ? 'page' : undefined}
            >
              <Icon name={v.icon} />
              <span>{v.label}</span>
              {v.id === 'signals' && badge > 0 && <span className="rail-badge">{badge}</span>}
            </button>
          ))}
        </nav>
        <div className="rail-foot">
          <span className="engine-status">
            <span className={`status-dot${ok ? '' : ' err'}`} />
            {ok ? 'Engine ready' : 'Needs data'}
          </span>
          <p>Rules-based engine. Every output is tagged fact, signal, hypothesis or recommendation. Data stays in this browser.</p>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <span className="crumb">Pricing Strategy Intelligence Engine</span>
            <h1>{current.title}</h1>
          </div>
          <div className="topbar-controls">
            <span className={`dataset-pill${dataset.sample ? ' sample' : ''}`} title={dataset.sample ? 'Synthetic data: made-up products, competitors and numbers' : dataset.name}>
              <span className="status-dot" />
              {dataset.sample ? 'Sample data (synthetic)' : dataset.name}
              {ok && result.meta.prior && <span className="muted"> · {result.meta.current} vs {result.meta.prior}</span>}
            </span>
            <label className="field">
              <span>Period</span>
              <select value={periodType} onChange={(e) => setPeriodType(e.target.value)}>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
              </select>
            </label>
            <label className="field">
              <span>Floor $/yr</span>
              <input
                value={floorInput}
                inputMode="numeric"
                placeholder={ok ? money(result.meta.floor) : 'auto'}
                onChange={(e) => setFloorInput(e.target.value)}
                aria-label="Materiality floor, dollars per year"
              />
            </label>
            <button className="btn primary" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={15} /> Upload CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && (onFile(e.target.files[0]), (e.target.value = ''))} />
          </div>
        </header>

        <main className="content">
          {loadError && view !== 'data' && <p className="callout">{loadError}</p>}
          {!ok && view !== 'data' ? (
            <Card title="The engine couldn’t run on this file">
              <p className="callout">{result.error}</p>
              <button className="btn" onClick={() => setView('data')}>
                Go to Data
              </button>
            </Card>
          ) : (
            <>
              {view === 'brief' && <BriefView result={result} runKey={runKey} ms={ms} onNavigate={setView} />}
              {view === 'signals' && <SignalsView result={result} />}
              {view === 'map' && (
                <Card eyebrow="Competitive positioning" title="Price premium vs volume response, by product line">
                  <PositioningMap result={result} />
                </Card>
              )}
              {view === 'pvm' && <PvmView result={result} />}
              {view === 'analyst' && <AnalystMode result={result} runKey={runKey} />}
              {view === 'data' && (
                <DataView
                  result={result}
                  dataset={dataset}
                  loadError={loadError}
                  onFile={onFile}
                  onPaste={(t) => loadCsv('Pasted data', t)}
                  onSample={() => load(SAMPLE)}
                  onTemplate={downloadTemplate}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
