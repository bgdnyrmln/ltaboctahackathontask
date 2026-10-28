import { inputsFromProfile, profileRisk } from '@data'
import { useAuth } from '../../auth/AuthContext'
import { ProfileDetails } from '../../components/ProfileDetails'
import { useT, type TFn } from '../../i18n'

const P_RANGE = '0.8–1.3'

// Factor details come from the data layer as English strings such as '3 years' or 'overdue'.
function detailText(t: TFn, detail: string): string {
  const years = /^(\d+) years?$/.exec(detail)
  if (years) return t('{n} years', { n: years[1] })
  if (detail === 'overdue' || detail === 'valid') return t(detail)
  return detail
}

export function ProfileTab() {
  const t = useT()
  const { state, signOut } = useAuth()
  if (state.status !== 'signedIn') return null

  const risk = profileRisk(inputsFromProfile(state.profile, new Date()), new Date())

  return (
    <div className="app-page">
      <h1 className="app-page__title">{t('Profile')}</h1>

      <div className="dash">
        <section className="panel">
          <h2 className="panel__title">{t('Driver and vehicle')}</h2>
          <ProfileDetails profile={state.profile} />
        </section>

        <section className="panel">
          <h2 className="panel__title">{t('Profile factors (separate from your driving)')}</h2>
          <p className="muted">
            {t("Static data you can't change by driving differently. It gives a bounded factor (×{range}) applied on top of the behaviour score; tips stay behaviour-only.", { range: P_RANGE })}{' '}
            {t('Current factor:')} <strong>×{risk.p.toFixed(2)}</strong>.
          </p>
          <ul className="factors-list">
            {risk.factors.map((f) => (
              <li key={f.id} className={f.known ? '' : 'is-unknown'}>
                <span>
                  <strong>{t(f.label)}</strong>
                  <small>{f.known ? detailText(t, f.detail) : t('No data')}</small>
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
        {t('Sign out')}
      </button>
    </div>
  )
}
