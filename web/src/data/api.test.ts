import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApi, NotSignedInError, SESSION_KEY } from './api.ts';
import { createMemoryStorage } from './storage.ts';

const NOW = new Date('2026-10-28T12:00:00Z');
const make = (storage = createMemoryStorage()) => ({ storage, api: createApi({ storage, now: () => NOW }) });

test('demo profiles are listed for the login picker', async () => {
  const { api } = make();
  assert.deepEqual((await api.listDemoProfiles()).map((p) => p.demoId), ['DEMO-SID-001', 'DEMO-SID-002', 'DEMO-SID-003']);
});

test('data calls require a session', async () => {
  const { api } = make();
  assert.equal(await api.getSession(), null);
  await assert.rejects(api.getWeeklyReport(), NotSignedInError);
  await assert.rejects(api.getTrend(), NotSignedInError);
  await assert.rejects(api.listTrips(), NotSignedInError);
  await assert.rejects(api.deleteMyData(), NotSignedInError);
});

test('sign-in persists across reloads and sign-out clears it', async () => {
  const { api, storage } = make();
  assert.ok((await api.signIn('DEMO-SID-001')).ok);
  assert.equal((await api.getSession())?.driver.id, 'drv-001');

  const reloaded = createApi({ storage, now: () => NOW });
  assert.equal((await reloaded.getSession())?.driver.id, 'drv-001');

  await reloaded.signOut();
  assert.equal(await reloaded.getSession(), null);
});

test('failed sign-in does not create a session', async () => {
  const { api } = make();
  assert.deepEqual(await api.signIn('DEMO-SID-999'), { ok: false, error: 'unknown_identity' });
  assert.equal(await api.getSession(), null);
});

test('a stale stored session is dropped', async () => {
  const { storage } = make();
  storage.setItem(SESSION_KEY, 'DEMO-SID-GONE');
  const api = createApi({ storage, now: () => NOW });
  assert.equal(await api.getSession(), null);
  assert.equal(storage.getItem(SESSION_KEY), null);
});

test('weekly report, trend and trips come from seeded synthetic data', async () => {
  const { api } = make();
  await api.signIn('DEMO-SID-002');
  assert.equal(api.currentWeek(), '2026-10-26');

  const report = await api.getWeeklyReport('2026-10-19');
  assert.equal(report.weekStart, '2026-10-19');
  assert.ok(report.trips > 0);
  assert.equal(typeof report.result.score, 'number');
  assert.ok(report.tips.length >= 1);
  assert.match(report.octa.disclaimer, /simulation/i);

  const trend = await api.getTrend(4);
  assert.deepEqual(trend.map((p) => p.weekStart), ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);

  const trips = await api.listTrips('2026-10-19');
  assert.equal(trips.length, report.trips);
  assert.ok(trips.every((t) => t.driverId === 'drv-002'));
});

test('the sparse demo driver gets no score, not a low one', async () => {
  const { api } = make();
  await api.signIn('DEMO-SID-003');
  const report = await api.getWeeklyReport('2026-10-19');
  assert.equal(report.result.score, null);
  assert.equal(report.result.confidence, 'insufficient');
  assert.equal(report.octa.direction, null);
});

test('delete my data removes trips, signs out and survives reloads until reset', async () => {
  const { api, storage } = make();
  await api.signIn('DEMO-SID-001');
  const before = (await api.listTrips('2026-10-19')).length;
  assert.ok(before > 0);

  const { tripsDeleted } = await api.deleteMyData();
  assert.ok(tripsDeleted >= before);
  assert.equal(await api.getSession(), null);

  const reloaded = createApi({ storage, now: () => NOW });
  await reloaded.signIn('DEMO-SID-001');
  assert.deepEqual(await reloaded.listTrips('2026-10-19'), []);
  assert.equal((await reloaded.getWeeklyReport('2026-10-19')).result.score, null);

  // Other drivers are untouched.
  await reloaded.signIn('DEMO-SID-002');
  assert.ok((await reloaded.listTrips('2026-10-19')).length > 0);

  await reloaded.resetDemo();
  await reloaded.signIn('DEMO-SID-001');
  assert.equal((await reloaded.listTrips('2026-10-19')).length, before);
});

test('seeding is idempotent across reloads', async () => {
  const { api, storage } = make();
  await api.signIn('DEMO-SID-001');
  const first = await api.listTrips('2026-10-19');
  const again = createApi({ storage, now: () => NOW });
  await again.signIn('DEMO-SID-001');
  assert.deepEqual(await again.listTrips('2026-10-19'), first);
});
