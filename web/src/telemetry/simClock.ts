// Clock of a simulated run: it starts at the moment of the press, runs `speed` times faster than the
// wall clock for the length of the trip, holds the arrival time briefly and then goes back to real time.
export interface SimRun {
  at: number // wall-clock ms when the run started
  speed: number // 1 = real time, 12 = twelve times faster
  durationSec: number // simulated length of the trip
}

export const ARRIVAL_HOLD_MS = 15_000

export function simulatedNow(run: SimRun | null, now: number): number {
  if (!run) return now
  const real = now - run.at
  const total = run.durationSec * 1000
  const sim = real * run.speed
  if (sim <= total) return run.at + sim
  return real > total / run.speed + ARRIVAL_HOLD_MS ? now : run.at + total
}
