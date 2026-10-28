import type { RouteRepository, TripRoute } from './types.ts';
import { validateTripRoute } from './validate.ts';

const copy = (r: TripRoute): TripRoute => structuredClone(r);

export function createMemoryRouteRepository(initial: TripRoute[] = []): RouteRepository {
  const routes = new Map<string, TripRoute>();
  for (const r of initial) {
    validateTripRoute(r);
    routes.set(r.tripId, copy(r));
  }
  return {
    async save(route) {
      validateTripRoute(route);
      routes.set(route.tripId, copy(route));
    },
    async get(tripId) {
      const r = routes.get(tripId);
      return r ? copy(r) : null;
    },
    async listTripIds(driverId) {
      return [...routes.values()].filter((r) => r.driverId === driverId).map((r) => r.tripId);
    },
    async delete(tripId) {
      return routes.delete(tripId);
    },
    async deleteByDriver(driverId) {
      let n = 0;
      for (const r of [...routes.values()]) if (r.driverId === driverId && routes.delete(r.tripId)) n++;
      return n;
    },
    async purgeExpired(now) {
      let n = 0;
      for (const r of [...routes.values()]) if (Date.parse(r.expiresAt) <= now.getTime() && routes.delete(r.tripId)) n++;
      return n;
    },
    async clear() {
      routes.clear();
    },
  };
}
