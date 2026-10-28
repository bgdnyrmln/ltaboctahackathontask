// Collects live phone GPS speed samples and turns them into one TripSummary with
// Agent C's shared aggregator (same rules as the OBD path). Positions are used only
// to derive speed when the device reports none; they are never stored.
import {
  aggregateTrip,
  getSpeedLimitMap,
  PHONE_WINDOW_MS,
  speedingBands,
  type SpeedSample,
  type TripSummary,
} from '@data'

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
  limitSource: 'map' | 'road_type_default'
  limitName: string | null
  overLimit: boolean
  tooSlow: boolean // moving at under half the limit for a sustained stretch
  secTooSlow: number
  harshBrakes: number
  harshAccels: number
  accuracy: number | null
  samples: number
  rejected: number
  phoneUseSec: number
}

const MAX_ACCURACY_M = 30
const MAX_PLAUSIBLE_KMH = 216
// Road-type default limit when the map has no coverage: urban 50 unless sustained
// >70 km/h for a minute, then 90.
const URBAN_LIMIT = 50
const RURAL_LIMIT = 90
const RURAL_AFTER_MS = 60_000
const MIN_TRIP_KM = 1
const MIN_TRIP_SEC = 180
// Driving far below the limit also raises risk (holding up traffic, risky overtakes).
const TOO_SLOW_SHARE = 0.5 // under half the limit...
const TOO_SLOW_AFTER_MS = 8000 // ...for at least this long, so normal starts and stops do not count
const MAP_SHARE_FOR_SOURCE = 0.5 // trip is labelled 'map' when most samples had a map limit

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
  private defaultLimit = URBAN_LIMIT
  private limitSource: LiveStats['limitSource'] = 'road_type_default'
  private limitName: string | null = null
  private mapHits = 0
  private speedSamples = 0
  private slowSince: number | null = null
  private tooSlow = false
  private secTooSlow = 0
  private lastT: number | null = null
  private fastSince: number | null = null
  private speedKmh = 0
  private accuracy: number | null = null
  private rejected = 0
  private phoneMarks: number[] = [] // epoch ms of in-app touches / app switches, ascending
  private readonly startedAt = Date.now()

  // Phone GPS by default; the website's phone simulator records synthetic trips.
  private readonly source: 'phone' | 'synthetic' | 'obd_mock'
  constructor(source: 'phone' | 'synthetic' | 'obd_mock' = 'phone') {
    this.source = source
  }

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

    // Road-type default, used when the speed limit map has no coverage here.
    if (kmh > 70) {
      this.fastSince ??= fix.t
      if (fix.t - this.fastSince >= RURAL_AFTER_MS) this.defaultLimit = RURAL_LIMIT
    } else {
      this.fastSince = null
      if (kmh < 55) this.defaultLimit = URBAN_LIMIT
    }
    const hit = getSpeedLimitMap().lookup(fix.lat, fix.lon)
    this.speedSamples++
    if (hit) this.mapHits++
    this.limit = hit?.limitKmh ?? this.defaultLimit
    this.limitSource = hit ? 'map' : 'road_type_default'
    this.limitName = hit?.name ?? null
    this.speedKmh = kmh
    const slow = kmh >= 5 && kmh < this.limit * TOO_SLOW_SHARE
    this.slowSince = slow ? (this.slowSince ?? fix.t) : null
    const wasSlow = this.tooSlow
    this.tooSlow = this.slowSince !== null && fix.t - this.slowSince >= TOO_SLOW_AFTER_MS
    if (this.tooSlow && wasSlow && this.lastT !== null) this.secTooSlow += (fix.t - this.lastT) / 1000
    this.lastT = fix.t
    this.limits.set(fix.t, this.limit)
    this.samples.push({ t: fix.t, speedKmh: kmh })
  }

  // Call on touch/pointer events on the driving screen and on visibilitychange.
  // Only the timestamp is kept, never what was touched.
  markPhoneActivity(t: number = Date.now()) {
    const last = this.phoneMarks[this.phoneMarks.length - 1]
    if (last === undefined || t - last >= 250) this.phoneMarks.push(t)
  }

  private phoneActive(t: number): boolean {
    for (let i = this.phoneMarks.length - 1; i >= 0; i--) {
      const m = this.phoneMarks[i]
      if (m <= t) return t - m <= PHONE_WINDOW_MS
    }
    return false
  }

  private aggregate(driverId: string, vehicleId: string | null): TripSummary | null {
    if (this.samples.length < 2) return null
    return aggregateTrip({
      id: `phone-${this.startedAt}`,
      driverId,
      vehicleId,
      samples: this.samples,
      limitKmh: (t) => this.limits.get(t) ?? URBAN_LIMIT,
      phoneActive: (t) => this.phoneActive(t),
      speedLimitSource:
        this.speedSamples > 0 && this.mapHits / this.speedSamples >= MAP_SHARE_FOR_SOURCE ? 'map' : 'road_type_default',
      source: this.source,
      expectedHz: 1,
    })
  }

  stats(): LiveStats {
    const summary = this.aggregate('live', null)
    return {
      elapsedSec:
        this.samples.length > 1
          ? (this.samples[this.samples.length - 1].t - this.samples[0].t) / 1000
          : (Date.now() - this.startedAt) / 1000,
      distanceKm: summary?.distanceKm ?? 0,
      speedKmh: this.speedKmh,
      limitKmh: this.limit,
      limitSource: this.limitSource,
      limitName: this.limitName,
      overLimit: speedingBands(this.speedKmh, this.limit).overLimit,
      tooSlow: this.tooSlow,
      secTooSlow: Math.round(this.secTooSlow),
      harshBrakes: summary?.harshBrakeCount ?? 0,
      harshAccels: summary?.harshAccelCount ?? 0,
      accuracy: this.accuracy,
      samples: this.samples.length,
      rejected: this.rejected,
      phoneUseSec: summary?.secPhoneUse ?? 0,
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
