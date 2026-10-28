import type { TripSummary } from '../trips/types.ts';
import { decodePolyline } from './polyline.ts';
import type { PolylinePoint } from './polyline.ts';
import type { SpeedState, TripRoute } from './types.ts';

export class RouteValidationError extends Error {
  readonly tripId: string;
  readonly problems: string[];

  constructor(tripId: string, problems: string[]) {
    super(`Invalid route ${tripId}: ${problems.join('; ')}`);
    this.name = 'RouteValidationError';
    this.tripId = tripId;
    this.problems = problems;
  }
}

const STATES: readonly SpeedState[] = ['ok', 'over', 'slow'];
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isIso = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

// Checks the contract from the proposal; with `trip`, also that the route
// belongs to that trip and fits its duration.
export function validateTripRoute(route: TripRoute, trip?: TripSummary): void {
  const problems: string[] = [];
  const id = typeof route?.tripId === 'string' && route.tripId ? route.tripId : '(no tripId)';
  if (id === '(no tripId)') problems.push('tripId is required');
  if (typeof route?.driverId !== 'string' || !route.driverId) problems.push('driverId is required');
  if (route?.version !== 1) problems.push('version must be 1');
  if (!isIso(route?.createdAt)) problems.push('createdAt must be ISO 8601');
  if (!isIso(route?.expiresAt)) problems.push('expiresAt must be ISO 8601');
  else if (isIso(route.createdAt) && Date.parse(route.expiresAt) <= Date.parse(route.createdAt)) {
    problems.push('expiresAt must be after createdAt');
  }
  if (!['map', 'road_type_default', 'unknown'].includes(route?.limitSource)) problems.push('limitSource is not recognised');
  if (!(isNum(route?.privacy?.trimmedStartM) && route.privacy.trimmedStartM >= 0 && isNum(route.privacy.trimmedEndM) && route.privacy.trimmedEndM >= 0)) {
    problems.push('privacy trims must be non-negative numbers');
  }

  let points: PolylinePoint[] = [];
  try {
    points = typeof route?.polyline === 'string' ? decodePolyline(route.polyline) : [];
  } catch {
    problems.push('polyline cannot be decoded');
  }
  const n = points.length;
  if (n < 2) problems.push('route needs at least 2 vertices');

  for (const key of ['tOffsetSec', 'speedKmh', 'limitKmh'] as const) {
    const arr = route?.[key];
    if (!Array.isArray(arr) || arr.length !== n) problems.push(`${key} must have one entry per vertex (${n})`);
    else if (!arr.every((v) => isNum(v) && v >= 0)) problems.push(`${key} must hold non-negative numbers`);
  }
  const t = Array.isArray(route?.tOffsetSec) ? route.tOffsetSec : [];
  if (t.some((v, i) => i > 0 && v < t[i - 1])) problems.push('tOffsetSec must not decrease');

  const segs = Array.isArray(route?.segments) ? route.segments : [];
  if (n >= 2) {
    let expectFrom = 0;
    let ok = segs.length > 0;
    for (const s of segs) {
      if (!(Number.isInteger(s?.from) && Number.isInteger(s?.to) && s.from === expectFrom && s.to >= s.from && STATES.includes(s.state) && isNum(s.maxOverKmh) && s.maxOverKmh >= 0)) {
        ok = false;
        break;
      }
      expectFrom = s.to + 1;
    }
    if (!ok || expectFrom !== n) problems.push('segments must cover every vertex in order without gaps');
  }

  const events = Array.isArray(route?.events) ? route.events : null;
  if (!events) problems.push('events must be a list');
  else if (!events.every((e) => ['harsh_brake', 'harsh_accel'].includes(e?.kind) && Number.isInteger(e.vertex) && e.vertex >= 0 && e.vertex < n && isNum(e.tOffsetSec) && e.tOffsetSec >= 0 && isNum(e.valueMs2))) {
    problems.push('events must point at existing vertices');
  }

  const b = route?.bbox;
  if (!Array.isArray(b) || b.length !== 4 || !b.every(isNum) || b[0] > b[2] || b[1] > b[3]) {
    problems.push('bbox must be [south, west, north, east]');
  } else if (points.some(([la, lo]) => la < b[0] - 1e-5 || la > b[2] + 1e-5 || lo < b[1] - 1e-5 || lo > b[3] + 1e-5)) {
    problems.push('vertices fall outside bbox');
  }

  if (trip) {
    if (trip.id !== route?.tripId) problems.push('route does not match the trip id');
    if (trip.driverId !== route?.driverId) problems.push('route belongs to another driver than the trip');
    const durationSec = (Date.parse(trip.endedAt) - Date.parse(trip.startedAt)) / 1000;
    if (t.length && t[t.length - 1] > durationSec + 1) problems.push('tOffsetSec exceeds the trip duration');
  }

  if (problems.length > 0) throw new RouteValidationError(id, problems);
}
