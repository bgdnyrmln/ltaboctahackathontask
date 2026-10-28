// Speed limit map: road segments (polylines) and area zones (polygons) with a
// posted limit. Lookups run per GPS sample, fully offline.
export interface LatLon {
  lat: number;
  lon: number;
}

export const ROAD_KINDS = ['residential', 'urban', 'arterial', 'rural', 'motorway'] as const;
export type RoadKind = (typeof ROAD_KINDS)[number];

export interface SpeedLimitFeature {
  id: string;
  type: 'segment' | 'zone'; // segment = polyline along a road, zone = area default
  name: string;
  kind: RoadKind;
  limitKmh: number;
  points: LatLon[]; // segment: >= 2 points; zone: >= 3 points, ring closed implicitly
}

export interface SpeedLimitHit {
  limitKmh: number;
  source: 'map'; // matches TripSummary.speedLimitSource
  kind: RoadKind;
  featureId: string;
  name: string;
  matchedBy: 'segment' | 'zone';
  distanceM: number; // to the segment; 0 inside a zone
}

export interface SpeedLimitMap {
  // null = no map coverage here: fall back to the road-type default.
  lookup(lat: number, lon: number): SpeedLimitHit | null;
  features(): SpeedLimitFeature[];
}
