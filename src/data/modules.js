import { hpe101 } from './hpe101'
import { copilotPowerBi } from './copilotPowerBi'
import { pricingIntelligence } from './pricingIntelligence'

// Ordered list of every module in the app. Add a new module by importing its
// data object and pushing it here — the landing page and routing pick it up
// automatically.
export const modules = [hpe101, copilotPowerBi, pricingIntelligence]

export function getModuleById(id) {
  return modules.find((m) => m.id === id)
}
