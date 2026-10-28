import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UNKNOWN } from '../types.ts';
import type { Profile } from '../types.ts';
import { P_MAX, P_MIN, finalScore, inputsFromProfile, profileRisk } from './profileRisk.ts';

const NOW = new Date('2026-10-28T12:00:00Z');

test('missing inputs are skipped and do not move P', () => {
  const r = profileRisk({}, NOW);
  assert.equal(r.p, 1);
  assert.ok(r.factors.every((f) => !f.known && f.adjustment === 0));
});

test('experience bands: new, mid, long', () => {
  assert.equal(profileRisk({ licenseSince: '2026-01-01' }, NOW).p, 1.15);
  assert.equal(profileRisk({ licenseSince: '2023-10-01' }, NOW).p, 1.05);
  assert.equal(profileRisk({ licenseSince: '2019-01-01' }, NOW).p, 1);
  assert.equal(profileRisk({ licenseSince: '2009-09-15' }, NOW).p, 0.9);
});

test('invalid or future dates count as unknown', () => {
  assert.equal(profileRisk({ licenseSince: 'nonsense' }, NOW).p, 1);
  assert.equal(profileRisk({ licenseSince: '2030-01-01' }, NOW).p, 1);
});

test('worked example from the pitch: 3 years, 1 incident, 2 points', () => {
  const r = profileRisk({ licenseSince: '2023-10-01', claimsLast5y: 1, penaltyPoints: 2, vehicleYear: 2020 }, NOW);
  assert.equal(r.p, 1.19);
});

test('P is bounded', () => {
  const worst = profileRisk(
    { licenseSince: '2026-06-01', claimsLast5y: 4, penaltyPoints: 30, vehicleYear: 2000, inspectionOverdue: true },
    NOW,
  );
  assert.equal(worst.p, P_MAX);
  const best = profileRisk({ licenseSince: '1990-01-01', claimsLast5y: 0, vehicleYear: 2024, inspectionOverdue: false }, NOW);
  assert.ok(best.p >= P_MIN);
});

test('driver age is ignored unless explicitly enabled', () => {
  assert.equal(profileRisk({ driverAge: 19 }, NOW).p, 1);
  assert.equal(profileRisk({ driverAge: 19 }, NOW, true).p, 1.05);
  assert.equal(profileRisk({ driverAge: 19 }, NOW).factors.some((f) => f.id === 'driver_age'), false);
});

test('final score is behaviour divided by P and stays within 0..100', () => {
  assert.equal(finalScore(72, { p: 1.19, factors: [] }).final, 61);
  assert.equal(finalScore(72, { p: 0.8, factors: [] }).final, 90);
  assert.equal(finalScore(72, { p: 1, factors: [] }).shift, 0);
  assert.equal(finalScore(95, { p: 0.8, factors: [] }).final, 100);
  assert.equal(finalScore(null, { p: 1.2, factors: [] }).final, null);
});

test('maps C mock profiles, including unknown fields', () => {
  const full: Profile = {
    driver: { id: 'd', displayName: 'x', licenseCategories: ['B'], licenseSince: '2016-05-01', synthetic: true },
    vehicles: [{ id: 'v', ownerDriverId: 'd', plateLabel: 'DEMO-1', make: 'a', model: 'b', year: 2019, synthetic: true }],
  };
  assert.deepEqual(inputsFromProfile(full), { licenseSince: '2016-05-01', vehicleYear: 2019 });
  const sparse: Profile = {
    driver: { id: 'd', displayName: 'x', licenseCategories: UNKNOWN, licenseSince: UNKNOWN, synthetic: true },
    vehicles: [],
  };
  assert.deepEqual(inputsFromProfile(sparse), { licenseSince: null, vehicleYear: null });
  assert.equal(profileRisk(inputsFromProfile(sparse), NOW).p, 1);
});
