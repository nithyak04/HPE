import { useMemo, useRef, useState } from 'react'
import SectionHeader from './SectionHeader'
import PricingBrief from '../pricing/PricingBrief'
import AnalystMode from '../pricing/AnalystMode'
import PvmView from '../pricing/PvmView'
import { analyze, parseCsv, money } from '../../lib/pricingEngine'
import { SAMPLE_ROWS, rowsToCsv } from '../../data/pricingSample'

const TABS = [
  { id: 'brief', label: 'Brief' },
  { id: 'analyst', label: 'Analyst mode' },
  { id: 'pvm', label: 'Price / volume / mix' },
]

export default function PricingEngineSection({ section, onInteract }) {
  const { eyebrow, title, lede } = section
  const [dataset, setDataset] = useState({ name: 'Illustrative sample (synthetic)', rows: SAMPLE_ROWS, sample: true })
  const [periodType, setPeriodType] = useState('quarter')
  const [floorInput, setFloorInput] = useState('')
  const [tab, setTab] = useState('brief')
  const [loadError, setLoadError] = useState(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const fileRef = useRef(null)

  const floor = floorInput === '' ? undefined : Number(floorInput.replace(/[$,\s]/g, ''))
  const result = useMemo(
    () => analyze(dataset.rows, { periodType, materialityFloor: Number.isFinite(floor) ? floor : undefined }),
    [dataset, periodType, floor]
  )

  const load = (name, rows, sample = false) => {
    setDataset({ name, rows, sample })
    setFloorInput('')
    setLoadError(null)
    onInteract?.()
  }

  const loadCsv = (name, text) => {
    try {
      const rows = parseCsv(text)
      if (!rows.length) throw new Error('No data rows found.')
      load(name, rows)
    } catch (err) {
      setLoadError(`Couldn’t read ${name}: ${err.message}`)
    }
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => loadCsv(file.name, String(reader.result))
    reader.onerror = () => setLoadError(`Couldn’t read ${file.name}.`)
    reader.readAsText(file)
    e.target.value = ''
  }

  const downloadTemplate = () => {
    const blob = new Blob([rowsToCsv(SAMPLE_ROWS)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pricing-engine-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <SectionHeader eyebrow={eyebrow} title={title} lede={lede} />

      <div className="pi-panel print-hide">
        <div className="pi-controls">
          <div className="pi-control-group">
            <button className="pi-btn" onClick={() => load('Illustrative sample (synthetic)', SAMPLE_ROWS, true)}>
              Load sample data
            </button>
            <button className="pi-btn primary" onClick={() => fileRef.current?.click()}>
              Upload CSV
            </button>
            <button className="pi-btn" onClick={() => setPasteOpen((o) => !o)}>
              {pasteOpen ? 'Close paste box' : 'Paste CSV'}
            </button>
            <button className="pi-btn ghost" onClick={downloadTemplate}>
              Download template
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} hidden />
          </div>
          <div className="pi-control-group">
            <label className="pi-field">
              <span>Period length</span>
              <select value={periodType} onChange={(e) => setPeriodType(e.target.value)}>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
              </select>
            </label>
            <label className="pi-field">
              <span>Materiality floor ($/yr)</span>
              <input
                type="text"
                inputMode="numeric"
                value={floorInput}
                placeholder={result.meta ? `auto: ${money(result.meta.floor)}` : 'auto'}
                onChange={(e) => setFloorInput(e.target.value)}
              />
            </label>
          </div>
        </div>

        {pasteOpen && (
          <div className="pi-paste">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="period,sku,asp,units,list_price,unit_cost,competitor,competitor_price,…"
              rows={6}
              aria-label="Paste CSV data"
            />
            <button className="pi-btn primary" onClick={() => loadCsv('Pasted data', pasteText)} disabled={!pasteText.trim()}>
              Run engine on pasted data
            </button>
          </div>
        )}

        <p className="pi-dataset">
          Dataset: <strong>{dataset.name}</strong>
          {dataset.sample && ' — made-up products, competitors and numbers for learning the engine. Not real HPE or competitor data.'}
        </p>
        {loadError && <p className="callout">{loadError}</p>}
      </div>

      {result.error ? (
        <p className="callout">{result.error}</p>
      ) : (
        <>
          <div className="toggle-tabs pi-tabs print-hide" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`toggle-tab${tab === t.id ? ' active' : ''}`}
                onClick={() => {
                  setTab(t.id)
                  onInteract?.()
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'brief' && <PricingBrief result={result} />}
          {tab === 'analyst' && <AnalystMode result={result} />}
          {tab === 'pvm' && <PvmView result={result} />}
        </>
      )}
    </>
  )
}
