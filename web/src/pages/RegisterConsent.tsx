import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { AppShell, Stepper } from '../components/AppShell'
import './App.css'

export function RegisterConsent() {
  const { state, giveConsent } = useAuth()
  const navigate = useNavigate()
  const existing = state.status === 'signedIn' ? state.registration.consent : undefined
  const [fakeData, setFakeData] = useState(Boolean(existing))
  const [trips, setTrips] = useState(Boolean(existing))
  const [share, setShare] = useState(existing?.shareSummary ?? false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!fakeData || !trips) return
    giveConsent(share)
    navigate('/register/profile')
  }

  return (
    <AppShell>
      <div className="container auth-page">
        <Stepper current={2} />
        <form className="auth-card" onSubmit={submit}>
          <h1 className="auth-card__title">Your data, your choice</h1>
          <p className="auth-card__lead">
            We only score how you drive. Profile data such as licence age is shown separately and never changes your
            score.
          </p>

          <div className="consents">
            <label className="consent">
              <input type="checkbox" checked={fakeData} onChange={(e) => setFakeData(e.target.checked)} required />
              <span>
                <strong>I understand this is a demo.</strong> All drivers, vehicles and trips are synthetic.
              </span>
            </label>
            <label className="consent">
              <input type="checkbox" checked={trips} onChange={(e) => setTrips(e.target.checked)} required />
              <span>
                <strong>Calculate my score on this device.</strong> Trip summaries stay local; raw locations are never
                stored. You can delete them any time.
              </span>
            </label>
            <label className="consent consent--optional">
              <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
              <span>
                <strong>Optional: share my weekly score with Demo Insurer AS.</strong> Only weekly scores and totals,
                never trips or locations. You can switch it off any time.
              </span>
            </label>
          </div>

          <button type="submit" className="btn btn--primary auth-form__submit" disabled={!fakeData || !trips}>
            Agree and continue
          </button>
        </form>
      </div>
    </AppShell>
  )
}
