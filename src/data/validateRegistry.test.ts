import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDemoSmartIdAuth } from './demoAuth.ts';
import { createCsddMockRegistry } from './registry.ts';
import { SEED_DEMO_IDENTITIES, SEED_DRIVERS, SEED_VEHICLES } from './seed.ts';
import { UNKNOWN } from './types.ts';
import type { Driver, Vehicle } from './types.ts';
import { validateRegistry } from './validateRegistry.ts';

const NOW = new Date('2026-10-28T12:00:00Z');

const driver = (o: Partial<Driver> = {}): Driver => ({
  id: 'd1',
  displayName: 'Demo Driver',
  licenseCategories: ['B'],
  licenseSince: '2015-01-01',
  synthetic: true,
  ...o,
});

const vehicle = (o: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1',
  ownerDriverId: 'd1',
  plateLabel: 'DEMO-001',
  make: 'Skoda',
  model: 'Fabia',
  year: 2018,
  synthetic: true,
  ...o,
});

const problemsOf = (drivers: Driver[], vehicles: Vehicle[], ids: Record<string, string> = {}) =>
  validateRegistry(drivers, vehicles, ids, NOW).map((p) => `${p.entity}:${p.id}: ${p.problem}`);

test('seed data passes every integrity check', () => {
  assert.deepEqual(validateRegistry(SEED_DRIVERS, SEED_VEHICLES, SEED_DEMO_IDENTITIES, NOW), []);
});

test('every seeded driver has exactly one vehicle and one demo identity', () => {
  for (const d of SEED_DRIVERS) {
    assert.equal(SEED_VEHICLES.filter((v) => v.ownerDriverId === d.id).length, 1, d.id);
    assert.equal(Object.values(SEED_DEMO_IDENTITIES).filter((id) => id === d.id).length, 1, d.id);
  }
});

test('demo lookups are deterministic for every identity', async () => {
  const auth = createDemoSmartIdAuth(createCsddMockRegistry());
  for (const [demoId, driverId] of Object.entries(SEED_DEMO_IDENTITIES)) {
    const a = await auth.signIn(demoId);
    const b = await auth.signIn(demoId);
    assert.ok(a.ok && b.ok);
    assert.equal(a.profile.driver.id, driverId);
    assert.deepEqual(a.profile, b.profile);
  }
});

test('malformed references are reported', () => {
  assert.deepEqual(
    problemsOf([driver()], [vehicle({ ownerDriverId: 'ghost' })], { 'DEMO-X': 'nobody', BAD: 'd1' }),
    [
      'vehicle:v1: ownerDriverId ghost does not exist',
      'identity:DEMO-X: maps to missing driver nobody',
      'identity:BAD: demo id must start with DEMO-',
    ],
  );
});

test('duplicates are reported', () => {
  assert.deepEqual(
    problemsOf([driver(), driver()], [vehicle(), vehicle({ id: 'v2' })]),
    ['driver:d1: duplicate id', 'vehicle:v2: duplicate plateLabel'],
  );
});

test('missing and wrongly typed fields are reported', () => {
  const broken = {
    id: '',
    displayName: '',
    licenseCategories: [],
    licenseSince: '15.01.2015',
    synthetic: false,
  } as unknown as Driver;
  assert.deepEqual(problemsOf([broken], []), [
    'driver:(no id): id is required',
    'driver:(no id): displayName is required',
    'driver:(no id): synthetic must be true',
    'driver:(no id): licenseCategories must be a non-empty list or unknown',
    'driver:(no id): licenseSince must be YYYY-MM-DD or unknown',
  ]);

  const badVehicle = {
    id: 'v9',
    ownerDriverId: 'd1',
    plateLabel: 'AB-1234',
    make: '',
    model: 42,
    year: 2031,
    synthetic: true,
  } as unknown as Vehicle;
  assert.deepEqual(problemsOf([driver()], [badVehicle]), [
    'vehicle:v9: plateLabel must be a DEMO- label, not a real plate',
    'vehicle:v9: make must be a non-empty string or unknown',
    'vehicle:v9: model must be a non-empty string or unknown',
    'vehicle:v9: year must be an integer 1950-2027 or unknown',
  ]);
});

test('unknown values are allowed, future and invalid values are not', () => {
  assert.deepEqual(
    problemsOf(
      [driver({ licenseCategories: UNKNOWN, licenseSince: UNKNOWN })],
      [vehicle({ make: UNKNOWN, model: UNKNOWN, year: UNKNOWN })],
    ),
    [],
  );
  assert.deepEqual(problemsOf([driver({ licenseSince: '2027-01-01', licenseCategories: ['X'] })], []), [
    'driver:d1: licenseCategories has an unrecognised category',
    'driver:d1: licenseSince is in the future',
  ]);
});
