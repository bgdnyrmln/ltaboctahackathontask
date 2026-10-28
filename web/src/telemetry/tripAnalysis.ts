import { getSpeedLimitMap, HARSH_MS2, isSlowSpeed, speedingBands, TOO_SLOW_AFTER_MS } from '@data'
import { simulatedFixes, SIM_TRIPS, type SimTripId } from './simulatedDrive'

// Routes are never stored for real trips. Simulated trips are scripted, so their
// route can be rebuilt from the script: we only remember which script a trip used.
const KEY = 'foc.simtrips'

export function rememberSimTrip(tripId: string, simTripId: SimTripId) {
  try {
    const map = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, SimTripId>
    map[tripId] = simTripId
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    // Storage unavailable: the trip simply has no replayable route.
  }
}

export function simTripOf(tripId: string): SimTripId | null {
  try {
    const id = (JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, SimTripId>)[tripId]
    return SIM_TRIPS.some((t) => t.id === id) ? id : null
  } catch {
    return null
  }
}

export type SpeedState = 'ok' | 'over' | 'slow'
export type RoutePoint = { lat: number; lon: number; t: number; kmh: number; limit: number; state: SpeedState }
export type RouteEvent = { lat: number; lon: number; kind: 'brake' | 'accel'; t: number }

const MERGE_MS = 3000

// Rebuild a simulated trip's route between its start and end, with the same
// rules the recorder and live map use (map limits, speeding, far below, harsh events).
export function analyzeSimTrip(simTripId: SimTripId, startedAt: string, endedAt: string) {
  const start = Date.parse(startedAt)
  const length = simulatedFixes(simTripId, 0).length
  const fixes = simulatedFixes(simTripId, start + length * 1000).filter((f) => f.t <= Date.parse(endedAt))
  const limits = getSpeedLimitMap()
  const points: RoutePoint[] = []
  const events: RouteEvent[] = []
  let slowSince: number | null = null
  let lastBrake = -Infinity
  let lastAccel = -Infinity

  fixes.forEach((f, i) => {
    const kmh = (f.speed ?? 0) * 3.6
    const limit = limits.lookup(f.lat, f.lon)?.limitKmh ?? 50
    const slow = isSlowSpeed(kmh, limit)
    slowSince = slow ? (slowSince ?? f.t) : null
    const tooSlow = slowSince !== null && f.t - slowSince >= TOO_SLOW_AFTER_MS
    const state: SpeedState = speedingBands(kmh, limit).overLimit ? 'over' : tooSlow ? 'slow' : 'ok'
    points.push({ lat: f.lat, lon: f.lon, t: f.t, kmh, limit, state })

    if (i === 0) return
    const prev = fixes[i - 1]
    const prevKmh = (prev.speed ?? 0) * 3.6
    const accel = (kmh - prevKmh) / 3.6 / ((f.t - prev.t) / 1000)
    if (Math.max(kmh, prevKmh) < 5) return
    if (accel <= -HARSH_MS2) {
      if (f.t - lastBrake > MERGE_MS) events.push({ lat: f.lat, lon: f.lon, kind: 'brake', t: f.t })
      lastBrake = f.t
    }
    if (accel >= HARSH_MS2) {
      if (f.t - lastAccel > MERGE_MS) events.push({ lat: f.lat, lon: f.lon, kind: 'accel', t: f.t })
      lastAccel = f.t
    }
  })
  const trip = SIM_TRIPS.find((t) => t.id === simTripId)!
  return { points, events, trip }
}

// ---------------------------------------------------------------------------
// Illustrative routes for trips without recorded positions (generated demo trips,
// demo OBD trips). A static Riga route is picked per trip and the trip's real
// totals are laid onto it: its distance, its share of time over the limit and its
// number of harsh events. Positions are illustrative, the numbers are the trip's.

type TripLike = {
  id: string
  startedAt: string
  endedAt: string
  distanceKm: number
  drivingSec: number
  secOverLimit: number
  secOver10: number
  harshBrakeCount: number
  harshAccelCount: number
}

function hashOf(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function rng(seed: number) {
  let s = seed || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const kmBetween = (a: [number, number], b: [number, number]) => {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// Path of at least `km`: the route, then back and forth if the trip is longer.
function pathFor(route: Array<[number, number]>, km: number) {
  const path = [...route]
  let length = 0
  for (let i = 1; i < path.length; i++) length += kmBetween(path[i - 1], path[i])
  const routeKm = length
  let forward = false
  while (length < km && routeKm > 0) {
    const leg = forward ? route : [...route].reverse()
    path.push(...leg.slice(1))
    length += routeKm
    forward = !forward
  }
  return path
}

function pointOnPath(path: Array<[number, number]>, cum: number[], km: number): [number, number] {
  let i = cum.findIndex((c) => c >= km)
  if (i <= 0) return i === 0 ? path[0] : path[path.length - 1]
  const f = (km - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)
  return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f]
}

export function illustrativeRoute(
  trip: TripLike,
  routes: Array<{ from: string; to: string; km: number; points: Array<[number, number]> }>,
) {
  const rand = rng(hashOf(trip.id))
  // Prefer routes close to the trip's length; pick among them deterministically.
  const ranked = [...routes].sort((a, b) => Math.abs(a.km - trip.distanceKm) - Math.abs(b.km - trip.distanceKm))
  const pick = ranked[Math.floor(rand() * Math.min(3, ranked.length))]
  const reverse = rand() < 0.5
  const base = reverse ? [...pick.points].reverse() : pick.points
  const path = pathFor(base, trip.distanceKm)
  const cum = [0]
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + kmBetween(path[i - 1], path[i]))

  const n = Math.max(60, Math.min(600, Math.round(trip.drivingSec / 5)))
  const start = Date.parse(trip.startedAt)
  const durMs = Math.max(1, Date.parse(trip.endedAt) - start)
  const avg = trip.drivingSec > 0 ? trip.distanceKm / (trip.drivingSec / 3600) : 40

  // Over-limit stretches: the trip's share of time, in one to three stretches.
  const over = new Array<boolean>(n).fill(false)
  const overSamples = Math.round((trip.drivingSec > 0 ? trip.secOverLimit / trip.drivingSec : 0) * n)
  if (overSamples > 0) {
    const k = Math.min(overSamples, 1 + Math.floor(rand() * 3))
    const each = Math.ceil(overSamples / k)
    for (let j = 0; j < k; j++) {
      const slot = Math.floor(n / k)
      const from = j * slot + Math.floor(rand() * Math.max(1, slot - each))
      for (let i = from; i < Math.min(n, from + each); i++) over[i] = true
    }
  }
  const severe = trip.secOverLimit > 0 && trip.secOver10 / trip.secOverLimit > 0.4
  const limits = getSpeedLimitMap()

  const points: RoutePoint[] = []
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1)
    const [lat, lon] = pointOnPath(path, cum, f * trip.distanceKm)
    const limit = limits.lookup(lat, lon)?.limitKmh ?? 50
    const wobble = 1 + Math.sin(i / 5) * 0.06
    const kmh = over[i] ? limit + (severe ? 14 : 7) * wobble : Math.min(limit - 3, avg * wobble)
    points.push({ lat, lon, t: start + f * durMs, kmh: Math.max(0, kmh), limit, state: over[i] ? 'over' : 'ok' })
  }

  // Harsh events at deterministic spots along the route.
  const events: RouteEvent[] = []
  const place = (kind: 'brake' | 'accel', count: number) => {
    for (let j = 0; j < count; j++) {
      const p = points[Math.min(n - 1, Math.floor(((j + 0.3 + rand() * 0.4) / count) * (n - 1)))]
      events.push({ lat: p.lat, lon: p.lon, kind, t: p.t })
    }
  }
  place('brake', trip.harshBrakeCount)
  place('accel', trip.harshAccelCount)

  const from = reverse ? pick.to : pick.from
  const to = path.length > base.length ? from : reverse ? pick.from : pick.to
  return { points, events, from, to }
}
