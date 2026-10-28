# Driving without a break: raise the limit to 5 h (proposal, Agent B → D/A, not approved)

## Today

- **Limit:** `FATIGUE_STRETCH_MIN = 120` in `web/src/data/score/interimScore.ts`. A stretch counts until a stop of 15 min or more.
- **D's fatigue KPI** (`dScore.ts`) penalises the minutes past 2 h, and is scaled by the night share. `FATIGUE_BAD_EXCESS_MIN = 120` means 4 h in total scores 0.
- **Night tips:** the "take breaks" advice triggers on night driving with a stretch over 120 min.
- **Hard-coded "2 hours":**
  - tip texts in `interimScore.ts`: "past 2 hours", "a break every 2 hours";
  - the KPI unit literal `'min beyond 2 h'` in `dScore.ts` and `types.ts`.

## Proposal

Raise the limit to **5 h (300 min)**, so that normal long commutes and day trips are not flagged and only very long non-stop drives count.

| Constant | Now | Proposed |
|---|---|---|
| `FATIGUE_STRETCH_MIN` | 120 | **300** |
| `FATIGUE_BAD_EXCESS_MIN` | 120 (4 h total = 0) | 120 (7 h total = 0), unchanged |

**Code changes (D/C):**

1. Set `FATIGUE_STRETCH_MIN = 300`.
2. Build the texts from the constant, for example: `` `past ${FATIGUE_STRETCH_MIN / 60} hours` `` and `` `a break every ${FATIGUE_STRETCH_MIN / 60} hours` ``.
3. Change the unit literal to `'min beyond the limit'`, or build it from the constant. Update `KpiResult['unit']` in `types.ts` to match.
4. In the synthetic generator, make long night trips run past 300 min, or Janis's "fatigue context" demo case disappears.
5. Update the scenarios and tests that assume 120.

## Front end (B, done)

The app reads the limit from `FATIGUE_STRETCH_MIN` through `web/src/telemetry/breaks.ts`, so it follows D's value automatically:

- **Drive (phone):** a live "Without a break" timer in the trip grid. A "Plan a break soon" banner shows 15 min before the limit, and "Time for a break" at the limit.
- **Trip page:** "Longest stretch without a break (limit X h)", flagged when over the limit.

Until D changes the constant, the app shows 2 h. After the change it shows 5 h, with no front-end change.

## Caveats for the pitch

- 5 h is lenient. Common road-safety advice is a break every 2 h.
- The EU rules for professional drivers (Regulation (EC) 561/2006) require a 45-min break after **4.5 h** of driving. **4.5 h (270 min)** would be an easy-to-defend alternative with a legal reference.
- The KPI stays a fatigue *indicator*. Night alone still costs nothing.

## Decisions for A / D

1. Use 5 h (300) as requested, or 4.5 h (270) to match the EU rule?
2. Keep `FATIGUE_BAD_EXCESS_MIN` at 120?
