import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recentWeeks } from '../time.ts';
import { generateDemoTrips } from '../trips/generator.ts';
import type { TripSummary, TripTotals } from '../trips/types.ts';
import {
  bandOf,
  buildTips,
  confidenceOf,
  createInterimScore,
  hasFatigueContext,
  interimScore,
  octaRecommendation,
} from './interimScore.ts';
import { buildTrend, buildWeeklyReport } from './report.ts';

const totals = (o: Partial<TripTotals> = {}): TripTotals => ({
  trips: 10,
  distanceKm: 150,
  drivingSec: 10_000,
  secOverLimit: 900, // 9%
  secOver10: 300,
  secOver20: 50,
  secOverPct10: 50,
  secOverPct20: 50,
  secOverPct40: 0,
  secPhoneUse: 0,
  harshBrakeCount: 9, // 6 / 100 km
  harshAccelCount: 6, // 4 / 100 km
  nightKm: 18,
  maxContinuousMin: 50,
  coverage: 0.95,
  ...o,
});

test('spec worked example scores 64 without smoothing', () => {
  const r = createInterimScore(0)(totals(), []);
  assert.equal(r.score, 64);
  assert.equal(r.band, 'moderate');
  assert.equal(r.confidence, 'medium');
  assert.deepEqual(r.kpis.map((k) => k.value), [9, 6, 4]);
  assert.deepEqual(r.kpis.map((k) => k.subscore), [61.1, 64.3, 72.7]);
});

test('weights are preliminary 0.5 / 0.3 / 0.2 and night is not scored', () => {
  const r = interimScore(totals(), []);
  assert.deepEqual(r.kpis.map((k) => k.weight), [0.5, 0.3, 0.2]);
  assert.equal(r.kpis.reduce((s, k) => s + k.weight, 0), 1);
  const lotsOfNight = interimScore(totals({ nightKm: 150 }), []);
  assert.equal(lotsOfNight.score, r.score);
});

test('smoothing pulls tiny samples towards typical values', () => {
  const oneHardBrake = totals({ distanceKm: 35, drivingSec: 2400, secOverLimit: 0, harshBrakeCount: 3, harshAccelCount: 0 });
  const raw = createInterimScore(0)(oneHardBrake, []);
  const smooth = interimScore(oneHardBrake, []);
  const brake = (r: typeof raw) => r.kpis.find((k) => k.id === 'harsh_brake_per_100km')!;
  assert.ok(brake(smooth).subscore! > brake(raw).subscore!);
  assert.equal(brake(smooth).value, brake(raw).value); // observed value is not altered
});

test('confidence depends on distance and coverage, never the score', () => {
  assert.equal(confidenceOf(totals({ distanceKm: 20 })), 'insufficient');
  assert.equal(confidenceOf(totals({ distanceKm: 60 })), 'low');
  assert.equal(confidenceOf(totals({ distanceKm: 150 })), 'medium');
  assert.equal(confidenceOf(totals({ distanceKm: 400 })), 'high');
  assert.equal(confidenceOf(totals({ distanceKm: 400, coverage: 0.5 })), 'medium');

  const sparse = interimScore(totals({ distanceKm: 20 }), []);
  assert.equal(sparse.score, null);
  assert.equal(sparse.band, null);
});

test('bands and OCTA directions', () => {
  assert.deepEqual([90, 75, 60, 40].map(bandOf), ['low', 'moderate_low', 'moderate', 'elevated']);
  const dir = (score: number) =>
    octaRecommendation({ score, confidence: 'high', band: bandOf(score), kpis: [] }).direction;
  assert.deepEqual([90, 75, 60, 40].map(dir), ['potential_discount', 'potential_discount', 'no_change', 'possible_surcharge']);
  const none = octaRecommendation({ score: null, confidence: 'insufficient', band: null, kpis: [] });
  assert.equal(none.direction, null);
  assert.match(none.disclaimer, /simulation/i);
});

test('main tip targets the KPI losing most points and projects a higher score', () => {
  const r = createInterimScore(0)(totals(), []);
  const [tip] = buildTips(r, false);
  assert.equal(tip.kind, 'speeding_share');
  assert.match(tip.text, /9%.*5\.5%/);
  assert.ok(tip.projectedScore! > r.score!);
});

test('fatigue context needs night driving and a stretch over 120 minutes', () => {
  const t = { nightKm: 0, maxContinuousMin: 150 } as TripSummary;
  assert.equal(hasFatigueContext([t]), false);
  assert.equal(hasFatigueContext([{ ...t, nightKm: 10, maxContinuousMin: 90 }]), false);
  assert.equal(hasFatigueContext([{ ...t, nightKm: 10 }]), true);

  const r = interimScore(totals(), []);
  const tips = buildTips(r, true);
  assert.equal(tips.at(-1)!.kind, 'fatigue_context');
  assert.equal(tips.at(-1)!.projectedScore, null);
});

test('no score means a "more data" tip instead of advice', () => {
  const tips = buildTips(interimScore(totals({ distanceKm: 10 }), []), false);
  assert.deepEqual(tips.map((t) => t.kind), ['more_data']);
});

test('demo drivers tell the intended story', () => {
  const now = new Date('2026-10-28T12:00:00Z');
  const weeks = recentWeeks(now, 5);
  const trips = generateDemoTrips(weeks, now);
  const lastFull = weeks[3];
  const report = (id: string) => buildWeeklyReport(lastFull, trips.filter((t) => t.driverId === id));

  const careful = report('drv-001');
  const aggressive = report('drv-002');
  const sparse = report('drv-003');
  assert.ok(careful.result.score! > aggressive.result.score!, `${careful.result.score} vs ${aggressive.result.score}`);
  assert.equal(careful.octa.direction, 'potential_discount');
  assert.equal(sparse.result.score, null);
  assert.equal(sparse.tips[0].kind, 'more_data');

  const trend = buildTrend(weeks.slice(0, 4), trips.filter((t) => t.driverId === 'drv-002'));
  assert.equal(trend.length, 4);
  assert.ok(trend[3].score! > trend[0].score!, `aggressive driver should improve: ${trend.map((p) => p.score)}`);
});
