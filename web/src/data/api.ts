// Single entry point for the UI. Everything runs locally in the browser (no
// server, no network); methods are async so a real backend can replace this
// module later without touching screens.
import { createDemoSmartIdAuth } from './demoAuth.ts';
import type { DemoIdentityOption } from './demoAuth.ts';
import { demoSpeedProfile, recordDemoDrive } from './obd/demoDrive.ts';
import { createCsddMockRegistry } from './registry.ts';
import { browserIndexedDb, createIndexedDbRouteRepository } from './routes/indexedDbStore.ts';
import { createMemoryRouteRepository } from './routes/memoryStore.ts';
import type { RouteRepository, TripRoute } from './routes/types.ts';
import { validateTripRoute } from './routes/validate.ts';
import { buildTrend, buildWeeklyReport } from './score/report.ts';
import { interimScore } from './score/interimScore.ts';
import type { ScoreFn, TrendPoint, WeeklyReport } from './score/types.ts';
import { defaultStorage } from './storage.ts';
import type { KeyValueStorage } from './storage.ts';
import { recentWeeks, weekRange, weekStartOf } from './time.ts';
import { generateDemoTrips } from './trips/generator.ts';
import { createPersistentTripRepository } from './trips/persistentStore.ts';
import type { TripSummary } from './trips/types.ts';
import type { Profile, SignInResult } from './types.ts';

// Routes are opt-in: saving one without the driver's consent is refused.
export class RouteConsentError extends Error {
  constructor() {
    super('Trip maps are off: the driver has not opted in to keeping routes');
    this.name = 'RouteConsentError';
  }
}

export class NotSignedInError extends Error {
  constructor() {
    super('Sign in with a demo profile first');
    this.name = 'NotSignedInError';
  }
}

export const SESSION_KEY = 'octa.session.v1';
export const DELETED_KEY = 'octa.deleted.v1';
export const ROUTE_CONSENT_KEY = 'octa.routeConsent.v1'; // driver ids that opted in
export const DEMO_WEEKS = 5; // current week plus four full weeks of history

export interface OctaApi {
  listDemoProfiles(): Promise<DemoIdentityOption[]>;
  signIn(demoId: string): Promise<SignInResult>;
  signOut(): Promise<void>;
  getSession(): Promise<Profile | null>;
  currentWeek(): string;
  getWeeklyReport(weekStart?: string): Promise<WeeklyReport>;
  getTrend(weeks?: number): Promise<TrendPoint[]>;
  listTrips(weekStart?: string): Promise<TripSummary[]>;
  saveTrip(trip: TripSummary): Promise<TripSummary>; // persists a phone-recorded trip
  deleteMyData(): Promise<{ tripsDeleted: number; routesDeleted: number }>;
  // Trip maps (opt-in, on this device only, expire after ROUTE_RETENTION_DAYS).
  getRouteConsent(): Promise<boolean>;
  setRouteConsent(on: boolean): Promise<{ routesDeleted: number }>; // off deletes the driver's routes
  saveTripRoute(route: TripRoute): Promise<void>; // RouteConsentError without consent
  getTripRoute(tripId: string): Promise<TripRoute | null>;
  deleteTripRoute(tripId: string): Promise<boolean>;
  listRouteTripIds(): Promise<string[]>; // trips of the signed-in driver that have a route
  purgeExpiredRoutes(): Promise<number>;
  resetDemo(): Promise<void>;
  recordDemoObdTrip(): Promise<TripSummary>; // simulated dongle, see OBD_DEMO_LABEL
}

export interface ApiOptions {
  storage?: KeyValueStorage;
  now?: () => Date;
  scoreFn?: ScoreFn; // Agent D plugs the final scoring in here
  routes?: RouteRepository; // default: IndexedDB in the browser, memory elsewhere
}

function readList(storage: KeyValueStorage, key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function safeSet(storage: KeyValueStorage, key: string, value: string | null) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // blocked storage: state lives in memory for this session only
  }
}

export function createApi(options: ApiOptions = {}): OctaApi {
  const storage = options.storage ?? defaultStorage();
  const now = options.now ?? (() => new Date());
  const scoreFn = options.scoreFn ?? interimScore;

  const registry = createCsddMockRegistry();
  const auth = createDemoSmartIdAuth(registry);
  const trips = createPersistentTripRepository(storage);
  const idb = browserIndexedDb();
  const routes = options.routes ?? (idb ? createIndexedDbRouteRepository(idb) : createMemoryRouteRepository());
  let purging: Promise<number> | null = null;
  const purgeOnce = () => (purging ??= routes.purgeExpired(now()));
  const consented = () => new Set(readList(storage, ROUTE_CONSENT_KEY));
  let memorySession: string | null = null;

  // Top up synthetic trips for the recent weeks. Generation is deterministic
  // and save upserts by id, so this is idempotent; drivers who deleted their
  // data are skipped until resetDemo.
  let seeding: Promise<void> | null = null;
  const ensureSeeded = () =>
    (seeding ??= (async () => {
      const deleted = new Set(readList(storage, DELETED_KEY));
      const at = now();
      const generated = generateDemoTrips(recentWeeks(at, DEMO_WEEKS), at);
      await trips.save(generated.filter((t) => !deleted.has(t.driverId)));
    })());

  const sessionId = (): string | null => {
    try {
      return storage.getItem(SESSION_KEY) ?? memorySession;
    } catch {
      return memorySession;
    }
  };

  const requireProfile = async (): Promise<Profile> => {
    const demoId = sessionId();
    if (!demoId) throw new NotSignedInError();
    const res = await auth.signIn(demoId);
    if (!res.ok) {
      safeSet(storage, SESSION_KEY, null);
      memorySession = null;
      throw new NotSignedInError();
    }
    return res.profile;
  };

  const driverTrips = async (driverId: string) => {
    await ensureSeeded();
    return trips.list({ driverId });
  };

  return {
    listDemoProfiles: () => auth.listDemoIdentities(),

    async signIn(demoId) {
      const res = await auth.signIn(demoId);
      if (res.ok) {
        memorySession = demoId.trim();
        safeSet(storage, SESSION_KEY, memorySession);
      }
      return res;
    },

    async signOut() {
      memorySession = null;
      safeSet(storage, SESSION_KEY, null);
    },

    async getSession() {
      try {
        return await requireProfile();
      } catch (err) {
        if (err instanceof NotSignedInError) return null;
        throw err;
      }
    },

    currentWeek: () => weekStartOf(now()),

    async getWeeklyReport(weekStart = weekStartOf(now())) {
      const { driver } = await requireProfile();
      return buildWeeklyReport(weekStart, await driverTrips(driver.id), scoreFn);
    },

    async getTrend(weeks = 4) {
      const { driver } = await requireProfile();
      return buildTrend(recentWeeks(now(), weeks), await driverTrips(driver.id), scoreFn);
    },

    async listTrips(weekStart = weekStartOf(now())) {
      const { driver } = await requireProfile();
      await ensureSeeded();
      return trips.list({ driverId: driver.id, ...weekRange(weekStart) });
    },

    async deleteMyData() {
      const { driver } = await requireProfile();
      await ensureSeeded();
      const tripsDeleted = await trips.deleteByDriver(driver.id);
      const routesDeleted = await routes.deleteByDriver(driver.id);
      const consent = consented();
      consent.delete(driver.id);
      safeSet(storage, ROUTE_CONSENT_KEY, JSON.stringify([...consent]));
      const deleted = new Set(readList(storage, DELETED_KEY)).add(driver.id);
      safeSet(storage, DELETED_KEY, JSON.stringify([...deleted]));
      memorySession = null;
      safeSet(storage, SESSION_KEY, null);
      return { tripsDeleted, routesDeleted };
    },

    async resetDemo() {
      safeSet(storage, DELETED_KEY, null);
      safeSet(storage, ROUTE_CONSENT_KEY, null);
      await trips.clear();
      await routes.clear();
      seeding = null;
      await ensureSeeded();
    },

    async recordDemoObdTrip() {
      const { driver, vehicles } = await requireProfile();
      await ensureSeeded();
      const durationMs = demoSpeedProfile().length * 1000;
      const trip = await recordDemoDrive({
        driverId: driver.id,
        vehicleId: vehicles[0]?.id ?? null,
        startedAt: new Date(now().getTime() - durationMs),
      });
      await trips.save([trip]);
      return trip;
    },

    async getRouteConsent() {
      const { driver } = await requireProfile();
      return consented().has(driver.id);
    },

    async setRouteConsent(on) {
      const { driver } = await requireProfile();
      const consent = consented();
      if (on) consent.add(driver.id);
      else consent.delete(driver.id);
      safeSet(storage, ROUTE_CONSENT_KEY, JSON.stringify([...consent]));
      return { routesDeleted: on ? 0 : await routes.deleteByDriver(driver.id) };
    },

    // Throws RouteValidationError on bad data or a route that does not fit its trip.
    async saveTripRoute(route) {
      const { driver } = await requireProfile();
      if (route.driverId !== driver.id) throw new Error(`Route ${route.tripId} belongs to another driver`);
      if (!consented().has(driver.id)) throw new RouteConsentError();
      const trip = await trips.get(route.tripId);
      if (!trip) throw new Error(`Trip ${route.tripId} is not saved; save the trip first`);
      validateTripRoute(route, trip);
      await routes.save(route);
    },

    async getTripRoute(tripId) {
      const { driver } = await requireProfile();
      await purgeOnce();
      const route = await routes.get(tripId);
      if (!route || route.driverId !== driver.id) return null;
      if (Date.parse(route.expiresAt) <= now().getTime()) {
        await routes.delete(tripId);
        return null;
      }
      return route;
    },

    async deleteTripRoute(tripId) {
      const { driver } = await requireProfile();
      const route = await routes.get(tripId);
      return route?.driverId === driver.id ? routes.delete(tripId) : false;
    },

    async listRouteTripIds() {
      const { driver } = await requireProfile();
      await purgeOnce();
      return routes.listTripIds(driver.id);
    },

    async purgeExpiredRoutes() {
      purging = null;
      return purgeOnce();
    },

    // Only the signed-in driver's own trips; throws TripValidationError on bad data.
    async saveTrip(trip) {
      const { driver } = await requireProfile();
      if (trip.driverId !== driver.id) throw new Error(`Trip ${trip.id} belongs to another driver`);
      await ensureSeeded();
      await trips.save([trip]);
      return trip;
    },
  };
}

let instance: OctaApi | null = null;

// App-wide instance backed by localStorage (memory if the browser blocks it).
export function getApi(): OctaApi {
  return (instance ??= createApi());
}
