import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDemoSmartIdAuth } from './demoAuth.ts';
import { createCsddMockRegistry } from './registry.ts';
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

test('empty input and personal-code-like input are rejected without lookup', async () => {
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
