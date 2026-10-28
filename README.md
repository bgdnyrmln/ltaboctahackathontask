# OCTA telematics workbench

Hackathon prototype concept: a mobile experience that uses driving telemetry to explain a driver risk score, and give one actionable safety tip. An illustrative price or risk-band recommendation is optional.

## Challenge constraints

- Prioritize safer driving, fewer crashes and lower crash impact; any premium effect is a prototype recommendation, not a real insurer quote.
- Present 3–5 KPIs. Normalize events by exposure (for example per 100 km or per driving hour) and account for road type, speed limit, time, weather, and data quality where available.
- Keep only indicators that have a plausible link to crash risk, can be compared fairly, and can guide a driver action.
- Show the score, explain which behaviors affect it, and provide specific advice. The demo should reach a decision: an actionable safety tip based on the score. A price or risk-band recommendation is optional; if shown, it must be labeled as a simulation.
- Favor low setup effort and low battery/resource use. Consider GDPR and EU-hosted data.

Workshop numbers in the supplied slides are illustrative and are not Balcia pricing rules. We have not selected final KPIs, score weights, price mapping, platform, or whether sensor data will be simulated or collected from a phone. Agree those before implementation.

## Current state

This repository is a planning scaffold. App implementation has not started. The team records decisions, scope, branches, and reviews in the shared Notion HQ and task board.

## Git collaboration

- `main` is the shared integration base.
- Each agent uses their own `agent/<ID>/<task>` branch. Starter branches `agent/A/working`, `agent/B/working`, `agent/C/working`, and `agent/D/working` are for initial collaboration; task-specific branches may be assigned from `main` once tasks are agreed.
- Before editing, confirm task ownership and branch in Notion. Keep one implementation task per agent and avoid overlapping files.
- Push small, scoped commits to your branch and open a PR to `main` with the Notion task link, acceptance evidence, and check results. A different agent reviews. Do not merge or deploy without coordinator authorization.

## Team roles

- **A:** coordination, product decisions, integration, and merging reviewed PRs after checks pass.
- **B:** mobile frontend and UI.
- **C:** app data, persistence, and approved backend integration.
- **D:** telematics KPIs, scoring, sample data, and QA.

These are default lanes. Agent A confirms each person’s strengths and records task-level ownership in Notion; roles alone do not authorize coding.

## Proposed stack

See [TECH-STACK.md](TECH-STACK.md) for the recommended prototype stack and its limits. It is a proposal for the team to approve before implementation; the repository remains a planning scaffold until the MVP, KPIs, score/price framing, and platform are agreed.

## Setup and run

After the team approves the proposal, initialize the Expo app with the current stable Expo tooling and record the exact package versions and run commands here. The first demo should use sample trips and work without a backend or live location permission.
