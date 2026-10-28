// Collects live phone GPS speed samples and turns them into one TripSummary with
// Agent C's shared aggregator (same rules as the OBD path). Positions are used only
// to derive speed when the device reports none; they are never stored.
import { aggregateTrip, type SpeedSample, type TripSummary } from '@data'

export type GpsFix = {
  t: number // epoch ms
  lat: number
  lon: number
  accuracy: number // metres
  speed: number | null // m/s as reported by the device, if any
}

export type LiveStats = {
  elapsedSec: number
  distanceKm: number
  speedKmh: number
  limitKmh: number
  overLimit: boolean
  harshBrakes: number
  harshAccels: number
  accuracy: number | null
  samples: number
  rejected: number
}

const MAX_ACCURACY_M = 30
const MAX_PLAUSIBLE_KMH = 216
const TOLERANCE_KMH = 3
// Road-type default limit: urban 50 unless sustained >70 km/h for a minute, then 90.
const URBAN_LIMIT = 50
const RURAL_LIMIT = 90
const RURAL_AFTER_MS = 60_000
const MIN_TRIP_KM = 1
const MIN_TRIP_SEC = 180

function haversineKm(a: GpsFix, b: GpsFix) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

export class TripRecorder {
  private samples: SpeedSample[] = []
  private limits = new Map<number, number>()
  private lastFix: GpsFix | null = null
  private limit = URBAN_LIMIT
  private fastSince: number | null = null
  private speedKmh = 0
  private accuracy: number | null = null
  private rejected = 0
  private readonly startedAt = Date.now()

  add(fix: GpsFix) {
    this.accuracy = fix.accuracy
    if (fix.accuracy > MAX_ACCURACY_M) {
      this.rejected++
      this.samples.push({ t: fix.t, speedKmh: null }) // counts against coverage
      return
    }
    const prev = this.lastFix
    this.lastFix = fix
    let kmh = fix.speed !== null ? fix.speed * 3.6 : null
    if (kmh === null && prev && fix.t > prev.t) kmh = (haversineKm(prev, fix) / (fix.t - prev.t)) * 3_600_000
    if (kmh === null || kmh > MAX_PLAUSIBLE_KMH) {
      this.rejected++
      this.samples.push({ t: fix.t, speedKmh: null })
      return
    }

    if (kmh > 70) {
      this.fastSince ??= fix.t
      if (fix.t - this.fastSince >= RURAL_AFTER_MS) this.limit = RURAL_LIMIT
    } else {
      this.fastSince = null
      if (kmh < 55) this.limit = URBAN_LIMIT
    }
    this.speedKmh = kmh
    this.limits.set(fix.t, this.limit)
    this.samples.push({ t: fix.t, speedKmh: kmh })
  }

  private aggregate(driverId: string, vehicleId: string | null): TripSummary | null {
    if (this.samples.length < 2) return null
    return aggregateTrip({
      id: `phone-${this.startedAt}`,
      driverId,
      vehicleId,
      samples: this.samples,
      limitKmh: (t) => this.limits.get(t) ?? URBAN_LIMIT,
      speedLimitSource: 'road_type_default',
      source: 'phone',
      expectedHz: 1,
    })
  }

  stats(): LiveStats {
    const summary = this.aggregate('live', null)
    return {
      elapsedSec: (Date.now() - this.startedAt) / 1000,
      distanceKm: summary?.distanceKm ?? 0,
      speedKmh: this.speedKmh,
      limitKmh: this.limit,
      overLimit: this.speedKmh - this.limit > TOLERANCE_KMH,
      harshBrakes: summary?.harshBrakeCount ?? 0,
      harshAccels: summary?.harshAccelCount ?? 0,
      accuracy: this.accuracy,
      samples: this.samples.length,
      rejected: this.rejected,
    }
  }

  // Returns null when the trip is too short to count (spec: < 1 km or < 3 min).
  finish(driverId: string, vehicleId: string | null): TripSummary | null {
    const trip = this.aggregate(driverId, vehicleId)
    if (!trip) return null
    const seconds = (Date.parse(trip.endedAt) - Date.parse(trip.startedAt)) / 1000
    return trip.distanceKm < MIN_TRIP_KM || seconds < MIN_TRIP_SEC ? null : trip
  }
}

export const MIN_TRIP = { km: MIN_TRIP_KM, sec: MIN_TRIP_SEC }
