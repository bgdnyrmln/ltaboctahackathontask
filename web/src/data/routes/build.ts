// Builds a TripRoute from a finished trip's fixes. Pure: the recorder passes
// what it already has (position, speed, limit) and saves the result next to
// the TripSummary. Raw fixes are not kept.
import { harshEvents } from '../obd/aggregate.ts';
import { isSlowSpeed, speedingBands, TOO_SLOW_AFTER_MS } from '../trips/speeding.ts';
import type { TripSummary } from '../trips/types.ts';
import { encodePolyline } from './polyline.ts';
import type { RouteSegment, SpeedState, TripRoute, TripRouteEvent } from './types.ts';
import { ROUTE_RETENTION_DAYS, ROUTE_SIMPLIFY_M, ROUTE_TRIM_M } from './types.ts';

export interface RouteFix {
  t: number; // ms since epoch
  lat: number;
  lon: number;
  speedKmh: number;
  limitKmh: number;
}

export interface BuildRouteOptions {
  trip: TripSummary;
  fixes: RouteFix[];
  now?: Date;
  trimM?: number;
  simplifyM?: number;
}

const EARTH_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

// Same rule as the recorder and the live map: over = above limit + tolerance,
// slow = under half the limit for at least TOO_SLOW_AFTER_MS.
export function speedStates(fixes: RouteFix[]): SpeedState[] {
  let slowSince: number | null = null;
  return fixes.map((f) => {
    slowSince = isSlowSpeed(f.speedKmh, f.limitKmh) ? (slowSince ?? f.t) : null;
    if (speedingBands(f.speedKmh, f.limitKmh).overLimit) return 'over';
    return slowSince !== null && f.t - slowSince >= TOO_SLOW_AFTER_MS ? 'slow' : 'ok';
  });
}

// Douglas-Peucker on a local flat projection; keeps both ends.
function simplify(points: RouteFix[], from: number, to: number, tolM: number, keep: Set<number>) {
  keep.add(from);
  keep.add(to);
  if (to - from < 2) return;
  const lat0 = rad(points[from].lat);
  const xy = (p: RouteFix) => [rad(p.lon) * Math.cos(lat0) * EARTH_M, rad(p.lat) * EARTH_M];
  const [ax, ay] = xy(points[from]);
  const [bx, by] = xy(points[to]);
  const len = Math.hypot(bx - ax, by - ay);
  let worst = -1;
  let worstM = 0;
  for (let i = from + 1; i < to; i++) {
    const [px, py] = xy(points[i]);
    const d = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
    if (d > worstM) {
      worstM = d;
      worst = i;
    }
  }
  if (worst >= 0 && worstM > tolM) {
    simplify(points, from, worst, tolM, keep);
    simplify(points, worst, to, tolM, keep);
  }
}

// null when nothing is left after the privacy trim (trip shorter than 2 x trimM).
export function buildTripRoute(o: BuildRouteOptions): TripRoute | null {
  const trimM = o.trimM ?? ROUTE_TRIM_M;
  const simplifyM = o.simplifyM ?? ROUTE_SIMPLIFY_M;
  const all = o.fixes
    .filter((f) => [f.t, f.lat, f.lon, f.speedKmh, f.limitKmh].every(Number.isFinite))
    .sort((a, b) => a.t - b.t);
  if (all.length < 2) return null;

  const allStates = speedStates(all);
  const cum = [0];
  for (let i = 1; i < all.length; i++) cum.push(cum[i - 1] + distanceM(all[i - 1], all[i]));
  const total = cum[cum.length - 1];
  const keptIdx = all.map((_, i) => i).filter((i) => cum[i] >= trimM && total - cum[i] >= trimM);
  if (keptIdx.length < 2) return null;
  const first = keptIdx[0];
  const last = keptIdx[keptIdx.length - 1];
  const fixes = all.slice(first, last + 1);
  const states = allStates.slice(first, last + 1);

  // Simplify each run of one state separately so state changes stay exact.
  const keep = new Set<number>();
  let runStart = 0;
  for (let i = 1; i <= fixes.length; i++) {
    if (i === fixes.length || states[i] !== states[runStart]) {
      simplify(fixes, runStart, i - 1, simplifyM, keep);
      runStart = i;
    }
  }
  const idx = [...keep].sort((a, b) => a - b);
  const verts = idx.map((i) => fixes[i]);
  const vStates = idx.map((i) => states[i]);

  const start = Date.parse(o.trip.startedAt);
  const offset = (t: number) => Math.max(0, Math.round((t - start) / 100) / 10);

  const segments: RouteSegment[] = [];
  vStates.forEach((state, v) => {
    const over = state === 'over' ? Math.max(0, Math.round(verts[v].speedKmh - verts[v].limitKmh)) : 0;
    const seg = segments[segments.length - 1];
    if (seg && seg.state === state) {
      seg.to = v;
      seg.maxOverKmh = Math.max(seg.maxOverKmh, over);
    } else {
      segments.push({ from: v, to: v, state, maxOverKmh: over });
    }
  });

  const tFirst = verts[0].t;
  const tLast = verts[verts.length - 1].t;
  const events: TripRouteEvent[] = harshEvents(all.map((f) => ({ t: f.t, speedKmh: f.speedKmh })))
    .filter((e) => e.t >= tFirst && e.t <= tLast)
    .map((e) => {
      let vertex = 0;
      verts.forEach((p, v) => {
        if (Math.abs(p.t - e.t) < Math.abs(verts[vertex].t - e.t)) vertex = v;
      });
      return { kind: e.kind, vertex, tOffsetSec: offset(e.t), valueMs2: e.valueMs2 };
    });

  // Same 1e-5 rounding as the polyline, so decoded vertices sit inside the bbox.
  const r5 = (x: number) => Math.round(x * 1e5) / 1e5;
  const lats = verts.map((p) => r5(p.lat));
  const lons = verts.map((p) => r5(p.lon));
  const created = o.now ?? new Date();
  return {
    tripId: o.trip.id,
    driverId: o.trip.driverId,
    version: 1,
    createdAt: created.toISOString(),
    expiresAt: new Date(created.getTime() + ROUTE_RETENTION_DAYS * 86_400_000).toISOString(),
    polyline: encodePolyline(verts.map((p) => [p.lat, p.lon])),
    tOffsetSec: verts.map((p) => offset(p.t)),
    speedKmh: verts.map((p) => Math.round(p.speedKmh)),
    limitKmh: verts.map((p) => Math.round(p.limitKmh)),
    segments,
    events,
    bbox: [Math.min(...lats), Math.min(...lons), Math.max(...lats), Math.max(...lons)],
    privacy: { trimmedStartM: Math.round(cum[first]), trimmedEndM: Math.round(total - cum[last]) },
    limitSource: o.trip.speedLimitSource,
  };
}
