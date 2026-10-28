import { ROAD_KINDS } from './types.ts';
import type { LatLon, SpeedLimitFeature, SpeedLimitHit, SpeedLimitMap } from './types.ts';

// A GPS fix within this distance of a segment counts as being on that road.
// Phone accuracy is ~5-15 m and the recorder drops fixes worse than 30 m.
export const SEGMENT_MATCH_M = 25;

const EARTH_M = 6_371_000;
const RAD = Math.PI / 180;

export class SpeedLimitDataError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Invalid speed limit data: ${problems.join('; ')}`);
    this.name = 'SpeedLimitDataError';
    this.problems = problems;
  }
}

export function validateSpeedLimitFeatures(features: SpeedLimitFeature[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    const at = `feature ${f.id || '(no id)'}`;
    if (!f.id) problems.push(`${at}: missing id`);
    else if (seen.has(f.id)) problems.push(`${at}: duplicate id`);
    seen.add(f.id);
    if (f.type !== 'segment' && f.type !== 'zone') problems.push(`${at}: type must be segment or zone`);
    if (!ROAD_KINDS.includes(f.kind)) problems.push(`${at}: unknown kind ${String(f.kind)}`);
    if (!Number.isInteger(f.limitKmh) || f.limitKmh < 5 || f.limitKmh > 130) {
      problems.push(`${at}: limitKmh must be an integer 5-130`);
    }
    const min = f.type === 'zone' ? 3 : 2;
    if (!Array.isArray(f.points) || f.points.length < min) {
      problems.push(`${at}: needs at least ${min} points`);
    } else if (f.points.some((p) => !(Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180))) {
      problems.push(`${at}: coordinates out of range`);
    }
  }
  return problems;
}

interface Bbox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export function bboxOf(points: LatLon[]): Bbox {
  return {
    minLat: Math.min(...points.map((p) => p.lat)),
    maxLat: Math.max(...points.map((p) => p.lat)),
    minLon: Math.min(...points.map((p) => p.lon)),
    maxLon: Math.max(...points.map((p) => p.lon)),
  };
}

// Local flat projection in metres around the query point; exact enough at
// city scale (errors well under 1 m for distances below a few km).
function project(origin: LatLon, p: LatLon) {
  return {
    x: (p.lon - origin.lon) * RAD * EARTH_M * Math.cos(origin.lat * RAD),
    y: (p.lat - origin.lat) * RAD * EARTH_M,
  };
}

export function distanceToPolylineM(q: LatLon, points: LatLon[]): number {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = project(q, points[i - 1]);
    const b = project(q, points[i]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2));
    best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return best;
}

export function pointInPolygon(q: LatLon, ring: LatLon[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.lat > q.lat !== b.lat > q.lat && q.lon < ((b.lon - a.lon) * (q.lat - a.lat)) / (b.lat - a.lat) + a.lon) {
      inside = !inside;
    }
  }
  return inside;
}

// Approximate polygon area in degrees², only used to pick the innermost zone.
function ringArea(ring: LatLon[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j].lon + ring[i].lon) * (ring[j].lat - ring[i].lat);
  }
  return Math.abs(sum / 2);
}

// Lookup order: nearest segment within SEGMENT_MATCH_M, else the smallest
// zone containing the point (a 30 km/h zone inside the city wins over the
// city-wide 50), else null.
export function createSpeedLimitMap(features: SpeedLimitFeature[]): SpeedLimitMap {
  const problems = validateSpeedLimitFeatures(features);
  if (problems.length) throw new SpeedLimitDataError(problems);

  const pad = (SEGMENT_MATCH_M / EARTH_M) / RAD; // match radius in degrees of latitude
  const indexed = features.map((f) => ({ f, box: bboxOf(f.points), area: f.type === 'zone' ? ringArea(f.points) : 0 }));
  const segments = indexed.filter((x) => x.f.type === 'segment');
  const zones = indexed.filter((x) => x.f.type === 'zone').sort((a, b) => a.area - b.area);

  const hit = (f: SpeedLimitFeature, matchedBy: 'segment' | 'zone', distanceM: number): SpeedLimitHit => ({
    limitKmh: f.limitKmh,
    source: 'map',
    kind: f.kind,
    featureId: f.id,
    name: f.name,
    matchedBy,
    distanceM: Math.round(distanceM * 10) / 10,
  });

  return {
    lookup(lat, lon) {
      const q = { lat, lon };
      const lonPad = pad / Math.max(0.01, Math.cos(lat * RAD));
      let best: { f: SpeedLimitFeature; d: number } | null = null;
      for (const { f, box } of segments) {
        if (lat < box.minLat - pad || lat > box.maxLat + pad || lon < box.minLon - lonPad || lon > box.maxLon + lonPad) continue;
        const d = distanceToPolylineM(q, f.points);
        if (d <= SEGMENT_MATCH_M && (!best || d < best.d)) best = { f, d };
      }
      if (best) return hit(best.f, 'segment', best.d);

      for (const { f, box } of zones) {
        if (lat < box.minLat || lat > box.maxLat || lon < box.minLon || lon > box.maxLon) continue;
        if (pointInPolygon(q, f.points)) return hit(f, 'zone', 0);
      }
      return null;
    },
    features: () => features.map((f) => ({ ...f, points: f.points.map((p) => ({ ...p })) })),
  };
}
