# Frontend data contract: driver, vehicle, demo login (HACK-17)

Audience: Agent B (frontend) and Agent D (scoring). Covers the HACK-15 mock data in `web/src/data/`. All records are synthetic.

## Validation result (2026-10-28)

`validateRegistry(SEED_DRIVERS, SEED_VEHICLES, SEED_DEMO_IDENTITIES)` returns no problems. Checked: stable unique ids, every vehicle's `ownerDriverId` exists, every demo identity maps to an existing driver, required fields and types, `unknown` handling, `DEMO-` labels (no real plates), deterministic lookups for every demo identity.

## Field dictionary

| Field | Type | Unit/format | Example | Frontend status |
|---|---|---|---|---|
| `driver.id` | string | stable id | `drv-001` | internal, use as key, do not display |
| `driver.displayName` | string | free text | `Demo Driver Anna` | safe to show |
| `driver.licenseCategories` | string[] or unknown | EU categories (`B`, `C`, ...) | `["B"]` | safe to show; **not a score input** until HACK-1 decides |
| `driver.licenseSince` | `YYYY-MM-DD` or unknown | date | `2016-05-01` | safe to show; driving experience as a risk factor is only a proposal (HACK-14), needs HACK-1 |
| `driver.synthetic` | `true` | flag | `true` | show a "Demo data" badge |
| `vehicle.id` | string | stable id | `veh-001` | internal |
| `vehicle.ownerDriverId` | string | driver id | `drv-001` | internal |
| `vehicle.plateLabel` | string | always `DEMO-nnn` | `DEMO-101` | safe to show |
| `vehicle.make`, `vehicle.model` | string or unknown | text | `Skoda`, `Octavia` | safe to show |
| `vehicle.year` | integer or unknown | year | `2019` | safe to show; not a score input yet |
| `vehicle.synthetic` | `true` | flag | `true` | demo badge |

Unknown is always the object `{ "kind": "unknown" }`. Use `isUnknown(value)` and render a placeholder such as "Not available". Never render it as `0`, an empty string or a guessed value.

## Response shapes

`signIn(demoId)` returns a promise.

Success:

```json
{
  "ok": true,
  "demo": true,
  "profile": {
    "driver": { "id": "drv-001", "displayName": "Demo Driver Anna", "licenseCategories": ["B"], "licenseSince": "2016-05-01", "synthetic": true },
    "vehicles": [
      { "id": "veh-001", "ownerDriverId": "drv-001", "plateLabel": "DEMO-101", "make": "Skoda", "model": "Octavia", "year": 2019, "synthetic": true }
    ]
  }
}
```

Driver with missing data (`DEMO-SID-003`): same shape, with `{ "kind": "unknown" }` in `licenseCategories`, `licenseSince`, `make`, `model` and `year`.

Errors:

| Result | When | Suggested UI |
|---|---|---|
| `{ "ok": false, "error": "invalid_input" }` | empty input, or looks like a personal code | "Choose a demo profile"; never echo the input |
| `{ "ok": false, "error": "unknown_identity" }` | demo id not seeded | "Demo profile not found" |
| `{ "ok": false, "error": "data_missing" }` | id maps to a driver the registry lacks | "Profile data unavailable", offer retry or another profile |

States:

- Loading: the promise is pending; show a spinner. The mock resolves instantly, but a real provider will not.
- Missing record: `registry.getProfile(id)` returns `null`; `getVehiclesByDriver` returns `[]` (render "No vehicle on record").
- Unsupported field: `{ kind: "unknown" }`, as above.
- Login screen: `listDemoIdentities()` returns `[{ demoId, displayName }]` to build a picker. Show `DEMO_LABEL` ("DEMO login, not Smart-ID") beside it.

## Data-flow boundary

UI -> `IdentityProvider.signIn` -> `DriverRegistry.getProfile` -> `Profile`. The UI and scoring depend only on these interfaces and types. A future approved Smart-ID or CSDD provider replaces the two mock factories and nothing else.

## Gaps and recommended follow-up

1. Platform: if the app becomes a web PWA (B's task), these modules work unchanged (plain TypeScript, no native APIs).
2. Score inputs: no driver or vehicle field feeds the score yet. Licence age or vehicle age need a HACK-1 decision and fairness review before use.
3. Vehicles per driver: the seed has exactly one each; the UI should still handle zero or several, since the type is a list.
4. Trips: driver ids here are the join key for trip data (proposed trip store, not yet a task).

## Checks

```sh
cd web && npm test
```
