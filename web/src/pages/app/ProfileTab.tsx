import { isUnknown } from '@data'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { ProfileDetails } from '../../components/ProfileDetails'
import { useDriverData } from '../../demo/useDriverData'

export function ProfileTab() {
  const { state, signOut, markSignedOut } = useAuth()
  const { trips, deleteMyData } = useDriverData()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  if (state.status !== 'signedIn') return null

  const { driver, vehicles } = state.profile
  const consent = state.registration.consent
  const licenceYears = isUnknown(driver.licenseSince)
    ? null
    : new Date().getFullYear() - new Date(driver.licenseSince).getFullYear()
  const vehicleYear = vehicles[0] && !isUnknown(vehicles[0].year) ? vehicles[0].year : null

  return (
    <div className="app-page">
      <h1 className="app-page__title">Profile</h1>

      <section className="panel">
        <h2 className="panel__title">Driver and vehicle</h2>
        <ProfileDetails profile={state.profile} />
      </section>

      <section className="panel">
        <h2 className="panel__title">Profile factors (separate from your score)</h2>
        <p className="muted">
          Static data you can't change by driving differently. Shown for transparency; not part of the 0–100 behaviour
          score and not used in tips. A combined price layer is a team proposal, not approved.
        </p>
        <dl className="facts">
          <div>
            <dt>Driving experience</dt>
            <dd>{licenceYears === null ? 'Not available' : `${licenceYears} years`}</dd>
          </div>
          <div>
            <dt>Vehicle age</dt>
            <dd>{vehicleYear === null ? 'Not available' : `${new Date().getFullYear() - vehicleYear} years`}</dd>
          </div>
          <div>
            <dt>Driver age</dt>
            <dd>Not used</dd>
          </div>
        </dl>
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

      <button type="button" className="btn btn--outline signout" onClick={signOut}>
        Sign out
      </button>
    </div>
  )
}
