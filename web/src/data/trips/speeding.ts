// Speeding bands for one speed reading. Every band requires being over the
// tolerance, so the stored seconds always nest:
//   overPct40 <= overPct20 <= overPct10 <= overLimit <= drivingSec
//   over20 <= over10 <= overLimit
// Relative bands (r = (speed - limit) / limit) follow D's request: risk scales
// with the ratio to the limit, so +20 km/h in a 30 zone counts as more severe
// than +20 km/h on a 110 road.

export const MIN_TOLERANCE_KMH = 3;
export const TOLERANCE_SHARE = 0.05;

export const speedToleranceKmh = (limitKmh: number) => Math.max(MIN_TOLERANCE_KMH, TOLERANCE_SHARE * limitKmh);

export interface SpeedingBands {
  overLimit: boolean;
  over10: boolean; // absolute: more than 10 km/h over
  over20: boolean;
  overPct10: boolean; // relative: more than 10% over
  overPct20: boolean;
  overPct40: boolean;
}

// Driving far below the limit (holding up traffic, provoking risky overtakes):
// moving at under half the limit for a run of at least 8 s, so normal starts,
// stops and turns do not count. Shared by the aggregator, recorder and route view.
export const TOO_SLOW_SHARE = 0.5;
export const TOO_SLOW_MIN_KMH = 5;
export const TOO_SLOW_AFTER_MS = 8000;

export const isSlowSpeed = (speedKmh: number, limitKmh: number) =>
  speedKmh >= TOO_SLOW_MIN_KMH && speedKmh < limitKmh * TOO_SLOW_SHARE;

export function speedingBands(speedKmh: number, limitKmh: number): SpeedingBands {
  const over = speedKmh - limitKmh;
  const overLimit = limitKmh > 0 && over > speedToleranceKmh(limitKmh);
  const r = limitKmh > 0 ? over / limitKmh : 0;
  return {
    overLimit,
    over10: overLimit && over > 10,
    over20: overLimit && over > 20,
    overPct10: overLimit && r > 0.1,
    overPct20: overLimit && r > 0.2,
    overPct40: overLimit && r > 0.4,
  };
}
