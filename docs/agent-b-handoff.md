# Agent B handoff: what is still open (2026-10-28)

All B work is pushed on `agent/B/working`. These items were started or planned but not finished.

## Needs a decision or another agent

1. **Break limit 5 h** (`docs/break-limit-proposal.md`): D changes `FATIGUE_STRETCH_MIN` 120 → 300 (or 270), builds the texts and unit from it, and updates the generator so long night trips stay. The UI follows automatically.
2. **Personal codes in the data model** (`docs/personal-code-proposal.md`): C adds `Driver.identity` (hash plus masked code, Smart-ID verified). B then swaps `demo/personas.ts` for it.
3. **Trip route store** (`docs/trip-route-store-proposal.md`): an opt-in on-device store for real trip routes (IndexedDB/SQLite), so real phone trips also get maps. Needs A's consent decision and C's storage work.
4. **Real backend:** the app and the insurer portal share browser storage only, so sync works on one computer. Cross-device sync needs a server DB (e.g. Postgres in the EU, per-insurer consent with row-level security).
5. **Platform:** TECH-STACK.md still says Expo; the app is a web PWA. A should update the stack record.

## B work not done

6. **Laptop screens at 100% zoom:** the CSS `zoom` approach was reverted after it broke the layout for the user. A proper fix is a compact layout for small laptop viewports: tighter spacing, a narrower sidebar, and a smaller phone and map. Needs the user's screen size and OS scaling to verify.
7. **Native app:** wrap `web/` with Capacitor for Android/iOS so live GPS recording (and background tracking) works on a real phone. Today trips start only in the website's phone simulator.
8. **Sharing switch:** the "share with insurer" toggle was removed from Profile on request, so sharing can only be chosen at sign-up. Consider a settings place to change or withdraw consent (needed for GDPR).
9. **Long demo trip:** the scripted trips last minutes, so the "time for a break" reminder never fires in a demo. Add one long simulated trip if the pitch should show it.
10. **Not visually checked:** replay on the trip page, the insurer driver page after the latest changes, the CSV export, live portal updates across tabs, and the 1440×900 size.
11. **Tests:** no UI tests; only C's data tests exist. Add a few checks for the recorder (`tripRecorder`) and illustrative routes.
