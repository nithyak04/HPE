import { useEffect, useRef } from 'react'

// Wraps a section and marks it complete in progress tracking once roughly
// half of it has been scrolled into view. Also exposes onInteract (via
// context-free prop drilling from children) for sections that should mark
// complete on explicit interaction (flip a card, drag a slider) rather than
// waiting for scroll.
export default function TrackedSection({ id, onVisible, children }) {
  const ref = useRef(null)
  const firedRef = useRef(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !firedRef.current) {
            firedRef.current = true
            onVisible?.()
          }
        })
      },
      { threshold: 0.4 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [onVisible])

  return (
    <section id={id} className="section-block" ref={ref}>
      {children}
    </section>
  )
}
