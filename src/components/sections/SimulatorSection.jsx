import { useState } from 'react'
import SectionHeader from './SectionHeader'

const currencyFmt = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export default function SimulatorSection({ section, onInteract }) {
  const { eyebrow, title, lede, content } = section
  const [usage, setUsage] = useState(content.default)
  const [touched, setTouched] = useState(false)

  const monthlyBill = content.baseFee + content.ratePerUnit * (usage / 10)
  const annualized = monthlyBill * 12

  const handleChange = (e) => {
    setUsage(Number(e.target.value))
    if (!touched) {
      setTouched(true)
      onInteract?.()
    }
  }

  return (
    <>
      <SectionHeader eyebrow={eyebrow} title={title} lede={lede} />
      <div className="simulator-panel">
        <div className="simulator-readout">
          <span className="simulator-amount">{currencyFmt(monthlyBill)}</span>
          <span className="simulator-amount-label">/ month at {usage}% usage</span>
        </div>
        <p className="simulator-sub">{content.explanation}</p>

        <div className="simulator-slider-row">
          <div className="simulator-slider-labels">
            <span>Low usage</span>
            <span>{content.unit}</span>
            <span>High usage</span>
          </div>
          <input
            type="range"
            min={content.min}
            max={content.max}
            step={content.step}
            value={usage}
            onChange={handleChange}
            aria-label="Monthly usage percentage"
          />
          <p className="simulator-slider-print-note">
            Printed default state: {content.default}% usage shown ({currencyFmt(
              content.baseFee + content.ratePerUnit * (content.default / 10)
            )}
            /month). Try the live slider in the app to explore other usage levels.
          </p>
        </div>

        <div className="simulator-compare">
          <div className="compare-card highlight">
            <h5>GreenLake — this month</h5>
            <div className="value">{currencyFmt(monthlyBill)}</div>
          </div>
          <div className="compare-card">
            <h5>GreenLake — annualized</h5>
            <div className="value">{currencyFmt(annualized)}</div>
          </div>
          <div className="compare-card">
            <h5>{content.traditionalPurchaseLabel}</h5>
            <div className="value">{currencyFmt(content.traditionalPurchasePrice)}</div>
          </div>
        </div>
      </div>
    </>
  )
}
