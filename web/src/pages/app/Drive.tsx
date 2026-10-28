import { OBD_DEMO_LABEL, SPEED_MAP_DEMO_LABEL } from '@data'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { useDriverData } from '../../demo/useDriverData'
import { isNativeMobileApp } from '../../telemetry/platform'
import { MIN_TRIP } from '../../telemetry/tripRecorder'
import { useTripRecording } from '../../telemetry/useTripRecording'

const mmss = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function Drive() {
  const { state } = useAuth()
  const { addTrip, recordDemoObdTrip } = useDriverData()
  const { status, stats, error, start, stop } = useTripRecording()
  const [message, setMessage] = useState<string | null>(null)
  const [obdBusy, setObdBusy] = useState(false)
  const navigate = useNavigate()
  if (state.status !== 'signedIn') return null

  const canRecord = isNativeMobileApp()
  const driverId = state.profile.driver.id
  const vehicleId = state.profile.vehicles[0]?.id ?? null
  const active = status === 'recording' || status === 'requesting'

  const finish = async () => {
    const trip = stop(driverId, vehicleId)
    if (!trip) {
      setMessage(`Trip not saved: it needs at least ${MIN_TRIP.km} km and ${MIN_TRIP.sec / 60} minutes.`)
      return
    }
    await addTrip(trip)
    navigate('/app/trips', { state: { saved: trip.id } })
  }

  const runDemoDongle = async () => {
    setObdBusy(true)
    try {
      const trip = await recordDemoObdTrip()
      navigate('/app/trips', { state: { saved: trip.id } })
    } finally {
      setObdBusy(false)
    }
  }

  if (active) {
    return (
      <div className="app-page">
        <h1 className="app-page__title">Drive</h1>
        <section className="panel live" aria-live="polite">
          <p className="live__status">
            <span className="live__dot" aria-hidden="true" />
            {status === 'requesting' ? 'Waiting for GPS…' : 'Recording'}
          </p>
          <p className={`live__speed${stats?.overLimit ? ' is-over' : ''}`}>
            {Math.round(stats?.speedKmh ?? 0)}
            <small>km/h</small>
          </p>
          <p className="muted">
            Limit {stats?.limitKmh ?? 50} km/h ·{' '}
            {stats?.limitSource === 'map' ? `${stats.limitName ?? 'map'} (map)` : 'default for road type'}
          </p>
          <dl className="live__grid">
            <div>
              <dt>Time</dt>
              <dd>{mmss(stats?.elapsedSec ?? 0)}</dd>
            </div>
            <div>
              <dt>Distance</dt>
              <dd>{(stats?.distanceKm ?? 0).toFixed(2)} km</dd>
            </div>
            <div>
              <dt>Harsh braking</dt>
              <dd>{stats?.harshBrakes ?? 0}</dd>
            </div>
            <div>
              <dt>Harsh accel.</dt>
              <dd>{stats?.harshAccels ?? 0}</dd>
            </div>
          </dl>
          <p className="muted live__gps">
            GPS accuracy: {stats?.accuracy != null ? `±${Math.round(stats.accuracy)} m` : '—'} · samples{' '}
            {stats?.samples ?? 0}
            {stats && stats.rejected > 0 ? ` (${stats.rejected} rejected)` : ''}
          </p>
          {error && <p className="form-note">{error}</p>}
          <button type="button" className="btn btn--primary btn--big" onClick={finish}>
            Stop and save
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="app-page">
      <h1 className="app-page__title">Drive</h1>

      {canRecord ? (
        <section className="panel drive-intro">
          <p>
            Put the phone in a holder and start before you drive. We measure speed and speed changes from GPS: time
            above the limit, harsh braking and harsh acceleration.
          </p>
          <ul className="checklist">
            <li>Only trip totals are saved. Your route is never stored.</li>
            <li>
              Speed limits come from a demo map of Riga, otherwise city 50 / out of town 90. {SPEED_MAP_DEMO_LABEL}.
            </li>
          </ul>
          {status === 'denied' && (
            <p className="form-error" role="alert">
              Location permission was denied. Allow location for the app in your phone settings and try again.
            </p>
          )}
          {error && status === 'error' && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="form-note" role="status">
              {message}
            </p>
          )}
          <button
            type="button"
            className="btn btn--primary btn--big"
            onClick={() => {
              setMessage(null)
              start()
            }}
          >
            Start trip
          </button>
        </section>
      ) : (
        <section className="panel app-only">
          <div className="app-only__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="6" y="2" width="12" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="app-only__title">Trips are recorded in the mobile app</h2>
          <p className="muted">
            Live recording needs the phone's GPS and runs only in the Fake OCTA Coach app on iOS or Android. Here you
            can follow your score, trips and tips; anything you record on the phone shows up automatically.
          </p>
          <button type="button" className="btn btn--primary" disabled>
            Start trip (mobile app only)
          </button>
        </section>
      )}

      <section className="panel">
        <h2 className="panel__title">Demo: connect a car</h2>
        <p className="muted">
          {OBD_DEMO_LABEL}. Plays a short scripted city drive through a mock OBD-II adapter and saves it.
        </p>
        <button type="button" className="btn btn--outline" onClick={runDemoDongle} disabled={obdBusy}>
          {obdBusy ? 'Reading the dongle…' : 'Run demo drive'}
        </button>
      </section>
    </div>
  )
}
