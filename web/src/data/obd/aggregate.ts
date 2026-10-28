// Turns 1 Hz speed samples into one TripSummary, following the spec:
// harsh event = |dv/dt| >= 3 m/s² (events within 3 s merged); speeding counted
// above limit + tolerance (see trips/speeding.ts); raw samples are discarded afterwards.
import { rigaParts } from '../time.ts';
import { isSlowSpeed, speedingBands, TOO_SLOW_AFTER_MS } from '../trips/speeding.ts';
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

export interface HarshEvent {
  t: number; // ms since epoch, first reading of the event
  kind: 'harsh_brake' | 'harsh_accel';
  valueMs2: number; // peak acceleration within the merged event, signed
}

// Harsh events with the aggregator's rule (|dv/dt| >= HARSH_MS2 while moving,
// readings within MERGE_MS merged into one event). The trip summary keeps only
// the counts; the timestamps are for the optional trip route (routes/).
export function harshEvents(samples: SpeedSample[]): HarshEvent[] {
  const valid = samples.filter((s): s is { t: number; speedKmh: number } => s.speedKmh !== null);
  const events: HarshEvent[] = [];
  const last: Record<HarshEvent['kind'], { t: number; event: HarshEvent | null }> = {
    harsh_brake: { t: -Infinity, event: null },
    harsh_accel: { t: -Infinity, event: null },
  };
  for (let i = 1; i < valid.length; i++) {
    const prev = valid[i - 1];
    const cur = valid[i];
    const dt = cur.t - prev.t;
    if (dt <= 0 || dt > MAX_GAP_MS) continue;
    if (Math.max(prev.speedKmh, cur.speedKmh) < MOVING_KMH) continue;
    const accel = ((cur.speedKmh - prev.speedKmh) / 3.6) / (dt / 1000);
    const kind = accel <= -HARSH_MS2 ? 'harsh_brake' : accel >= HARSH_MS2 ? 'harsh_accel' : null;
    if (!kind) continue;
    const state = last[kind];
    if (cur.t - state.t > MERGE_MS || !state.event) {
      state.event = { t: cur.t, kind, valueMs2: Math.round(accel * 10) / 10 };
      events.push(state.event);
    } else if (Math.abs(accel) > Math.abs(state.event.valueMs2)) {
      state.event.valueMs2 = Math.round(accel * 10) / 10;
    }
    state.t = cur.t;
  }
  return events;
}

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
  let slowMs = 0;
  let slowSince: number | null = null;
  let wasTooSlow = false;
  let stretchStart: number | null = null;
  let stoppedSince: number | null = null;
  let maxStretchMs = 0;

  for (let i = 1; i < valid.length; i++) {
    const prev = valid[i - 1];
    const cur = valid[i];
    const dt = cur.t - prev.t;
    if (dt <= 0 || dt > MAX_GAP_MS) {
      slowSince = null; // a gap breaks a too-slow run
      wasTooSlow = false;
      continue;
    }

    // Too slow: same rule as the live recorder; time counts once the run has lasted 8 s.
    const curLimit = o.limitKmh(cur.t);
    const slow = curLimit !== null && isSlowSpeed(cur.speedKmh, curLimit);
    slowSince = slow ? (slowSince ?? cur.t) : null;
    const tooSlow = slowSince !== null && cur.t - slowSince >= TOO_SLOW_AFTER_MS;
    if (tooSlow && wasTooSlow) slowMs += dt;
    wasTooSlow = tooSlow;

    const avg = (prev.speedKmh + cur.speedKmh) / 2;
    const km = (avg * dt) / 3_600_000;
    distanceKm += km;
    if (isNight(cur.t)) nightKm += km;

    if (cur.speedKmh >= MOVING_KMH) {
      drivingMs += dt;
      if (curLimit !== null) {
        const b = speedingBands(cur.speedKmh, curLimit);
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
  }

  const events = harshEvents(o.samples);

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
    secTooSlow: Math.min(Math.round(slowMs / 1000), Math.round(drivingMs / 1000)),
    harshBrakeCount: events.filter((e) => e.kind === 'harsh_brake').length,
    harshAccelCount: events.filter((e) => e.kind === 'harsh_accel').length,
    nightKm: Math.min(Math.round(nightKm * 100) / 100, Math.round(distanceKm * 100) / 100),
    maxContinuousMin: r1(maxStretchMs / 60_000),
    coverage: Math.round(Math.min(1, valid.length / expected) * 100) / 100,
    speedLimitSource: o.speedLimitSource,
    source: o.source,
  };
}
