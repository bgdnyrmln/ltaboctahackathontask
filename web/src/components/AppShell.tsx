import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { footer } from '../content/landing'
import { Logo } from './Logo'

// Compact chrome for the signed-in demo app and the sign-in flow.
export function AppShell({ children }: { children: ReactNode }) {
  const { state, signOut } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="container app-header__inner">
          <Link to="/" className="app-header__logo" aria-label="Back to home">
            <Logo />
          </Link>
          <div className="app-header__actions">
            <span className="demo-badge">Demo data</span>
            {state.status === 'signedIn' && (
              <button type="button" className="app-header__signout" onClick={signOut}>
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <div className="container">{footer.credit}</div>
      </footer>
    </div>
  )
}

export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Smart-ID', 'Consent', 'Profile']
  return (
    <ol className="stepper" aria-label="Registration progress">
      {steps.map((label, index) => {
        const n = index + 1
        const status = n < current ? 'done' : n === current ? 'current' : 'todo'
        return (
          <li key={label} className={`stepper__item stepper__item--${status}`} aria-current={n === current ? 'step' : undefined}>
            <span className="stepper__dot" aria-hidden="true">
              {n < current ? '✓' : n}
            </span>
            <span className="stepper__label">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
