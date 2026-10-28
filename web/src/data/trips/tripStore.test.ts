import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, test } from 'node:test';
import { createMemoryTripRepository } from './memoryStore.ts';
import { createSqliteTripRepository } from './sqliteStore.ts';
import type { SqlDriver, SqlValue } from './sqliteStore.ts';
import type { TripRepository, TripSummary } from './types.ts';
import { speedingBands } from './speeding.ts';
import { sumTrips, TripValidationError, upgradeTrip, validateTrip } from './validate.ts';

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
    secOverPct10: 5,
    secOverPct20: 5,
    secOverPct40: 0,
    secPhoneUse: 0,
    secTooSlow: 0,
    harshBrakeCount: 2,
    harshAccelCount: 1,
    nightKm: 0,
    maxContinuousMin: 15,
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

  test('rejects a continuous stretch longer than the trip', () => {
    assert.throws(() => validateTrip(trip({ maxContinuousMin: 45 })), TripValidationError);
    assert.throws(() => validateTrip(trip({ maxContinuousMin: -1 })), TripValidationError);
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

describe('relative speeding bands', () => {
  test('the same +20 km/h is more severe in a 30 zone than on a 110 road', () => {
    const highway = speedingBands(130, 110); // +18%
    assert.deepEqual([highway.overLimit, highway.overPct10, highway.overPct20, highway.overPct40], [true, true, false, false]);
    const zone30 = speedingBands(50, 30); // +67%
    assert.deepEqual([zone30.overLimit, zone30.overPct10, zone30.overPct20, zone30.overPct40], [true, true, true, true]);
  });

  test('tolerance is max(3 km/h, 5% of the limit) and gates every band', () => {
    assert.equal(speedingBands(22.5, 20).overPct10, false); // +12.5% but only +2.5 km/h
    assert.equal(speedingBands(115, 110).overLimit, false); // +5 < 5.5
    assert.equal(speedingBands(116, 110).overLimit, true);
    assert.equal(speedingBands(53.5, 50).overLimit, true); // +3.5 > 3
  });

  test('validation enforces overPct40 <= overPct20 <= overPct10 <= overLimit', () => {
    assert.throws(() => validateTrip(trip({ secOverPct10: 200 })), /overPct10/);
    assert.throws(() => validateTrip(trip({ secOverPct40: 5, secOverPct20: 1 })), /overPct40/);
    assert.throws(() => validateTrip(trip({ secOverPct20: -1 })), /secOverPct20 must be/);
  });

  test('sumTrips adds the relative bands', () => {
    const totals = sumTrips([trip(), trip({ id: 'trip-2', secOverPct40: 2 })]);
    assert.deepEqual([totals.secOverPct10, totals.secOverPct20, totals.secOverPct40], [10, 10, 2]);
  });

  test('trips saved before the bands existed load with them as 0', () => {
    const { secOverPct10: _a, secOverPct20: _b, secOverPct40: _c, ...legacy } = trip();
    assert.deepEqual(upgradeTrip(legacy), { ...trip(), secOverPct10: 0, secOverPct20: 0, secOverPct40: 0 });
  });
});

test('an old sqlite database gains the new columns and keeps its rows', async () => {
  const driver = nodeSqliteDriver();
  // Schema as shipped before the relative bands (and before maxContinuousMin).
  await driver.exec(`CREATE TABLE trip_summary (
    id TEXT PRIMARY KEY NOT NULL, driver_id TEXT NOT NULL, vehicle_id TEXT,
    started_at TEXT NOT NULL, ended_at TEXT NOT NULL, distance_km REAL NOT NULL,
    driving_sec REAL NOT NULL, sec_over_limit REAL NOT NULL, sec_over_10 REAL NOT NULL,
    sec_over_20 REAL NOT NULL, harsh_brake_count INTEGER NOT NULL, harsh_accel_count INTEGER NOT NULL,
    night_km REAL NOT NULL, coverage REAL NOT NULL, speed_limit_source TEXT NOT NULL, source TEXT NOT NULL)`);
  await driver.run(
    `INSERT INTO trip_summary VALUES ('old-1', 'drv-001', NULL, '2026-10-20T08:00:00.000Z', '2026-10-20T08:30:00.000Z',
      20, 1500, 120, 40, 5, 2, 1, 0, 0.95, 'road_type_default', 'synthetic')`,
  );
  const repo = await createSqliteTripRepository(driver);
  const old = await repo.get('old-1');
  assert.deepEqual([old?.secOverPct10, old?.secOverPct20, old?.secOverPct40, old?.secPhoneUse, old?.secTooSlow, old?.maxContinuousMin], [0, 0, 0, 0, 0, 0]);
  await repo.save([trip({ id: 'new-1' })]);
  assert.equal((await repo.get('new-1'))?.secOverPct10, 5);
  // Opening again is a no-op.
  await createSqliteTripRepository(driver);
  assert.equal((await repo.list()).length, 2);
});

describe('phone use', () => {
  test('secPhoneUse is a non-negative count within driving time and is summed', () => {
    validateTrip(trip({ secPhoneUse: 30 }));
    assert.throws(() => validateTrip(trip({ secPhoneUse: 1600 })), /secPhoneUse exceeds drivingSec/);
    assert.throws(() => validateTrip(trip({ secPhoneUse: -1 })), /secPhoneUse must be/);
    assert.equal(sumTrips([trip({ secPhoneUse: 30 }), trip({ id: 'trip-2', secPhoneUse: 12 })]).secPhoneUse, 42);
  });

  test('trips stored before phone use existed load with 0', () => {
    const { secPhoneUse: _p, ...legacy } = trip({ secPhoneUse: 9 });
    assert.equal(upgradeTrip(legacy).secPhoneUse, 0);
  });
});

describe('too slow', () => {
  test('secTooSlow is a non-negative count within driving time and is summed', () => {
    validateTrip(trip({ secTooSlow: 30 }));
    assert.throws(() => validateTrip(trip({ secTooSlow: 1600 })), /secTooSlow exceeds drivingSec/);
    assert.throws(() => validateTrip(trip({ secTooSlow: -1 })), /secTooSlow must be/);
    assert.equal(sumTrips([trip({ secTooSlow: 30 }), trip({ id: 'trip-2', secTooSlow: 12 })]).secTooSlow, 42);
  });

  test('trips stored before too-slow existed load with 0', () => {
    const { secTooSlow: _s, ...legacy } = trip({ secTooSlow: 9 });
    assert.equal(upgradeTrip(legacy).secTooSlow, 0);
  });

  test('sqlite stores secTooSlow', async () => {
    const repo = await createSqliteTripRepository(nodeSqliteDriver());
    await repo.save([trip({ secTooSlow: 44 })]);
    assert.equal((await repo.get('trip-1'))?.secTooSlow, 44);
  });
});
