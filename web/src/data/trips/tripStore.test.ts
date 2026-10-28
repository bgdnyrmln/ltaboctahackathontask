import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, test } from 'node:test';
import { createMemoryTripRepository } from './memoryStore.ts';
import { createSqliteTripRepository } from './sqliteStore.ts';
import type { SqlDriver, SqlValue } from './sqliteStore.ts';
import type { TripRepository, TripSummary } from './types.ts';
import { sumTrips, TripValidationError, validateTrip } from './validate.ts';

function nodeSqliteDriver(): SqlDriver {
  const db = new DatabaseSync(':memory:');
  return {
    async exec(sql) {
      db.exec(sql);
    },
    async run(sql, params: SqlValue[] = []) {
      db.prepare(sql).run(...params);
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
  };
}

function trip(overrides: Partial<TripSummary> = {}): TripSummary {
  return {
    id: 'trip-1',
    driverId: 'drv-001',
    vehicleId: 'veh-001',
    startedAt: '2026-10-20T08:00:00.000Z',
    endedAt: '2026-10-20T08:30:00.000Z',
    distanceKm: 20,
    drivingSec: 1500,
    secOverLimit: 120,
    secOver10: 40,
    secOver20: 5,
    harshBrakeCount: 2,
    harshAccelCount: 1,
    nightKm: 0,
    coverage: 0.95,
    speedLimitSource: 'road_type_default',
    source: 'synthetic',
    ...overrides,
  };
}

const stores: [string, () => Promise<TripRepository>][] = [
  ['memory', async () => createMemoryTripRepository()],
  ['sqlite', () => createSqliteTripRepository(nodeSqliteDriver())],
];

for (const [name, make] of stores) {
  describe(`${name} trip repository`, () => {
    test('saves and reads back a trip unchanged', async () => {
      const repo = await make();
      const t = trip({ vehicleId: null });
      await repo.save([t]);
      assert.deepEqual(await repo.get('trip-1'), t);
      assert.equal(await repo.get('missing'), null);
    });

    test('save upserts by id', async () => {
      const repo = await make();
      await repo.save([trip()]);
      await repo.save([trip({ harshBrakeCount: 7 })]);
      const all = await repo.list();
      assert.equal(all.length, 1);
      assert.equal(all[0].harshBrakeCount, 7);
    });

    test('list filters by driver and time window, ordered by start', async () => {
      const repo = await make();
      await repo.save([
        trip({ id: 'b', startedAt: '2026-10-21T09:00:00.000Z', endedAt: '2026-10-21T09:20:00.000Z' }),
        trip({ id: 'a', startedAt: '2026-10-19T09:00:00.000Z', endedAt: '2026-10-19T09:20:00.000Z' }),
        trip({ id: 'c', startedAt: '2026-10-27T09:00:00.000Z', endedAt: '2026-10-27T09:20:00.000Z' }),
        trip({ id: 'other', driverId: 'drv-002' }),
      ]);
      const week = await repo.list({
        driverId: 'drv-001',
        from: '2026-10-19T00:00:00.000Z',
        to: '2026-10-26T00:00:00.000Z',
      });
      assert.deepEqual(week.map((t) => t.id), ['a', 'b']);
      assert.equal((await repo.list()).length, 4);
    });

    test('time window compares instants, not strings', async () => {
      const repo = await make();
      // 10:30+03:00 is 07:30Z, before the 08:00Z cut-off.
      await repo.save([
        trip({ id: 'tz', startedAt: '2026-10-20T10:30:00+03:00', endedAt: '2026-10-20T11:00:00+03:00' }),
      ]);
      assert.deepEqual(await repo.list({ to: '2026-10-20T08:00:00.000Z' }).then((r) => r.map((t) => t.id)), ['tz']);
    });

    test('invalid batch is rejected and nothing is written', async () => {
      const repo = await make();
      await assert.rejects(
        repo.save([trip({ id: 'ok' }), trip({ id: 'bad', coverage: 1.5 })]),
        TripValidationError,
      );
      assert.deepEqual(await repo.list(), []);
    });

    test('deleteByDriver removes only that driver and reports the count', async () => {
      const repo = await make();
      await repo.save([trip({ id: '1' }), trip({ id: '2' }), trip({ id: '3', driverId: 'drv-002' })]);
      assert.equal(await repo.deleteByDriver('drv-001'), 2);
      assert.deepEqual((await repo.list()).map((t) => t.id), ['3']);
      await repo.clear();
      assert.deepEqual(await repo.list(), []);
    });
  });
}

describe('validateTrip', () => {
  test('accepts a consistent trip', () => {
    validateTrip(trip());
  });

  test('reports every problem at once', () => {
    try {
      validateTrip(
        trip({
          driverId: '',
          endedAt: '2026-10-20T07:00:00.000Z',
          harshBrakeCount: 1.5,
          nightKm: 99,
          source: 'gps' as TripSummary['source'],
        }),
      );
      assert.fail('expected validation error');
    } catch (err) {
      assert.ok(err instanceof TripValidationError);
      assert.equal(err.problems.length, 5);
    }
  });

  test('rejects inconsistent speeding bands', () => {
    assert.throws(() => validateTrip(trip({ secOver10: 500 })), TripValidationError);
    assert.throws(() => validateTrip(trip({ secOverLimit: 9999 })), TripValidationError);
  });
});

describe('sumTrips', () => {
  test('sums counters and weights coverage by distance', () => {
    const totals = sumTrips([
      trip({ distanceKm: 30, coverage: 1, harshBrakeCount: 3, nightKm: 10 }),
      trip({ distanceKm: 10, coverage: 0.6, harshBrakeCount: 1 }),
    ]);
    assert.equal(totals.trips, 2);
    assert.equal(totals.distanceKm, 40);
    assert.equal(totals.harshBrakeCount, 4);
    assert.equal(totals.nightKm, 10);
    assert.equal(totals.coverage, 0.9);
  });

  test('empty input gives zero totals', () => {
    const totals = sumTrips([]);
    assert.equal(totals.trips, 0);
    assert.equal(totals.coverage, 0);
  });
});
