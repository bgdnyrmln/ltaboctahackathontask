import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryStorage } from '../storage.ts';
import type { KeyValueStorage } from '../storage.ts';
import { createPersistentTripRepository, TRIPS_STORAGE_KEY } from './persistentStore.ts';
import type { TripSummary } from './types.ts';

const trip = (id: string, driverId = 'drv-001'): TripSummary => ({
  id,
  driverId,
  vehicleId: 'veh-001',
  startedAt: '2026-10-20T08:00:00.000Z',
  endedAt: '2026-10-20T08:30:00.000Z',
  distanceKm: 20,
  drivingSec: 1500,
  secOverLimit: 120,
  secOver10: 40,
  secOver20: 5,
  secOverPct10: 5,
  secOverPct20: 5,
  secOverPct40: 0,
  harshBrakeCount: 2,
  harshAccelCount: 1,
  nightKm: 0,
  maxContinuousMin: 15,
  coverage: 0.95,
  speedLimitSource: 'road_type_default',
  source: 'synthetic',
});

test('trips survive a new repository instance on the same storage', async () => {
  const storage = createMemoryStorage();
  await createPersistentTripRepository(storage).save([trip('a'), trip('b', 'drv-002')]);

  const reopened = createPersistentTripRepository(storage);
  assert.deepEqual((await reopened.list()).map((t) => t.id), ['a', 'b']);

  await reopened.deleteByDriver('drv-001');
  assert.deepEqual((await createPersistentTripRepository(storage).list()).map((t) => t.id), ['b']);

  await reopened.clear();
  assert.deepEqual(await createPersistentTripRepository(storage).list(), []);
});

test('corrupt or invalid snapshots are discarded instead of crashing', async () => {
  for (const bad of ['{not json', '{"a":1}', JSON.stringify([{ id: 'x' }])]) {
    const storage = createMemoryStorage();
    storage.setItem(TRIPS_STORAGE_KEY, bad);
    const repo = createPersistentTripRepository(storage);
    assert.deepEqual(await repo.list(), []);
    assert.equal(storage.getItem(TRIPS_STORAGE_KEY), null);
  }
});

test('a storage that refuses writes still works in memory', async () => {
  const failing: KeyValueStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {},
  };
  const repo = createPersistentTripRepository(failing);
  await repo.save([trip('a')]);
  assert.equal((await repo.list()).length, 1);
});

test('a snapshot from before the relative speeding bands is upgraded, not discarded', async () => {
  const storage = createMemoryStorage();
  const { secOverPct10: _a, secOverPct20: _b, secOverPct40: _c, ...legacy } = trip('phone-old');
  storage.setItem(TRIPS_STORAGE_KEY, JSON.stringify([legacy]));
  const repo = createPersistentTripRepository(storage);
  const loaded = await repo.get('phone-old');
  assert.equal(loaded?.secOverPct10, 0);
  assert.equal(loaded?.secOverPct40, 0);
});
