import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARRIVAL_HOLD_MS, simulatedNow } from './simClock.ts';
import { fixesForRun, runLengthSec, SIM_TRIPS } from './simulatedDrive.ts';

const NOW = Date.parse('2026-10-28T14:00:00Z');

test('a run starts at the press and advances one simulated second per fix, at any speed', () => {
  for (const trip of SIM_TRIPS) {
    for (const speed of [1, 12] as const) {
      const fixes = fixesForRun(trip.id, speed, NOW);
      assert.equal(fixes[0].t, NOW, `${trip.id} ${speed}x`);
      for (let i = 1; i < fixes.length; i++) assert.equal(fixes[i].t - fixes[i - 1].t, 1000);
      assert.equal(fixes.length, runLengthSec(trip.id));
    }
  }
});

test('speed only changes the delivery pace, not the trip', () => {
  for (const trip of SIM_TRIPS) {
    const real = fixesForRun(trip.id, 1, NOW);
    const fast = fixesForRun(trip.id, 12, NOW);
    assert.deepEqual(real, fast);
  }
});

test('simulated clock runs at the chosen speed for the length of the trip, then returns to real time', () => {
  const run = { at: NOW, speed: 12, durationSec: 480 };
  assert.equal(simulatedNow(null, NOW + 5000), NOW + 5000);
  assert.equal(simulatedNow(run, NOW), NOW);
  assert.equal(simulatedNow(run, NOW + 10_000), NOW + 120_000); // 10 s real = 2 min simulated
  assert.equal(simulatedNow(run, NOW + 40_000), NOW + 480_000); // the 8 min trip is over after 40 s
  assert.equal(simulatedNow(run, NOW + 40_000 + ARRIVAL_HOLD_MS - 1), NOW + 480_000); // holds the arrival time
  assert.equal(simulatedNow(run, NOW + 40_000 + ARRIVAL_HOLD_MS + 1), NOW + 40_000 + ARRIVAL_HOLD_MS + 1); // real again
  const real = { at: NOW, speed: 1, durationSec: 480 };
  assert.equal(simulatedNow(real, NOW + 90_000), NOW + 90_000);
});
