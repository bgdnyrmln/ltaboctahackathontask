// Contract between storage (C), scoring (D) and UI (B). Agent D can replace the
// interim implementation by providing another ScoreFn; the UI only reads these
// types.
import type { TripSummary, TripTotals } from '../trips/types.ts';

export type Confidence = 'insufficient' | 'low' | 'medium' | 'high';

export type KpiId =
  | 'speeding_share'
  | 'harsh_brake_per_100km'
  | 'harsh_accel_per_100km'
  | 'fatigue_excess_min'
  | 'phone_use_share';

export interface KpiResult {
  id: KpiId;
  label: string;
  value: number | null; // observed, null without exposure
  unit: '% of driving time' | 'per 100 km' | 'min beyond 2 h';
  subscore: number | null; // 0..100 after small-sample smoothing
  weight: number; // preliminary, sums to 1
  good: number;
  bad: number;
  pointsLost: number | null; // weight * (100 - subscore)
}

export type RiskBand = 'low' | 'moderate_low' | 'moderate' | 'elevated';

export interface ScoreResult {
  score: number | null; // 0..100, 100 = safer; null when data is insufficient
  confidence: Confidence; // separate from the score: missing data never lowers it
  band: RiskBand | null;
  kpis: KpiResult[];
}

export type ScoreFn = (totals: TripTotals, trips: TripSummary[]) => ScoreResult;

export interface Tip {
  kind: KpiId | 'fatigue_context' | 'more_data';
  text: string;
  projectedScore: number | null; // score if the driver follows the tip
}

export type OctaDirection = 'potential_discount' | 'no_change' | 'possible_surcharge';

export interface OctaRecommendation {
  direction: OctaDirection | null; // null when there is no score
  label: string;
  disclaimer: string;
}

export interface WeeklyReport {
  weekStart: string; // Monday, Europe/Riga
  range: { from: string; to: string };
  trips: number;
  totals: TripTotals;
  result: ScoreResult;
  fatigueContext: boolean; // night driving with a stretch over 120 min; advice only
  tips: Tip[];
  octa: OctaRecommendation;
}

export interface TrendPoint {
  weekStart: string;
  score: number | null;
  confidence: Confidence;
  distanceKm: number;
}
