import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { AppShell, Stepper } from '../components/AppShell'
import { ProfileDetails } from '../components/ProfileDetails'
import './App.css'

export function RegisterProfile() {
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
          <h1 className="auth-card__title">Is this you?</h1>
          <p className="auth-card__lead">
            Loaded from the demo registry (CSDD-style mock). Nothing here affects your driving score.
          </p>
          <ProfileDetails profile={state.profile} />
          <div className="auth-card__actions">
            <Link to="/register/consent" className="btn btn--outline">
              Back
            </Link>
            <button type="button" className="btn btn--primary" onClick={finish}>
              Looks right, finish
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
