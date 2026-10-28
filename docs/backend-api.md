# Backend (Agent C): local data API for the web app

There is no server. The "backend" is `web/src/data/`, a TypeScript module that runs in the browser, works offline and keeps data in `localStorage` (memory if the browser blocks it). Every method is async, so a real server can replace it later without changing screens. All data is synthetic.

## For B (frontend)

```ts
import { getApi, NotSignedInError } from './data';

const api = getApi();
await api.listDemoProfiles();          // [{ demoId, displayName }] for the login picker
await api.signIn('DEMO-SID-001');       // { ok: true, profile, demo: true } | { ok: false, error }
await api.getSession();                 // Profile | null (survives reloads)
await api.getWeeklyReport();            // current week; or getWeeklyReport('2026-10-19')
await api.getTrend(4);                  // [{ weekStart, score, confidence, distanceKm }], oldest first
await api.listTrips();                  // this week's TripSummary[]
await api.deleteMyData();               // GDPR: removes trips, signs out
await api.signOut();
await api.resetDemo();                  // restore all demo data (for rehearsals)
await api.recordDemoObdTrip();          // simulated OBD dongle drive; show OBD_DEMO_LABEL
await api.saveTrip(trip);               // store a phone-recorded TripSummary for the signed-in driver
```

Data calls without a session throw `NotSignedInError`: send the user to login. Show `DEMO_LABEL` ("DEMO login, not Smart-ID") next to the login.

### `WeeklyReport`

| Field | Meaning | UI |
|---|---|---|
| `result.score` | 0-100, 100 = safer; `null` when data is insufficient | big number; when `null` show "Not enough data", never 0 |
| `result.confidence` | `insufficient`, `low`, `medium`, `high` | small badge next to the score; separate from the score |
| `result.band` | `low`, `moderate_low`, `moderate`, `elevated` | colour of the score ring |
| `result.kpis[]` | `label`, `value`, `unit`, `subscore`, `weight`, `pointsLost` | one card per KPI; `pointsLost` explains the score |
| `tips[]` | first tip = biggest win with `projectedScore`; `fatigue_context` and `more_data` tips have none | "Do this: ... Score could reach N" |
| `fatigueContext` | night driving with a stretch over 120 min | advice only, never shown as a penalty |
| `octa` | `direction` (`potential_discount`, `no_change`, `possible_surcharge`, or `null`), `label`, `disclaimer` | always show `disclaimer` |
| `totals`, `trips` | km, driving time, events | "Based on 12 trips, 501 km" |

### Demo drivers

| Login | Story (week of 19 Oct) |
|---|---|
| `DEMO-SID-001` Anna | careful: score about 92, potential discount |
| `DEMO-SID-002` Janis | aggressive but improving (28 -> 39 over 4 weeks), fatigue context, possible surcharge |
| `DEMO-SID-003` Marta | sparse data: no score, "drive 30 km" tip, unknown profile fields |

Synthetic trips are generated deterministically for the current week and four weeks before it, so the demo looks the same on every device.

## For D (scoring)

The interim score follows `docs/driver-score-spec-draft.md`. Preliminary weights are speeding 0.50, harsh braking 0.30 and harsh acceleration 0.20. Small samples are smoothed. Night driving is never scored. To plug in your own scoring, pass a `ScoreFn`:

```ts
import { createApi, type ScoreFn } from './data';
const myScore: ScoreFn = (totals, trips) => ({ score, confidence, band, kpis });
const api = createApi({ scoreFn: myScore });
```

Your trips can replace the generator: save `TripSummary[]` (see `docs/trip-store.md`, now including `maxContinuousMin`) through the trip repository.

Static data for the algorithm is available synchronously from `@data` or `@trips`. `generateDemoTrips(recentWeeks(now, 5), now)` returns the same deterministic trips the app shows. `DEMO_PROFILES` describes each demo driver, and `sumTrips` aggregates them.

### Speed limit map

`getSpeedLimitMap().lookup(lat, lon)` returns `{ limitKmh, kind, featureId, name, matchedBy, source: 'map' }`, or `null` when the point has no map coverage. When it returns `null`, keep the road-type default (urban 50, rural 90).

- **Lookup order:** the nearest road segment within 25 m wins. Otherwise the innermost zone containing the point is used: Old Riga 30 inside the Riga built-up area 50.
- **Labelling:** the bundled data (`SEED_SPEED_LIMITS`) is an illustrative hand-drawn demo for Riga. Show `SPEED_MAP_DEMO_LABEL`.
- **SQLite:** `SPEED_LIMIT_SCHEMA`, `saveSpeedLimitFeatures`, `loadSpeedLimitFeatures(db, bbox?)` and `loadSpeedLimitMap` store the same data in the `speed_limit_feature` table. A future OpenStreetMap `maxspeed` import (ODbL) can use this table too.
- **Trip summary:** if a trip used map limits, set `speedLimitSource: 'map'`.

## Checks

```sh
cd web
npm test               # 81 tests: registry, demo login, trip store, generator, score, api, OBD mock, speed limit map
npm run typecheck:data
npm run build
```

The PR workflow runs all three.
