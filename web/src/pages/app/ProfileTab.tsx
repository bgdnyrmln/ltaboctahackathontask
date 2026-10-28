import { inputsFromProfile, profileRisk } from '@data'
import { useAuth } from '../../auth/AuthContext'
import { ProfileDetails } from '../../components/ProfileDetails'

const P_RANGE = '0.8–1.3'

export function ProfileTab() {
  const { state, signOut } = useAuth()
  if (state.status !== 'signedIn') return null

  const risk = profileRisk(inputsFromProfile(state.profile, new Date()), new Date())

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
      </div>

      <button type="button" className="btn btn--outline signout" onClick={signOut}>
        Sign out
      </button>
    </div>
  )
}
