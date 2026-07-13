import SectionHeader from './SectionHeader'

export default function CheatsheetSection({ section }) {
  const { eyebrow, title, lede, content } = section

  return (
    <>
      <SectionHeader eyebrow={eyebrow} title={title} lede={lede} />
      <div className="cheatsheet-list">
        {content.prompts.map((p, i) => (
          <div className="cheatsheet-item" key={i}>
            <div className="cheatsheet-prompt">&ldquo;{p.prompt}&rdquo;</div>
            <p className="cheatsheet-when">{p.when}</p>
          </div>
        ))}
      </div>
    </>
  )
}
