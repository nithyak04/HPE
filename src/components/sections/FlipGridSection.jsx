import SectionHeader from './SectionHeader'
import FlipCard from '../shared/FlipCard'

export default function FlipGridSection({ section, onInteract }) {
  const { eyebrow, title, lede, content } = section

  return (
    <>
      <SectionHeader eyebrow={eyebrow} title={title} lede={lede} />
      <div className="flip-grid">
        {content.cards.map((card) => (
          <FlipCard key={card.front} front={card.front} back={card.back} onFlip={onInteract} />
        ))}
      </div>
    </>
  )
}
