// Agent D scoring. Drop-in ScoreFn (see types.ts) that keeps the interim KPIs,
// weights and thresholds from docs/driver-score-spec-draft.md and adds what the
// trip aggregates already allow: severity-weighted speeding, a cap for extreme
// speeding, input validation, and lower confidence without map speed limits.
// All numbers are preliminary and illustrative (HACK-1 not approved).
import type { TripSummary, TripTotals } from '../trips/types.ts';
import { KPI_DEFS, bandOf, confidenceOf } from './interimScore.ts';
import type { Confidence, KpiResult, ScoreFn } from './types.ts';

// secOverLimit is already beyond the tolerance, secOver10 and secOver20 are nested in it.
export const SPEED_BAND_WEIGHTS = { upTo10: 0.5, from10to20: 1, over20: 2 } as const;
export const PEAK_SHARE = 0.05; // share of driving time more than 20 km/h over the limit
export const PEAK_CAP = 60;
export const MAP_LIMIT_SHARE_MIN = 0.5; // km share with a map speed limit
const SPEEDING_PRIOR = 5; // typical severity-weighted share, % of driving time
const PRIOR_SEC = 3600;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const r1 = (x: number) => Math.round(x * 10) / 10;

export function isValidTotals(t: TripTotals): boolean {
  const nums = [
    t.distanceKm, t.drivingSec, t.secOverLimit, t.secOver10, t.secOver20,
    t.harshBrakeCount, t.harshAccelCount,
  ];
  return (
    nums.every((n) => Number.isFinite(n) && n >= 0) &&
    t.secOver20 <= t.secOver10 &&
    t.secOver10 <= t.secOverLimit &&
    t.secOverLimit <= t.drivingSec &&
    Number.isFinite(t.coverage) && t.coverage >= 0 && t.coverage <= 1
  );
}

// Seconds above the limit, weighted by how far above.
export function severitySeconds(t: TripTotals): number {
  return (
    SPEED_BAND_WEIGHTS.upTo10 * (t.secOverLimit - t.secOver10) +
    SPEED_BAND_WEIGHTS.from10to20 * (t.secOver10 - t.secOver20) +
    SPEED_BAND_WEIGHTS.over20 * t.secOver20
  );
}

export function speedingSeverityShare(t: TripTotals): number | null {
  return t.drivingSec > 0 ? (severitySeconds(t) / t.drivingSec) * 100 : null;
}

function mapLimitShare(trips: TripSummary[]): number {
  const km = trips.reduce((s, t) => s + t.distanceKm, 0);
  if (km <= 0) return 0;
  return trips.filter((t) => t.speedLimitSource === 'map').reduce((s, t) => s + t.distanceKm, 0) / km;
}

const LEVELS: Confidence[] = ['insufficient', 'low', 'medium', 'high'];

// Approximate road-type limits make speeding less certain; the score itself is unchanged.
export function confidenceWithLimits(base: Confidence, trips: TripSummary[]): Confidence {
  if (base === 'insufficient' || trips.length === 0) return base;
  if (mapLimitShare(trips) >= MAP_LIMIT_SHARE_MIN) return base;
  return LEVELS[Math.max(1, LEVELS.indexOf(base) - 1)];
}

// smoothing = 1 blends one prior's worth of typical driving into small samples; 0 disables it.
export function createDScore(smoothing = 1): ScoreFn {
  return (totals, trips) => {
    const valid = isValidTotals(totals);
    const confidence = valid ? confidenceWithLimits(confidenceOf(totals), trips) : 'insufficient';

    const kpis: KpiResult[] = KPI_DEFS.map((def, i) => {
      const isSpeeding = i === 0;
      const observed = !valid ? null : isSpeeding ? speedingSeverityShare(totals) : def.observed(totals);
      let smoothed: number | null;
      if (!valid) smoothed = null;
      else if (isSpeeding) {
        const sec = totals.drivingSec + PRIOR_SEC * smoothing;
        smoothed = sec > 0 ? ((severitySeconds(totals) + (SPEEDING_PRIOR / 100) * PRIOR_SEC * smoothing) / sec) * 100 : null;
      } else smoothed = def.smoothed(totals, smoothing);
      const subscore =
        observed === null || smoothed === null
          ? null
          : 100 * (1 - clamp01((smoothed - def.good) / (def.bad - def.good)));
      return {
        id: def.id,
        label: def.label,
        value: observed === null ? null : r1(observed),
        unit: def.unit,
        subscore: subscore === null ? null : r1(subscore),
        weight: def.weight,
        good: def.good,
        bad: def.bad,
        pointsLost: subscore === null ? null : r1(def.weight * (100 - subscore)),
      };
    });

    const usable = valid && confidence !== 'insufficient' && kpis.every((k) => k.subscore !== null);
    let score = usable ? Math.round(kpis.reduce((s, k) => s + k.weight * (k.subscore ?? 0), 0)) : null;
    // Short extreme speeding must not hide behind good braking and acceleration.
    if (score !== null && totals.drivingSec > 0 && totals.secOver20 / totals.drivingSec >= PEAK_SHARE) {
      score = Math.min(score, PEAK_CAP);
    }
    return { score, confidence, band: score === null ? null : bandOf(score), kpis };
  };
}

export const dScore: ScoreFn = createDScore();
