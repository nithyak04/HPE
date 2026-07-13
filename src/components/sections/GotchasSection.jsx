import SectionHeader from './SectionHeader'

export default function GotchasSection({ section }) {
  const { eyebrow, title, lede, content } = section

  return (
    <>
      <SectionHeader eyebrow={eyebrow} title={title} lede={lede} />
      <div className="gotcha-list">
        {content.items.map((item) => (
          <div className="gotcha-card" key={item.title}>
            <h4>⚠ {item.title}</h4>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
    </>
  )
}
