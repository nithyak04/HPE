import { useCallback, useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { getModuleById } from '../../data/modules'
import { useModuleProgress } from '../../hooks/useModuleProgress'
import SectionSidebar from '../layout/SectionSidebar'
import GlobalProgressBar from '../layout/GlobalProgressBar'
import SectionRenderer from '../sections/SectionRenderer'

export default function ModulePage() {
  const { moduleId } = useParams()
  const module = getModuleById(moduleId)
  const [activeId, setActiveId] = useState(module?.sections[0]?.id)

  const progress = useModuleProgress(moduleId, module?.sections.length ?? 0)

  const handleNavigate = useCallback((id) => {
    setActiveId(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Scroll-spy: keep the sidebar highlight in sync with whichever section is
  // currently most visible, so it doesn't just reflect the last click.
  useEffect(() => {
    if (!module) return
    const sectionEls = module.sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean)

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    )

    sectionEls.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [module])

  if (!module) return <Navigate to="/" replace />

  const jumpToNext = () => {
    const nextSection = module.sections[1]
    if (nextSection) handleNavigate(nextSection.id)
  }

  return (
    <>
      <GlobalProgressBar percent={progress.percent} />
      <div className="module-layout">
        <SectionSidebar module={module} activeId={activeId} progress={progress} onNavigate={handleNavigate} />
        <div className="module-content">
          {module.sections.map((section, i) => (
            <SectionRenderer
              key={section.id}
              section={section}
              markComplete={progress.markComplete}
              onJumpNext={i === 0 ? jumpToNext : undefined}
            />
          ))}
        </div>
      </div>
    </>
  )
}
