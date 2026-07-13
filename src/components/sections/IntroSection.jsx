import SectionHeader from './SectionHeader'

export default function IntroSection({ section, onJump }) {
  const { eyebrow, title, content } = section

  return (
    <div className="intro-hero">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {content.body.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {content.bullets && (
        <div className="intro-bullets">
          {content.bullets.map((b) => (
            <div className="intro-bullet" key={b.num}>
              <span className="num">{b.num}</span>
              <h4>{b.title}</h4>
              <p>{b.body}</p>
            </div>
          ))}
        </div>
      )}
      {onJump && (
        <button className="start-btn" onClick={onJump}>
          Continue reading ↓
        </button>
      )}
    </div>
  )
}
