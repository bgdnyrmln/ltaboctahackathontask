import { addDays, rigaToUtc } from '../time.ts';
import type { TripSummary } from './types.ts';

// Deterministic synthetic trips for the demo. Agent D's telemetry can replace
// this; the output is plain TripSummary so nothing downstream changes.

export interface DrivingProfile {
  tripsPerWeek: number;
  kmRange: [number, number];
  speedingShare: number; // share of moving time over the limit
  brakePer100: number;
  accelPer100: number;
  nightTripShare: number; // share of trips starting 23:00-04:59
  longNightTrips: boolean; // some night trips run >120 min without a stop
  coverage: number;
  speedLimitSource: TripSummary['speedLimitSource'];
  improvement: number; // 0.4 = oldest week 40% worse, improving to the newest
}

export const DEMO_PROFILES: Record<string, { vehicleId: string; profile: DrivingProfile }> = {
  'drv-001': {
    vehicleId: 'veh-001',
    profile: {
      tripsPerWeek: 10,
      kmRange: [5, 35],
      speedingShare: 0.03,
      brakePer100: 1.5,
      accelPer100: 1,
      nightTripShare: 0.05,
      longNightTrips: false,
      coverage: 0.97,
      speedLimitSource: 'road_type_default',
      improvement: 0,
    },
  },
  'drv-002': {
    vehicleId: 'veh-002',
    profile: {
      tripsPerWeek: 12,
      kmRange: [6, 45],
      speedingShare: 0.12,
      brakePer100: 8,
      accelPer100: 6,
      nightTripShare: 0.25,
      longNightTrips: true,
      coverage: 0.95,
      speedLimitSource: 'road_type_default',
      improvement: 0.4,
    },
  },
  'drv-003': {
    vehicleId: 'veh-003',
    profile: {
      tripsPerWeek: 3,
      kmRange: [3, 8],
      speedingShare: 0.06,
      brakePer100: 4,
      accelPer100: 3,
      nightTripShare: 0,
      longNightTrips: false,
      coverage: 0.6,
      speedLimitSource: 'unknown',
      improvement: 0,
    },
  },
};

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(mean: number, rnd: () => number): number {
  if (mean <= 0) return 0;
  const limit = Math.exp(-mean);
  let k = 0;
  let p = rnd();
  while (p > limit) {
    k++;
    p *= rnd();
  }
  return k;
}

const between = (rnd: () => number, lo: number, hi: number) => lo + rnd() * (hi - lo);
const round = (x: number, digits = 1) => Math.round(x * 10 ** digits) / 10 ** digits;

export interface GenerateOptions {
  driverId: string;
  vehicleId: string | null;
  profile: DrivingProfile;
  weekStarts: string[]; // oldest first
  now?: Date; // trips starting after this are dropped
}

export function generateTrips(opts: GenerateOptions): TripSummary[] {
  const { driverId, vehicleId, profile, weekStarts, now } = opts;
  const trips: TripSummary[] = [];
  const n = weekStarts.length;

  weekStarts.forEach((weekStart, w) => {
    const factor = 1 + (n > 1 ? (profile.improvement * (n - 1 - w)) / (n - 1) : 0);

    for (let i = 0; i < profile.tripsPerWeek; i++) {
      // One stream per trip: a trip's schedule never depends on the window or
      // on how many draws earlier trips used.
      const rnd = mulberry32(hashSeed(`${driverId}|${weekStart}|${i}`));
      const night = rnd() < profile.nightTripShare;
      const day = Math.floor(rnd() * 7);
      const hour = night ? [23, 0, 1, 2, 3][Math.floor(rnd() * 5)] : 7 + Math.floor(rnd() * 13);
      const minute = Math.floor(rnd() * 60);
      // Hours 0-4 belong to the next calendar day after a 23:00 start.
      const startDate = night && hour < 23 ? addDays(weekStart, Math.min(day + 1, 6)) : addDays(weekStart, day);
      const start = rigaToUtc(startDate, hour, minute);
      if (now && start.getTime() > now.getTime()) continue;

      const longNight = night && profile.longNightTrips && rnd() < 0.5;
      const distanceKm = round(longNight ? between(rnd, 160, 230) : between(rnd, ...profile.kmRange));
      const speedKmh = longNight ? between(rnd, 75, 90) : between(rnd, 30, 70);
      const drivingSec = Math.round((distanceKm / speedKmh) * 3600);
      const durationSec = Math.round(drivingSec * between(rnd, 1.05, 1.25));
      const maxContinuousMin = round(
        longNight ? drivingSec / 60 : Math.min(durationSec, drivingSec * between(rnd, 0.6, 1)) / 60,
      );

      const share = Math.min(0.6, profile.speedingShare * factor * between(rnd, 0.5, 1.5));
      const secOverLimit = Math.round(drivingSec * share);
      const secOver10 = Math.round(secOverLimit * between(rnd, 0.25, 0.5));
      const secOver20 = Math.round(secOver10 * between(rnd, 0.1, 0.35));

      trips.push({
        id: `syn-${driverId}-${weekStart}-${String(i).padStart(2, '0')}`,
        driverId,
        vehicleId,
        startedAt: start.toISOString(),
        endedAt: new Date(start.getTime() + durationSec * 1000).toISOString(),
        distanceKm,
        drivingSec,
        secOverLimit,
        secOver10,
        secOver20,
        harshBrakeCount: poisson((profile.brakePer100 * factor * distanceKm) / 100, rnd),
        harshAccelCount: poisson((profile.accelPer100 * factor * distanceKm) / 100, rnd),
        nightKm: night ? distanceKm : 0,
        maxContinuousMin,
        coverage: round(Math.min(1, Math.max(0.3, profile.coverage + between(rnd, -0.05, 0.03))), 2),
        speedLimitSource: profile.speedLimitSource,
        source: 'synthetic',
      });
    }
  });

  return trips.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}

// Synthetic trips for every seeded demo driver.
export function generateDemoTrips(weekStarts: string[], now?: Date): TripSummary[] {
  return Object.entries(DEMO_PROFILES).flatMap(([driverId, { vehicleId, profile }]) =>
    generateTrips({ driverId, vehicleId, profile, weekStarts, now }),
  );
}
