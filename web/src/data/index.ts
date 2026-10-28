// UI entry point: `import { getApi } from './data'`. Lower-level modules are
// exported for Agent D (scoring) and tests.
export * from './api.ts';
export * from './types.ts';
export * from './registry.ts';
export * from './demoAuth.ts';
export * from './validateRegistry.ts';
export * from './storage.ts';
export * from './time.ts';
export * from './score/index.ts';
export * from './trips/index.ts';
export * from './obd/index.ts';
export { SEED_DRIVERS, SEED_VEHICLES, SEED_DEMO_IDENTITIES } from './seed.ts';
