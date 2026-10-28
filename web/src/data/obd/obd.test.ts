import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateTrip } from '../trips/validate.ts';
import { aggregateTrip } from './aggregate.ts';
import type { SpeedSample } from './aggregate.ts';
import { recordDemoDrive } from './demoDrive.ts';
import { createMockElm327, parseObdReply, readSpeed } from './elm327.ts';

test('mock dongle answers AT and mode 01 commands like an ELM327', async () => {
  const dongle = createMockElm327(() => ({ speedKmh: 60, rpm: 1726, throttlePct: 50 }));
  assert.match(await dongle.send('ATZ'), /ELM327.*MOCK/);
  assert.equal(await dongle.send('ATE0'), 'OK\r\r>');
  assert.equal(await dongle.send('010D'), '41 0D 3C\r\r>');
  assert.equal(await dongle.send('01 0c'), '41 0C 1A F8\r\r>');
  assert.equal(await dongle.send('0902'), 'NO DATA\r\r>'); // VIN is never served
  assert.equal(await readSpeed(dongle), 60);
});

test('parser decodes speed, rpm and throttle and rejects junk', () => {
  assert.deepEqual(parseObdReply('41 0D 3C\r\r>'), { pid: 'speed', value: 60 });
  assert.deepEqual(parseObdReply('41 0C 1A F8'), { pid: 'rpm', value: 1726 });
  assert.deepEqual(parseObdReply('41 11 80'), { pid: 'throttle', value: 50 });
  for (const bad of ['NO DATA\r\r>', '?', '7F 01 12', '41 0D', '']) assert.equal(parseObdReply(bad), null);
});

const T0 = Date.parse('2026-10-27T10:00:00Z');
const samples = (speeds: (number | null)[]): SpeedSample[] =>
  speeds.map((speedKmh, i) => ({ t: T0 + i * 1000, speedKmh }));
const agg = (speeds: (number | null)[], limit = 50) =>
  aggregateTrip({
    id: 't',
    driverId: 'drv-001',
    vehicleId: 'veh-001',
    samples: samples(speeds),
    limitKmh: () => limit,
    speedLimitSource: 'road_type_default',
    source: 'obd_mock',
  });

test('distance, driving time and speeding bands', () => {
  const t = agg([36, ...Array(60).fill(36)]); // 60 s at 36 km/h = 0.6 km
  assert.equal(t.distanceKm, 0.6);
  assert.equal(t.drivingSec, 60);
  assert.equal(t.secOverLimit, 0);

  const fast = agg([...Array(11).fill(54), ...Array(10).fill(62), ...Array(10).fill(75)]);
  assert.equal(fast.secOverLimit, 30); // 54 is within the 3 km/h tolerance
  assert.equal(fast.secOver10, 20);
  assert.equal(fast.secOver20, 10);
  // Relative bands at a 50 limit: 62 is +24%, 75 is +50%.
  assert.equal(fast.secOverPct10, 20);
  assert.equal(fast.secOverPct20, 20);
  assert.equal(fast.secOverPct40, 10);
});

test('harsh events use 3 m/s² and merge within 3 s', () => {
  // 54 -> 40 km/h in 1 s is -3.9 m/s²; two drops in a row count once.
  assert.equal(agg([54, 54, 40, 26, 26, 26, 26]).harshBrakeCount, 1);
  // Two separate hard stops 5 s apart count twice.
  assert.equal(agg([54, 40, 40, 40, 40, 40, 40, 26]).harshBrakeCount, 2);
  // Gentle deceleration (-1.4 m/s²) is not harsh.
  assert.equal(agg([54, 49, 44, 39, 34]).harshBrakeCount, 0);
  assert.equal(agg([0, 12, 24, 36]).harshAccelCount, 1);
});

test('gaps lower coverage and are not interpolated', () => {
  const t = agg([30, 30, null, null, null, null, 30, 30, 30, 30]);
  assert.equal(t.coverage, 0.6);
  assert.ok(t.drivingSec <= 4);
});

test('mock dongle drive end to end produces a valid trip', async () => {
  const trip = await recordDemoDrive({ driverId: 'drv-001', vehicleId: 'veh-001', startedAt: new Date(T0) });
  validateTrip(trip);
  assert.equal(trip.source, 'obd_mock');
  assert.equal(trip.harshBrakeCount, 1);
  assert.equal(trip.harshAccelCount, 1);
  assert.ok(trip.secOverLimit >= 40, `speeding ${trip.secOverLimit}s`);
  assert.ok(trip.distanceKm > 3 && trip.distanceKm < 4, `${trip.distanceKm} km`);
  assert.equal(trip.coverage, 1);
  assert.equal(trip.nightKm, 0);
});
