import type { KeyValueStorage } from '../storage.ts';
import { createMemoryTripRepository } from './memoryStore.ts';
import type { TripRepository, TripSummary } from './types.ts';
import { validateTrip } from './validate.ts';

export const TRIPS_STORAGE_KEY = 'octa.trips.v2';

function load(storage: KeyValueStorage, key: string): TripSummary[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('not an array');
    parsed.forEach((t) => validateTrip(t as TripSummary));
    return parsed as TripSummary[];
  } catch {
    // Corrupt or outdated snapshot: start clean rather than crash the app.
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
    return [];
  }
}

// In-memory store that writes a JSON snapshot after every change. Fine for the
// demo's few hundred trips; swap for IndexedDB if volumes grow.
export function createPersistentTripRepository(
  storage: KeyValueStorage,
  key: string = TRIPS_STORAGE_KEY,
): TripRepository {
  const inner = createMemoryTripRepository(load(storage, key));

  const persist = async () => {
    try {
      storage.setItem(key, JSON.stringify(await inner.list()));
    } catch {
      // Quota or blocked storage: keep working in memory for this session.
    }
  };

  return {
    get: inner.get,
    list: inner.list,
    async save(batch) {
      await inner.save(batch);
      await persist();
    },
    async deleteByDriver(driverId) {
      const removed = await inner.deleteByDriver(driverId);
      await persist();
      return removed;
    },
    async clear() {
      await inner.clear();
      await persist();
    },
  };
}
