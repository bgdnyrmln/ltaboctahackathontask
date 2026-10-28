import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, test } from 'node:test';
import type { SqlDriver } from '../trips/sqliteStore.ts';
import {
  createSpeedLimitMap,
  distanceToPolylineM,
  getSpeedLimitMap,
  initSpeedLimitSchema,
  loadSpeedLimitFeatures,
  loadSpeedLimitMap,
  pointInPolygon,
  saveSpeedLimitFeatures,
  SEED_SPEED_LIMITS,
  SpeedLimitDataError,
  validateSpeedLimitFeatures,
} from './index.ts';
import type { SpeedLimitFeature } from './index.ts';

function nodeDriver(): SqlDriver {
  const db = new DatabaseSync(':memory:');
  return {
    exec: async (sql) => void db.exec(sql),
    run: async (sql, params = []) => void db.prepare(sql).run(...params),
    all: async <T>(sql: string, params: (string | number | null)[] = []) => db.prepare(sql).all(...params) as T[],
  };
}

describe('geometry', () => {
  test('distance to a segment is perpendicular, not to the nearest vertex', () => {
    const line = [{ lat: 57, lon: 24 }, { lat: 57, lon: 24.01 }];
    // ~11 m north of the middle of the line (0.0001° lat ≈ 11.1 m)
    const d = distanceToPolylineM({ lat: 57.0001, lon: 24.005 }, line);
    assert.ok(Math.abs(d - 11.1) < 0.5, `got ${d}`);
  });

  test('point in polygon', () => {
    const square = [{ lat: 0, lon: 0 }, { lat: 1, lon: 0 }, { lat: 1, lon: 1 }, { lat: 0, lon: 1 }];
    assert.equal(pointInPolygon({ lat: 0.5, lon: 0.5 }, square), true);
    assert.equal(pointInPolygon({ lat: 1.5, lon: 0.5 }, square), false);
  });
});

describe('speed limit map', () => {
  const map = getSpeedLimitMap();

  test('the bundled demo data is valid', () => {
    assert.deepEqual(validateSpeedLimitFeatures(SEED_SPEED_LIMITS), []);
  });

  test('a fix on a mapped road gets that road\'s limit', () => {
    const hit = map.lookup(56.9380, 24.1280); // a Krasta iela vertex
    assert.equal(hit?.featureId, 'seg-krasta');
    assert.equal(hit?.limitKmh, 70);
    assert.equal(hit?.source, 'map');
    assert.equal(hit?.matchedBy, 'segment');
  });

  test('a fix just off the road still matches, further away falls back to the zone', () => {
    assert.equal(map.lookup(56.9381, 24.1280)?.featureId, 'seg-krasta'); // ~11 m
    const off = map.lookup(56.9390, 24.1280); // ~110 m away, still inside Riga
    assert.equal(off?.featureId, 'zone-riga');
    assert.equal(off?.limitKmh, 50);
  });

  test('the innermost zone wins', () => {
    const hit = map.lookup(56.9480, 24.1070);
    assert.equal(hit?.featureId, 'zone-old-town');
    assert.equal(hit?.limitKmh, 30);
  });

  test('outside the map there is no answer, so the caller uses its default', () => {
    assert.equal(map.lookup(56.5, 21.0), null); // Liepaja
  });

  test('a motorway segment outside the city is matched', () => {
    assert.equal(map.lookup(57.0300, 24.4500)?.limitKmh, 90);
  });

  test('features() returns copies', () => {
    const copy = map.features();
    copy[0].points[0].lat = 0;
    assert.notEqual(map.features()[0].points[0].lat, 0);
  });

  test('invalid data is rejected with every problem listed', () => {
    const bad: SpeedLimitFeature[] = [
      { id: 'a', type: 'segment', name: 'x', kind: 'urban', limitKmh: 50, points: [{ lat: 1, lon: 1 }] },
      { id: 'a', type: 'zone', name: 'y', kind: 'urban', limitKmh: 300, points: [{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }, { lat: 99, lon: 1 }] },
    ];
    assert.throws(() => createSpeedLimitMap(bad), (err: unknown) => {
      assert.ok(err instanceof SpeedLimitDataError);
      assert.equal(err.problems.length, 4); // 1 point, duplicate id, limit range, latitude range
      return true;
    });
  });
});

describe('sqlite speed limit table', () => {
  test('round-trips the demo data and answers the same lookups', async () => {
    const db = nodeDriver();
    await initSpeedLimitSchema(db);
    await saveSpeedLimitFeatures(db, SEED_SPEED_LIMITS);
    await saveSpeedLimitFeatures(db, SEED_SPEED_LIMITS); // upsert, no duplicates
    const loaded = await loadSpeedLimitFeatures(db);
    assert.equal(loaded.length, SEED_SPEED_LIMITS.length);
    const fromDb = await loadSpeedLimitMap(db);
    assert.deepEqual(fromDb.lookup(56.9380, 24.1280), getSpeedLimitMap().lookup(56.9380, 24.1280));
  });

  test('area query returns only overlapping features', async () => {
    const db = nodeDriver();
    await initSpeedLimitSchema(db);
    await saveSpeedLimitFeatures(db, SEED_SPEED_LIMITS);
    const ids = (await loadSpeedLimitFeatures(db, { minLat: 57.02, maxLat: 57.06, minLon: 24.4, maxLon: 24.6 })).map((f) => f.id);
    assert.deepEqual(ids, ['seg-a2-east']);
  });

  test('invalid input writes nothing', async () => {
    const db = nodeDriver();
    await initSpeedLimitSchema(db);
    const bad = { ...SEED_SPEED_LIMITS[0], id: 'bad', limitKmh: 0 };
    await assert.rejects(saveSpeedLimitFeatures(db, [SEED_SPEED_LIMITS[1], bad]), SpeedLimitDataError);
    assert.deepEqual(await loadSpeedLimitFeatures(db), []);
  });
});
