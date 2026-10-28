import { getSpeedLimitMap, SPEED_MAP_DEMO_LABEL } from '@data'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { onLiveTrip, type LiveTripMessage } from '../telemetry/liveChannel'
import { PLACES, ROUTE } from '../telemetry/simulatedDrive'

// Real map (OpenStreetMap tiles, no API key) next to the phone. During a trip it
// works like a navigator: the car glides smoothly between fixes, the camera
// follows it and the map turns so the direction of travel points up. Markers are
// counter-rotated so their text stays upright. Leaflet has no rotation, so the
// whole map sits in an oversized square that is rotated with CSS.

const OK_COLOR = '#2e9e3a'
const OVER_COLOR = '#ff4512'
const SLOW_COLOR = '#2f80ed'

type SpeedState = 'ok' | 'over' | 'slow'
const stateOf = (m: { overLimit: boolean; tooSlow: boolean }): SpeedState =>
  m.overLimit ? 'over' : m.tooSlow ? 'slow' : 'ok'
const COLORS: Record<SpeedState, string> = { ok: OK_COLOR, over: OVER_COLOR, slow: SLOW_COLOR }
const SIGN_AFTER_FIXES = 30
const FOLLOW_ZOOM = 16
const MIN_HEADING_M = 3 // ignore heading changes from tiny moves
const TURN_EASE = 0.08 // share of the remaining turn applied per frame
const PADDING = 36

type Live = Extract<LiveTripMessage, { type: 'fix' }>
type Summary = Extract<LiveTripMessage, { type: 'end' }>

const icon = (html: string, size: [number, number], anchor: [number, number]) =>
  L.divIcon({ html, className: 'ltm-icon', iconSize: size, iconAnchor: anchor })

const carIcon = icon('<span class="ltm-car"><span></span></span>', [30, 30], [15, 15])
const signIcon = (limit: number) => icon(`<span class="ltm-sign">${limit}</span>`, [34, 34], [17, 17])
const labelIcon = (text: string) => icon(`<span class="ltm-label">${text}</span>`, [0, 0], [0, 0])
const placeIcon = (glyph: string, name: string, side: 'left' | 'right') =>
  icon(`<span class="ltm-place ltm-place--${side}"><b>${glyph}</b><em>${name}</em></span>`, [34, 34], [17, 17])
const pinIcon = (kind: 'brake' | 'accel') =>
  icon(
    `<span class="ltm-pin ltm-pin--${kind}"><b>${kind === 'brake' ? '!' : '↑'}</b><em>${
      kind === 'brake' ? 'Harsh braking' : 'Harsh acceleration'
    }</em></span>`,
    [30, 30],
    [15, 15],
  )

const toRad = (d: number) => (d * Math.PI) / 180
const toDeg = (r: number) => (r * 180) / Math.PI

// Compass bearing from a to b, degrees clockwise from north.
function bearingOf(a: L.LatLng, b: L.LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat))
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng))
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

// Shortest signed turn from a to b, in degrees (-180..180).
const turn = (a: number, b: number) => ((b - a + 540) % 360) - 180

type Run = { line: L.Polyline; pts: L.LatLng[]; state: SpeedState }
type Motion = { from: L.LatLng; to: L.LatLng; start: number; dur: number; lastArrival: number }

export function LiveTripMap() {
  const stageEl = useRef<HTMLDivElement>(null)
  const rotatorEl = useRef<HTMLDivElement>(null)
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const tripLayer = useRef<L.LayerGroup | null>(null)
  const routeBounds = useRef<L.LatLngBounds | null>(null)
  const extraPad = useRef({ x: 0, y: 0 }) // hidden margin of the oversized square

  const car = useRef<L.Marker | null>(null)
  const run = useRef<Run | null>(null)
  const motion = useRef<Motion | null>(null)
  const heading = useRef({ shown: 0, target: 0 }) // car direction
  const bearing = useRef({ shown: 0, target: 0 }) // map rotation
  const navigating = useRef(false)
  const lastLimit = useRef<number | null>(null)
  const pendingLimit = useRef<{ limit: number; at: L.LatLng; count: number } | null>(null)
  const counts = useRef({ fixes: 0, over: 0, slow: 0 })

  const [status, setStatus] = useState<'idle' | 'live' | 'done'>('idle')
  const [live, setLive] = useState<Live | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [overShare, setOverShare] = useState(0)
  const [slowShare, setSlowShare] = useState(0)
  const [destination, setDestination] = useState<string | null>(null)

  const fitRoute = (animate: boolean) => {
    const m = map.current
    if (!m || !routeBounds.current) return
    const pad = L.point(PADDING + extraPad.current.x, PADDING + extraPad.current.y)
    const opts = { paddingTopLeft: pad, paddingBottomRight: pad }
    if (animate) m.flyToBounds(routeBounds.current, { ...opts, duration: 1.2 })
    else m.fitBounds(routeBounds.current, opts)
  }

  // Build the map once, inside an oversized square so rotation never shows corners.
  useEffect(() => {
    if (!mapEl.current || !stageEl.current || map.current) return
    const m = L.map(mapEl.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      zoomSnap: 0.25,
    })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m)

    // Speed limit zones from the demo map (Old Riga 30).
    for (const f of getSpeedLimitMap().features()) {
      if (f.type !== 'zone' || f.id === 'zone-riga') continue
      const ring = f.points.map((p) => L.latLng(p.lat, p.lon))
      L.polygon(ring, {
        color: '#ff6d45',
        weight: 2,
        dashArray: '6 6',
        fillColor: '#ff6d45',
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(m)
      const west = ring.reduce((a, b) => (b.lng < a.lng ? b : a))
      L.marker(L.latLng(Math.max(...ring.map((p) => p.lat)), west.lng), {
        icon: labelIcon(`${f.limitKmh} km/h zone`),
        interactive: false,
      }).addTo(m)
    }

    const planned = L.polyline(ROUTE, {
      color: '#7d8796',
      weight: 4,
      opacity: 0.45,
      dashArray: '2 9',
      interactive: false,
    }).addTo(m)
    routeBounds.current = planned.getBounds()
    L.marker([PLACES.oldRiga.lat, PLACES.oldRiga.lon], {
      icon: placeIcon('⛪', PLACES.oldRiga.name, 'right'),
      zIndexOffset: 300,
    }).addTo(m)
    L.marker([PLACES.akropole.lat, PLACES.akropole.lon], {
      icon: placeIcon('🛍', PLACES.akropole.name, 'left'),
      zIndexOffset: 300,
    }).addTo(m)
    tripLayer.current = L.layerGroup().addTo(m)
    map.current = m

    // Size the rotating square to the stage diagonal, centred on the stage.
    const layout = () => {
      const stage = stageEl.current
      const rot = rotatorEl.current
      if (!stage || !rot) return
      // Layout size in CSS px (not getBoundingClientRect, which includes page zoom).
      const w = stage.offsetWidth
      const h = stage.offsetHeight
      const d = Math.ceil(Math.hypot(w, h))
      rot.style.width = `${d}px`
      rot.style.height = `${d}px`
      rot.style.left = `${(w - d) / 2}px`
      rot.style.top = `${(h - d) / 2}px`
      extraPad.current = { x: (d - w) / 2, y: (d - h) / 2 }
      m.invalidateSize({ pan: false })
    }
    layout()
    fitRoute(false)
    const ro = new ResizeObserver(() => {
      layout()
      if (!navigating.current) fitRoute(false)
    })
    ro.observe(stageEl.current)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
    }
  }, [])

  // Frame loop: glide the car, extend the trail, follow and rotate.
  useEffect(() => {
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const m = map.current
      const mo = motion.current
      const rot = rotatorEl.current
      if (mo && car.current) {
        const k = Math.min(1, (performance.now() - mo.start) / mo.dur)
        const pos = L.latLng(mo.from.lat + (mo.to.lat - mo.from.lat) * k, mo.from.lng + (mo.to.lng - mo.from.lng) * k)
        car.current.setLatLng(pos)
        if (run.current) run.current.line.setLatLngs([...run.current.pts, pos])
        if (m && navigating.current) m.setView(pos, m.getZoom(), { animate: false })
      }
      heading.current.shown += turn(heading.current.shown, heading.current.target) * TURN_EASE
      bearing.current.shown += turn(bearing.current.shown, bearing.current.target) * TURN_EASE
      if (rot) {
        rot.style.setProperty('--bearing', `${bearing.current.shown.toFixed(2)}deg`)
        rot.style.setProperty('--heading', `${heading.current.shown.toFixed(2)}deg`)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  // Follow the live feed from the phone.
  useEffect(
    () =>
      onLiveTrip((msg) => {
        const layer = tripLayer.current
        const m = map.current
        if (!layer || !m) return

        if (msg.type === 'start') {
          layer.clearLayers()
          car.current = null
          run.current = null
          motion.current = null
          lastLimit.current = null
          pendingLimit.current = null
          counts.current = { fixes: 0, over: 0, slow: 0 }
          navigating.current = true
          m.dragging.disable()
          m.doubleClickZoom.disable()
          setStatus('live')
          setLive(null)
          setSummary(null)
          setOverShare(0)
          setSlowShare(0)
          setDestination(msg.to ?? null)
          return
        }

        if (msg.type === 'fix') {
          const at = L.latLng(msg.lat, msg.lon)
          const now = performance.now()
          const prev = motion.current

          if (!prev || !car.current) {
            // First fix: place the car and zoom in to street level.
            car.current = L.marker(at, { icon: carIcon, zIndexOffset: 1000, interactive: false }).addTo(layer)
            motion.current = { from: at, to: at, start: now, dur: 1, lastArrival: now }
            m.setView(at, FOLLOW_ZOOM, { animate: false })
          } else {
            // Glide from where the car is drawn now to the new fix over one fix interval.
            const k = Math.min(1, (now - prev.start) / prev.dur)
            const from = L.latLng(
              prev.from.lat + (prev.to.lat - prev.from.lat) * k,
              prev.from.lng + (prev.to.lng - prev.from.lng) * k,
            )
            const dur = Math.max(40, Math.min(1200, now - prev.lastArrival))
            motion.current = { from, to: at, start: now, dur, lastArrival: now }
            if (prev.to.distanceTo(at) >= MIN_HEADING_M) {
              const b = bearingOf(prev.to, at)
              heading.current.target = b
              bearing.current.target = b
              if (counts.current.fixes === 1) {
                heading.current.shown = b
                bearing.current.shown = b
              }
            }
          }

          // Trail: one polyline per colour run; the last point follows the car.
          const lastFix = prev?.to ?? at
          const r = run.current
          if (r && r.state === stateOf(msg)) {
            r.pts.push(lastFix)
          } else {
            if (r) r.line.setLatLngs([...r.pts, lastFix])
            run.current = {
              state: stateOf(msg),
              pts: [lastFix],
              line: L.polyline([lastFix], {
                color: COLORS[stateOf(msg)],
                weight: 7,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
                interactive: false,
              }).addTo(layer),
            }
          }

          // Limit signs only for zone changes that last (no flicker).
          if (msg.limitKmh === lastLimit.current) {
            pendingLimit.current = null
          } else if (lastLimit.current === null) {
            lastLimit.current = msg.limitKmh
          } else {
            const p = pendingLimit.current
            pendingLimit.current =
              p && p.limit === msg.limitKmh ? { ...p, count: p.count + 1 } : { limit: msg.limitKmh, at, count: 1 }
            if (pendingLimit.current.count >= SIGN_AFTER_FIXES) {
              L.marker(pendingLimit.current.at, {
                icon: signIcon(msg.limitKmh),
                interactive: false,
                zIndexOffset: 500,
              }).addTo(layer)
              lastLimit.current = msg.limitKmh
              pendingLimit.current = null
            }
          }

          counts.current.fixes++
          if (msg.overLimit) counts.current.over++
          if (msg.tooSlow) counts.current.slow++
          setStatus('live')
          setLive(msg)
          setOverShare(Math.round((counts.current.over / counts.current.fixes) * 100))
          setSlowShare(Math.round((counts.current.slow / counts.current.fixes) * 100))
          return
        }

        if (msg.type === 'event') {
          L.marker([msg.lat, msg.lon], { icon: pinIcon(msg.kind), zIndexOffset: 800, interactive: false }).addTo(layer)
          return
        }

        // Trip over: finish the glide, turn north and zoom out to the whole route.
        navigating.current = false
        bearing.current.target = 0
        m.dragging.enable()
        m.doubleClickZoom.enable()
        window.setTimeout(() => fitRoute(true), 700)
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

      <div ref={stageEl} className="ltm__stage">
        <div ref={rotatorEl} className="ltm__rotator">
          <div ref={mapEl} className="ltm__leaflet" />
        </div>

        {status !== 'live' && (
          <div className="ltm__zoom">
            <button type="button" aria-label="Zoom in" onClick={() => map.current?.zoomIn()}>
              +
            </button>
            <button type="button" aria-label="Zoom out" onClick={() => map.current?.zoomOut()}>
              −
            </button>
          </div>
        )}

        {status === 'idle' && (
          <div className="ltm__overlay">
            <p>
              Tap <strong>Start trip</strong> on the phone. The drive appears here live.
            </p>
          </div>
        )}

        {live && status === 'live' && (
          <div className={`ltm__readout${live.overLimit ? ' is-over' : live.tooSlow ? ' is-slow' : ''}`}>
            {destination && <p className="ltm__dest">To {destination}</p>}
            <p className="ltm__speed">
              {Math.round(live.kmh)}
              <small> km/h</small>
            </p>
            <p className="ltm__limit">
              Limit {live.limitKmh} · {live.limitName ?? 'road-type default'}
            </p>
            {live.tooSlow && <p className="ltm__warn">Well below the limit</p>}
            <p className="ltm__limit">
              {live.distanceKm.toFixed(2)} km · over the limit {overShare}%
            </p>
          </div>
        )}

        {summary && status === 'done' && (
          <div className="ltm__summary">
            <p className="ltm__summary-title">
              {summary.saved
                ? destination
                  ? `Arrived at ${destination} · trip saved`
                  : 'Trip saved'
                : 'Trip too short, not saved'}
            </p>
            <p>
              {summary.distanceKm.toFixed(1)} km · over the limit {overShare}% · far below it {slowShare}% ·{' '}
              {summary.harshBrakes} harsh braking · {summary.harshAccels} harsh acceleration
            </p>
            {summary.saved && (
              <Link to="/app" className="btn btn--primary">
                See updated score
              </Link>
            )}
          </div>
        )}

        <p className="ltm__attribution">
          ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>{' '}
          contributors
        </p>
      </div>

      <div className="ltm__legend">
        <span className="ltm-key ltm-key--ok">Within limit</span>
        <span className="ltm-key ltm-key--over">Over limit</span>
        <span className="ltm-key ltm-key--slow">Far below limit</span>
        <span className="ltm-key ltm-key--brake">Harsh braking</span>
        <span className="ltm-key ltm-key--accel">Harsh acceleration</span>
        <span className="ltm__note">{SPEED_MAP_DEMO_LABEL}. Positions are shown live only, never stored.</span>
      </div>
    </section>
  )
}
