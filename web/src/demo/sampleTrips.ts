// SYNTHETIC trips for the demo UI, in Agent C's TripSummary shape. Placeholder until
// Agent D's fixtures exist. Deterministic per driver, dated relative to "now" so the
// current week always has data.
import type { TripSummary } from '@trips'

type Style = {
  weeklyKm: number[] // oldest week first, last entry is the current week
  speedingPct: number[]
  brakePer100: number[]
  accelPer100: number[]
  nightShare: number
  avgKmh: number
}

// Three seeded demo drivers from HACK-15, each showing a different UI state.
const STYLES: Record<string, Style> = {
  // Calm, steady driver: high score, high confidence.
  'drv-001': {
    weeklyKm: [210, 185, 240, 320],
    speedingPct: [4, 3.5, 3, 2.5],
    brakePer100: [2.5, 2, 2, 1.5],
    accelPer100: [2, 2, 1.5, 1.5],
    nightShare: 0.05,
    avgKmh: 48,
  },
  // Improving but still aggressive: moderate score, a clear tip.
  'drv-002': {
    weeklyKm: [260, 230, 250, 190],
    speedingPct: [16, 14, 12, 10],
    brakePer100: [9, 8, 7, 6],
    accelPer100: [8, 7, 6.5, 5],
    nightShare: 0.18,
    avgKmh: 62,
  },
  // Barely drove this week: "insufficient data" state, profile has unknown fields.
  'drv-003': {
    weeklyKm: [60, 85, 40, 18],
    speedingPct: [7, 6, 8, 6],
    brakePer100: [4, 5, 4, 5],
    accelPer100: [3, 3, 4, 3],
    nightShare: 0.3,
    avgKmh: 42,
  },
}

const DAY = 24 * 60 * 60 * 1000

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function sampleTripsFor(driverId: string, vehicleId: string | null, now = Date.now()): TripSummary[] {
  const style = STYLES[driverId]
  if (!style) return []
  const rand = seeded([...driverId].reduce((a, c) => a * 31 + c.charCodeAt(0), 7))
  const trips: TripSummary[] = []
  const weeks = style.weeklyKm.length

  style.weeklyKm.forEach((weekKm, w) => {
    const weekEnd = now - (weeks - 1 - w) * 7 * DAY
    let remaining = weekKm
    let brakeCarry = 0
    let accelCarry = 0
    let n = 0
    while (remaining > 0.5) {
      const km = Math.min(remaining, Math.round((6 + rand() * 34) * 10) / 10)
      remaining -= km
      const start = weekEnd - (0.3 + rand() * 6.5) * DAY
      const kmh = style.avgKmh * (0.85 + rand() * 0.3)
      const drivingSec = Math.round((km / kmh) * 3600)
      const overLimit = Math.round(drivingSec * (style.speedingPct[w] / 100) * (0.7 + rand() * 0.6))
      brakeCarry += (style.brakePer100[w] * km) / 100
      accelCarry += (style.accelPer100[w] * km) / 100
      const brakes = Math.floor(brakeCarry)
      const accels = Math.floor(accelCarry)
      brakeCarry -= brakes
      accelCarry -= accels
      const night = rand() < style.nightShare * 2 ? Math.round(km * (0.3 + rand() * 0.7) * 10) / 10 : 0
      const over = Math.min(overLimit, drivingSec)
      trips.push({
        id: `${driverId}-w${w}-t${n++}`,
        driverId,
        vehicleId,
        startedAt: new Date(start).toISOString(),
        endedAt: new Date(start + (drivingSec + 120) * 1000).toISOString(),
        distanceKm: km,
        drivingSec,
        secOverLimit: over,
        secOver10: Math.round(over * 0.4),
        secOver20: Math.round(over * 0.1),
        harshBrakeCount: brakes,
        harshAccelCount: accels,
        nightKm: Math.min(night, km),
        maxContinuousMin: Math.round(drivingSec / 60),
        coverage: Math.round((0.84 + rand() * 0.15) * 100) / 100,
        speedLimitSource: 'road_type_default',
        source: 'synthetic',
      })
    }
  })
  return trips
}
