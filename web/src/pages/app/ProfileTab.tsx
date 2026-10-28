import { inputsFromProfile, profileRisk } from '@data'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { ProfileDetails } from '../../components/ProfileDetails'
import { useDriverData } from '../../demo/useDriverData'

const P_RANGE = '0.8–1.3'

export function ProfileTab() {
  const { state, signOut, markSignedOut } = useAuth()
  const { trips, deleteMyData } = useDriverData()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  if (state.status !== 'signedIn') return null

  const risk = profileRisk(inputsFromProfile(state.profile, new Date()), new Date())
  const consent = state.registration.consent

  return (
    <div className="app-page">
      <h1 className="app-page__title">Profile</h1>

      <div className="dash">
        <section className="panel">
          <h2 className="panel__title">Driver and vehicle</h2>
          <ProfileDetails profile={state.profile} />
        </section>

        <section className="panel">
          <h2 className="panel__title">Profile factors (separate from your driving)</h2>
          <p className="muted">
            Static data you can't change by driving differently. It gives a bounded factor (×{P_RANGE}) applied on top
            of the behaviour score; tips stay behaviour-only. Current factor: <strong>×{risk.p.toFixed(2)}</strong>.
          </p>
          <ul className="factors-list">
            {risk.factors.map((f) => (
              <li key={f.id} className={f.known ? '' : 'is-unknown'}>
                <span>
                  <strong>{f.label}</strong>
                  <small>{f.known ? f.detail : 'No data'}</small>
                </span>
                <span className="factors-list__adj">
                  {f.known
                    ? f.adjustment === 0
                      ? '±0'
                      : `${f.adjustment > 0 ? '+' : ''}${f.adjustment.toFixed(2)}`
                    : '—'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2 className="panel__title">Privacy</h2>
          <p className="muted">
            {trips.length} recent trip summaries stored on this device. Weekly summary sharing:{' '}
            {consent?.shareSummary ? 'on (simulated)' : 'off'}.
          </p>
          {!confirming ? (
            <button type="button" className="btn btn--outline" onClick={() => setConfirming(true)}>
              Delete my trip data
            </button>
          ) : (
            <div className="confirm">
              <p>Delete all your trips on this device and sign out? This cannot be undone.</p>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={async () => {
                    await deleteMyData()
                    markSignedOut()
                    navigate('/login', { replace: true })
                  }}
                >
                  Delete
                </button>
                <button type="button" className="btn btn--outline" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <button type="button" className="btn btn--outline signout" onClick={signOut}>
        Sign out
      </button>
    </div>
  )
}
