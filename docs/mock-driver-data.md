# Mock driver/vehicle data and demo login (HACK-15)

Everything here is synthetic. There is no call to Smart-ID, CSDD or any external service. The demo never requests or stores real personal codes, PINs, passwords or credentials.

## Fields

`Driver`: `id`, `displayName`, `licenseCategories`, `licenseSince`, `synthetic: true`.
`Vehicle`: `id`, `ownerDriverId`, `plateLabel` (fake, e.g. `DEMO-101`), `make`, `model`, `year`, `synthetic: true`.
`Profile`: one driver plus their vehicles.

Any value we cannot know is the explicit `{ kind: 'unknown' }` (see `isUnknown`). We never invent official CSDD facts. `drv-003` is seeded incomplete on purpose.

## Data flow

demo login (`DEMO-SID-00x`) -> seeded driver id -> `DriverRegistry.getProfile` -> `Profile` (driver and vehicles)

Sign-in returns `{ ok: true, profile, demo: true }` or `{ ok: false, error }` with `invalid_input` (empty, or looks like a personal code and is rejected without lookup or echo), `unknown_identity`, or `data_missing` (mapped driver absent from the registry).

The UI should show `DEMO_LABEL` ("DEMO login, not Smart-ID") next to the login.

## Replacement boundary

| Mock | Interface | A future approved provider |
|---|---|---|
| `createCsddMockRegistry` | `DriverRegistry` | implements the same three methods against an approved data source |
| `createDemoSmartIdAuth` | `IdentityProvider` | implements `signIn` against an approved identity service |

Consumers (UI, scoring) depend only on the interfaces and the `Profile` type, so swapping the providers changes no consumer code. Real use needs a lawful basis, consent and GDPR review first.

## Files

`src/data/types.ts`, `seed.ts`, `registry.ts`, `demoAuth.ts`, `index.ts`, `demoAuth.test.ts`.

## Run checks

Node 22.18 or newer (type stripping, tested on Node 24), no dependencies:

```sh
node --test src/data/demoAuth.test.ts
```

The platform (Expo) is not set up yet; when it is, move these files to the app's source layout and wire the same test into its runner.
