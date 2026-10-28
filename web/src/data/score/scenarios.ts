// Named weekly scenarios (synthetic) with the score range each should land in.
// They document the intended behaviour of dScore and guard against accidental
// recalibration. Ranges are preliminary, like the weights and thresholds.
import type { TripTotals } from '../trips/types.ts';
import type { Confidence } from './types.ts';

export interface Scenario {
  id: string;
  title: string;
  totals: TripTotals;
  expect: { min: number; max: number } | null; // null = no score expected
  confidence: Confidence;
}

const base: TripTotals = {
  trips: 10,
  distanceKm: 150,
  drivingSec: 10_000,
  secOverLimit: 0,
  secOver10: 0,
  secOver20: 0,
  secOverPct10: 0,
  secOverPct20: 0,
  secOverPct40: 0,
  harshBrakeCount: 0,
  harshAccelCount: 0,
  nightKm: 0,
  maxContinuousMin: 40,
  coverage: 0.97,
};

const make = (o: Partial<TripTotals>): TripTotals => ({ ...base, ...o });

const typical = {
  secOverLimit: 700, secOver10: 250, secOver20: 40,
  secOverPct10: 200, secOverPct20: 60, secOverPct40: 5,
  harshBrakeCount: 9, harshAccelCount: 6,
};

export const SCENARIOS: Scenario[] = [
  {
    id: 'calm',
    title: 'Careful driver: almost no speeding, few harsh events',
    totals: make({
      secOverLimit: 150, secOver10: 30, secOver20: 3,
      secOverPct10: 40, secOverPct20: 5,
      harshBrakeCount: 2, harshAccelCount: 1,
    }),
    expect: { min: 90, max: 100 },
    confidence: 'medium',
  },
  {
    id: 'typical',
    title: 'Typical driver: some speeding, 6 harsh brakes and 4 harsh accelerations per 100 km',
    totals: make(typical),
    expect: { min: 70, max: 80 },
    confidence: 'medium',
  },
  {
    id: 'speeder',
    title: 'Frequent and large speeding, otherwise smooth',
    totals: make({
      secOverLimit: 2000, secOver10: 1500, secOver20: 300,
      secOverPct10: 1200, secOverPct20: 500, secOverPct40: 100,
      harshBrakeCount: 6, harshAccelCount: 4,
    }),
    expect: { min: 35, max: 50 },
    confidence: 'medium',
  },
  {
    id: 'aggressive',
    title: 'Speeding together with many harsh brakes and accelerations',
    totals: make({
      secOverLimit: 1500, secOver10: 1000, secOver20: 250,
      secOverPct10: 900, secOverPct20: 400, secOverPct40: 80,
      harshBrakeCount: 35, harshAccelCount: 28,
    }),
    expect: { min: 5, max: 25 },
    confidence: 'medium',
  },
  {
    id: 'harsh_only',
    title: 'No speeding but very frequent harsh braking and acceleration',
    totals: make({ harshBrakeCount: 25, harshAccelCount: 20 }),
    expect: { min: 45, max: 60 },
    confidence: 'medium',
  },
  {
    id: 'short_extreme_spell',
    title: 'Otherwise perfect, but 2.5% of driving time far above the limit (cap applies)',
    totals: make({
      secOverLimit: 250, secOver10: 250, secOver20: 250,
      secOverPct10: 250, secOverPct20: 250, secOverPct40: 250,
    }),
    expect: { min: 60, max: 60 },
    confidence: 'medium',
  },
  {
    id: 'noisy_data',
    title: 'Same driving as typical, but only half the trip has valid readings',
    totals: make({ ...typical, coverage: 0.5 }),
    expect: { min: 70, max: 80 },
    confidence: 'low',
  },
  {
    id: 'too_little_data',
    title: 'Under 30 km: no score, never a guess',
    totals: make({ distanceKm: 20, drivingSec: 1400, harshBrakeCount: 1 }),
    expect: null,
    confidence: 'insufficient',
  },
  {
    id: 'long_night_drive',
    title: 'Same as typical plus long night driving: context for advice, not a penalty',
    totals: make({ ...typical, nightKm: 90, maxContinuousMin: 150 }),
    expect: { min: 70, max: 80 },
    confidence: 'medium',
  },
];
