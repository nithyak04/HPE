import { useState } from 'react'
import { OPTIONAL_COLUMNS, REQUIRED_COLUMNS } from '../../lib/pricingEngine'
import { Card, Icon } from './shared'

export default function DataView({ result, dataset, onFile, onPaste, onSample, onTemplate, loadError }) {
  const [drag, setDrag] = useState(false)
  const [paste, setPaste] = useState('')
  const preview = dataset.rows.slice(0, 8)
  const cols = preview.length ? Object.keys(preview[0]) : []

  return (
    <div className="stack">
      <div className="grid-2">
        <Card eyebrow="Load data" title="Bring your pricing file">
          <label
            className={`dropzone${drag ? ' over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              const f = e.dataTransfer.files?.[0]
              if (f) onFile(f)
            }}
          >
            <Icon name="upload" size={22} />
            <strong>Drop a CSV here or click to browse</strong>
            <span className="muted small">Read in your browser. Nothing is uploaded.</span>
            <input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && (onFile(e.target.files[0]), (e.target.value = ''))} />
          </label>
          <div className="btn-row">
            <button className="btn" onClick={onSample}>
              Load sample data
            </button>
            <button className="btn ghost" onClick={onTemplate}>
              <Icon name="download" size={15} /> CSV template
            </button>
          </div>
          <details className="paste-box">
            <summary>Or paste CSV text</summary>
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={5} placeholder="period,sku,asp,units,…" aria-label="Paste CSV" />
            <button className="btn primary" disabled={!paste.trim()} onClick={() => onPaste(paste)}>
              Run engine on pasted data
            </button>
          </details>
          {loadError && <p className="callout">{loadError}</p>}
        </Card>

        <Card eyebrow="Coverage" title="What the engine can see">
          <ul className="coverage">
            {REQUIRED_COLUMNS.map((c) => (
              <li key={c} className={result.error ? 'off' : 'on'}>
                <Icon name={result.error ? 'dash' : 'check'} size={15} />
                <code>{c}</code>
                <span>required</span>
              </li>
            ))}
            {Object.entries(OPTIONAL_COLUMNS).map(([c, what]) => {
              const on = result.present?.[c]
              return (
                <li key={c} className={on ? 'on' : 'off'}>
                  <Icon name={on ? 'check' : 'dash'} size={15} />
                  <code>{c}</code>
                  <span>{what}</span>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      {result.dataGaps?.length > 0 && (
        <Card eyebrow="Data gaps" title="Skipped or limited, not guessed">
          <ul className="plain-list">
            {result.dataGaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card eyebrow="Preview" title={`${dataset.name} · first ${preview.length} of ${dataset.rows.length} rows`}>
        <div className="table-wrap">
          <table className="data-table compact">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c}>{String(r[c] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
