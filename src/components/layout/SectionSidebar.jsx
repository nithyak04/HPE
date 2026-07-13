export default function SectionSidebar({ module, activeId, progress, onNavigate }) {
  return (
    <aside className="module-sidebar print-hide">
      <div className="sidebar-progress">
        <div className="sidebar-progress-label">
          <span>Your progress</span>
          <span>
            {progress.completedCount}/{progress.total}
          </span>
        </div>
        <div className="sidebar-progress-track">
          <div className="sidebar-progress-fill" style={{ width: `${progress.percent}%` }} />
        </div>
      </div>

      <div className="module-sidebar-title">{module.title} sections</div>
      <ul className="sidebar-nav-list">
        {module.sections.map((section) => {
          const done = progress.isComplete(section.id)
          const active = activeId === section.id
          return (
            <li key={section.id}>
              <button
                className={`sidebar-nav-item${active ? ' active' : ''}${done ? ' done' : ''}`}
                onClick={() => onNavigate(section.id)}
              >
                <span className="sidebar-check">{done ? '✓' : ''}</span>
                {section.navLabel}
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
