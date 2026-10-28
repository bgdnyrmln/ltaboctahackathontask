import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dScore, isValidTotals } from './dScore.ts';
import { SCENARIOS } from './scenarios.ts';

const byId = (id: string) => SCENARIOS.find((s) => s.id === id)!;

test('every scenario is internally consistent', () => {
  for (const s of SCENARIOS) assert.ok(isValidTotals(s.totals), `${s.id} has inconsistent totals`);
});

test('every scenario lands in its expected range and confidence', () => {
  for (const s of SCENARIOS) {
    const r = dScore(s.totals, []);
    assert.equal(r.confidence, s.confidence, `${s.id} confidence`);
    if (s.expect === null) assert.equal(r.score, null, `${s.id} should have no score`);
    else {
      assert.notEqual(r.score, null, `${s.id} should have a score`);
      assert.ok(
        r.score! >= s.expect.min && r.score! <= s.expect.max,
        `${s.id}: ${r.score} not in ${s.expect.min}..${s.expect.max}`,
      );
    }
  }
});

test('scenarios rank in the intended order', () => {
  const score = (id: string) => dScore(byId(id).totals, []).score!;
  assert.ok(score('calm') > score('typical'));
  assert.ok(score('typical') > score('speeder'));
  assert.ok(score('speeder') > score('aggressive'));
  assert.ok(score('typical') > score('harsh_only'));
});

test('noisy data and night driving change confidence or advice, never the score', () => {
  const typical = dScore(byId('typical').totals, []).score;
  assert.equal(dScore(byId('noisy_data').totals, []).score, typical);
  assert.equal(dScore(byId('long_night_drive').totals, []).score, typical);
});
