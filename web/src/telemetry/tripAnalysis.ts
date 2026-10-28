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
