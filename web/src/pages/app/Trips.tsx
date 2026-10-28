import { Link, useLocation } from 'react-router'
import { useDriverData } from '../../demo/useDriverData'

const SOURCE_LABEL: Record<string, string> = {
  phone: 'Phone GPS',
  synthetic: 'Synthetic',
  obd_mock: 'OBD (mock)',
  obd: 'OBD',
}

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function Trips() {
  const { trips, loading } = useDriverData()
  const location = useLocation()
  const savedId = (location.state as { saved?: string } | null)?.saved
  if (loading) return <p className="muted">Loading…</p>

  const list = trips

  return (
    <div className="app-page">
      <h1 className="app-page__title">Trips</h1>
      {savedId && (
        <p className="form-note" role="status">
          Trip saved. Your score has been updated.
        </p>
      )}
      {list.length === 0 ? (
        <p className="muted">No trips yet. Record one on the Drive tab.</p>
      ) : (
        <ul className="trip-list">
          {list.map((t) => {
            const minutes = Math.round(t.drivingSec / 60)
            const speeding = t.drivingSec > 0 ? Math.round((t.secOverLimit / t.drivingSec) * 100) : 0
            return (
              <li key={t.id}>
                <Link to={`/app/trips/${t.id}`} className={`trip${t.id === savedId ? ' is-new' : ''}`}>
                  <div className="trip__head">
                    <span className="trip__date">{dateFmt.format(new Date(t.startedAt))}</span>
                    <span className={`source source--${t.source}`}>{SOURCE_LABEL[t.source] ?? t.source}</span>
                  </div>
                  <p className="trip__main">
                    {t.distanceKm.toFixed(1)} km · {minutes} min
                  </p>
                  <p className="trip__meta">
                    Over limit {speeding}% · braking {t.harshBrakeCount} · accel. {t.harshAccelCount}
                    {t.nightKm > 0 && ` · night ${t.nightKm.toFixed(1)} km`}
                  </p>
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
