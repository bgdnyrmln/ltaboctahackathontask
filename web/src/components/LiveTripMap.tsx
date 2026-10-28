import { getSpeedLimitMap, SPEED_MAP_DEMO_LABEL } from '@data'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { onLiveTrip, type LiveTripMessage } from '../telemetry/liveChannel'
import { ROUTE } from '../telemetry/simulatedDrive'

// Real map (OpenStreetMap tiles, no API key) next to the phone. Shows the
// trip driven on the phone live: trail coloured by speeding, the car, speed limit
// signs as zones change, and harsh braking/acceleration pins. Overlays still work
// if the basemap tiles cannot load.

const OK_COLOR = '#2e9e3a'
const OVER_COLOR = '#ff4512'
const SIGN_AFTER_FIXES = 30

type Live = Extract<LiveTripMessage, { type: 'fix' }>
type Summary = Extract<LiveTripMessage, { type: 'end' }>

const icon = (html: string, size: [number, number], anchor: [number, number]) =>
  L.divIcon({ html, className: 'ltm-icon', iconSize: size, iconAnchor: anchor })

const carIcon = icon('<span class="ltm-car"><span></span></span>', [28, 28], [14, 14])
const signIcon = (limit: number) => icon(`<span class="ltm-sign">${limit}</span>`, [34, 34], [17, 17])
const pinIcon = (kind: 'brake' | 'accel') =>
  icon(
    `<span class="ltm-pin ltm-pin--${kind}"><b>${kind === 'brake' ? '!' : '↑'}</b><em>${
      kind === 'brake' ? 'Harsh braking' : 'Harsh acceleration'
    }</em></span>`,
    [30, 38],
    [15, 38],
  )

export function LiveTripMap() {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const tripLayer = useRef<L.LayerGroup | null>(null)
  const trail = useRef<{ line: L.Polyline | null; over: boolean | null; last: L.LatLng | null }>({
    line: null,
    over: null,
    last: null,
  })
  const car = useRef<L.Marker | null>(null)
  const lastLimit = useRef<number | null>(null)
  // A new limit sign appears only after the limit has held for a few fixes (no flicker).
  const pendingLimit = useRef<{ limit: number; at: L.LatLng; count: number } | null>(null)
  const counts = useRef({ fixes: 0, over: 0 })

  const [status, setStatus] = useState<'idle' | 'live' | 'done'>('idle')
  const [live, setLive] = useState<Live | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [overShare, setOverShare] = useState(0)

  // Build the map once.
  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { scrollWheelZoom: false, zoomControl: true, attributionControl: true })
    // Standard OpenStreetMap tiles: no API key. Toned to grey in CSS to match the site.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m)

    // Speed limit zones from the demo map (Old Riga 30).
    for (const f of getSpeedLimitMap().features()) {
      if (f.type !== 'zone' || f.id === 'zone-riga') continue
      L.polygon(
        f.points.map((p) => [p.lat, p.lon] as L.LatLngTuple),
        { color: '#ff6d45', weight: 2, dashArray: '6 6', fillColor: '#ff6d45', fillOpacity: 0.08 },
      )
        .bindTooltip(`${f.name} · ${f.limitKmh} km/h`, { permanent: true, direction: 'left', className: 'ltm-tip' })
        .addTo(m)
    }

    // The planned route, faint, so viewers see where the drive goes.
    const planned = L.polyline(ROUTE, { color: '#7d8796', weight: 4, opacity: 0.45, dashArray: '2 9' }).addTo(m)
    m.fitBounds(planned.getBounds(), { padding: [36, 36] })
    tripLayer.current = L.layerGroup().addTo(m)
    map.current = m

    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
    }
  }, [])

  // Follow the live feed from the phone.
  useEffect(
    () =>
      onLiveTrip((msg) => {
        const layer = tripLayer.current
        if (!layer) return
        if (msg.type === 'start') {
          layer.clearLayers()
          trail.current = { line: null, over: null, last: null }
          car.current = null
          lastLimit.current = null
          pendingLimit.current = null
          counts.current = { fixes: 0, over: 0 }
          setStatus('live')
          setLive(null)
          setSummary(null)
          setOverShare(0)
          return
        }
        if (msg.type === 'fix') {
          const at = L.latLng(msg.lat, msg.lon)
          const t = trail.current
          if (t.line && t.over === msg.overLimit) {
            t.line.addLatLng(at)
          } else {
            // New colour run, starting where the previous one ended so the trail stays continuous.
            t.line = L.polyline(t.last ? [t.last, at] : [at], {
              color: msg.overLimit ? OVER_COLOR : OK_COLOR,
              weight: 7,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }).addTo(layer)
            t.over = msg.overLimit
          }
          t.last = at
          if (msg.limitKmh === lastLimit.current) {
            pendingLimit.current = null
          } else {
            const p = pendingLimit.current
            pendingLimit.current =
              p && p.limit === msg.limitKmh ? { ...p, count: p.count + 1 } : { limit: msg.limitKmh, at, count: 1 }
            if (lastLimit.current === null) {
              // First limit of the trip: shown in the readout and zone label, no sign needed.
              lastLimit.current = msg.limitKmh
              pendingLimit.current = null
            } else if (pendingLimit.current.count >= SIGN_AFTER_FIXES) {
              L.marker(pendingLimit.current.at, {
                icon: signIcon(msg.limitKmh),
                interactive: false,
                zIndexOffset: 500,
              }).addTo(layer)
              lastLimit.current = msg.limitKmh
              pendingLimit.current = null
            }
          }
          if (!car.current) car.current = L.marker(at, { icon: carIcon, zIndexOffset: 1000 }).addTo(layer)
          else car.current.setLatLng(at)
          counts.current.fixes++
          if (msg.overLimit) counts.current.over++
          setStatus('live')
          setLive(msg)
          setOverShare(Math.round((counts.current.over / counts.current.fixes) * 100))
          return
        }
        if (msg.type === 'event') {
          L.marker([msg.lat, msg.lon], { icon: pinIcon(msg.kind), zIndexOffset: 800 }).addTo(layer)
          return
        }
        setStatus('done')
        setSummary(msg)
      }),
    [],
  )

  return (
    <section className="panel ltm" aria-label="Live trip map">
      <div className="ltm__head">
        <h2 className="panel__title">Live trip map</h2>
        <span className={`ltm__status ltm__status--${status}`}>
          {status === 'live' ? 'Live from the phone' : status === 'done' ? 'Trip finished' : 'Waiting for a trip'}
        </span>
      </div>

      <div className="ltm__stage">
        <div ref={el} className="ltm__leaflet" />

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
            <p className="ltm__limit">
              {live.distanceKm.toFixed(2)} km · over the limit {overShare}%
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
        <span className="ltm__note">{SPEED_MAP_DEMO_LABEL}. Positions are shown live only, never stored.</span>
      </div>
    </section>
  )
}
