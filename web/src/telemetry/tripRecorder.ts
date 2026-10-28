// Turns live phone GPS samples into one TripSummary (Agent C's storage shape), using
// the measurement rules from docs/driver-score-spec-draft.md. Raw positions are only
// held in memory while recording and are never stored (data minimisation).
import type { TripSummary } from '@trips'

export type GpsSample = {
  t: number // epoch ms
  lat: number
  lon: number
  accuracy: number // metres
  speed: number | null // m/s as reported by the device, if any
}

export type LiveStats = {
  startedAt: number
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

// Thresholds from the draft spec (illustrative, not approved).
const MAX_ACCURACY_M = 30
const GAP_SEC = 3
const MOVING_KMH = 5
const LIMIT_TOLERANCE_KMH = 3
const HARSH_MS2 = 3
const HARSH_MIN_SEC = 1
const HARSH_MERGE_SEC = 3
const URBAN_LIMIT = 50
const RURAL_LIMIT = 90
const RURAL_AFTER_SEC = 60 // sustained >70 km/h switches the default limit to rural
const MIN_TRIP_KM = 1
const MIN_TRIP_SEC = 180

function haversineKm(a: GpsSample, b: GpsSample) {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const isNight = (t: number) => {
  const h = new Date(t).getHours()
  return h >= 23 || h < 5
}

export class TripRecorder {
  private last: GpsSample | null = null
  private lastSpeedMs = 0
  private fastSince: number | null = null
  private limit = URBAN_LIMIT
  private brakeRun = 0
  private accelRun = 0
  private lastBrakeAt = -Infinity
  private lastAccelAt = -Infinity

  private distanceKm = 0
  private nightKm = 0
  private drivingSec = 0
  private validSec = 0
  private secOverLimit = 0
  private secOver10 = 0
  private secOver20 = 0
  private harshBrakeCount = 0
  private harshAccelCount = 0
  private samples = 0
  private rejected = 0
  private speedKmh = 0
  private accuracy: number | null = null
  readonly startedAt = Date.now()

  add(sample: GpsSample) {
    this.accuracy = sample.accuracy
    if (sample.accuracy > MAX_ACCURACY_M) {
      this.rejected++
      return
    }
    this.samples++
    const prev = this.last
    this.last = sample
    if (!prev) return

    const dt = (sample.t - prev.t) / 1000
    if (dt <= 0) return
    if (dt > GAP_SEC) {
      // Gap in data: count the distance but not the time as valid coverage.
      this.distanceKm += haversineKm(prev, sample)
      this.lastSpeedMs = 0
      return
    }

    const segKm = haversineKm(prev, sample)
    const speedMs = sample.speed ?? (segKm * 1000) / dt
    // Drop physically implausible jumps (> 60 m/s ~ 216 km/h).
    if (speedMs > 60) {
      this.rejected++
      return
    }
    const kmh = speedMs * 3.6
    this.speedKmh = kmh
    this.validSec += dt
    this.distanceKm += segKm
    if (isNight(sample.t)) this.nightKm += segKm

    if (kmh < MOVING_KMH) {
      this.lastSpeedMs = speedMs
      this.brakeRun = this.accelRun = 0
      return
    }
    this.drivingSec += dt

    // Road-type default limit: urban 50 unless sustained >70 km/h, then rural 90.
    if (kmh > 70) {
      this.fastSince ??= sample.t
      if ((sample.t - this.fastSince) / 1000 >= RURAL_AFTER_SEC) this.limit = RURAL_LIMIT
    } else {
      this.fastSince = null
      if (kmh < 55) this.limit = URBAN_LIMIT
    }
    const over = kmh - this.limit
    if (over > LIMIT_TOLERANCE_KMH) this.secOverLimit += dt
    if (over > 10) this.secOver10 += dt
    if (over > 20) this.secOver20 += dt

    // Harsh events from speed change: |a| >= 3 m/s² for >= 1 s, merged within 3 s.
    const a = (speedMs - this.lastSpeedMs) / dt
    this.lastSpeedMs = speedMs
    const now = sample.t / 1000
    this.brakeRun = a <= -HARSH_MS2 ? this.brakeRun + dt : 0
    this.accelRun = a >= HARSH_MS2 ? this.accelRun + dt : 0
    if (this.brakeRun >= HARSH_MIN_SEC && now - this.lastBrakeAt > HARSH_MERGE_SEC) {
      this.harshBrakeCount++
      this.lastBrakeAt = now
    }
    if (this.accelRun >= HARSH_MIN_SEC && now - this.lastAccelAt > HARSH_MERGE_SEC) {
      this.harshAccelCount++
      this.lastAccelAt = now
    }
  }

  stats(): LiveStats {
    const elapsedSec = (Date.now() - this.startedAt) / 1000
    return {
      startedAt: this.startedAt,
      elapsedSec,
      distanceKm: this.distanceKm,
      speedKmh: this.speedKmh,
      limitKmh: this.limit,
      overLimit: this.speedKmh - this.limit > LIMIT_TOLERANCE_KMH,
      harshBrakes: this.harshBrakeCount,
      harshAccels: this.harshAccelCount,
      accuracy: this.accuracy,
      samples: this.samples,
      rejected: this.rejected,
    }
  }

  // Returns null when the trip is too short to count (spec: < 1 km or < 3 min).
  finish(driverId: string, vehicleId: string | null): TripSummary | null {
    const endedAt = Date.now()
    const elapsedSec = (endedAt - this.startedAt) / 1000
    if (this.distanceKm < MIN_TRIP_KM || elapsedSec < MIN_TRIP_SEC) return null
    const drivingSec = Math.round(this.drivingSec)
    const overLimit = Math.min(Math.round(this.secOverLimit), drivingSec)
    const over10 = Math.min(Math.round(this.secOver10), overLimit)
    const over20 = Math.min(Math.round(this.secOver20), over10)
    const distanceKm = Math.round(this.distanceKm * 100) / 100
    return {
      id: `phone-${this.startedAt}`,
      driverId,
      vehicleId,
      startedAt: new Date(this.startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      distanceKm,
      drivingSec,
      secOverLimit: overLimit,
      secOver10: over10,
      secOver20: over20,
      harshBrakeCount: this.harshBrakeCount,
      harshAccelCount: this.harshAccelCount,
      nightKm: Math.min(Math.round(this.nightKm * 100) / 100, distanceKm),
      coverage: Math.round(Math.min(1, this.validSec / Math.max(1, elapsedSec)) * 100) / 100,
      speedLimitSource: 'road_type_default',
      source: 'phone',
    }
  }
}

export const MIN_TRIP = { km: MIN_TRIP_KM, sec: MIN_TRIP_SEC }
