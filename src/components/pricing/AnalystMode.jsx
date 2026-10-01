import { useState } from 'react'
import { ANALYST_QUESTIONS, answerQuestion, matchQuestion } from '../../lib/pricingEngine'

// Natural-language-ish Q&A over the engine result. This is a rules engine,
// not an LLM: free text is matched to the closest supported question, and the
// answer is computed from the data — never generated.
export default function AnalystMode({ result }) {
  const [activeId, setActiveId] = useState(ANALYST_QUESTIONS[0].id)
  const [text, setText] = useState('')
  const [miss, setMiss] = useState(false)

  const ask = (e) => {
    e.preventDefault()
    const q = matchQuestion(text)
    if (q) {
      setActiveId(q.id)
      setMiss(false)
    } else setMiss(true)
  }

  const active = ANALYST_QUESTIONS.find((q) => q.id === activeId)
  const ans = answerQuestion(result, activeId)

  return (
    <div className="pi-analyst">
      <form className="pi-ask" onSubmit={ask}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask a question, e.g. “where are we losing price?”"
          aria-label="Ask the pricing engine a question"
        />
        <button type="submit" className="pi-btn">
          Ask
        </button>
      </form>
      {miss && (
        <p className="callout">
          That doesn’t map to a question the engine can answer from this data. Pick one of the questions below.
        </p>
      )}

      <div className="pi-chips">
        {ANALYST_QUESTIONS.map((q) => (
          <button key={q.id} className={`pi-chip${q.id === activeId ? ' active' : ''}`} onClick={() => setActiveId(q.id)}>
            {q.q}
          </button>
        ))}
      </div>

      <div className="pi-answer">
        <h5>{active.q}</h5>
        <p>{ans.answer}</p>
        {ans.rows.length > 0 && (
          <div className="pi-table-wrap">
            <table className="pi-table">
              <thead>
                <tr>
                  {ans.columns.map((c) => (
                    <th key={c.key} className={c.fmt ? 'num' : undefined}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ans.rows.map((r, i) => (
                  <tr key={i}>
                    {ans.columns.map((c) => (
                      <td key={c.key} className={c.fmt ? 'num' : undefined}>
                        {c.fmt ? c.fmt(r[c.key]) : r[c.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
