import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { footer } from '../content/landing'
import { LangSwitch, useT } from '../i18n'
import { Logo } from './Logo'

// Compact chrome for the signed-in demo app and the sign-in flow.
export function AppShell({ children }: { children: ReactNode }) {
  const t = useT()
  const { state, signOut } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="container app-header__inner">
          <Link to="/" className="app-header__logo" aria-label={t('Back to home')}>
            <Logo />
          </Link>
          <div className="app-header__actions">
            <LangSwitch />
            <span className="demo-badge">{t('Demo data')}</span>
            {state.status === 'signedIn' && (
              <button type="button" className="app-header__signout" onClick={signOut}>
                {t('Sign out')}
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <div className="container">{t(footer.credit)}</div>
      </footer>
    </div>
  )
}

export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  const t = useT()
  const steps = ['Smart-ID', 'Consent', 'Profile']
  return (
    <ol className="stepper" aria-label={t('Registration progress')}>
      {steps.map((label, index) => {
        const n = index + 1
        const status = n < current ? 'done' : n === current ? 'current' : 'todo'
        return (
          <li key={label} className={`stepper__item stepper__item--${status}`} aria-current={n === current ? 'step' : undefined}>
            <span className="stepper__dot" aria-hidden="true">
              {n < current ? '✓' : n}
            </span>
            <span className="stepper__label">{t(label)}</span>
          </li>
        )
      })}
    </ol>
  )
}
