import { createSpeedLimitMap } from './map.ts';
import { SEED_SPEED_LIMITS } from './seed.ts';
import type { SpeedLimitMap } from './types.ts';

export * from './types.ts';
export * from './map.ts';
export * from './seed.ts';
export * from './sqliteStore.ts';

let instance: SpeedLimitMap | null = null;

// App-wide map built from the bundled demo data (works offline).
export function getSpeedLimitMap(): SpeedLimitMap {
  return (instance ??= createSpeedLimitMap(SEED_SPEED_LIMITS));
}
