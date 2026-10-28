# Recommended prototype stack

Status: proposal for team approval. This file records an implementation recommendation; it does not approve the product scope or start app implementation.

## Recommendation

- **Mobile:** React Native, Expo, and TypeScript. One app codebase, quick iteration, and a shared language for app logic and tests.
- **Navigation and screens:** Expo Router with simple feature folders. Keep components small and separate UI from scoring and data access.
- **Trip demo:** bundled synthetic/sample trips first. Make the core demo usable without GPS permissions, a network connection, or an account.
- **Live location, if approved:** `expo-location` and `expo-task-manager` in an Expo development build. Background tracking is not supported by Expo Go and needs native platform configuration and real-device testing ([Expo location docs](https://docs.expo.dev/versions/latest/sdk/location/)).
- **Local persistence, if needed:** Expo SQLite. Keep raw GPS points on-device for the prototype; derive trip summaries locally.
- **Scoring:** pure TypeScript functions with deterministic inputs and unit tests. Show 3–5 explainable, exposure-normalized measures, plus data-quality/coverage context.
- **Backend:** none for the first demo. If sync or shared accounts become necessary, evaluate Supabase/Postgres in an EU region; send derived summaries only unless the product team approves more.
- **Maps:** optional. Add a map only if it improves the judged demo. Treat road speed-limit matching as approximate until a reliable, licensed Latvia data source is verified.
- **Price output:** illustrative risk/discount band only, prominently labeled as a simulation, never a real Balcia tariff or quote.

## Why this fits the hackathon

The prototype needs a polished mobile flow and explainable calculations quickly. Expo/TypeScript lets teammates split UI, sample data, and scoring while keeping a single app. Synthetic trips avoid spending the hackathon on permission prompts, device build setup, background execution, and uncertain speed-limit coverage.

## Limits and production path

Expo background location requires a development build. iOS needs location background capability and user-visible permission handling ([Apple Core Location guidance](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background)); Android requires the appropriate location permissions and a location foreground service for continuous tracking ([Android background location and battery guidance](https://developer.android.com/develop/sensors-and-location/location/battery)). Operating systems can suspend or throttle background work, and high-frequency location can drain battery. Test on real devices before promising reliable trip capture.

If dependable background telemetry becomes a production requirement and the Expo layer cannot meet tested requirements, keep the scoring/data contracts and replace only the tracking adapter with native Swift/Core Location and Kotlin/Android location APIs. Do not add native work before the prototype proves it is necessary.

## Approval gate

Before implementation, the team should agree on the MVP, selected KPIs and score explanation, simulated price framing, and whether the demo uses sample data or live tracking. Then record the decision in Notion and update setup/run instructions here with the exact Expo SDK and package versions used.
