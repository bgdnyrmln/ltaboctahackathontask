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

test('speeding is weighted by how far above the limit, relative to it', () => {
  // 9% of driving time over the limit in both cases.
  const none = { secOver10: 0, secOver20: 0, secOverPct10: 0, secOverPct20: 0, secOverPct40: 0 };
  const mild = totals({ ...none, secOverLimit: 900 });
  const harsh = totals({
    secOverLimit: 900, secOver10: 900, secOver20: 900,
    secOverPct10: 900, secOverPct20: 900, secOverPct40: 900,
  });
  assert.equal(speedingSeverityShare(mild), 4.5);
  assert.equal(speedingSeverityShare(harsh), 36);
  const s = createDScore(0);
  assert.ok((s(mild, []).score ?? 0) > (s(harsh, []).score ?? 100));
});

test('a short spell far above the limit caps the score even with calm braking and acceleration', () => {
  const calm = { harshBrakeCount: 0, harshAccelCount: 0 };
  const band = (pct40: number) => ({
    secOverLimit: 250, secOver10: 250, secOver20: 250,
    secOverPct10: 250, secOverPct20: 250, secOverPct40: pct40,
  });
  // 2% of driving time more than 40% over the limit.
  const capped = createDScore(0)(totals({ ...calm, ...band(200) }), []);
  assert.equal(capped.score, PEAK_CAP);
  // Just under the threshold: the cap does not apply.
  const below = createDScore(0)(totals({ ...calm, ...band(190) }), []);
  assert.ok((below.score ?? 0) > PEAK_CAP);
});

test('inconsistent or missing input gives no score instead of a wrong one', () => {
  assert.equal(isValidTotals(totals({ secOver10: 1000, secOverLimit: 900 })), false);
  assert.equal(isValidTotals(totals({ secOverPct40: 60, secOverPct20: 50 })), false);
  assert.equal(isValidTotals(totals({ coverage: 1.2 })), false);
  assert.equal(isValidTotals(totals({ drivingSec: Number.NaN })), false);
  const r = dScore(totals({ secOver10: 1000, secOverLimit: 900 }), []);
  assert.equal(r.score, null);
  assert.equal(r.band, null);
  assert.equal(r.confidence, 'insufficient');
  assert.equal(r.kpis.length, 4);
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

test('weights sum to 1 and night driving without a long stretch is not scored', () => {
  const r = dScore(totals(), []);
  assert.deepEqual(r.kpis.map((k) => k.weight), [0.35, 0.2, 0.1, 0.15, 0.2]);
  assert.ok(Math.abs(r.kpis.reduce((s, k) => s + k.weight, 0) - 1) < 1e-9);
  assert.equal(dScore(totals({ nightKm: 150, maxContinuousMin: 60 }), []).score, r.score);
});

test('fatigue: free up to 2 h, then linear down to zero at 4 h, night scales the excess', () => {
  const sub = (o: Partial<TripTotals>) => dScore(totals({ nightKm: 0, ...o }), []).kpis[3].subscore;
  assert.equal(sub({ maxContinuousMin: 120 }), 100);
  assert.equal(sub({ maxContinuousMin: 180 }), 50);
  assert.equal(sub({ maxContinuousMin: 240 }), 0);
  assert.equal(sub({ maxContinuousMin: 150, nightKm: 150 }), 50); // all-night: excess 30 x 2 = 60
});

test('phone KPI exists only when the totals carry secPhoneUse, with its own weights', () => {
  // Totals from an older source that has no secPhoneUse: four KPIs, old weights.
  const { secPhoneUse: _unused, ...legacy } = totals();
  const without = dScore(legacy as TripTotals, []);
  assert.equal(without.kpis.length, 4);
  assert.equal(without.kpis.some((k) => k.id === 'phone_use_share'), false);
  assert.deepEqual(without.kpis.map((k) => k.weight), [0.45, 0.25, 0.15, 0.15]);

  const withPhone = dScore({ ...totals(), secPhoneUse: 100 } as TripTotals, []);
  assert.equal(withPhone.kpis.length, 5);
  assert.deepEqual(withPhone.kpis.map((k) => k.weight), [0.35, 0.2, 0.1, 0.15, 0.2]);
  assert.ok(Math.abs(withPhone.kpis.reduce((s, k) => s + k.weight, 0) - 1) < 1e-9);
  assert.equal(withPhone.kpis[4].id, 'phone_use_share');
  assert.equal(withPhone.kpis[4].value, 1); // 100 s of 10 000 s
});

test('more phone use never raises the score; 5% of driving time scores zero', () => {
  const at = (secPhoneUse: number) => dScore({ ...totals(), secPhoneUse } as TripTotals, [])
  let prev = Infinity;
  for (const sec of [0, 50, 200, 500, 1500]) {
    const score = at(sec).score ?? 0;
    assert.ok(score <= prev, `${sec} s of phone use raised the score`);
    prev = score;
  }
  const smoothing0 = createDScore(0)({ ...totals(), secPhoneUse: 500 } as TripTotals, []);
  assert.equal(smoothing0.kpis[4].subscore, 0);
});

test('invalid phone seconds give no score', () => {
  assert.equal(isValidTotals({ ...totals(), secPhoneUse: 20_000 } as TripTotals), false);
  assert.equal(isValidTotals({ ...totals(), secPhoneUse: -1 } as TripTotals), false);
  assert.equal(dScore({ ...totals(), secPhoneUse: 20_000 } as TripTotals, []).score, null);
});
