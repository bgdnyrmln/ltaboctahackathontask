# Trip store (Agent C, proposal, not yet a Ready task)

Storage for per-trip aggregates that Agent D's synthetic telemetry produces and D's scoring reads. Raw GPS/OBD samples are not stored: only the counters the KPIs need (data minimisation, GDPR).

## Flow

D: synthetic telemetry -> per-trip aggregates (`TripSummary[]`)
C: `TripRepository.save` (validated) -> `list({ driverId, from, to })` -> `sumTrips` -> `TripTotals`
D: `TripTotals` -> KPIs -> Driver Score

## What D hands over: `TripSummary`

| Field | Type | Meaning |
|---|---|---|
| `id` | string | unique trip id |
| `driverId` | string | seeded driver, e.g. `drv-001` |
| `vehicleId` | string or null | seeded vehicle, e.g. `veh-001` |
| `startedAt`, `endedAt` | ISO 8601 | trip start and end |
| `distanceKm` | number >= 0 | distance |
| `drivingSec` | number >= 0 | time moving |
| `secOverLimit`, `secOver10`, `secOver20` | number >= 0 | seconds over limit (+ tolerance), over by >10, over by >20 km/h; must satisfy over20 <= over10 <= overLimit <= drivingSec |
| `harshBrakeCount`, `harshAccelCount` | integer >= 0 | harsh events |
| `nightKm` | number, <= distanceKm | km driven 23:00-05:00 |
| `maxContinuousMin` | number, <= trip duration | longest stretch without a stop over 15 min; fatigue context only |
| `coverage` | 0..1 | share of trip with valid data |
| `speedLimitSource` | `map`, `road_type_default`, `unknown` | where limits came from, feeds confidence |
| `source` | `synthetic`, `obd_mock`, `obd`, `phone` | data origin |

Example:

```json
{
  "id": "trip-001", "driverId": "drv-001", "vehicleId": "veh-001",
  "startedAt": "2026-10-20T08:00:00Z", "endedAt": "2026-10-20T08:30:00Z",
  "distanceKm": 20, "drivingSec": 1500,
  "secOverLimit": 120, "secOver10": 40, "secOver20": 5,
  "harshBrakeCount": 2, "harshAccelCount": 1, "nightKm": 0,
  "maxContinuousMin": 15, "coverage": 0.95, "speedLimitSource": "road_type_default", "source": "synthetic"
}
```

An invalid trip rejects the whole batch with `TripValidationError`, listing every problem, so bad fixtures fail loudly instead of skewing the score.

## Stores

- `createMemoryTripRepository()`: default for the demo; no permissions, native module or network.
- `createSqliteTripRepository(driver)`: persistent. `SqlDriver` is three async methods (`exec`, `run`, `all`) that map 1:1 onto `expo-sqlite` (`execAsync`, `runAsync`, `getAllAsync`). Tests run it on Node's built-in `node:sqlite`. Schema version 1 is stored in `PRAGMA user_version`. Time filters compare instants, so mixed ISO offsets order correctly (needs SQLite 3.42+ for `unixepoch(..., 'subsec')`).

Both pass the same contract tests.

## Privacy

`deleteByDriver(driverId)` backs a "delete my data" button; `clear()` wipes everything. No raw coordinates are stored.

## Run checks

```sh
cd web && npm test
```

## Open questions for A and D

1. Does D produce aggregates directly, or raw samples that C should aggregate?
2. Weekly window: Monday 00:00 in Europe/Riga, or rolling 7 days?
3. Memory store only for the demo, or SQLite persistence across app restarts?
