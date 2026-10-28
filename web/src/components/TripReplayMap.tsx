import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import type { RouteEvent, RoutePoint, SpeedState } from '../telemetry/tripAnalysis'
import { useT } from '../i18n'

// Whole trip on a map, coloured by speed state, with a replay of the drive.
const COLORS: Record<SpeedState, string> = { ok: '#2e9e3a', over: '#ff4512', slow: '#2f80ed' }
const SPEEDS = [
  { label: 'Slow', factor: 5 },
  { label: 'Normal', factor: 15 },
  { label: 'Fast', factor: 40 },
]

const icon = (html: string, size: [number, number], anchor: [number, number]) =>
  L.divIcon({ html, className: 'ltm-icon', iconSize: size, iconAnchor: anchor })
const carIcon = icon('<span class="ltm-car ltm-car--dot"><span></span></span>', [30, 30], [15, 15])
const placeIcon = (glyph: string, name: string) =>
  icon(`<span class="ltm-place ltm-place--right"><b>${glyph}</b><em>${name}</em></span>`, [34, 34], [17, 17])
const pinIcon = (kind: 'brake' | 'accel') =>
  icon(
    `<span class="ltm-pin ltm-pin--${kind}"><b>${kind === 'brake' ? '!' : '↑'}</b><em>${
      kind === 'brake' ? 'Harsh braking' : 'Harsh acceleration'
    }</em></span>`,
    [30, 30],
    [15, 15],
  )

// Split the route into runs of the same colour (each run shares its first point with the previous one).
function runsOf(points: RoutePoint[]) {
  const runs: Array<{ state: SpeedState; from: number; to: number }> = []
  points.forEach((p, i) => {
    const last = runs[runs.length - 1]
    if (last && last.state === p.state) last.to = i
    else runs.push({ state: p.state, from: Math.max(0, i - 1), to: i })
  })
  return runs
}

export function TripReplayMap({
  points,
  events,
  from,
  to,
}: {
  points: RoutePoint[]
  events: RouteEvent[]
  from: string
  to: string
}) {
  const t = useT()
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const lines = useRef<Array<{ line: L.Polyline; from: number; to: number }>>([])
  const pins = useRef<Array<{ marker: L.Marker; t: number }>>([])
  const car = useRef<L.Marker | null>(null)
  const replay = useRef<{ startReal: number; startSim: number; factor: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [factor, setFactor] = useState(SPEEDS[1].factor)
  const [progress, setProgress] = useState(1)
  const [big, setBig] = useState(false)
  const [readout, setReadout] = useState<RoutePoint | null>(null)

  const latlng = (p: RoutePoint) => L.latLng(p.lat, p.lon)

  // Draw the trip up to point index `upTo` (inclusive).
  const drawUpTo = (upTo: number) => {
    for (const r of lines.current) {
      const end = Math.min(r.to, upTo)
      r.line.setLatLngs(end >= r.from ? points.slice(r.from, end + 1).map(latlng) : [])
    }
    const tNow = points[Math.max(0, upTo)]?.t ?? 0
    for (const p of pins.current) p.marker.setOpacity(p.t <= tNow ? 1 : 0)
  }

  useEffect(() => {
    if (!el.current || map.current || points.length < 2) return
    const m = L.map(el.current, { scrollWheelZoom: false, attributionControl: true, zoomSnap: 0.25 })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m)
    lines.current = runsOf(points).map((r) => ({
      ...r,
      line: L.polyline([], {
        color: COLORS[r.state],
        weight: 7,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(m),
    }))
    pins.current = events.map((e) => ({
      t: e.t,
      marker: L.marker([e.lat, e.lon], { icon: pinIcon(e.kind), zIndexOffset: 800, interactive: false }).addTo(m),
    }))
    L.marker(latlng(points[0]), { icon: placeIcon('●', from), zIndexOffset: 300, interactive: false }).addTo(m)
    L.marker(latlng(points[points.length - 1]), {
      icon: placeIcon('⚑', to),
      zIndexOffset: 300,
      interactive: false,
    }).addTo(m)
    car.current = L.marker(latlng(points[points.length - 1]), { icon: carIcon, zIndexOffset: 1000 }).addTo(m)
    drawUpTo(points.length - 1)
    m.fitBounds(L.latLngBounds(points.map(latlng)), { padding: [40, 40] })
    map.current = m
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, events])

  // Replay loop.
  useEffect(() => {
    if (!playing) return
    let frame = 0
    const tick = () => {
      const r = replay.current
      if (!r) return
      const simT = r.startSim + (performance.now() - r.startReal) * r.factor
      let i = points.findIndex((p) => p.t > simT) - 1
      if (i < 0) i = points.length - 1
      const a = points[i]
      const b = points[Math.min(i + 1, points.length - 1)]
      const k = b.t > a.t ? Math.min(1, (simT - a.t) / (b.t - a.t)) : 0
      const pos = L.latLng(a.lat + (b.lat - a.lat) * k, a.lon + (b.lon - a.lon) * k)
      car.current?.setLatLng(pos)
      drawUpTo(i)
      lines.current.forEach((l) => {
        if (i >= l.from && i < l.to) l.line.addLatLng(pos)
      })
      map.current?.panTo(pos, { animate: false })
      setReadout(a)
      setProgress((simT - points[0].t) / (points[points.length - 1].t - points[0].t))
      if (simT >= points[points.length - 1].t) {
        setPlaying(false)
        setReadout(null)
        drawUpTo(points.length - 1)
        map.current?.flyToBounds(L.latLngBounds(points.map(latlng)), { padding: [40, 40], duration: 1 })
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  const play = () => {
    const restart = progress >= 1
    const startSim = restart ? points[0].t : points[0].t + progress * (points[points.length - 1].t - points[0].t)
    replay.current = { startReal: performance.now(), startSim, factor }
    if (restart) {
      drawUpTo(0)
      map.current?.setView(latlng(points[0]), 16, { animate: false })
    }
    setPlaying(true)
  }

  const changeSpeed = (f: number) => {
    setFactor(f)
    if (playing && replay.current) {
      const simNow = replay.current.startSim + (performance.now() - replay.current.startReal) * replay.current.factor
      replay.current = { startReal: performance.now(), startSim: simNow, factor: f }
    }
  }

  return (
    <div className={`trip-map${big ? ' is-big' : ''}`}>
      <div className="trip-map__stage">
        <div ref={el} className="trip-map__leaflet" />
        {readout && (
          <div
            className={`ltm__readout${readout.state === 'over' ? ' is-over' : readout.state === 'slow' ? ' is-slow' : ''}`}
          >
            <p className="ltm__speed">
              {Math.round(readout.kmh)}
              <small> km/h</small>
            </p>
            <p className="ltm__limit">{t('Limit')} {readout.limit}</p>
          </div>
        )}
      </div>
      <div className="trip-map__controls">
        <button type="button" className="btn btn--primary" onClick={() => (playing ? setPlaying(false) : play())}>
          {playing ? t('Pause') : progress >= 1 ? t('▶ Replay trip') : t('▶ Resume')}
        </button>
        <div className="seg" role="group" aria-label={t('Replay speed')}>
          {SPEEDS.map((s) => (
            <button
              key={s.label}
              type="button"
              className={factor === s.factor ? 'is-on' : ''}
              onClick={() => changeSpeed(s.factor)}
            >
              {t(s.label)}
            </button>
          ))}
        </div>
        <div className="trip-map__progress" aria-hidden="true">
          <span style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
        <button type="button" className="btn btn--outline" onClick={() => setBig((b) => !b)}>
          {big ? t('Smaller map') : t('Larger map')}
        </button>
      </div>
    </div>
  )
}
