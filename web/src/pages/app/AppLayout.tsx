import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { Logo } from '../../components/Logo'
import { DriverDataProvider } from '../../demo/useDriverData'
import '../App.css'

const TABS = [
  { to: '/app', label: 'Score', icon: 'M12 3a9 9 0 1 0 9 9M12 12l5-5', end: true },
  { to: '/app/drive', label: 'Drive', icon: 'M5 17h14M7 17l2-6h6l2 6M8 11l1-4h6l1 4', end: false },
  { to: '/app/trips', label: 'Trips', icon: 'M4 6h16M4 12h16M4 18h10', end: false },
  { to: '/app/profile', label: 'Profile', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0', end: false },
]

// Mobile app frame: compact top bar, content, bottom tab bar.
export function AppLayout() {
  const { state, signOut } = useAuth()
  if (state.status !== 'signedIn') return null
  return (
    <DriverDataProvider>
      <div className="mobile-app">
        <header className="mobile-app__bar">
          <Logo />
          <div className="mobile-app__bar-end">
            <span className="mobile-app__user">{state.profile.driver.displayName}</span>
            <span className="demo-badge">Demo data</span>
            <button type="button" className="mobile-app__signout" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>
        <main className="mobile-app__content">
          <Outlet />
        </main>
        <nav className="tabbar" aria-label="App">
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={tab.end} className="tabbar__link">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d={tab.icon}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </DriverDataProvider>
  )
}
