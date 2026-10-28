import { buildWeeklyReport, dScore, sumTrips, weekStartOf, type TripSummary } from '@data'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { TripReplayMap } from '../../components/TripReplayMap'
import { useDriverData } from '../../demo/useDriverData'
import { routeForTrip } from '../../demo/tripRoutes'

const SOURCE_LABEL: Record<string, string> = {
  phone: 'Phone GPS',
  synthetic: 'Synthetic (demo)',
  obd_mock: 'OBD (mock)',
  obd: 'OBD',
}

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})
const fmt = (n: number, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '—')

type Metric = { label: string; trip: number; week: number; unit: string; lowerIsBetter: boolean }

function metricsOf(t: {
  drivingSec: number
  secOverLimit: number
  distanceKm: number
  harshBrakeCount: number
  harshAccelCount: number
}) {
  return {
    speeding: t.drivingSec > 0 ? (t.secOverLimit / t.drivingSec) * 100 : 0,
    brake: t.distanceKm > 0 ? (t.harshBrakeCount / t.distanceKm) * 100 : 0,
    accel: t.distanceKm > 0 ? (t.harshAccelCount / t.distanceKm) * 100 : 0,
  }
}

export function TripDetail() {
  const { id } = useParams()
  const { trips, loading } = useDriverData()
  const trip = trips.find((t) => t.id === id)

  const route = useMemo(() => (trip ? routeForTrip(trip) : null), [trip])

  const impact = useMemo(() => {
    if (!trip) return null
    const weekStart = weekStartOf(new Date(trip.startedAt))
    const withTrip = buildWeeklyReport(weekStart, trips, dScore)
    const without = buildWeeklyReport(
      weekStart,
      trips.filter((t: TripSummary) => t.id !== trip.id),
      dScore,
    )
    return { weekStart, withTrip, without }
  }, [trip, trips])

  if (loading) return <p className="muted">Loading…</p>
  if (!trip || !impact) {
    return (
      <div className="app-page">
        <Link to="/app/trips" className="back-link">
          ← All trips
        </Link>
        <p className="muted">This trip is not in your recent history.</p>
      </div>
    )
  }

  const minutes = Math.round(trip.drivingSec / 60)
  const avgKmh = trip.drivingSec > 0 ? trip.distanceKm / (trip.drivingSec / 3600) : 0
  const tm = metricsOf(trip)
  const wm = metricsOf(sumTrips(trips.filter((t) => weekStartOf(new Date(t.startedAt)) === impact.weekStart)))
  const metrics: Metric[] = [
    { label: 'Over the limit', trip: tm.speeding, week: wm.speeding, unit: '% of time', lowerIsBetter: true },
    { label: 'Harsh braking', trip: tm.brake, week: wm.brake, unit: 'per 100 km', lowerIsBetter: true },
    { label: 'Harsh acceleration', trip: tm.accel, week: wm.accel, unit: 'per 100 km', lowerIsBetter: true },
  ]
  const scoreWith = impact.withTrip.result.score
  const scoreWithout = impact.without.result.score
  const delta = scoreWith !== null && scoreWithout !== null ? scoreWith - scoreWithout : null
  const from = route?.from ?? null
  const to = route?.to ?? null

  return (
    <div className="app-page trip-detail">
      <Link to="/app/trips" className="back-link">
        ← All trips
      </Link>
      <div className="trip-detail__head">
        <h1 className="app-page__title">{from && to ? `${from} → ${to}` : 'Trip details'}</h1>
        <p className="muted">
          {dateFmt.format(new Date(trip.startedAt))} · {SOURCE_LABEL[trip.source] ?? trip.source}
        </p>
      </div>

      <div className="dash">
        <div className="dash__col">
          <section className="panel">
            <h2 className="panel__title">Route</h2>
            {route && from && to ? (
              <>
                {route.kind === 'illustrative' && (
                  <p className="form-note">
                    Illustrative route: this demo trip has no recorded positions, so its real totals (distance, time
                    over the limit, harsh events) are shown on a sample Riga route.
                  </p>
                )}
                <TripReplayMap points={route.points} events={route.events} from={from} to={to} />
              </>
            ) : (
              <p className="muted">
                No route to show. Routes recorded with the phone's GPS are never stored for privacy; only trip totals
                are kept.
              </p>
            )}
          </section>
        </div>

        <div className="dash__col">
          <section className="panel impact">
            <h2 className="panel__title">Effect on your score</h2>
            {delta === null ? (
              <p className="muted">
                Not enough data in that week for a score{scoreWith !== null ? ` (week score ${scoreWith})` : ''}.
              </p>
            ) : (
              <>
                <p className={`impact__delta ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}`}>
                  {delta > 0 ? '+' : ''}
                  {delta} <small>points</small>
                </p>
                <p className="muted">
                  Week score {scoreWith} with this trip, {scoreWithout} without it.
                </p>
              </>
            )}
            <ul className="compare">
              {metrics.map((m) => {
                const better = m.lowerIsBetter ? m.trip <= m.week : m.trip >= m.week
                return (
                  <li key={m.label}>
                    <span className="compare__label">{m.label}</span>
                    <span className={`compare__trip ${better ? 'is-good' : 'is-bad'}`}>
                      {fmt(m.trip)} <small>{m.unit}</small>
                    </span>
                    <span className="compare__week">week {fmt(m.week)}</span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="panel">
            <h2 className="panel__title">Details</h2>
            <dl className="facts">
              <div>
                <dt>Distance</dt>
                <dd>{fmt(trip.distanceKm)} km</dd>
              </div>
              <div>
                <dt>Driving time</dt>
                <dd>{minutes} min</dd>
              </div>
              <div>
                <dt>Average speed</dt>
                <dd>{fmt(avgKmh, 0)} km/h</dd>
              </div>
              <div>
                <dt>Over the limit by 10+ / 20+ km/h</dt>
                <dd>
                  {Math.round(trip.secOver10)} s / {Math.round(trip.secOver20)} s
                </dd>
              </div>
              <div>
                <dt>Harsh braking / acceleration</dt>
                <dd>
                  {trip.harshBrakeCount} / {trip.harshAccelCount}
                </dd>
              </div>
              <div>
                <dt>Longest stretch without a break</dt>
                <dd>{fmt(trip.maxContinuousMin, 0)} min</dd>
              </div>
              <div>
                <dt>Night driving</dt>
                <dd>{fmt(trip.nightKm)} km</dd>
              </div>
              <div>
                <dt>Speed limits from</dt>
                <dd>{trip.speedLimitSource === 'map' ? 'Map (demo)' : 'Road-type default'}</dd>
              </div>
              <div>
                <dt>Data coverage</dt>
                <dd>{Math.round(trip.coverage * 100)}%</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}
