// Web/PWA store: IndexedDB database `octa`, object store `tripRoutes` keyed by
// tripId. localStorage is not used for routes (5 MB, synchronous).
import type { RouteRepository, TripRoute } from './types.ts';
import { validateTripRoute } from './validate.ts';

// The data layer builds without DOM types, so only the IndexedDB surface used
// here is described; the browser's indexedDB satisfies it.
interface IdbRequest<T> {
  result: T;
  error: unknown;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}
interface IdbOpenRequest extends IdbRequest<IdbDatabase> {
  onupgradeneeded: (() => void) | null;
}
interface IdbStore {
  put(value: unknown): IdbRequest<unknown>;
  get(key: string): IdbRequest<unknown>;
  getAll(): IdbRequest<unknown[]>;
  delete(key: string): IdbRequest<unknown>;
  clear(): IdbRequest<unknown>;
  createIndex(name: string, keyPath: string): unknown;
  index(name: string): { getAllKeys(key: string): IdbRequest<unknown[]> };
}
interface IdbDatabase {
  createObjectStore(name: string, options: { keyPath: string }): IdbStore;
  transaction(store: string, mode: 'readonly' | 'readwrite'): { objectStore(name: string): IdbStore };
}
export interface IdbFactory {
  open(name: string, version: number): IdbOpenRequest;
}

export const browserIndexedDb = (): IdbFactory | null =>
  (globalThis as { indexedDB?: IdbFactory }).indexedDB ?? null;

export const ROUTE_DB_NAME = 'octa';
export const ROUTE_STORE = 'tripRoutes';

const done = <T>(req: IdbRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function open(factory: IdbFactory, name: string): Promise<IdbDatabase> {
  const req = factory.open(name, 1);
  req.onupgradeneeded = () => {
    const store = req.result.createObjectStore(ROUTE_STORE, { keyPath: 'tripId' });
    store.createIndex('driverId', 'driverId');
  };
  return done(req);
}

export function createIndexedDbRouteRepository(factory: IdbFactory, name: string = ROUTE_DB_NAME): RouteRepository {
  let db: Promise<IdbDatabase> | null = null;
  const tx = async <T>(mode: 'readonly' | 'readwrite', fn: (store: IdbStore) => IdbRequest<T>): Promise<T> => {
    const conn = await (db ??= open(factory, name));
    return done(fn(conn.transaction(ROUTE_STORE, mode).objectStore(ROUTE_STORE)));
  };
  const all = async () => (await tx('readonly', (s) => s.getAll())) as TripRoute[];
  const removeWhere = async (match: (r: TripRoute) => boolean) => {
    const ids = (await all()).filter(match).map((r) => r.tripId);
    for (const id of ids) await tx('readwrite', (s) => s.delete(id));
    return ids.length;
  };

  return {
    async save(route) {
      validateTripRoute(route);
      await tx('readwrite', (s) => s.put(route));
    },
    async get(tripId) {
      return ((await tx('readonly', (s) => s.get(tripId))) as TripRoute | undefined) ?? null;
    },
    async listTripIds(driverId) {
      const keys = await tx('readonly', (s) => s.index('driverId').getAllKeys(driverId));
      return keys.map(String);
    },
    async delete(tripId) {
      return (await removeWhere((r) => r.tripId === tripId)) > 0;
    },
    deleteByDriver: (driverId) => removeWhere((r) => r.driverId === driverId),
    purgeExpired: (now) => removeWhere((r) => Date.parse(r.expiresAt) <= now.getTime()),
    async clear() {
      await tx('readwrite', (s) => s.clear());
    },
  };
}
