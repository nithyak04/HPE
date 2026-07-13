import { BrowserRouter, Routes, Route } from 'react-router-dom'
import TopNav from './components/layout/TopNav'
import LandingPage from './components/landing/LandingPage'
import ModulePage from './components/module/ModulePage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <TopNav />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/:moduleId" element={<ModulePage />} />
          </Routes>
        </main>
        <footer className="app-footer print-hide">
          HPE Onboarding · Chips/AI Finance Team · Progress saved locally on this device
        </footer>
      </div>
    </BrowserRouter>
  )
}
