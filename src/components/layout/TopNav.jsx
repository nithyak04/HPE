import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { modules } from '../../data/modules'

export default function TopNav() {
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)

  return (
    <header className="topnav print-hide">
      <Link to="/" className="topnav-brand" onClick={close}>
        <span className="mark">H</span>
        <span className="wordmark">HPE</span>
      </Link>

      <button className="topnav-menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Toggle navigation">
        ☰
      </button>

      <nav className={`topnav-links${open ? ' open' : ''}`}>
        <Link to="/" className={`topnav-link${location.pathname === '/' ? ' active' : ''}`} onClick={close}>
          Home
        </Link>
        {modules.map((m) => (
          <Link
            key={m.id}
            to={`/${m.id}`}
            className={`topnav-link${location.pathname.startsWith(`/${m.id}`) ? ' active' : ''}`}
            onClick={close}
          >
            {m.navLabel}
          </Link>
        ))}
      </nav>
    </header>
  )
}
