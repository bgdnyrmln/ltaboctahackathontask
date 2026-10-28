// Agent D scoring. Drop-in ScoreFn (see types.ts) that keeps the interim KPIs,
// weights and thresholds from docs/driver-score-spec-draft.md and adds what the
// trip aggregates already allow: speeding weighted by how far above the limit (relative), a cap for extreme
// speeding, input validation, and lower confidence without map speed limits.
// All numbers are preliminary and illustrative (HACK-1 not approved).
import type { TripSummary, TripTotals } from '../trips/types.ts';
import { FATIGUE_STRETCH_MIN, KPI_DEFS, bandOf, confidenceOf } from './interimScore.ts';
import type { Confidence, KpiId, KpiResult, ScoreFn } from './types.ts';

// Relative bands (share of the limit), nested: overLimit >= pct10 >= pct20 >= pct40.
// +20 km/h in a 30 zone is far more severe than +20 km/h on a 110 road.
export const SPEED_BAND_WEIGHTS = { upTo10: 0.5, from10to20: 1, from20to40: 2, over40: 4 } as const;
export const PEAK_SHARE = 0.02; // share of driving time more than 40% over the limit
export const PEAK_CAP = 60;
export const MAP_LIMIT_SHARE_MIN = 0.5; // km share with a map speed limit
// Weights (sum 1), preliminary like the thresholds. The phone KPI only exists when the trip
// totals carry secPhoneUse; without it the four-KPI weights apply.
export const D_WEIGHTS: Record<Exclude<KpiId, 'phone_use_share' | 'too_slow_share'>, number> = {
  speeding_share: 0.45,
  harsh_brake_per_100km: 0.25,
  harsh_accel_per_100km: 0.15,
  fatigue_excess_min: 0.15,
};
export const D_WEIGHTS_WITH_PHONE: Record<KpiId, number> = {
  speeding_share: 0.35,
  harsh_brake_per_100km: 0.2,
  harsh_accel_per_100km: 0.1,
  fatigue_excess_min: 0.15,
  phone_use_share: 0.2,
  too_slow_share: 0,
};
// With the far-below-the-limit flag as a small sixth KPI (needs secPhoneUse as well).
export const D_WEIGHTS_FULL: Record<KpiId, number> = {
  speeding_share: 0.3,
  harsh_brake_per_100km: 0.2,
  harsh_accel_per_100km: 0.1,
  fatigue_excess_min: 0.15,
  phone_use_share: 0.2,
  too_slow_share: 0.05,
};
export const SLOW_GOOD = 0; // % of driving time
export const SLOW_BAD = 20;
const SLOW_PRIOR = 3; // typical share in urban traffic, %
export const PHONE_GOOD = 0; // % of driving time
export const PHONE_BAD = 5;
const PHONE_PRIOR = 1; // typical share, % of driving time, used for small-sample smoothing
export const FATIGUE_BAD_EXCESS_MIN = 120; // 2 h beyond the stretch (4 h in total) scores 0
const SPEEDING_PRIOR = 5; // typical severity-weighted share, % of driving time
const PRIOR_SEC = 3600;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const r1 = (x: number) => Math.round(x * 10) / 10;

// secPhoneUse arrives with C's storage change; until then the field is simply absent.
export type PhoneAwareTotals = TripTotals & { secPhoneUse?: number; secTooSlow?: number };

export function hasPhoneData(t: PhoneAwareTotals): boolean {
  return typeof t.secPhoneUse === 'number' && Number.isFinite(t.secPhoneUse);
}

export function hasSlowData(t: PhoneAwareTotals): boolean {
  return typeof t.secTooSlow === 'number' && Number.isFinite(t.secTooSlow);
}

export function isValidTotals(t: PhoneAwareTotals): boolean {
  const nums = [
    t.distanceKm, t.drivingSec, t.secOverLimit, t.secOver10, t.secOver20,
    t.secOverPct10, t.secOverPct20, t.secOverPct40, t.harshBrakeCount, t.harshAccelCount,
  ];
  return (
    nums.every((n) => Number.isFinite(n) && n >= 0) &&
    t.secOver20 <= t.secOver10 &&
    t.secOver10 <= t.secOverLimit &&
    t.secOverPct40 <= t.secOverPct20 &&
    t.secOverPct20 <= t.secOverPct10 &&
    t.secOverPct10 <= t.secOverLimit &&
    (t.secTooSlow === undefined || (Number.isFinite(t.secTooSlow) && t.secTooSlow >= 0 && t.secTooSlow <= t.drivingSec)) &&
    (t.secPhoneUse === undefined || (Number.isFinite(t.secPhoneUse) && t.secPhoneUse >= 0 && t.secPhoneUse <= t.drivingSec)) &&
    t.secOverLimit <= t.drivingSec &&
    Number.isFinite(t.coverage) && t.coverage >= 0 && t.coverage <= 1
  );
}

// Seconds above the limit, weighted by how far above.
export function severitySeconds(t: TripTotals): number {
  return (
    SPEED_BAND_WEIGHTS.upTo10 * (t.secOverLimit - t.secOverPct10) +
    SPEED_BAND_WEIGHTS.from10to20 * (t.secOverPct10 - t.secOverPct20) +
    SPEED_BAND_WEIGHTS.from20to40 * (t.secOverPct20 - t.secOverPct40) +
    SPEED_BAND_WEIGHTS.over40 * t.secOverPct40
  );
}

export function speedingSeverityShare(t: TripTotals): number | null {
  return t.drivingSec > 0 ? (severitySeconds(t) / t.drivingSec) * 100 : null;
}

// Minutes the longest stretch ran past 2 h, scaled up by the night share of the distance.
// Night alone adds nothing: it only matters together with a long uninterrupted stretch.
export function fatigueExcessMin(t: TripTotals): number | null {
  if (t.distanceKm <= 0) return null;
  const excess = Math.max(0, t.maxContinuousMin - FATIGUE_STRETCH_MIN);
  const nightShare = Math.min(1, Math.max(0, t.nightKm / t.distanceKm));
  return excess * (1 + nightShare);
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
    const withPhone = valid && hasPhoneData(totals);
    const withSlow = withPhone && hasSlowData(totals);
    const weights: Record<KpiId, number> = withSlow
      ? D_WEIGHTS_FULL
      : withPhone
        ? D_WEIGHTS_WITH_PHONE
        : { ...D_WEIGHTS, phone_use_share: 0, too_slow_share: 0 };
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
        weight: weights[def.id],
        good: def.good,
        bad: def.bad,
        pointsLost: subscore === null ? null : r1(weights[def.id] * (100 - subscore)),
      };
    });

    const fatigue = valid ? fatigueExcessMin(totals) : null;
    const fatigueSub = fatigue === null ? null : 100 * (1 - clamp01(fatigue / FATIGUE_BAD_EXCESS_MIN));
    kpis.push({
      id: 'fatigue_excess_min',
      label: 'Long drives without a break',
      value: fatigue === null ? null : r1(fatigue),
      unit: 'min beyond 2 h',
      subscore: fatigueSub === null ? null : r1(fatigueSub),
      weight: weights.fatigue_excess_min,
      good: 0,
      bad: FATIGUE_BAD_EXCESS_MIN,
      pointsLost: fatigueSub === null ? null : r1(weights.fatigue_excess_min * (100 - fatigueSub)),
    });

    if (withPhone) {
      const t = totals as PhoneAwareTotals;
      const observed = totals.drivingSec > 0 ? ((t.secPhoneUse ?? 0) / totals.drivingSec) * 100 : null;
      const sec = totals.drivingSec + PRIOR_SEC * smoothing;
      const smoothed = sec > 0 ? (((t.secPhoneUse ?? 0) + (PHONE_PRIOR / 100) * PRIOR_SEC * smoothing) / sec) * 100 : null;
      const sub =
        observed === null || smoothed === null
          ? null
          : 100 * (1 - clamp01((smoothed - PHONE_GOOD) / (PHONE_BAD - PHONE_GOOD)));
      kpis.push({
        id: 'phone_use_share',
        label: 'Phone use while driving',
        value: observed === null ? null : r1(observed),
        unit: '% of driving time',
        subscore: sub === null ? null : r1(sub),
        weight: weights.phone_use_share,
        good: PHONE_GOOD,
        bad: PHONE_BAD,
        pointsLost: sub === null ? null : r1(weights.phone_use_share * (100 - sub)),
      });
    }

    if (withSlow) {
      const sec = (totals as PhoneAwareTotals).secTooSlow ?? 0;
      const observed = totals.drivingSec > 0 ? (sec / totals.drivingSec) * 100 : null;
      const denom = totals.drivingSec + PRIOR_SEC * smoothing;
      const smoothed = denom > 0 ? ((sec + (SLOW_PRIOR / 100) * PRIOR_SEC * smoothing) / denom) * 100 : null;
      const sub =
        observed === null || smoothed === null
          ? null
          : 100 * (1 - clamp01((smoothed - SLOW_GOOD) / (SLOW_BAD - SLOW_GOOD)));
      kpis.push({
        id: 'too_slow_share',
        label: 'Far below the limit',
        value: observed === null ? null : r1(observed),
        unit: '% of driving time',
        subscore: sub === null ? null : r1(sub),
        weight: weights.too_slow_share,
        good: SLOW_GOOD,
        bad: SLOW_BAD,
        pointsLost: sub === null ? null : r1(weights.too_slow_share * (100 - sub)),
      });
    }

    const usable = valid && confidence !== 'insufficient' && kpis.every((k) => k.subscore !== null);
    let score = usable ? Math.round(kpis.reduce((s, k) => s + k.weight * (k.subscore ?? 0), 0)) : null;
    // Short extreme speeding must not hide behind good braking and acceleration.
    if (score !== null && totals.drivingSec > 0 && totals.secOverPct40 / totals.drivingSec >= PEAK_SHARE) {
      score = Math.min(score, PEAK_CAP);
    }
    return { score, confidence, band: score === null ? null : bandOf(score), kpis };
  };
}

export const dScore: ScoreFn = createDScore();
