import { useEffect, useRef, useState } from 'react'
import { ANALYST_QUESTIONS, answerQuestion, matchQuestion } from '../../lib/pricingEngine'
import { Icon } from './shared'

// Question → answer console over the engine result. Free text is matched to
// the closest supported question; every answer is computed from the loaded
// data, never generated, and anything outside the supported set says so.
let seq = 0

export default function AnalystMode({ result, runKey }) {
  const [thread, setThread] = useState([{ id: seq++, qid: 'first', text: ANALYST_QUESTIONS[0].q }])
  const [text, setText] = useState('')
  const [pending, setPending] = useState(null)
  const endRef = useRef(null)
  const matched = result.items.filter((i) => i.status === 'matched').length

  useEffect(() => {
    setThread([{ id: seq++, qid: 'first', text: ANALYST_QUESTIONS[0].q }])
  }, [runKey])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [thread, pending])

  const ask = (q) => {
    const question = q.trim()
    if (!question || pending) return
    const hit = ANALYST_QUESTIONS.find((x) => x.q === question) || matchQuestion(question)
    setText('')
    setPending(question)
    setTimeout(() => {
      setThread((t) => [...t, { id: seq++, qid: hit?.id ?? null, text: question }])
      setPending(null)
    }, 380)
  }

  return (
    <div className="console">
      <div className="console-thread">
        {thread.map((m) => {
          const ans = m.qid ? answerQuestion(result, m.qid) : null
          const canonical = m.qid && ANALYST_QUESTIONS.find((x) => x.id === m.qid).q
          return (
            <div key={m.id} className="exchange">
              <div className="msg-user">{m.text}</div>
              <div className="msg-engine">
                <div className="msg-engine-head">
                  <span className="engine-glyph">
                    <Icon name="spark" size={14} />
                  </span>
                  Engine
                  <span className="muted">
                    {ans ? `· computed from ${matched} product lines${canonical !== m.text ? ` · read as “${canonical}”` : ''}` : '· outside supported questions'}
                  </span>
                </div>
                {ans ? (
                  <>
                    <p className="msg-answer">{ans.answer}</p>
                    {ans.rows.length > 0 && (
                      <div className="table-wrap">
                        <table className="data-table">
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
                  </>
                ) : (
                  <p className="msg-answer">
                    I can only answer from the loaded pricing data, and that question doesn’t map to an analysis I run. Try one of the
                    suggestions below.
                  </p>
                )}
              </div>
            </div>
          )
        })}
        {pending && (
          <div className="exchange">
            <div className="msg-user">{pending}</div>
            <div className="msg-engine thinking">
              <span className="dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              Querying {matched} product lines…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="console-input">
        <div className="suggestions">
          {ANALYST_QUESTIONS.slice(1).map((q) => (
            <button key={q.id} className="suggestion" onClick={() => ask(q.q)}>
              {q.q}
            </button>
          ))}
        </div>
        <form
          className="ask-bar"
          onSubmit={(e) => {
            e.preventDefault()
            ask(text)
          }}
        >
          <Icon name="spark" size={16} />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask about price, margin, competitors, discounting…"
            aria-label="Ask the pricing engine"
          />
          <button type="submit" className="btn primary icon-only" aria-label="Ask" disabled={!text.trim() || !!pending}>
            <Icon name="send" size={16} />
          </button>
        </form>
      </div>
    </div>
  )
}
