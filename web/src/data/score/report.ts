import { weekRange } from '../time.ts';
import type { TripSummary } from '../trips/types.ts';
import { matchesQuery, sumTrips } from '../trips/validate.ts';
import { buildTips, hasFatigueContext, interimScore, octaRecommendation } from './interimScore.ts';
import type { ScoreFn, TrendPoint, WeeklyReport } from './types.ts';

// Pure: same trips and week in, same report out.
export function buildWeeklyReport(
  weekStart: string,
  trips: TripSummary[],
  scoreFn: ScoreFn = interimScore,
): WeeklyReport {
  const range = weekRange(weekStart);
  const inWeek = trips.filter((t) => matchesQuery(t, range));
  const totals = sumTrips(inWeek);
  const result = scoreFn(totals, inWeek);
  const fatigueContext = hasFatigueContext(inWeek);
  return {
    weekStart,
    range,
    trips: inWeek.length,
    totals,
    result,
    fatigueContext,
    tips: buildTips(result, fatigueContext),
    octa: octaRecommendation(result),
  };
}

export function buildTrend(
  weekStarts: string[],
  trips: TripSummary[],
  scoreFn: ScoreFn = interimScore,
): TrendPoint[] {
  return weekStarts.map((weekStart) => {
    const r = buildWeeklyReport(weekStart, trips, scoreFn);
    return {
      weekStart,
      score: r.result.score,
      confidence: r.result.confidence,
      distanceKm: Math.round(r.totals.distanceKm),
    };
  });
}
