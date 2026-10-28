# Fake OCTA Coach

Hackathon prototype for explaining driving behaviour through a driver score, trip history, and practical safety tips. The current product is a responsive React web app and installable PWA, with a phone-shaped demo simulator. It is not a native iOS or Android app.

## Run locally

```sh
cd web
npm ci
npm run dev
```

Open the local URL printed by Vite. Choose a seeded demo profile at `/login` to use the driver app. The insurer demo is at `/insurer/login`.

Useful checks:

```sh
npm test
npm run typecheck:data
npm run build
npm run lint
```

`npm test` covers the data, trip, and scoring layers. It does not run browser or end-to-end UI tests.

## What works in the demo

- Driver dashboard with behaviour score, confidence, KPI explanations, weekly trend, and safety tips.
- Seeded synthetic profiles and trips, saved locally in the browser.
- Scripted Riga drives in the phone simulator, trip summaries, history, and illustrative route replay.
- A simulated OBD-II connection. It does not connect to a Bluetooth adapter.
- A fictional insurer portal with synthetic driver data. It is a demo flow, not an insurer system.
- PWA install metadata and responsive layouts.

## Prototype limits

- No server, real account system, cross-device sync, or real vehicle/driver registry integration. Demo authentication and insurer access are client-side only.
- The browser demo does not provide a native mobile shell. Live GPS recording is available only in the embedded phone simulator or when hosted inside a compatible native shell; that shell is not included here. Browser background tracking is not supported.
- Demo trips and driver profiles are synthetic. The bundled Riga speed-limit map is illustrative; map tiles load from OpenStreetMap tile servers.
- Score weights, thresholds, and OCTA directions are experimental examples. They are not calibrated insurance models, Balcia rules, premiums, quotes, or offers.
- Raw GPS positions are used while recording and are not saved as trip history. Saved trip summaries remain in browser storage unless the user deletes them.

## Main routes

| Route | Purpose |
| --- | --- |
| `/` | Product landing page |
| `/login` | Select a demo driver |
| `/app` | Driver dashboard |
| `/app/drive` | Simulated drive or supported live recording |
| `/app/trips` | Trip history |
| `/app/profile` | Profile, consent, and data deletion |
| `/insurer/login` | Fictional insurer demo |
| `/insurer` | Synthetic portfolio |

## Project layout

- `web/src/pages/` — landing page, registration flow, and driver app screens.
- `web/src/data/` — demo API, local persistence, trip models, score calculations, and tests.
- `web/src/telemetry/` — GPS trip recording, simulation, and live demo messaging.
- `web/src/insurer/` — fictional insurer portal and portfolio calculations.
- `docs/` — product, data, score, and privacy proposals. Some documents describe earlier decisions; treat the running app and tests as implementation evidence.

## Collaboration

`main` is the integration branch. B, C, and D work on their own `agent/<ID>/working` branches and push scoped commits there. Agent A integrates changes into `main`. Do not push directly to another agent's branch.
