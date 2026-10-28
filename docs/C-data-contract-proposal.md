# Agent C: data contract proposal (DRAFT, not approved)

Planning only. No app code until A confirms MVP, KPIs, score and price framing. Goal: fix the interface between C (storage) and D (scoring) so both can start the moment the gate opens.

## Layers

fixtures (D) -> `TripRepository` (C) -> `computeKpis` / `computeScore` (D, pure) -> `WeeklyReport` -> UI (B)

C owns persistence and the types below. D owns the pure functions. B only consumes `WeeklyReport`.

## Proposed types (TypeScript)

```ts
export type Confidence = 'high' | 'medium' | 'low' | 'insufficient';

export interface TripSample {      // one telemetry point
  t: number;                       // ms since trip start
  lat?: number; lon?: number;      // optional, minimised
  speedKmh: number;
  speedLimitKmh?: number;          // optional, source may be approximate
  accelMs2?: number;               // longitudinal
}

export interface Trip {
  id: string;
  startedAt: string;               // ISO 8601
  distanceKm: number;
  durationMin: number;
  roadType?: 'urban' | 'rural' | 'highway';
  isNight: boolean;
  samples: TripSample[];
  source: 'synthetic' | 'live';
  coverage: number;                // 0..1 share of trip with valid data
}

export interface KpiResult {
  id: 'speeding_share' | 'harsh_events_per_100km' | 'night_share';
  value: number;
  unit: string;
  exposure: { km: number; hours: number };
  confidence: Confidence;
  note?: string;
}

export interface ScoreResult {
  score: number | null;            // 0..100, 100 is safer; null if insufficient
  confidence: Confidence;          // low data lowers confidence, not score
  contributions: { kpiId: string; weight: number; points: number }[];
}

export interface WeeklyReport {
  weekStart: string;
  trips: number;
  kpis: KpiResult[];
  score: ScoreResult;
  tip: string;
  octaBand: { label: string; disclaimer: string };  // illustrative only
}

export interface TripRepository {
  list(range?: { from: string; to: string }): Promise<Trip[]>;
  get(id: string): Promise<Trip | null>;
  save(trip: Trip): Promise<void>;
  clear(): Promise<void>;          // GDPR: delete all local data
}
```

## Decisions to propose to A

1. MVP default: `InMemory`/bundled JSON repository over synthetic trips. Expo SQLite only if the demo needs persistence across restarts.
2. Raw GPS stays on device. Only derived summaries ever leave it, and no server for the MVP.
3. Missing or low-confidence data lowers `confidence`, never `score`.
4. `clear()` supports a visible "delete my data" button (GDPR).

## Open questions

- Do fixtures include `speedLimitKmh`, or does speeding use road-type defaults?
- Does D want raw samples, or precomputed per-trip aggregates?
- Final KPI list (3 to 5) and weights.
