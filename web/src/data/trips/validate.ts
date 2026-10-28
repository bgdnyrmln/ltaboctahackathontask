import { TRIP_SOURCES } from './types.ts';
import type { TripSummary, TripTotals } from './types.ts';

export class TripValidationError extends Error {
  readonly tripId: string;
  readonly problems: string[];

  constructor(tripId: string, problems: string[]) {
    super(`Invalid trip ${tripId}: ${problems.join('; ')}`);
    this.name = 'TripValidationError';
    this.tripId = tripId;
    this.problems = problems;
  }
}

const COUNTERS = [
  'distanceKm',
  'drivingSec',
  'secOverLimit',
  'secOver10',
  'secOver20',
  'secOverPct10',
  'secOverPct20',
  'secOverPct40',
  'secPhoneUse',
  'harshBrakeCount',
  'harshAccelCount',
  'nightKm',
] as const;

type AddedLater = 'secOverPct10' | 'secOverPct20' | 'secOverPct40' | 'secPhoneUse';

// Trips stored before these counters existed load with them as 0.
export function upgradeTrip(trip: Omit<TripSummary, AddedLater> & Partial<TripSummary>): TripSummary {
  return { secOverPct10: 0, secOverPct20: 0, secOverPct40: 0, secPhoneUse: 0, ...trip };
}

const INTEGER_COUNTERS = new Set(['harshBrakeCount', 'harshAccelCount']);

// Checks shape and internal consistency so bad fixtures fail loudly at the
// storage boundary instead of skewing the score later.
export function validateTrip(trip: TripSummary): void {
  const problems: string[] = [];
  const id = typeof trip?.id === 'string' && trip.id ? trip.id : '(no id)';

  if (id === '(no id)') problems.push('id is required');
  if (typeof trip?.driverId !== 'string' || !trip.driverId) {
    problems.push('driverId is required');
  }
  if (trip?.vehicleId !== null && typeof trip?.vehicleId !== 'string') {
    problems.push('vehicleId must be a string or null');
  }

  const start = Date.parse(trip?.startedAt);
  const end = Date.parse(trip?.endedAt);
  if (Number.isNaN(start)) problems.push('startedAt must be ISO 8601');
  if (Number.isNaN(end)) problems.push('endedAt must be ISO 8601');
  if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) {
    problems.push('endedAt is before startedAt');
  }

  let countersValid = true;
  for (const key of COUNTERS) {
    const v = trip?.[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      problems.push(`${key} must be a non-negative number`);
      countersValid = false;
    } else if (INTEGER_COUNTERS.has(key) && !Number.isInteger(v)) {
      problems.push(`${key} must be an integer`);
    }
  }

  // Cross-field checks only make sense once every counter is a number.
  if (countersValid) {
    if (trip.secOver20 > trip.secOver10 || trip.secOver10 > trip.secOverLimit) {
      problems.push('speeding seconds must satisfy over20 <= over10 <= overLimit');
    }
    if (trip.secOverPct40 > trip.secOverPct20 || trip.secOverPct20 > trip.secOverPct10 || trip.secOverPct10 > trip.secOverLimit) {
      problems.push('speeding seconds must satisfy overPct40 <= overPct20 <= overPct10 <= overLimit');
    }
    if (trip.secOverLimit > trip.drivingSec) {
      problems.push('secOverLimit exceeds drivingSec');
    }
    if (trip.secPhoneUse > trip.drivingSec) {
      problems.push('secPhoneUse exceeds drivingSec');
    }
    if (trip.nightKm > trip.distanceKm) problems.push('nightKm exceeds distanceKm');
  }

  const cont = trip?.maxContinuousMin;
  if (typeof cont !== 'number' || !Number.isFinite(cont) || cont < 0) {
    problems.push('maxContinuousMin must be a non-negative number');
  } else if (end >= start && cont * 60_000 > end - start + 60_000) {
    problems.push('maxContinuousMin exceeds trip duration');
  }

  if (
    typeof trip?.coverage !== 'number' ||
    !(trip.coverage >= 0 && trip.coverage <= 1)
  ) {
    problems.push('coverage must be between 0 and 1');
  }
  if (!['map', 'road_type_default', 'unknown'].includes(trip?.speedLimitSource)) {
    problems.push('speedLimitSource is not recognised');
  }
  if (!(TRIP_SOURCES as readonly string[]).includes(trip?.source)) {
    problems.push('source is not recognised');
  }

  if (problems.length > 0) throw new TripValidationError(id, problems);
}

export function sumTrips(trips: TripSummary[]): TripTotals {
  const totals: TripTotals = {
    trips: trips.length,
    distanceKm: 0,
    drivingSec: 0,
    secOverLimit: 0,
    secOver10: 0,
    secOver20: 0,
    secOverPct10: 0,
    secOverPct20: 0,
    secOverPct40: 0,
    secPhoneUse: 0,
    harshBrakeCount: 0,
    harshAccelCount: 0,
    nightKm: 0,
    maxContinuousMin: 0,
    coverage: 0,
  };
  let weightedCoverage = 0;
  for (const t of trips) {
    for (const key of COUNTERS) totals[key] += t[key];
    totals.maxContinuousMin = Math.max(totals.maxContinuousMin, t.maxContinuousMin);
    weightedCoverage += t.coverage * t.distanceKm;
  }
  totals.coverage = totals.distanceKm > 0 ? weightedCoverage / totals.distanceKm : 0;
  return totals;
}

export function matchesQuery(
  trip: TripSummary,
  query: { driverId?: string; from?: string; to?: string } = {},
): boolean {
  if (query.driverId !== undefined && trip.driverId !== query.driverId) return false;
  const start = Date.parse(trip.startedAt);
  if (query.from !== undefined && start < Date.parse(query.from)) return false;
  if (query.to !== undefined && start >= Date.parse(query.to)) return false;
  return true;
}
