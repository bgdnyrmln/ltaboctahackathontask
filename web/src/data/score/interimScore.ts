// Interim Driver Score from docs/driver-score-spec-draft.md, so the UI works
// before Agent D's scoring lands. Weights and thresholds are preliminary and
// illustrative, not Balcia pricing rules.
import type { TripSummary, TripTotals } from '../trips/types.ts';
import type {
  Confidence,
  KpiId,
  KpiResult,
  OctaRecommendation,
  RiskBand,
  ScoreFn,
  ScoreResult,
  Tip,
} from './types.ts';

interface KpiDef {
  id: KpiId;
  label: string;
  unit: KpiResult['unit'];
  good: number;
  bad: number;
  weight: number;
  prior: number; // typical value used to smooth small samples
  observed(t: TripTotals): number | null;
  smoothed(t: TripTotals, k: number): number | null;
}

const PRIOR_KM = 50; // km of "typical" driving blended into small samples
const PRIOR_SEC = 3600; // one hour, for the time-based KPI

const perKm = (count: (t: TripTotals) => number, prior: number) => ({
  observed: (t: TripTotals) => (t.distanceKm > 0 ? (count(t) / t.distanceKm) * 100 : null),
  smoothed: (t: TripTotals, k: number) => {
    const km = t.distanceKm + PRIOR_KM * k;
    return km > 0 ? ((count(t) + (prior / 100) * PRIOR_KM * k) / km) * 100 : null;
  },
});

export const KPI_DEFS: KpiDef[] = [
  {
    id: 'speeding_share',
    label: 'Speeding',
    unit: '% of driving time',
    good: 2,
    bad: 20,
    weight: 0.5,
    prior: 8,
    observed: (t) => (t.drivingSec > 0 ? (t.secOverLimit / t.drivingSec) * 100 : null),
    smoothed: (t, k) => {
      const sec = t.drivingSec + PRIOR_SEC * k;
      return sec > 0 ? ((t.secOverLimit + 0.08 * PRIOR_SEC * k) / sec) * 100 : null;
    },
  },
  {
    id: 'harsh_brake_per_100km',
    label: 'Harsh braking',
    unit: 'per 100 km',
    good: 1,
    bad: 15,
    weight: 0.3,
    prior: 6,
    ...perKm((t) => t.harshBrakeCount, 6),
  },
  {
    id: 'harsh_accel_per_100km',
    label: 'Harsh acceleration',
    unit: 'per 100 km',
    good: 1,
    bad: 12,
    weight: 0.2,
    prior: 5,
    ...perKm((t) => t.harshAccelCount, 5),
  },
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const subscoreOf = (def: { good: number; bad: number }, x: number) => 100 * (1 - clamp01((x - def.good) / (def.bad - def.good)));
const r1 = (x: number) => Math.round(x * 10) / 10;

export function confidenceOf(t: TripTotals): Confidence {
  if (t.distanceKm < 30) return 'insufficient';
  const levels: Confidence[] = ['low', 'medium', 'high'];
  let level = t.distanceKm < 100 ? 0 : t.distanceKm < 300 ? 1 : 2;
  if (t.coverage < 0.7) level = Math.max(0, level - 1);
  return levels[level];
}

export function bandOf(score: number): RiskBand {
  if (score >= 85) return 'low';
  if (score >= 70) return 'moderate_low';
  if (score >= 50) return 'moderate';
  return 'elevated';
}

// smoothing = 1 blends PRIOR_KM / PRIOR_SEC of typical driving in; 0 disables it.
export function createInterimScore(smoothing = 1): ScoreFn {
  return (totals) => {
    const confidence = confidenceOf(totals);
    const kpis: KpiResult[] = KPI_DEFS.map((def) => {
      const observed = def.observed(totals);
      const smoothed = def.smoothed(totals, smoothing);
      const subscore = smoothed === null || observed === null ? null : subscoreOf(def, smoothed);
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

    const usable = confidence !== 'insufficient' && kpis.every((k) => k.subscore !== null);
    const score = usable ? Math.round(kpis.reduce((s, k) => s + k.weight * (k.subscore ?? 0), 0)) : null;
    return { score, confidence, band: score === null ? null : bandOf(score), kpis };
  };
}

export const interimScore: ScoreFn = createInterimScore();

export const FATIGUE_STRETCH_MIN = 120;

// Night driving only matters together with a long uninterrupted stretch, and
// even then it changes advice, never the score or price.
export function hasFatigueContext(trips: TripSummary[]): boolean {
  return trips.some((t) => t.nightKm > 0 && t.maxContinuousMin > FATIGUE_STRETCH_MIN);
}

const TIP_TEXT: Record<KpiId, (from: number, to: number) => string> = {
  speeding_share: (from, to) =>
    `Speeding took ${from}% of your driving time. Bringing it down to ${to}% is the biggest win this week.`,
  harsh_brake_per_100km: (from, to) =>
    `You braked hard ${from} times per 100 km. Leaving more distance ahead could bring it to about ${to}.`,
  harsh_accel_per_100km: (from, to) =>
    `You accelerated hard ${from} times per 100 km. Smoother starts could bring it to about ${to}.`,
  too_slow_share: (from, to) =>
    `You drove far below the limit for ${from}% of your driving time. Keeping with the flow of traffic where it is safe could bring that to about ${to}%.`,
  phone_use_share: (from, to) =>
    `Phone use was ${from}% of your driving time. Keeping it at about ${to}% would help most. Use a mount and set the route before you start.`,
  fatigue_excess_min: (from, to) =>
    `Your longest drive ran ${from} minutes past 2 hours without a stop. Taking a break every 2 hours could bring that to about ${to}.`,
};

// One main tip: the KPI losing the most points, with the score the driver would
// get by closing half the gap to "good".
export function buildTips(result: ScoreResult, fatigue: boolean): Tip[] {
  const tips: Tip[] = [];
  if (result.score === null) {
    tips.push({
      kind: 'more_data',
      text: 'Drive at least 30 km this week to get a score. Missing data never lowers your score.',
      projectedScore: null,
    });
  } else {
    const worst = [...result.kpis]
      .filter((k) => k.value !== null && (k.pointsLost ?? 0) > 1)
      .sort((a, b) => (b.pointsLost ?? 0) - (a.pointsLost ?? 0))[0];
    if (worst && worst.value !== null) {
      const target = r1(Math.max(worst.good, worst.value - (worst.value - worst.good) / 2));
      // Compare like with like: both points on the observed (unsmoothed) scale.
      const gained = worst.weight * (subscoreOf(worst, target) - subscoreOf(worst, worst.value));
      tips.push({
        kind: worst.id,
        text: TIP_TEXT[worst.id](worst.value, target),
        projectedScore: Math.min(100, Math.round(result.score + Math.max(0, gained))),
      });
    }
  }
  if (fatigue && tips[0]?.kind !== 'fatigue_excess_min') {
    tips.push({
      kind: 'fatigue_context',
      text: 'Some night drives ran over 2 hours without a stop. Plan a short break every 2 hours.',
      projectedScore: null,
    });
  }
  return tips;
}

export const OCTA_DISCLAIMER =
  'Hackathon simulation. Not a Balcia tariff, quote or offer; no real price is calculated.';

export function octaRecommendation(result: ScoreResult): OctaRecommendation {
  if (result.score === null || result.band === null) {
    return { direction: null, label: 'Not enough data for an estimate', disclaimer: OCTA_DISCLAIMER };
  }
  if (result.band === 'low' || result.band === 'moderate_low') {
    return { direction: 'potential_discount', label: 'Potential discount', disclaimer: OCTA_DISCLAIMER };
  }
  if (result.band === 'moderate') {
    return { direction: 'no_change', label: 'No change expected', disclaimer: OCTA_DISCLAIMER };
  }
  return { direction: 'possible_surcharge', label: 'Possible surcharge', disclaimer: OCTA_DISCLAIMER };
}
