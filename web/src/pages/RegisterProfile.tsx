import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { AppShell, Stepper } from '../components/AppShell'
import { ProfileDetails } from '../components/ProfileDetails'
import { useT } from '../i18n'
import './App.css'

export function RegisterProfile() {
  const t = useT()
  const { state, completeRegistration } = useAuth()
  const navigate = useNavigate()
  if (state.status !== 'signedIn') return null

  const finish = () => {
    completeRegistration()
    navigate('/app', { replace: true })
  }

  return (
    <AppShell>
      <div className="container auth-page">
        <Stepper current={3} />
        <div className="auth-card">
          <h1 className="auth-card__title">{t('Is this you?')}</h1>
          <p className="auth-card__lead">
            {t('Loaded from the demo registry (CSDD-style mock). Nothing here changes your behaviour score; it only adjusts the separate "with profile" number.')}
          </p>
          <ProfileDetails profile={state.profile} />
          <div className="auth-card__actions">
            <Link to="/register/consent" className="btn btn--outline">
              {t('Back')}
            </Link>
            <button type="button" className="btn btn--primary" onClick={finish}>
              {t('Looks right, finish')}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
