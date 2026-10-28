import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { simulateTrip } from '../../demo/simulateTrip'
import { useDriverData } from '../../demo/useDriverData'
import { MIN_TRIP } from '../../telemetry/tripRecorder'
import { useTripRecording } from '../../telemetry/useTripRecording'

const mmss = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function Drive() {
  const { state } = useAuth()
  const { addTrip } = useDriverData()
  const { status, stats, error, start, stop } = useTripRecording()
  const [message, setMessage] = useState<string | null>(null)
  const navigate = useNavigate()
  if (state.status !== 'signedIn') return null

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

  const simulate = async (style: 'calm' | 'rushed') => {
    await addTrip(simulateTrip(driverId, vehicleId, style))
    navigate('/app', { replace: false })
  }

  return (
    <div className="app-page">
      <h1 className="app-page__title">Drive</h1>

      {!active ? (
        <>
          <section className="panel drive-intro">
            <p>
              Put the phone in a holder and start before you drive. We measure speed and speed changes from GPS:
              time above the limit, harsh braking and harsh acceleration.
            </p>
            <ul className="checklist">
              <li>Keep the app open with the screen on (web apps can't record in the background).</li>
              <li>Only trip totals are saved. Your route is never stored.</li>
              <li>Speed limits are approximate (city 50, out of town 90).</li>
            </ul>
            {status === 'denied' && (
              <p className="form-error" role="alert">
                Location permission was denied. Allow location for this site in your browser settings and try again.
              </p>
            )}
            {status === 'unsupported' && (
              <p className="form-error" role="alert">
                This browser has no location access. Use the simulated trip below.
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
              disabled={status === 'unsupported'}
            >
              Start trip
            </button>
          </section>

          <section className="panel">
            <h2 className="panel__title">No car nearby?</h2>
            <p className="muted">Add a simulated trip (labelled synthetic) to see how the score reacts.</p>
            <div className="btn-row">
              <button type="button" className="btn btn--outline" onClick={() => simulate('calm')}>
                Calm trip
              </button>
              <button type="button" className="btn btn--outline" onClick={() => simulate('rushed')}>
                Rushed trip
              </button>
            </div>
          </section>
        </>
      ) : (
        <section className="panel live" aria-live="polite">
          <p className="live__status">
            <span className="live__dot" aria-hidden="true" />
            {status === 'requesting' ? 'Waiting for GPS…' : 'Recording'}
          </p>
          <p className={`live__speed${stats?.overLimit ? ' is-over' : ''}`}>
            {Math.round(stats?.speedKmh ?? 0)}
            <small>km/h</small>
          </p>
          <p className="muted">Assumed limit {stats?.limitKmh ?? 50} km/h</p>

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
            GPS accuracy: {stats?.accuracy != null ? `±${Math.round(stats.accuracy)} m` : '—'} · samples {stats?.samples ?? 0}
            {stats && stats.rejected > 0 ? ` (${stats.rejected} rejected)` : ''}
          </p>
          {error && <p className="form-note">{error}</p>}
          <button type="button" className="btn btn--primary btn--big" onClick={finish}>
            Stop and save
          </button>
        </section>
      )}
    </div>
  )
}
