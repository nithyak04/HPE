import PricingEngine from './components/pricing/PricingEngine'

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="mark">H</span>
        <span className="wordmark">HPE</span>
        <span className="product">Pricing Strategy Intelligence</span>
      </header>
      <main className="app-main page">
        <div className="page-header">
          <span className="eyebrow">Pricing · Finance · Competitive strategy</span>
          <h1>Pricing Strategy Intelligence Engine</h1>
          <p>
            Load internal pricing and competitive data to get a prioritized brief: pricing risks and opportunities,
            the likely drivers, estimated financial impact, and the next analysis to run. It flags and explains; the
            pricing team decides.
          </p>
        </div>
        <PricingEngine />
      </main>
      <footer className="app-footer print-hide">
        Every statement is tagged FACT, SIGNAL, HYPOTHESIS or RECOMMENDATION · Data stays in your browser
      </footer>
    </div>
  )
}
