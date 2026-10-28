import type { TripRoute } from '../demo/tripRoutes'

const COLORS = { ok: '#2e9e3a', over: '#ff4512', slow: '#2f80ed' } as const
const W = 120
const H = 72
const PAD = 6

// Static mini map of a trip (no tiles): the route coloured by speed state.
export function TripThumb({ route }: { route: TripRoute }) {
  const pts = route.points
  const lats = pts.map((p) => p.lat)
  const lons = pts.map((p) => p.lon)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const cos = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)
  const spanX = (maxLon - minLon) * cos || 1e-6
  const spanY = maxLat - minLat || 1e-6
  const k = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY)
  const ox = (W - spanX * k) / 2
  const oy = (H - spanY * k) / 2
  const xy = (p: { lat: number; lon: number }) =>
    `${(ox + (p.lon - minLon) * cos * k).toFixed(1)},${(oy + (maxLat - p.lat) * k).toFixed(1)}`

  // Colour runs, each sharing its first point with the previous run.
  const runs: Array<{ state: keyof typeof COLORS; pts: string[] }> = []
  pts.forEach((p, i) => {
    const last = runs[runs.length - 1]
    if (last && last.state === p.state) last.pts.push(xy(p))
    else runs.push({ state: p.state, pts: i ? [xy(pts[i - 1]), xy(p)] : [xy(p)] })
  })
  const [sx, sy] = xy(pts[0]).split(',')
  const [ex, ey] = xy(pts[pts.length - 1]).split(',')

  return (
    <svg className="trip-thumb" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <rect width={W} height={H} rx="6" className="trip-thumb__bg" />
      {runs.map((r, i) => (
        <polyline key={i} points={r.pts.join(' ')} stroke={COLORS[r.state]} />
      ))}
      {route.events.map((e, i) => {
        const [x, y] = xy(e).split(',')
        return <circle key={`e${i}`} cx={x} cy={y} r="2.6" className={`trip-thumb__ev trip-thumb__ev--${e.kind}`} />
      })}
      <circle cx={sx} cy={sy} r="3" className="trip-thumb__start" />
      <circle cx={ex} cy={ey} r="3" className="trip-thumb__end" />
    </svg>
  )
}
