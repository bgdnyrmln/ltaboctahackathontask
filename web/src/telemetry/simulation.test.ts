import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixesForRun, SIM_TRIPS } from './simulatedDrive.ts';

const NOW = Date.parse('2026-10-28T14:00:00Z');

test('real-time run: the first fix is stamped now and each fix is one second later', () => {
  for (const trip of SIM_TRIPS) {
    const fixes = fixesForRun(trip.id, 1, NOW);
    assert.equal(fixes[0].t, NOW, trip.id);
    for (let i = 1; i < fixes.length; i++) assert.equal(fixes[i].t - fixes[i - 1].t, 1000);
    // Elapsed minutes at the end equal the wall-clock minutes the run takes at 1x.
    assert.equal((fixes.at(-1)!.t - fixes[0].t) / 1000, fixes.length - 1);
  }
});

test('fast run: the whole trip is stamped in the past and ends just before now', () => {
  for (const trip of SIM_TRIPS) {
    const fixes = fixesForRun(trip.id, 12, NOW);
    assert.equal(fixes.at(-1)!.t, NOW - 1000, trip.id);
    assert.ok(fixes[0].t < NOW);
  }
});

test('both speeds describe the same trip, only the timestamps differ', () => {
  for (const trip of SIM_TRIPS) {
    const real = fixesForRun(trip.id, 1, NOW);
    const fast = fixesForRun(trip.id, 12, NOW);
    assert.equal(real.length, fast.length);
    assert.deepEqual(real.map((f) => f.speed), fast.map((f) => f.speed));
  }
});
