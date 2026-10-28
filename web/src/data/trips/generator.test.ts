import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SEED_DRIVERS, SEED_VEHICLES } from '../seed.ts';
import { recentWeeks, weekRange, weekStartOf } from '../time.ts';
import { DEMO_PROFILES, generateDemoTrips } from './generator.ts';
import { matchesQuery, sumTrips, validateTrip } from './validate.ts';

const NOW = new Date('2026-10-28T12:00:00Z'); // Wednesday
const WEEKS = recentWeeks(NOW, 5);

test('week helpers use Riga Mondays across the DST change', () => {
  assert.equal(weekStartOf(NOW), '2026-10-26');
  assert.deepEqual(WEEKS, ['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  // Summer time (UTC+3) before 25 Oct, winter time (UTC+2) after.
  assert.deepEqual(weekRange('2026-10-19'), {
    from: '2026-10-18T21:00:00.000Z',
    to: '2026-10-25T22:00:00.000Z',
  });
  // Sunday 23:30 Riga still belongs to the previous week.
  assert.equal(weekStartOf(new Date('2026-10-25T21:30:00Z')), '2026-10-19');
});

test('generation is deterministic', () => {
  assert.deepEqual(generateDemoTrips(WEEKS, NOW), generateDemoTrips(WEEKS, NOW));
});

test('a week yields the same trips whatever window includes it', () => {
  const inWide = generateDemoTrips(WEEKS).filter((t) => t.id.includes('2026-10-12'));
  const alone = generateDemoTrips(['2026-10-12']).filter((t) => t.id.includes('2026-10-12'));
  // Improvement factor depends on position, so compare only the schedule.
  assert.deepEqual(inWide.map((t) => [t.id, t.startedAt, t.distanceKm]), alone.map((t) => [t.id, t.startedAt, t.distanceKm]));
});

test('every generated trip passes storage validation and references seeded data', () => {
  const driverIds = new Set(SEED_DRIVERS.map((d) => d.id));
  const vehicleIds = new Set(SEED_VEHICLES.map((v) => v.id));
  const trips = generateDemoTrips(WEEKS, NOW);
  assert.ok(trips.length > 100);
  for (const t of trips) {
    validateTrip(t);
    assert.ok(driverIds.has(t.driverId));
    assert.ok(t.vehicleId && vehicleIds.has(t.vehicleId));
    assert.equal(t.source, 'synthetic');
  }
  assert.equal(new Set(trips.map((t) => t.id)).size, trips.length);
});

test('no trip starts after now', () => {
  for (const t of generateDemoTrips(WEEKS, NOW)) assert.ok(Date.parse(t.startedAt) <= NOW.getTime());
});

test('profiles differ the way the demo story needs', () => {
  const trips = generateDemoTrips(WEEKS.slice(0, 4));
  const week = (driverId: string, weekStart: string) =>
    sumTrips(trips.filter((t) => matchesQuery(t, { driverId, ...weekRange(weekStart) })));

  const careful = week('drv-001', '2026-10-19');
  const aggressive = week('drv-002', '2026-10-19');
  const sparse = week('drv-003', '2026-10-19');

  assert.ok(careful.secOverLimit / careful.drivingSec < aggressive.secOverLimit / aggressive.drivingSec);
  assert.ok(careful.harshBrakeCount / careful.distanceKm < aggressive.harshBrakeCount / aggressive.distanceKm);
  assert.ok(sparse.distanceKm < 30, `sparse driver drove ${sparse.distanceKm} km`);
  assert.ok(sparse.coverage < 0.7);

  // The aggressive driver improves: oldest week has more speeding than newest.
  const first = week('drv-002', '2026-09-28');
  assert.ok(first.secOverLimit / first.drivingSec > aggressive.secOverLimit / aggressive.drivingSec);
  // and has at least one long night stretch for the fatigue context.
  assert.ok(trips.some((t) => t.driverId === 'drv-002' && t.nightKm > 0 && t.maxContinuousMin > 240));
  assert.ok(Object.keys(DEMO_PROFILES).every((id) => trips.some((t) => t.driverId === id)));
});

test('mid-week, the current week already shows a normal amount of driving', () => {
  const now = new Date('2026-10-28T14:00:00Z'); // Wednesday afternoon in Riga
  const trips = generateDemoTrips(['2026-10-26'], now);
  const km = (id: string) => sumTrips(trips.filter((t) => t.driverId === id)).distanceKm;
  assert.ok(km('drv-001') >= 100, `Anna ${km('drv-001')} km`);
  assert.ok(km('drv-002') >= 100, `Janis ${km('drv-002')} km`);
  assert.ok(km('drv-003') < 30); // the sparse driver stays sparse
  assert.ok(trips.every((t) => Date.parse(t.endedAt) <= now.getTime())); // no trip still in progress
});

test('past weeks do not depend on when the demo runs', () => {
  const past = ['2026-10-12', '2026-10-19'];
  assert.deepEqual(
    generateDemoTrips(past, new Date('2026-10-26T06:00:00Z')),
    generateDemoTrips(past, new Date('2026-10-30T12:00:00Z')),
  );
});

test('synthetic phone use follows the driver profile', () => {
  const trips = generateDemoTrips(WEEKS, NOW);
  const share = (id: string) => {
    const t = sumTrips(trips.filter((x) => x.driverId === id));
    return (t.secPhoneUse ?? 0) / t.drivingSec;
  };
  assert.ok(share('drv-001') > 0 && share('drv-001') < 0.01, `Anna ${share('drv-001')}`);
  assert.ok(share('drv-002') > 0.02 && share('drv-002') < 0.08, `Janis ${share('drv-002')}`);
  assert.equal(share('drv-003'), 0);
});

test('synthetic too-slow time follows the driver profile and fits in driving time', () => {
  const trips = generateDemoTrips(WEEKS, NOW);
  for (const t of trips) assert.ok((t.secTooSlow ?? 0) + t.secOverLimit <= t.drivingSec, t.id);
  const share = (id: string) => {
    const t = sumTrips(trips.filter((x) => x.driverId === id));
    return (t.secTooSlow ?? 0) / t.drivingSec;
  };
  assert.ok(share('drv-001') > 0.01 && share('drv-001') < 0.03, `Anna ${share('drv-001')}`);
  assert.ok(share('drv-002') > 0.005 && share('drv-002') < 0.03, `Janis ${share('drv-002')}`);
  assert.equal(share('drv-003'), 0);
});
