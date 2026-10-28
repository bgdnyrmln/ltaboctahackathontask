// Native (Capacitor / expo-sqlite) store over the same SqlDriver as trips.
import type { SqlDriver, SqlValue } from '../trips/sqliteStore.ts';
import type { RouteRepository, TripRoute } from './types.ts';
import { validateTripRoute } from './validate.ts';

export const ROUTE_SCHEMA = `
CREATE TABLE IF NOT EXISTS trip_route (
  trip_id         TEXT PRIMARY KEY NOT NULL,
  driver_id       TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  polyline        TEXT NOT NULL,
  t_offset_sec    TEXT NOT NULL,
  speed_kmh       TEXT NOT NULL,
  limit_kmh       TEXT NOT NULL,
  segments        TEXT NOT NULL,
  events          TEXT NOT NULL,
  bbox            TEXT NOT NULL,
  limit_source    TEXT NOT NULL,
  trimmed_start_m REAL NOT NULL DEFAULT 0,
  trimmed_end_m   REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS trip_route_driver ON trip_route (driver_id, created_at);
`;

interface RouteRow {
  trip_id: string;
  driver_id: string;
  version: number;
  created_at: string;
  expires_at: string;
  polyline: string;
  t_offset_sec: string;
  speed_kmh: string;
  limit_kmh: string;
  segments: string;
  events: string;
  bbox: string;
  limit_source: TripRoute['limitSource'];
  trimmed_start_m: number;
  trimmed_end_m: number;
}

const fromRow = (r: RouteRow): TripRoute => ({
  tripId: r.trip_id,
  driverId: r.driver_id,
  version: 1,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  polyline: r.polyline,
  tOffsetSec: JSON.parse(r.t_offset_sec),
  speedKmh: JSON.parse(r.speed_kmh),
  limitKmh: JSON.parse(r.limit_kmh),
  segments: JSON.parse(r.segments),
  events: JSON.parse(r.events),
  bbox: JSON.parse(r.bbox),
  privacy: { trimmedStartM: r.trimmed_start_m, trimmedEndM: r.trimmed_end_m },
  limitSource: r.limit_source,
});

const toParams = (r: TripRoute): SqlValue[] => [
  r.tripId,
  r.driverId,
  r.version,
  r.createdAt,
  r.expiresAt,
  r.polyline,
  JSON.stringify(r.tOffsetSec),
  JSON.stringify(r.speedKmh),
  JSON.stringify(r.limitKmh),
  JSON.stringify(r.segments),
  JSON.stringify(r.events),
  JSON.stringify(r.bbox),
  r.limitSource,
  r.privacy.trimmedStartM,
  r.privacy.trimmedEndM,
];

const UPSERT = `INSERT OR REPLACE INTO trip_route (
  trip_id, driver_id, version, created_at, expires_at, polyline, t_offset_sec,
  speed_kmh, limit_kmh, segments, events, bbox, limit_source, trimmed_start_m, trimmed_end_m
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const count = async (db: SqlDriver, where: string, params: SqlValue[]) =>
  (await db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM trip_route WHERE ${where}`, params))[0]?.n ?? 0;

export async function createSqliteRouteRepository(db: SqlDriver): Promise<RouteRepository> {
  await db.exec(ROUTE_SCHEMA);
  return {
    async save(route) {
      validateTripRoute(route);
      await db.run(UPSERT, toParams(route));
    },
    async get(tripId) {
      const rows = await db.all<RouteRow>('SELECT * FROM trip_route WHERE trip_id = ?', [tripId]);
      return rows[0] ? fromRow(rows[0]) : null;
    },
    async listTripIds(driverId) {
      const rows = await db.all<{ trip_id: string }>(
        'SELECT trip_id FROM trip_route WHERE driver_id = ? ORDER BY created_at',
        [driverId],
      );
      return rows.map((r) => r.trip_id);
    },
    async delete(tripId) {
      const n = await count(db, 'trip_id = ?', [tripId]);
      await db.run('DELETE FROM trip_route WHERE trip_id = ?', [tripId]);
      return n > 0;
    },
    async deleteByDriver(driverId) {
      const n = await count(db, 'driver_id = ?', [driverId]);
      await db.run('DELETE FROM trip_route WHERE driver_id = ?', [driverId]);
      return n;
    },
    async purgeExpired(now) {
      const where = "unixepoch(expires_at, 'subsec') <= unixepoch(?, 'subsec')";
      const n = await count(db, where, [now.toISOString()]);
      await db.run(`DELETE FROM trip_route WHERE ${where}`, [now.toISOString()]);
      return n;
    },
    async clear() {
      await db.run('DELETE FROM trip_route');
    },
  };
}
