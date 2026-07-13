export default function SectionHeader({ eyebrow, title, lede }) {
  return (
    <div className="section-header">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="section-title">{title}</h2>
      {lede && <p className="section-lede">{lede}</p>}
    </div>
  )
}
