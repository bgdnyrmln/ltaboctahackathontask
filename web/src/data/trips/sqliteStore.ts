import type { TripQuery, TripRepository, TripSummary } from './types.ts';
import { validateTrip } from './validate.ts';

// Minimal async SQL surface. expo-sqlite's SQLiteDatabase maps onto it
// directly (execAsync / runAsync / getAllAsync); tests use node:sqlite.
export interface SqlDriver {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
}

export type SqlValue = string | number | null;

export const SCHEMA_VERSION = 4;

// Columns added after the first release; older databases get them via ALTER
// TABLE so existing rows load with 0.
const ADDED_COLUMNS: [name: string, ddl: string][] = [
  ['max_continuous_min', 'REAL NOT NULL DEFAULT 0 CHECK (max_continuous_min >= 0)'],
  ['sec_over_pct_10', 'REAL NOT NULL DEFAULT 0 CHECK (sec_over_pct_10 >= 0)'],
  ['sec_over_pct_20', 'REAL NOT NULL DEFAULT 0 CHECK (sec_over_pct_20 >= 0)'],
  ['sec_over_pct_40', 'REAL NOT NULL DEFAULT 0 CHECK (sec_over_pct_40 >= 0)'],
  ['sec_phone_use', 'REAL NOT NULL DEFAULT 0 CHECK (sec_phone_use >= 0)'],
];

export const TRIP_SCHEMA = `
CREATE TABLE IF NOT EXISTS trip_summary (
  id                 TEXT PRIMARY KEY NOT NULL,
  driver_id          TEXT NOT NULL,
  vehicle_id         TEXT,
  started_at         TEXT NOT NULL,
  ended_at           TEXT NOT NULL,
  distance_km        REAL NOT NULL CHECK (distance_km >= 0),
  driving_sec        REAL NOT NULL CHECK (driving_sec >= 0),
  sec_over_limit     REAL NOT NULL CHECK (sec_over_limit >= 0),
  sec_over_10        REAL NOT NULL CHECK (sec_over_10 >= 0),
  sec_over_20        REAL NOT NULL CHECK (sec_over_20 >= 0),
  sec_over_pct_10    REAL NOT NULL DEFAULT 0 CHECK (sec_over_pct_10 >= 0),
  sec_over_pct_20    REAL NOT NULL DEFAULT 0 CHECK (sec_over_pct_20 >= 0),
  sec_over_pct_40    REAL NOT NULL DEFAULT 0 CHECK (sec_over_pct_40 >= 0),
  sec_phone_use      REAL NOT NULL DEFAULT 0 CHECK (sec_phone_use >= 0),
  harsh_brake_count  INTEGER NOT NULL CHECK (harsh_brake_count >= 0),
  harsh_accel_count  INTEGER NOT NULL CHECK (harsh_accel_count >= 0),
  night_km           REAL NOT NULL CHECK (night_km >= 0),
  max_continuous_min REAL NOT NULL CHECK (max_continuous_min >= 0),
  coverage           REAL NOT NULL CHECK (coverage BETWEEN 0 AND 1),
  speed_limit_source TEXT NOT NULL,
  source             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS trip_summary_driver_start
  ON trip_summary (driver_id, started_at);
`;

interface TripRow {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  started_at: string;
  ended_at: string;
  distance_km: number;
  driving_sec: number;
  sec_over_limit: number;
  sec_over_10: number;
  sec_over_20: number;
  sec_over_pct_10: number;
  sec_over_pct_20: number;
  sec_over_pct_40: number;
  sec_phone_use: number;
  harsh_brake_count: number;
  harsh_accel_count: number;
  night_km: number;
  max_continuous_min: number;
  coverage: number;
  speed_limit_source: TripSummary['speedLimitSource'];
  source: TripSummary['source'];
}

const fromRow = (r: TripRow): TripSummary => ({
  id: r.id,
  driverId: r.driver_id,
  vehicleId: r.vehicle_id,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  distanceKm: r.distance_km,
  drivingSec: r.driving_sec,
  secOverLimit: r.sec_over_limit,
  secOver10: r.sec_over_10,
  secOver20: r.sec_over_20,
  secOverPct10: r.sec_over_pct_10,
  secOverPct20: r.sec_over_pct_20,
  secOverPct40: r.sec_over_pct_40,
  secPhoneUse: r.sec_phone_use,
  harshBrakeCount: r.harsh_brake_count,
  harshAccelCount: r.harsh_accel_count,
  nightKm: r.night_km,
  maxContinuousMin: r.max_continuous_min,
  coverage: r.coverage,
  speedLimitSource: r.speed_limit_source,
  source: r.source,
});

const toParams = (t: TripSummary): SqlValue[] => [
  t.id,
  t.driverId,
  t.vehicleId,
  t.startedAt,
  t.endedAt,
  t.distanceKm,
  t.drivingSec,
  t.secOverLimit,
  t.secOver10,
  t.secOver20,
  t.secOverPct10,
  t.secOverPct20,
  t.secOverPct40,
  t.secPhoneUse,
  t.harshBrakeCount,
  t.harshAccelCount,
  t.nightKm,
  t.maxContinuousMin,
  t.coverage,
  t.speedLimitSource,
  t.source,
];

const UPSERT = `INSERT OR REPLACE INTO trip_summary (
  id, driver_id, vehicle_id, started_at, ended_at, distance_km, driving_sec,
  sec_over_limit, sec_over_10, sec_over_20, sec_over_pct_10, sec_over_pct_20,
  sec_over_pct_40, sec_phone_use, harsh_brake_count, harsh_accel_count, night_km,
  max_continuous_min, coverage, speed_limit_source, source
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// Timestamps are compared as epoch ms so mixed ISO offsets order correctly.
export async function createSqliteTripRepository(db: SqlDriver): Promise<TripRepository> {
  await db.exec(TRIP_SCHEMA);
  const existing = new Set((await db.all<{ name: string }>('PRAGMA table_info(trip_summary)')).map((c) => c.name));
  for (const [name, ddl] of ADDED_COLUMNS) {
    if (!existing.has(name)) await db.exec(`ALTER TABLE trip_summary ADD COLUMN ${name} ${ddl}`);
  }
  await db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);

  return {
    async save(batch) {
      batch.forEach(validateTrip); // validate all before writing any
      await db.exec('BEGIN');
      try {
        for (const t of batch) await db.run(UPSERT, toParams(t));
        await db.exec('COMMIT');
      } catch (err) {
        await db.exec('ROLLBACK');
        throw err;
      }
    },
    async get(id) {
      const rows = await db.all<TripRow>('SELECT * FROM trip_summary WHERE id = ?', [id]);
      return rows[0] ? fromRow(rows[0]) : null;
    },
    async list(query: TripQuery = {}) {
      const where: string[] = [];
      const params: SqlValue[] = [];
      if (query.driverId !== undefined) {
        where.push('driver_id = ?');
        params.push(query.driverId);
      }
      if (query.from !== undefined) {
        where.push("unixepoch(started_at, 'subsec') >= unixepoch(?, 'subsec')");
        params.push(query.from);
      }
      if (query.to !== undefined) {
        where.push("unixepoch(started_at, 'subsec') < unixepoch(?, 'subsec')");
        params.push(query.to);
      }
      const sql =
        'SELECT * FROM trip_summary' +
        (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
        " ORDER BY unixepoch(started_at, 'subsec'), id";
      return (await db.all<TripRow>(sql, params)).map(fromRow);
    },
    async deleteByDriver(driverId) {
      const before = await db.all<{ n: number }>(
        'SELECT COUNT(*) AS n FROM trip_summary WHERE driver_id = ?',
        [driverId],
      );
      await db.run('DELETE FROM trip_summary WHERE driver_id = ?', [driverId]);
      return before[0]?.n ?? 0;
    },
    async clear() {
      await db.run('DELETE FROM trip_summary');
    },
  };
}
