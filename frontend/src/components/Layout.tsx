import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/log', label: 'Log workout', end: false },
  { to: '/history', label: 'History', end: false },
  { to: '/coach', label: 'AI coach', end: false },
]

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <NavLink to="/" className="brand">
            <span className="brand-mark">CA</span>
            <span>
              Coach<span className="brand-accent">App</span>
            </span>
          </NavLink>

          <nav className="nav" aria-label="Main navigation">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="user-area">
            <span className="user-email" title={user?.email}>
              {user?.email}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="container main">
        <Outlet />
      </main>

      <footer className="footer container">
        CoachApp - log the work, see the trend, ask the coach.
      </footer>
    </div>
  )
}
