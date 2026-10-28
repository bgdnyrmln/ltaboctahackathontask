import type { SpeedLimitFeature } from './types.ts';

// ILLUSTRATIVE demo data for Riga, hand-drawn with approximate coordinates.
// Not official limits and not road-accurate: it exists so the app can show
// "limit from map" in the demo. A real build would import OpenStreetMap
// `maxspeed` tags (ODbL, attribution required) into the same table.
export const SPEED_MAP_DEMO_LABEL = 'Speed limits: illustrative demo map, not official';

export const SEED_SPEED_LIMITS: SpeedLimitFeature[] = [
  {
    id: 'zone-riga',
    type: 'zone',
    name: 'Riga built-up area',
    kind: 'urban',
    limitKmh: 50,
    points: [
      { lat: 56.87, lon: 23.95 },
      { lat: 57.08, lon: 23.95 },
      { lat: 57.08, lon: 24.33 },
      { lat: 56.87, lon: 24.33 },
    ],
  },
  {
    id: 'zone-old-town',
    type: 'zone',
    name: 'Old Riga',
    kind: 'residential',
    limitKmh: 30,
    points: [
      { lat: 56.9440, lon: 24.1000 },
      { lat: 56.9520, lon: 24.1000 },
      { lat: 56.9520, lon: 24.1150 },
      { lat: 56.9440, lon: 24.1150 },
    ],
  },
  {
    id: 'seg-krasta',
    type: 'segment',
    name: 'Krasta iela',
    kind: 'arterial',
    limitKmh: 70,
    points: [
      { lat: 56.9425, lon: 24.1110 },
      { lat: 56.9380, lon: 24.1280 },
      { lat: 56.9330, lon: 24.1450 },
    ],
  },
  {
    id: 'seg-brivibas',
    type: 'segment',
    name: 'Brivibas iela',
    kind: 'urban',
    limitKmh: 50,
    points: [
      { lat: 56.9530, lon: 24.1150 },
      { lat: 56.9650, lon: 24.1380 },
      { lat: 56.9800, lon: 24.1650 },
    ],
  },
  {
    id: 'seg-a1-north',
    type: 'segment',
    name: 'A1 towards Adazi',
    kind: 'motorway',
    limitKmh: 100,
    points: [
      { lat: 57.0300, lon: 24.1700 },
      { lat: 57.0550, lon: 24.2350 },
      { lat: 57.0800, lon: 24.3000 },
    ],
  },
  {
    id: 'seg-a2-east',
    type: 'segment',
    name: 'A2 east of Riga',
    kind: 'rural',
    limitKmh: 90,
    points: [
      { lat: 57.0100, lon: 24.3400 },
      { lat: 57.0300, lon: 24.4500 },
      { lat: 57.0500, lon: 24.5600 },
    ],
  },
];
