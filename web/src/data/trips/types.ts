// Per-trip aggregates. Raw samples stay with the telemetry source (Agent D);
// storage keeps only what KPIs need (data minimisation).

export const TRIP_SOURCES = ['synthetic', 'obd_mock', 'obd', 'phone'] as const;
export type TripSource = (typeof TRIP_SOURCES)[number];

export interface TripSummary {
  id: string;
  driverId: string;
  vehicleId: string | null;
  startedAt: string; // ISO 8601
  endedAt: string; // ISO 8601
  distanceKm: number;
  drivingSec: number; // time moving
  secOverLimit: number; // above limit + tolerance
  secOver10: number; // more than 10 km/h over
  secOver20: number; // more than 20 km/h over
  harshBrakeCount: number;
  harshAccelCount: number;
  nightKm: number; // 23:00-05:00
  maxContinuousMin: number; // longest stretch without a stop over 15 min
  coverage: number; // 0..1 share of trip with valid data
  speedLimitSource: 'map' | 'road_type_default' | 'unknown';
  source: TripSource;
}

export interface TripQuery {
  driverId?: string;
  from?: string; // inclusive, ISO 8601
  to?: string; // exclusive, ISO 8601
}

// Exposure totals over a set of trips; Agent D turns these into KPIs.
export interface TripTotals {
  trips: number;
  distanceKm: number;
  drivingSec: number;
  secOverLimit: number;
  secOver10: number;
  secOver20: number;
  harshBrakeCount: number;
  harshAccelCount: number;
  nightKm: number;
  maxContinuousMin: number; // longest single stretch, not a sum
  coverage: number; // distance-weighted mean, 0 when no distance
}

export interface TripRepository {
  save(trips: TripSummary[]): Promise<void>; // upsert by id, all-or-nothing
  get(id: string): Promise<TripSummary | null>;
  list(query?: TripQuery): Promise<TripSummary[]>; // ordered by startedAt
  deleteByDriver(driverId: string): Promise<number>; // GDPR "delete my data"
  clear(): Promise<void>;
}
