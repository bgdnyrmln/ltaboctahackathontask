import { Link, useLocation } from 'react-router'
import { TripThumb } from '../../components/TripThumb'
import { routeForTrip } from '../../demo/tripRoutes'
import { useDriverData } from '../../demo/useDriverData'
import { useLang, useT } from '../../i18n'

const SOURCE_LABEL: Record<string, string> = {
  phone: 'Phone GPS',
  synthetic: 'Synthetic',
  obd_mock: 'OBD (mock)',
  obd: 'OBD',
}

const dateFormat = (locale: string) =>
  new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

export function Trips() {
  const t = useT()
  const { lang } = useLang()
  const dateFmt = dateFormat(lang === 'lv' ? 'lv-LV' : 'en-GB')
  const { trips, loading } = useDriverData()
  const location = useLocation()
  const savedId = (location.state as { saved?: string } | null)?.saved
  if (loading) return <p className="muted">{t('Loading…')}</p>

  const list = trips

  return (
    <div className="app-page">
      <h1 className="app-page__title">{t('Trips')}</h1>
      {savedId && (
        <p className="form-note" role="status">
          {t('Trip saved. Your score has been updated.')}
        </p>
      )}
      {list.length === 0 ? (
        <p className="muted">{t('No trips yet. Record one on the Drive tab.')}</p>
      ) : (
        <ul className="trip-list">
          {list.map((tr) => {
            const minutes = Math.round(tr.drivingSec / 60)
            const speeding = tr.drivingSec > 0 ? Math.round((tr.secOverLimit / tr.drivingSec) * 100) : 0
            const route = routeForTrip(tr)
            return (
              <li key={tr.id}>
                <Link to={`/app/trips/${tr.id}`} className={`trip${tr.id === savedId ? ' is-new' : ''}`}>
                  {route && (
                    <span className="trip__thumb">
                      <TripThumb route={route} />
                    </span>
                  )}
                  <div className="trip__head">
                    <span className="trip__date">{dateFmt.format(new Date(tr.startedAt))}</span>
                    <span className={`source source--${tr.source}`}>{t(SOURCE_LABEL[tr.source] ?? tr.source)}</span>
                  </div>
                  <p className="trip__main">
                    {tr.distanceKm.toFixed(1)} km · {minutes} min
                  </p>
                  <p className="trip__meta">
                    {t('Over limit {n}% · braking {b} · accel. {a}', { n: speeding, b: tr.harshBrakeCount, a: tr.harshAccelCount })}
                    {tr.nightKm > 0 && ` · ${t('night {km} km', { km: tr.nightKm.toFixed(1) })}`}
                  </p>
                  {route && (
                    <p className="trip__route">
                      {route.from} → {route.to}
                    </p>
                  )}
                  <span className="trip__open" aria-hidden="true">
                    ›
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
