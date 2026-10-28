import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDemoSmartIdAuth, isImpossibleDate } from './demoAuth.ts';
import { createCsddMockRegistry } from './registry.ts';
import { SEED_DEMO_IDENTITIES, SEED_DEMO_PERSONAL_CODES } from './seed.ts';
import { isUnknown } from './types.ts';

const registry = createCsddMockRegistry();
const auth = createDemoSmartIdAuth(registry);

test('demo sign-in resolves to the seeded driver and their vehicle', async () => {
  const res = await auth.signIn('DEMO-SID-001');
  assert.ok(res.ok);
  assert.equal(res.demo, true);
  assert.equal(res.profile.driver.id, 'drv-001');
  assert.equal(res.profile.vehicles.length, 1);
  assert.equal(res.profile.vehicles[0].ownerDriverId, 'drv-001');
  assert.deepEqual(res.profile, await registry.getProfile('drv-001'));
});

test('sign-in is consistent across repeated calls', async () => {
  const a = await auth.signIn(' DEMO-SID-002 ');
  const b = await auth.signIn('DEMO-SID-002');
  assert.ok(a.ok && b.ok);
  assert.deepEqual(a.profile, b.profile);
});

test('unknown demo identity is rejected', async () => {
  assert.deepEqual(await auth.signIn('DEMO-SID-999'), {
    ok: false,
    error: 'unknown_identity',
  });
  assert.deepEqual(await auth.signIn('__proto__'), {
    ok: false,
    error: 'unknown_identity',
  });
});

test('fictional test personal codes sign in the matching demo driver', async () => {
  for (const [code, driverId] of [
    ['300291-17428', 'drv-001'],
    ['310405-20716', 'drv-002'],
    ['31068813059', 'drv-003'],
    [' 300291 17428 ', 'drv-001'],
  ]) {
    const res = await auth.signIn(code);
    assert.ok(res.ok, code);
    assert.equal(res.profile.driver.id, driverId);
  }
});

test('test codes sit on dates that do not exist; real-looking codes never sign in', async () => {
  assert.equal(isImpossibleDate('300291-17428'), true);
  assert.equal(isImpossibleDate('310405-20716'), true);
  assert.equal(isImpossibleDate('310688-13059'), true);
  assert.equal(isImpossibleDate('010190-12345'), false);
  assert.equal(isImpossibleDate('290200-20000'), false); // 29 Feb 2000 exists
  for (const code of Object.keys(SEED_DEMO_PERSONAL_CODES)) assert.equal(isImpossibleDate(code), true, code);
  // Even if a real-date code is put into the map, it is refused.
  const unsafe = createDemoSmartIdAuth(registry, SEED_DEMO_IDENTITIES, { '010190-12345': 'drv-001' });
  assert.deepEqual(await unsafe.signIn('010190-12345'), { ok: false, error: 'invalid_input' });
  // A code that is not in the list is refused too.
  assert.deepEqual(await auth.signIn('010190-12345'), { ok: false, error: 'invalid_input' });
});

test('empty input and unknown personal-code-like input are rejected without lookup', async () => {
  for (const input of ['', '   ', '123456-12345', '12345612345']) {
    assert.deepEqual(await auth.signIn(input), {
      ok: false,
      error: 'invalid_input',
    });
  }
});

test('missing registry data is reported as data_missing', async () => {
  const emptyAuth = createDemoSmartIdAuth(createCsddMockRegistry([], []));
  assert.deepEqual(await emptyAuth.signIn('DEMO-SID-001'), {
    ok: false,
    error: 'data_missing',
  });
});

test('missing values are explicit unknowns, not invented', async () => {
  const res = await auth.signIn('DEMO-SID-003');
  assert.ok(res.ok);
  assert.ok(isUnknown(res.profile.driver.licenseCategories));
  assert.ok(isUnknown(res.profile.driver.licenseSince));
  assert.ok(isUnknown(res.profile.vehicles[0].make));
  assert.ok(isUnknown(res.profile.vehicles[0].year));
});

test('lookups for absent ids return null or empty', async () => {
  assert.equal(await registry.getDriver('nope'), null);
  assert.equal(await registry.getProfile('nope'), null);
  assert.deepEqual(await registry.getVehiclesByDriver('nope'), []);
});

test('demo identity list shows seeded drivers only', async () => {
  const list = await auth.listDemoIdentities();
  assert.deepEqual(
    list.map((o) => o.demoId),
    ['DEMO-SID-001', 'DEMO-SID-002', 'DEMO-SID-003'],
  );
});
