import SectionHeader from './SectionHeader'

export default function FinanceRoleSection({ section }) {
  const { eyebrow, title, lede, content } = section

  return (
    <>
      <SectionHeader eyebrow={eyebrow} title={title} lede={lede} />
      <div className="reason-grid">
        {content.items.map((item) => (
          <div className="reason-card" key={item.title}>
            <h4>{item.title}</h4>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
    </>
  )
}
