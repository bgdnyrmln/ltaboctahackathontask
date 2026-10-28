import { getSpeedLimitMap, SPEED_MAP_DEMO_LABEL, type LatLon } from '@data'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { onLiveTrip, type LiveTripMessage } from '../telemetry/liveChannel'

// Offline map of central Riga drawn from Agent C's speed limit map (no tiles, so
// it works without internet). Shows the trip driven on the phone live: trail
// coloured by speeding, the car, and harsh braking/acceleration pins.

const BOUNDS = { latMin: 56.913, latMax: 56.959, lonMin: 24.086, lonMax: 24.193 }
const W = 1000
const COS = Math.cos((((BOUNDS.latMin + BOUNDS.latMax) / 2) * Math.PI) / 180)
const K = W / ((BOUNDS.lonMax - BOUNDS.lonMin) * COS)
const H = Math.round((BOUNDS.latMax - BOUNDS.latMin) * K)

const px = (p: LatLon) => ({ x: (p.lon - BOUNDS.lonMin) * COS * K, y: (BOUNDS.latMax - p.lat) * K })
const path = (points: LatLon[], close = false) =>
  points.map((p, i) => `${i ? 'L' : 'M'}${px(p).x.toFixed(1)},${px(p).y.toFixed(1)}`).join(' ') + (close ? ' Z' : '')

// Decorative river line, approximate (the map is illustrative, not road-accurate).
const DAUGAVA: LatLon[] = [
  { lat: 56.957, lon: 24.093 },
  { lat: 56.946, lon: 24.097 },
  { lat: 56.9395, lon: 24.105 },
  { lat: 56.9335, lon: 24.121 },
  { lat: 56.9275, lon: 24.14 },
  { lat: 56.92, lon: 24.162 },
  { lat: 56.912, lon: 24.18 },
]

// Where to show the city-wide 50 sign (an empty part of the map).
const RIGA_SIGN: LatLon = { lat: 56.9205, lon: 24.1 }

type TrailPoint = LatLon & { over: boolean }
type Pin = LatLon & { kind: 'brake' | 'accel' }
type Live = Extract<LiveTripMessage, { type: 'fix' }>
type Summary = Extract<LiveTripMessage, { type: 'end' }>

function centroid(points: LatLon[]): LatLon {
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    lon: points.reduce((s, p) => s + p.lon, 0) / points.length,
  }
}

function LimitSign({ at, xy, limit }: { at?: LatLon; xy?: { x: number; y: number }; limit: number }) {
  const { x, y } = xy ?? px(at!)
  return (
    <g className="ltm-sign" transform={`translate(${x},${y})`}>
      <circle r="22" />
      <text dy="7">{limit}</text>
    </g>
  )
}

// Sign position next to a road: offset sideways from the segment's midpoint so it
// does not sit under the trail.
function roadSignAt(points: LatLon[]): { x: number; y: number } {
  const i = Math.max(1, Math.floor(points.length / 2))
  const a = px(points[i - 1])
  const b = px(points[i])
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  return { x: (a.x + b.x) / 2 + ((b.y - a.y) / len) * 44, y: (a.y + b.y) / 2 - ((b.x - a.x) / len) * 44 }
}

export function LiveTripMap() {
  const [status, setStatus] = useState<'idle' | 'live' | 'done'>('idle')
  const [trail, setTrail] = useState<TrailPoint[]>([])
  const [pins, setPins] = useState<Pin[]>([])
  const [live, setLive] = useState<Live | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const features = useMemo(() => getSpeedLimitMap().features(), [])

  useEffect(
    () =>
      onLiveTrip((m) => {
        if (m.type === 'start') {
          setStatus('live')
          setTrail([])
          setPins([])
          setLive(null)
          setSummary(null)
        } else if (m.type === 'fix') {
          setStatus('live')
          setLive(m)
          setTrail((t) => [...t, { lat: m.lat, lon: m.lon, over: m.overLimit }])
        } else if (m.type === 'event') {
          setPins((p) => [...p, { lat: m.lat, lon: m.lon, kind: m.kind }])
        } else if (m.type === 'end') {
          setStatus('done')
          setSummary(m)
        }
      }),
    [],
  )

  const zones = features.filter((f) => f.type === 'zone' && f.id !== 'zone-riga')
  const roads = features.filter((f) => f.type === 'segment')
  const car = trail[trail.length - 1]
  const overShare = trail.length ? Math.round((trail.filter((p) => p.over).length / trail.length) * 100) : 0

  return (
    <section className="panel ltm" aria-label="Live trip map">
      <div className="ltm__head">
        <h2 className="panel__title">Live trip map</h2>
        <span className={`ltm__status ltm__status--${status}`}>
          {status === 'live' ? 'Live from the phone' : status === 'done' ? 'Trip finished' : 'Waiting for a trip'}
        </span>
      </div>

      <div className="ltm__stage">
        <svg viewBox={`0 0 ${W} ${H}`} className="ltm__map" role="img" aria-label="Map of central Riga with the trip">
          <rect width={W} height={H} className="ltm-city" />
          <path d={path(DAUGAVA)} className="ltm-river" />
          <text
            x={px({ lat: 56.9235, lon: 24.13 }).x}
            y={px({ lat: 56.9235, lon: 24.13 }).y}
            className="ltm-label ltm-label--river"
          >
            Daugava
          </text>

          {zones.map((z) => (
            <g key={z.id}>
              <path d={path(z.points, true)} className="ltm-zone" />
              <text x={px(centroid(z.points)).x} y={px(centroid(z.points)).y - 34} className="ltm-label">
                {z.name}
              </text>
              <LimitSign at={centroid(z.points)} limit={z.limitKmh} />
            </g>
          ))}

          {roads.map((r) => (
            <g key={r.id}>
              <path d={path(r.points)} className="ltm-road-casing" />
              <path d={path(r.points)} className="ltm-road" />
            </g>
          ))}

          {trail.slice(1).map((p, i) => {
            const a = px(trail[i])
            const b = px(p)
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={p.over ? 'ltm-trail ltm-trail--over' : 'ltm-trail'}
              />
            )
          })}

          {roads.map((r) => {
            const sign = roadSignAt(r.points)
            return (
              <g key={`${r.id}-label`}>
                <LimitSign xy={sign} limit={r.limitKmh} />
                <text x={sign.x + 30} y={sign.y + 7} className="ltm-label ltm-label--road">
                  {r.name}
                </text>
              </g>
            )
          })}
          <LimitSign at={RIGA_SIGN} limit={50} />
          <text x={px(RIGA_SIGN).x + 30} y={px(RIGA_SIGN).y + 7} className="ltm-label ltm-label--road">
            Riga built-up area
          </text>

          {pins.map((p, i) => {
            const { x, y } = px(p)
            return (
              <g key={i} className={`ltm-pin ltm-pin--${p.kind}`} transform={`translate(${x},${y})`}>
                <path d="M0,0 C-14,-18 -14,-34 0,-34 C14,-34 14,-18 0,0 Z" />
                <text y="-17">{p.kind === 'brake' ? '!' : '↑'}</text>
                <text y="-44" className="ltm-pin__label">
                  {p.kind === 'brake' ? 'Harsh braking' : 'Harsh acceleration'}
                </text>
              </g>
            )
          })}

          {car && status === 'live' && (
            <g transform={`translate(${px(car).x},${px(car).y})`}>
              <circle r="22" className="ltm-car-pulse" />
              <circle r="11" className="ltm-car" />
            </g>
          )}
        </svg>

        {status === 'idle' && (
          <div className="ltm__overlay">
            <p>
              Tap <strong>Start trip</strong> on the phone. The drive appears here live.
            </p>
          </div>
        )}

        {live && status === 'live' && (
          <div className={`ltm__readout${live.overLimit ? ' is-over' : ''}`}>
            <p className="ltm__speed">
              {Math.round(live.kmh)}
              <small> km/h</small>
            </p>
            <p className="ltm__limit">
              Limit {live.limitKmh} · {live.limitName ?? 'road-type default'}
            </p>
          </div>
        )}

        {summary && status === 'done' && (
          <div className="ltm__summary">
            <p className="ltm__summary-title">{summary.saved ? 'Trip saved' : 'Trip too short, not saved'}</p>
            <p>
              {summary.distanceKm.toFixed(1)} km · over the limit {overShare}% of the time · {summary.harshBrakes} harsh
              braking · {summary.harshAccels} harsh acceleration
            </p>
            {summary.saved && (
              <Link to="/app" className="btn btn--primary">
                See updated score
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="ltm__legend">
        <span className="ltm-key ltm-key--ok">Within limit</span>
        <span className="ltm-key ltm-key--over">Over limit</span>
        <span className="ltm-key ltm-key--brake">Harsh braking</span>
        <span className="ltm-key ltm-key--accel">Harsh acceleration</span>
        <span className="ltm__note">
          {live ? `${live.distanceKm.toFixed(2)} km · ` : ''}
          {SPEED_MAP_DEMO_LABEL}. Positions are shown live only, never stored.
        </span>
      </div>
    </section>
  )
}
