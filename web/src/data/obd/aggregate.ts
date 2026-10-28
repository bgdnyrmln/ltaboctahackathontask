// Turns 1 Hz speed samples into one TripSummary, following the spec:
// harsh event = |dv/dt| >= 3 m/s² (events within 3 s merged); speeding counted
// above limit + tolerance (see trips/speeding.ts); raw samples are discarded afterwards.
import { rigaParts } from '../time.ts';
import { speedingBands } from '../trips/speeding.ts';
import type { TripSummary } from '../trips/types.ts';

export interface SpeedSample {
  t: number; // ms since epoch
  speedKmh: number | null; // null = no valid reading
}

export interface AggregateOptions {
  id: string;
  driverId: string;
  vehicleId: string | null;
  samples: SpeedSample[]; // ascending t
  limitKmh: (t: number) => number | null;
  // true when the phone was used (in-app touch or app switch) within the
  // last PHONE_WINDOW_MS before t; omit when the source cannot know (OBD).
  phoneActive?: (t: number) => boolean;
  speedLimitSource: TripSummary['speedLimitSource'];
  source: TripSummary['source'];
  expectedHz?: number;
}

export const HARSH_MS2 = 3.0;
const MERGE_MS = 3000;
const MOVING_KMH = 5;
const BREAK_MS = 15 * 60_000; // a stop this long ends a continuous stretch
const MAX_GAP_MS = 3000; // GPS/OBD gaps longer than this are not interpolated
export const PHONE_MIN_KMH = 10;
export const PHONE_WINDOW_MS = 5000;

const isNight = (t: number) => {
  const h = rigaParts(new Date(t)).hour;
  return h >= 23 || h < 5;
};

export function aggregateTrip(o: AggregateOptions): TripSummary {
  const valid = o.samples.filter((s): s is { t: number; speedKmh: number } => s.speedKmh !== null);
  if (o.samples.length === 0) throw new Error('aggregateTrip needs at least one sample');
  const startT = o.samples[0].t;
  const endT = o.samples[o.samples.length - 1].t;

  let distanceKm = 0;
  let nightKm = 0;
  let drivingMs = 0;
  let overMs = 0;
  let over10Ms = 0;
  let over20Ms = 0;
  let pct10Ms = 0;
  let pct20Ms = 0;
  let pct40Ms = 0;
  let phoneMs = 0;
  let brakes = 0;
  let accels = 0;
  let lastBrake = -Infinity;
  let lastAccel = -Infinity;
  let stretchStart: number | null = null;
  let stoppedSince: number | null = null;
  let maxStretchMs = 0;

  for (let i = 1; i < valid.length; i++) {
    const prev = valid[i - 1];
    const cur = valid[i];
    const dt = cur.t - prev.t;
    if (dt <= 0 || dt > MAX_GAP_MS) continue;

    const avg = (prev.speedKmh + cur.speedKmh) / 2;
    const km = (avg * dt) / 3_600_000;
    distanceKm += km;
    if (isNight(cur.t)) nightKm += km;

    if (cur.speedKmh >= MOVING_KMH) {
      drivingMs += dt;
      const limit = o.limitKmh(cur.t);
      if (limit !== null) {
        const b = speedingBands(cur.speedKmh, limit);
        if (b.overLimit) overMs += dt;
        if (b.over10) over10Ms += dt;
        if (b.over20) over20Ms += dt;
        if (b.overPct10) pct10Ms += dt;
        if (b.overPct20) pct20Ms += dt;
        if (b.overPct40) pct40Ms += dt;
      }
      if (cur.speedKmh > PHONE_MIN_KMH && o.phoneActive?.(cur.t)) phoneMs += dt;
      if (stretchStart === null || (stoppedSince !== null && cur.t - stoppedSince >= BREAK_MS)) {
        stretchStart = cur.t;
      }
      stoppedSince = null;
      maxStretchMs = Math.max(maxStretchMs, cur.t - stretchStart);
    } else if (stoppedSince === null) {
      stoppedSince = cur.t;
    }

    const accel = ((cur.speedKmh - prev.speedKmh) / 3.6) / (dt / 1000);
    if (Math.max(prev.speedKmh, cur.speedKmh) >= MOVING_KMH) {
      if (accel <= -HARSH_MS2 && cur.t - lastBrake > MERGE_MS) brakes++;
      if (accel <= -HARSH_MS2) lastBrake = cur.t;
      if (accel >= HARSH_MS2 && cur.t - lastAccel > MERGE_MS) accels++;
      if (accel >= HARSH_MS2) lastAccel = cur.t;
    }
  }

  const expected = Math.max(1, Math.round(((endT - startT) / 1000) * (o.expectedHz ?? 1)) + 1);
  const r1 = (x: number) => Math.round(x * 10) / 10;

  return {
    id: o.id,
    driverId: o.driverId,
    vehicleId: o.vehicleId,
    startedAt: new Date(startT).toISOString(),
    endedAt: new Date(endT).toISOString(),
    distanceKm: Math.round(distanceKm * 100) / 100,
    drivingSec: Math.round(drivingMs / 1000),
    secOverLimit: Math.round(overMs / 1000),
    secOver10: Math.round(over10Ms / 1000),
    secOver20: Math.round(over20Ms / 1000),
    secOverPct10: Math.round(pct10Ms / 1000),
    secOverPct20: Math.round(pct20Ms / 1000),
    secOverPct40: Math.round(pct40Ms / 1000),
    secPhoneUse: Math.round(phoneMs / 1000),
    harshBrakeCount: brakes,
    harshAccelCount: accels,
    nightKm: Math.min(Math.round(nightKm * 100) / 100, Math.round(distanceKm * 100) / 100),
    maxContinuousMin: r1(maxStretchMs / 60_000),
    coverage: Math.round(Math.min(1, valid.length / expected) * 100) / 100,
    speedLimitSource: o.speedLimitSource,
    source: o.source,
  };
}
