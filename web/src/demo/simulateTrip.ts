import type { TripSummary } from '@trips'

// One synthetic trip "just driven", for demos without a car or GPS. Labelled synthetic.
export function simulateTrip(driverId: string, vehicleId: string | null, style: 'calm' | 'rushed'): TripSummary {
  const end = Date.now()
  const km = style === 'calm' ? 18.4 : 22.7
  const drivingSec = style === 'calm' ? 1500 : 1380
  const over = style === 'calm' ? 30 : 260
  return {
    id: `sim-${end}`,
    driverId,
    vehicleId,
    startedAt: new Date(end - (drivingSec + 240) * 1000).toISOString(),
    endedAt: new Date(end).toISOString(),
    distanceKm: km,
    drivingSec,
    secOverLimit: over,
    secOver10: Math.round(over * 0.45),
    secOver20: Math.round(over * 0.15),
    harshBrakeCount: style === 'calm' ? 0 : 3,
    harshAccelCount: style === 'calm' ? 0 : 2,
    nightKm: 0,
    coverage: 0.96,
    speedLimitSource: 'road_type_default',
    source: 'synthetic',
  }
}
