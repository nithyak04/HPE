import { useState } from 'react'
import SectionHeader from './SectionHeader'

export default function ToggleSection({ section, onInteract }) {
  const { eyebrow, title, lede, content } = section
  const [activeId, setActiveId] = useState(content.tabs[0].id)
  const active = content.tabs.find((t) => t.id === activeId)

  const select = (id) => {
    setActiveId(id)
    onInteract?.()
  }

  return (
    <>
      <SectionHeader eyebrow={eyebrow} title={title} lede={lede} />
      <div className="toggle-tabs">
        {content.tabs.map((tab) => (
          <button
            key={tab.id}
            className={`toggle-tab${tab.id === activeId ? ' active' : ''}`}
            onClick={() => select(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="toggle-panel">
        <div>
          <h3>{active.label}</h3>
          <p>{active.summary}</p>
          <div className="toggle-panel-tags">
            {active.tags.map((tag) => (
              <span className="tag-pill" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
        <ul className="toggle-panel-list">
          {active.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
    </>
  )
}
