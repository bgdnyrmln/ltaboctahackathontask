// Single entry point for the UI. Everything runs locally in the browser (no
// server, no network); methods are async so a real backend can replace this
// module later without touching screens.
import { createDemoSmartIdAuth } from './demoAuth.ts';
import type { DemoIdentityOption } from './demoAuth.ts';
import { demoSpeedProfile, recordDemoDrive } from './obd/demoDrive.ts';
import { createCsddMockRegistry } from './registry.ts';
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

export class NotSignedInError extends Error {
  constructor() {
    super('Sign in with a demo profile first');
    this.name = 'NotSignedInError';
  }
}

export const SESSION_KEY = 'octa.session.v1';
export const DELETED_KEY = 'octa.deleted.v1';
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
  deleteMyData(): Promise<{ tripsDeleted: number }>;
  resetDemo(): Promise<void>;
  recordDemoObdTrip(): Promise<TripSummary>; // simulated dongle, see OBD_DEMO_LABEL
}

export interface ApiOptions {
  storage?: KeyValueStorage;
  now?: () => Date;
  scoreFn?: ScoreFn; // Agent D plugs the final scoring in here
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
      const deleted = new Set(readList(storage, DELETED_KEY)).add(driver.id);
      safeSet(storage, DELETED_KEY, JSON.stringify([...deleted]));
      memorySession = null;
      safeSet(storage, SESSION_KEY, null);
      return { tripsDeleted };
    },

    async resetDemo() {
      safeSet(storage, DELETED_KEY, null);
      await trips.clear();
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
  };
}

let instance: OctaApi | null = null;

// App-wide instance backed by localStorage (memory if the browser blocks it).
export function getApi(): OctaApi {
  return (instance ??= createApi());
}
