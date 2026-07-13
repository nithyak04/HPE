import TrackedSection from '../shared/TrackedSection'
import IntroSection from './IntroSection'
import ToggleSection from './ToggleSection'
import FlipGridSection from './FlipGridSection'
import SimulatorSection from './SimulatorSection'
import ReasonsSection from './ReasonsSection'
import FinanceRoleSection from './FinanceRoleSection'
import WalkthroughSection from './WalkthroughSection'
import CheatsheetSection from './CheatsheetSection'
import GotchasSection from './GotchasSection'

// Maps a section's `type` field (set in the data files) to the component
// that renders it. Add a new section type by adding a component + an entry
// here — data files stay untouched.
const TYPE_MAP = {
  intro: IntroSection,
  toggle: ToggleSection,
  flipgrid: FlipGridSection,
  simulator: SimulatorSection,
  reasons: ReasonsSection,
  'finance-role': FinanceRoleSection,
  walkthrough: WalkthroughSection,
  cheatsheet: CheatsheetSection,
  gotchas: GotchasSection,
}

export default function SectionRenderer({ section, markComplete, onJumpNext }) {
  const Component = TYPE_MAP[section.type]
  if (!Component) return null

  const handleVisible = () => markComplete(section.id)
  const handleInteract = () => markComplete(section.id)

  return (
    <TrackedSection id={section.id} onVisible={handleVisible}>
      <Component section={section} onInteract={handleInteract} onJump={onJumpNext} />
    </TrackedSection>
  )
}
