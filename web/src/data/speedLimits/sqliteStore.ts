import type { SqlDriver } from '../trips/sqliteStore.ts';
import { bboxOf, createSpeedLimitMap, SpeedLimitDataError, validateSpeedLimitFeatures } from './map.ts';
import type { LatLon, RoadKind, SpeedLimitFeature, SpeedLimitMap } from './types.ts';

// Static reference table, same SqlDriver as the trip store. Points are kept
// as JSON; the bbox columns let a bigger import (e.g. OSM) be queried by area.
export const SPEED_LIMIT_SCHEMA = `
CREATE TABLE IF NOT EXISTS speed_limit_feature (
  id        TEXT PRIMARY KEY NOT NULL,
  type      TEXT NOT NULL CHECK (type IN ('segment', 'zone')),
  name      TEXT NOT NULL,
  kind      TEXT NOT NULL,
  limit_kmh INTEGER NOT NULL CHECK (limit_kmh BETWEEN 5 AND 130),
  points    TEXT NOT NULL,
  min_lat   REAL NOT NULL,
  max_lat   REAL NOT NULL,
  min_lon   REAL NOT NULL,
  max_lon   REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS speed_limit_feature_bbox
  ON speed_limit_feature (min_lat, max_lat, min_lon, max_lon);
`;

interface FeatureRow {
  id: string;
  type: 'segment' | 'zone';
  name: string;
  kind: string;
  limit_kmh: number;
  points: string;
}

export async function initSpeedLimitSchema(db: SqlDriver): Promise<void> {
  await db.exec(SPEED_LIMIT_SCHEMA);
}

// Upserts all features in one transaction; invalid input writes nothing.
export async function saveSpeedLimitFeatures(db: SqlDriver, features: SpeedLimitFeature[]): Promise<void> {
  const problems = validateSpeedLimitFeatures(features);
  if (problems.length) throw new SpeedLimitDataError(problems);
  await db.exec('BEGIN');
  try {
    for (const f of features) {
      const box = bboxOf(f.points);
      await db.run(
        `INSERT OR REPLACE INTO speed_limit_feature
           (id, type, name, kind, limit_kmh, points, min_lat, max_lat, min_lon, max_lon)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [f.id, f.type, f.name, f.kind, f.limitKmh, JSON.stringify(f.points), box.minLat, box.maxLat, box.minLon, box.maxLon],
      );
    }
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}

// Loads every feature, or only those whose bbox overlaps `area`.
export async function loadSpeedLimitFeatures(
  db: SqlDriver,
  area?: { minLat: number; maxLat: number; minLon: number; maxLon: number },
): Promise<SpeedLimitFeature[]> {
  const rows = area
    ? await db.all<FeatureRow>(
        `SELECT * FROM speed_limit_feature
          WHERE max_lat >= ? AND min_lat <= ? AND max_lon >= ? AND min_lon <= ?
          ORDER BY id`,
        [area.minLat, area.maxLat, area.minLon, area.maxLon],
      )
    : await db.all<FeatureRow>('SELECT * FROM speed_limit_feature ORDER BY id');
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    kind: r.kind as RoadKind,
    limitKmh: r.limit_kmh,
    points: JSON.parse(r.points) as LatLon[],
  }));
}

export async function loadSpeedLimitMap(db: SqlDriver): Promise<SpeedLimitMap> {
  return createSpeedLimitMap(await loadSpeedLimitFeatures(db));
}
