import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, test } from 'node:test';
import { createApi, RouteConsentError } from '../api.ts';
import { aggregateTrip } from '../obd/aggregate.ts';
import { createMemoryStorage } from '../storage.ts';
import type { SqlDriver, SqlValue } from '../trips/sqliteStore.ts';
import type { TripSummary } from '../trips/types.ts';
import { buildTripRoute, distanceM } from './build.ts';
import type { RouteFix } from './build.ts';
import { createMemoryRouteRepository } from './memoryStore.ts';
import { decodePolyline, encodePolyline } from './polyline.ts';
import { createSqliteRouteRepository } from './sqliteStore.ts';
import type { RouteRepository, TripRoute } from './types.ts';
import { RouteValidationError, validateTripRoute } from './validate.ts';
import { routeView } from './view.ts';

const NOW = new Date('2026-10-28T12:00:00Z');
const START = Date.parse('2026-10-28T10:00:00Z');

// 50 km/h, then speeding at 70, a harsh brake, a too-slow crawl at 20, then 50 again.
const SPEEDS = [
  ...Array(40).fill(50),
  ...Array(20).fill(70),
  55,
  40,
  ...Array(20).fill(20),
  ...Array(40).fill(50),
];

function drive(speeds: number[] = SPEEDS, driverId = 'drv-001', id = 'phone-1'): { trip: TripSummary; fixes: RouteFix[] } {
  let lat = 56.95;
  const lon = 24.1;
  const fixes = speeds.map((kmh, i) => {
    if (i > 0) lat += ((speeds[i - 1] + kmh) / 2 / 3.6) / 111_195;
    return { t: START + i * 1000, lat, lon: lon + i * 1e-6, speedKmh: kmh, limitKmh: 50 };
  });
  const trip = aggregateTrip({
    id,
    driverId,
    vehicleId: null,
    samples: fixes.map((f) => ({ t: f.t, speedKmh: f.speedKmh })),
    limitKmh: () => 50,
    speedLimitSource: 'map',
    source: 'phone',
  });
  return { trip, fixes };
}

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

const built = (): { trip: TripSummary; route: TripRoute } => {
  const { trip, fixes } = drive();
  const route = buildTripRoute({ trip, fixes, now: NOW });
  assert.ok(route);
  return { trip, route };
};

describe('polyline', () => {
  test('matches the reference encoding and round-trips', () => {
    const pts: [number, number][] = [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]];
    assert.equal(encodePolyline(pts), '_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), pts);
  });

  test('rejects a truncated string', () => {
    assert.throws(() => decodePolyline('_p~iF~ps|U_'));
  });
});

describe('buildTripRoute', () => {
  test('builds a valid, simplified, trimmed route with speed states and events', () => {
    const { trip, fixes } = drive();
    const { route } = built();
    validateTripRoute(route, trip);
    const pts = decodePolyline(route.polyline);
    assert.ok(pts.length < fixes.length / 4, `${pts.length} vertices from ${fixes.length} fixes`);
    assert.ok(route.privacy.trimmedStartM >= 200 && route.privacy.trimmedEndM >= 200);
    const first = { lat: pts[0][0], lon: pts[0][1] };
    assert.ok(distanceM(fixes[0], first) >= 199, 'start is trimmed');
    assert.deepEqual(route.segments.map((s) => s.state), ['ok', 'over', 'ok', 'slow', 'ok']);
    assert.equal(route.segments[1].maxOverKmh, 20);
    // 50->70 and 20->50 in one second are harsh accelerations too.
    assert.deepEqual(route.events.map((e) => e.kind), ['harsh_accel', 'harsh_brake', 'harsh_accel']);
    assert.ok(route.events[1].valueMs2 <= -3);
    assert.equal(route.expiresAt, '2026-11-27T12:00:00.000Z');
    assert.equal(route.limitSource, 'map');
  });

  test('routeView decodes points and pins for the map', () => {
    const { trip, route } = built();
    const view = routeView(route, trip.startedAt);
    assert.equal(view.points.length, route.speedKmh.length);
    assert.ok(view.points.some((p) => p.state === 'over') && view.points.some((p) => p.state === 'slow'));
    assert.deepEqual(view.events.map((e) => e.kind), ['accel', 'brake', 'accel']);
    assert.ok(view.events.every((e) => e.t > Date.parse(trip.startedAt)));
  });

  test('a trip too short for the privacy trim has no route', () => {
    const { trip, fixes } = drive(Array(30).fill(40)); // about 330 m
    assert.equal(buildTripRoute({ trip, fixes, now: NOW }), null);
  });
});

describe('validateTripRoute', () => {
  const bad = (patch: Partial<TripRoute>, re: RegExp) => {
    const { trip, route } = built();
    assert.throws(() => validateTripRoute({ ...route, ...patch }, trip), (e: unknown) => e instanceof RouteValidationError && re.test(e.message));
  };

  test('rejects broken routes', () => {
    const { route } = built();
    bad({ speedKmh: route.speedKmh.slice(1) }, /speedKmh must have one entry per vertex/);
    bad({ segments: route.segments.slice(1) }, /segments must cover/);
    bad({ events: [{ ...route.events[0], vertex: 999 }] }, /events must point/);
    bad({ polyline: '_p~iF~ps|U_' }, /polyline cannot be decoded/);
    bad({ tOffsetSec: [...route.tOffsetSec].reverse() }, /must not decrease/);
    bad({ driverId: 'drv-002' }, /another driver/);
    bad({ expiresAt: route.createdAt }, /expiresAt must be after/);
  });
});

const stores: [string, () => Promise<RouteRepository>][] = [
  ['memory', async () => createMemoryRouteRepository()],
  ['sqlite', () => createSqliteRouteRepository(nodeSqliteDriver())],
];

for (const [name, make] of stores) {
  describe(`${name} route repository`, () => {
    test('saves, lists, deletes and purges', async () => {
      const repo = await make();
      const { route } = built();
      const other = { ...route, tripId: 'phone-2', driverId: 'drv-002' };
      await repo.save(route);
      await repo.save(other);
      assert.deepEqual(await repo.get(route.tripId), route);
      assert.deepEqual(await repo.listTripIds('drv-001'), ['phone-1']);
      assert.equal(await repo.purgeExpired(NOW), 0);
      assert.equal(await repo.purgeExpired(new Date('2026-11-28T00:00:00Z')), 2);
      await repo.save(route);
      assert.equal(await repo.delete('phone-1'), true);
      assert.equal(await repo.delete('phone-1'), false);
      await repo.save(other);
      assert.equal(await repo.deleteByDriver('drv-002'), 1);
      assert.equal(await repo.get('phone-2'), null);
    });

    test('refuses an invalid route', async () => {
      const repo = await make();
      await assert.rejects(repo.save({ ...built().route, segments: [] }), RouteValidationError);
    });
  });
}

describe('api routes', () => {
  const setup = async () => {
    const storage = createMemoryStorage();
    let at = NOW;
    const api = createApi({ storage, now: () => at, routes: createMemoryRouteRepository() });
    await api.signIn('DEMO-SID-001');
    const { trip, route } = built();
    await api.saveTrip(trip);
    return { api, trip, route, setNow: (d: Date) => (at = d) };
  };

  test('saving needs consent, then the route reads back', async () => {
    const { api, route } = await setup();
    assert.equal(await api.getRouteConsent(), false);
    await assert.rejects(api.saveTripRoute(route), RouteConsentError);
    await api.setRouteConsent(true);
    await api.saveTripRoute(route);
    assert.deepEqual(await api.getTripRoute(route.tripId), route);
    assert.deepEqual(await api.listRouteTripIds(), [route.tripId]);
  });

  test('a route needs its saved trip and the same driver', async () => {
    const { api, route } = await setup();
    await api.setRouteConsent(true);
    await assert.rejects(api.saveTripRoute({ ...route, tripId: 'nope' }), /save the trip first/);
    await assert.rejects(api.saveTripRoute({ ...route, driverId: 'drv-002' }), /another driver/);
  });

  test('consent off, delete-my-data and expiry remove routes', async () => {
    const { api, route, setNow } = await setup();
    await api.setRouteConsent(true);
    await api.saveTripRoute(route);
    assert.deepEqual(await api.setRouteConsent(false), { routesDeleted: 1 });
    assert.equal(await api.getTripRoute(route.tripId), null);

    await api.setRouteConsent(true);
    await api.saveTripRoute(route);
    setNow(new Date('2026-11-28T00:00:00Z'));
    assert.equal(await api.getTripRoute(route.tripId), null);
    setNow(NOW);

    await api.saveTripRoute(route);
    const res = await api.deleteMyData();
    assert.equal(res.routesDeleted, 1);
  });
});
