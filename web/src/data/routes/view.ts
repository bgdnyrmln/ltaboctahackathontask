// Decodes a stored route into per-vertex points and event pins for a map.
// Shapes match B's TripReplayMap (RoutePoint / RouteEvent in telemetry/tripAnalysis.ts).
import { decodePolyline } from './polyline.ts';
import type { SpeedState, TripRoute } from './types.ts';

export interface RouteViewPoint {
  lat: number;
  lon: number;
  t: number; // ms since epoch
  kmh: number;
  limit: number;
  state: SpeedState;
}

export interface RouteViewEvent {
  lat: number;
  lon: number;
  kind: 'brake' | 'accel';
  t: number;
}

export function routeView(route: TripRoute, tripStartedAt: string): { points: RouteViewPoint[]; events: RouteViewEvent[] } {
  const start = Date.parse(tripStartedAt);
  const coords = decodePolyline(route.polyline);
  const state: SpeedState[] = [];
  for (const s of route.segments) for (let v = s.from; v <= s.to; v++) state[v] = s.state;
  const points = coords.map(([lat, lon], v) => ({
    lat,
    lon,
    t: start + route.tOffsetSec[v] * 1000,
    kmh: route.speedKmh[v],
    limit: route.limitKmh[v],
    state: state[v] ?? 'ok',
  }));
  const events = route.events.map((e) => ({
    lat: coords[e.vertex][0],
    lon: coords[e.vertex][1],
    kind: e.kind === 'harsh_brake' ? ('brake' as const) : ('accel' as const),
    t: start + e.tOffsetSec * 1000,
  }));
  return { points, events };
}
