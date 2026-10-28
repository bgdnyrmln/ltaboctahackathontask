import type { TripQuery, TripRepository, TripSummary } from './types.ts';
import { matchesQuery, validateTrip } from './validate.ts';

const byStart = (a: TripSummary, b: TripSummary) =>
  Date.parse(a.startedAt) - Date.parse(b.startedAt) || a.id.localeCompare(b.id);

// Default demo store: no permissions, no native module, works offline.
export function createMemoryTripRepository(initial: TripSummary[] = []): TripRepository {
  const trips = new Map<string, TripSummary>();

  const repo: TripRepository = {
    async save(batch) {
      batch.forEach(validateTrip); // validate all before writing any
      for (const t of batch) trips.set(t.id, { ...t });
    },
    async get(id) {
      const t = trips.get(id);
      return t ? { ...t } : null;
    },
    async list(query?: TripQuery) {
      return [...trips.values()]
        .filter((t) => matchesQuery(t, query))
        .sort(byStart)
        .map((t) => ({ ...t }));
    },
    async deleteByDriver(driverId) {
      let removed = 0;
      for (const [id, t] of trips) {
        if (t.driverId === driverId) {
          trips.delete(id);
          removed++;
        }
      }
      return removed;
    },
    async clear() {
      trips.clear();
    },
  };

  if (initial.length > 0) {
    initial.forEach(validateTrip);
    for (const t of initial) trips.set(t.id, { ...t });
  }
  return repo;
}
