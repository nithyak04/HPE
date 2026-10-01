import { Link } from 'react-router-dom'
import { modules } from '../../data/modules'
import { useAllModulesProgress } from '../../hooks/useModuleProgress'

export default function LandingPage() {
  const progressList = useAllModulesProgress(modules)
  const completedModules = progressList.filter((p) => p.isModuleComplete).length

  return (
    <>
      <div className="landing-hero">
        <span className="eyebrow">Chips / AI Finance Team</span>
        <h1>HPE</h1>
        <p>
          Short interactive modules covering what HPE sells and how the money works, the tools you’ll use every
          week, and a pricing intelligence engine you can run on real data. Pick a module below — your progress is
          saved on this device.
        </p>

        <div className="overall-progress">
          <span>
            {completedModules} of {modules.length} modules complete
          </span>
          <div className="overall-progress-track">
            <div
              className="overall-progress-fill"
              style={{ width: `${(completedModules / modules.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="module-card-grid">
        {modules.map((mod) => {
          const p = progressList.find((x) => x.id === mod.id)
          return (
            <Link to={`/${mod.id}`} className="module-card" key={mod.id}>
              <span className="module-icon">{mod.icon}</span>
              <h2>{mod.title}</h2>
              <p>{mod.tagline}</p>
              <div className="module-card-progress-track">
                <div className="module-card-progress-fill" style={{ width: `${p.percent}%` }} />
              </div>
              <div className="module-card-footer">
                <span>
                  {p.completedCount}/{p.total} sections {p.isModuleComplete ? '· complete' : ''}
                </span>
                <span className="module-card-cta">{p.completedCount > 0 ? 'Continue →' : 'Start →'}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
