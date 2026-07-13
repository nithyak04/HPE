import { useState } from 'react'

export default function FlipCard({ front, back, onFlip }) {
  const [flipped, setFlipped] = useState(false)

  const toggle = () => {
    const next = !flipped
    setFlipped(next)
    if (next) onFlip?.()
  }

  return (
    <div
      className={`flip-card${flipped ? ' flipped' : ''}`}
      onClick={toggle}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggle()
        }
      }}
    >
      <div className="flip-card-inner">
        <div className="flip-card-face flip-card-front">
          <h4>{front}</h4>
          <span className="flip-hint">Click to flip →</span>
        </div>
        <div className="flip-card-face flip-card-back">
          <p>{back}</p>
        </div>
      </div>
    </div>
  )
}
