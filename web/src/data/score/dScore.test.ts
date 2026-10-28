import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TripSummary, TripTotals } from '../trips/types.ts';
import {
  PEAK_CAP,
  confidenceWithLimits,
  createDScore,
  dScore,
  isValidTotals,
  speedingSeverityShare,
} from './dScore.ts';

const totals = (o: Partial<TripTotals> = {}): TripTotals => ({
  trips: 10,
  distanceKm: 150,
  drivingSec: 10_000,
  secOverLimit: 900,
  secOver10: 300,
  secOver20: 50,
  secOverPct10: 50,
  secOverPct20: 50,
  secOverPct40: 0,
  harshBrakeCount: 9,
  harshAccelCount: 6,
  nightKm: 18,
  maxContinuousMin: 50,
  coverage: 0.95,
  ...o,
});

const trip = (source: TripSummary['speedLimitSource'], distanceKm = 50): TripSummary => ({
  id: `t-${source}-${distanceKm}`,
  driverId: 'd1',
  vehicleId: 'v1',
  startedAt: '2026-10-26T08:00:00+02:00',
  endedAt: '2026-10-26T09:00:00+02:00',
  distanceKm,
  drivingSec: 3000,
  secOverLimit: 0,
  secOver10: 0,
  secOver20: 0,
  secOverPct10: 0,
  secOverPct20: 0,
  secOverPct40: 0,
  harshBrakeCount: 0,
  harshAccelCount: 0,
  nightKm: 0,
  maxContinuousMin: 30,
  coverage: 1,
  speedLimitSource: source,
  source: 'synthetic',
});

test('severity weights speeding by how far above the limit', () => {
  // 9% of driving time over the limit in both cases.
  const mild = totals({ secOverLimit: 900, secOver10: 0, secOver20: 0 });
  const harsh = totals({ secOverLimit: 900, secOver10: 900, secOver20: 900 });
  assert.equal(speedingSeverityShare(mild), 4.5);
  assert.equal(speedingSeverityShare(harsh), 18);
  const s = createDScore(0);
  assert.ok((s(mild, []).score ?? 0) > (s(harsh, []).score ?? 100));
});

test('extreme speeding caps the score even with calm braking and acceleration', () => {
  const calm = { harshBrakeCount: 0, harshAccelCount: 0 };
  const r = createDScore(0)(totals({ ...calm, secOverLimit: 600, secOver10: 600, secOver20: 600 }), []);
  assert.equal(r.score, PEAK_CAP);
  const below = createDScore(0)(totals({ ...calm, secOverLimit: 0, secOver10: 0, secOver20: 0 }), []);
  assert.ok((below.score ?? 0) > PEAK_CAP);
});

test('inconsistent or missing input gives no score instead of a wrong one', () => {
  assert.equal(isValidTotals(totals({ secOver10: 1000, secOverLimit: 900 })), false);
  assert.equal(isValidTotals(totals({ coverage: 1.2 })), false);
  assert.equal(isValidTotals(totals({ drivingSec: Number.NaN })), false);
  const r = dScore(totals({ secOver10: 1000, secOverLimit: 900 }), []);
  assert.equal(r.score, null);
  assert.equal(r.band, null);
  assert.equal(r.confidence, 'insufficient');
  assert.equal(r.kpis.length, 3);
});

test('under 30 km never produces a score', () => {
  const r = dScore(totals({ distanceKm: 20 }), []);
  assert.equal(r.score, null);
  assert.equal(r.confidence, 'insufficient');
});

test('approximate speed limits lower confidence, not the score', () => {
  const withMap = [trip('map'), trip('map')];
  const approx = [trip('road_type_default'), trip('unknown')];
  const t = totals();
  const a = dScore(t, withMap);
  const b = dScore(t, approx);
  assert.equal(a.score, b.score);
  assert.equal(a.confidence, 'medium');
  assert.equal(b.confidence, 'low');
  assert.equal(confidenceWithLimits('insufficient', approx), 'insufficient');
  assert.equal(confidenceWithLimits('low', approx), 'low');
});

test('more harsh events never raise the score', () => {
  const s = createDScore(1);
  let prev = Infinity;
  for (const harshBrakeCount of [0, 3, 9, 20, 40]) {
    const score = s(totals({ harshBrakeCount }), []).score ?? 0;
    assert.ok(score <= prev, `${harshBrakeCount} braking events raised the score`);
    prev = score;
  }
});

test('weights stay 0.5 / 0.3 / 0.2 and night driving is not scored', () => {
  const r = dScore(totals(), []);
  assert.deepEqual(r.kpis.map((k) => k.weight), [0.5, 0.3, 0.2]);
  assert.equal(dScore(totals({ nightKm: 150 }), []).score, r.score);
});
