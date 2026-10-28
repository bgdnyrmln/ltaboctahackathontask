// Optional per-trip route for the driver's own map and replay (proposal:
// docs/trip-route-store-proposal.md). A route is personal location data, so it
// is opt-in, simplified, trimmed at both ends, kept on the device only and
// expires. The score never reads routes; TripSummary stays the only score input.

export type SpeedState = 'ok' | 'over' | 'slow'; // within limit, over it, far below it

export const ROUTE_RETENTION_DAYS = 30;
export const ROUTE_TRIM_M = 200; // first and last 200 m are dropped (home / work)
export const ROUTE_SIMPLIFY_M = 5; // Douglas-Peucker tolerance

export interface RouteSegment {
  from: number; // vertex index, inclusive
  to: number; // inclusive; the next segment starts at to + 1
  state: SpeedState;
  maxOverKmh: number; // largest speed above the limit in the run, 0 when not over
}

export interface TripRouteEvent {
  kind: 'harsh_brake' | 'harsh_accel';
  vertex: number; // nearest vertex index
  tOffsetSec: number;
  valueMs2: number; // peak acceleration, signed
}

export interface TripRoute {
  tripId: string; // = TripSummary.id (1:1)
  driverId: string;
  version: 1;
  createdAt: string; // ISO 8601
  expiresAt: string; // createdAt + ROUTE_RETENTION_DAYS
  polyline: string; // encoded polyline, precision 5 (see polyline.ts)
  // One entry per vertex, in polyline order:
  tOffsetSec: number[]; // seconds since TripSummary.startedAt
  speedKmh: number[]; // rounded to 1 km/h
  limitKmh: number[];
  segments: RouteSegment[];
  events: TripRouteEvent[];
  bbox: [south: number, west: number, north: number, east: number];
  privacy: { trimmedStartM: number; trimmedEndM: number };
  limitSource: 'map' | 'road_type_default' | 'unknown';
}

export interface RouteRepository {
  save(route: TripRoute): Promise<void>; // upsert by tripId
  get(tripId: string): Promise<TripRoute | null>;
  listTripIds(driverId: string): Promise<string[]>;
  delete(tripId: string): Promise<boolean>;
  deleteByDriver(driverId: string): Promise<number>;
  purgeExpired(now: Date): Promise<number>;
  clear(): Promise<void>;
}
