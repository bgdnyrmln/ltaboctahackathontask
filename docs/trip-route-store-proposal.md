# Trip route store (proposal, Agent B → C/A, not approved)

Goal: keep a per-trip route so the app can show each trip on a map with speeding, far-below-limit stretches and harsh events, and replay it. Today only `TripSummary` aggregates are stored, so the trip page can draw routes for simulated trips only, rebuilt from the demo script.

A route is personal location data. Trip totals are not. Everything below is built so routes are opt-in, minimised, stay on the device by default and expire.

## What changes

| Today | Proposed |
|---|---|
| `TripSummary` (aggregates) in `TripRepository` | unchanged, still the only input to the score |
| No positions stored | separate, optional `TripRoute` per trip, linked by `tripId` |
| Trip page: map only for simulated trips | map for any trip that has a `TripRoute` |

The score (D's `ScoreFn`) never reads routes. Routes are for the driver's own view and replay.

## Data model

```ts
export type SpeedState = 'ok' | 'over' | 'slow' // within limit, over the limit, far below it

export interface TripRoute {
  tripId: string                 // = TripSummary.id (1:1)
  driverId: string
  version: 1
  createdAt: string              // ISO 8601
  expiresAt: string              // retention, default createdAt + 30 days
  // Simplified geometry (Douglas-Peucker, 5 m), encoded polyline, precision 5 (~1 m).
  polyline: string
  // One entry per vertex, same order as the polyline:
  tOffsetSec: number[]           // seconds since TripSummary.startedAt
  speedKmh: number[]             // rounded to 1 km/h
  limitKmh: number[]             // limit used at that vertex
  // Runs of the same state, as vertex index ranges (inclusive).
  segments: Array<{ from: number; to: number; state: SpeedState; maxOverKmh: number }>
  events: Array<{
    kind: 'harsh_brake' | 'harsh_accel'
    vertex: number               // nearest vertex index
    tOffsetSec: number
    valueMs2: number             // peak acceleration, signed
  }>
  bbox: [south: number, west: number, north: number, east: number]
  privacy: { trimmedStartM: number; trimmedEndM: number } // see Privacy
  limitSource: 'map' | 'road_type_default' | 'unknown'
}
```

Size: a 10-minute trip at 1 Hz has 600 samples, about 120 to 200 vertices after simplification. That is roughly 2 KB encoded polyline plus arrays. 1,000 trips fit in about 2 to 3 MB.

## Storage

**Default: on the device only.**

- **Web/PWA:** IndexedDB database `octa`, store `tripRoutes`, key `tripId`, index `[driverId, createdAt]`. Do not use localStorage: it is limited to 5 MB and synchronous.
- **Native (Capacitor):** SQLite through C's existing `SqlDriver`:

```sql
CREATE TABLE trip_route (
  trip_id      TEXT PRIMARY KEY REFERENCES trip(id) ON DELETE CASCADE,
  driver_id    TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  polyline     TEXT NOT NULL,
  t_offset_sec TEXT NOT NULL,   -- JSON number[]
  speed_kmh    TEXT NOT NULL,   -- JSON number[]
  limit_kmh    TEXT NOT NULL,   -- JSON number[]
  segments     TEXT NOT NULL,   -- JSON
  events       TEXT NOT NULL,   -- JSON
  bbox         TEXT NOT NULL,   -- JSON [s,w,n,e]
  limit_source TEXT NOT NULL,
  trimmed_start_m REAL NOT NULL DEFAULT 0,
  trimmed_end_m   REAL NOT NULL DEFAULT 0
);
CREATE INDEX trip_route_driver ON trip_route(driver_id, created_at);
```

**Later, only with explicit opt-in "sync my routes":** Postgres with PostGIS in an EU region, for example Supabase eu-central. Geometry would be a `LINESTRINGM` (M = seconds since start), with row-level security so only the driver reads their rows. Not needed for the hackathon demo.

## API (extends `OctaApi`, C's lane)

```ts
saveTripRoute(route: TripRoute): Promise<void>        // validates; requires routes consent
getTripRoute(tripId: string): Promise<TripRoute | null>
deleteTripRoute(tripId: string): Promise<void>
// existing calls:
listTrips(...)     // add hasRoute: boolean per trip (no geometry in lists)
deleteMyData()     // also deletes all routes
purgeExpiredRoutes(now?: Date): Promise<number>        // run on app start
```

Validation (contract tests, same style as `tripStore.test.ts`):
- all per-vertex arrays have the polyline's vertex count;
- `tOffsetSec` does not decrease and stays within the trip duration;
- segments cover the vertex range without gaps;
- events point at existing vertices;
- `tripId` exists in `TripRepository` and belongs to the same driver.

## Who produces it

The producer is B's `TripRecorder`. It already has every fix with position, speed, the map limit and the over/far-below state. On `finish()` it:

1. trims the privacy zones;
2. simplifies the geometry;
3. builds the state segments;
4. takes the harsh-event positions;
5. saves `TripSummary` and `TripRoute` together.

For event positions, C's `aggregateTrip` could also return the event timestamps it already detects, so both use one rule.

## Frontend

The trip page calls `getTripRoute(tripId)`, decodes the polyline and feeds the existing `TripReplayMap`. That map already takes points with a speed state plus events, and supports replay, speed choice and the larger-map toggle. Trips without a route keep the current "No route to show" text.

## Privacy and GDPR

- **Opt-in:** a separate, optional consent checkbox: "Keep a map of my trips on this device (30 days)". If it is off, no routes are stored and the app still works.
- **Minimisation:**
  - trim the first and last 200 m of every route (home and work);
  - store simplified geometry only;
  - no raw GPS samples, accuracy values or device IDs.
- **Retention:** expire after 30 days and purge on app start. "Delete my data" removes routes immediately.
- **Purpose limitation:**
  - routes never feed the score and are never shared with the insurer;
  - only the driver sees them;
  - any server sync is a separate opt-in that is off by default.
- **Transparency:** the trip page shows "Route stored on this device until <date>", with a delete button.

## Steps and owners (suggested)

1. **A:** approve the opt-in consent wording and the 30-day retention.
2. **C:**
   - `TripRoute` type and validator;
   - IndexedDB repository (web) and SQLite table (native);
   - API methods and contract tests;
   - event timestamps from `aggregateTrip`.
3. **B:**
   - build the route in `TripRecorder.finish()`;
   - consent checkbox;
   - trip page reads `getTripRoute`;
   - "stored until" note and delete button.
4. **D:** confirm the score stays aggregate-only, with no route inputs.

## Open questions

1. Default retention: 30 days, or until the driver deletes?
2. Privacy trim: a fixed 200 m, or user-defined zones (home/work)?
3. Should the demo show stored routes for seeded synthetic trips? That would mean generating geometry for them in the generator.
4. Is server sync in scope at all for the prototype?
