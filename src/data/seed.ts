import { UNKNOWN } from './types.ts';
import type { Driver, Vehicle } from './types.ts';

export const SEED_DRIVERS: Driver[] = [
  {
    id: 'drv-001',
    displayName: 'Demo Driver Anna',
    licenseCategories: ['B'],
    licenseSince: '2016-05-01',
    synthetic: true,
  },
  {
    id: 'drv-002',
    displayName: 'Demo Driver Janis',
    licenseCategories: ['B', 'C'],
    licenseSince: '2009-09-15',
    synthetic: true,
  },
  {
    // Deliberately incomplete to exercise the "unknown" path.
    id: 'drv-003',
    displayName: 'Demo Driver Marta',
    licenseCategories: UNKNOWN,
    licenseSince: UNKNOWN,
    synthetic: true,
  },
];

export const SEED_VEHICLES: Vehicle[] = [
  {
    id: 'veh-001',
    ownerDriverId: 'drv-001',
    plateLabel: 'DEMO-101',
    make: 'Skoda',
    model: 'Octavia',
    year: 2019,
    synthetic: true,
  },
  {
    id: 'veh-002',
    ownerDriverId: 'drv-002',
    plateLabel: 'DEMO-102',
    make: 'Volvo',
    model: 'V60',
    year: 2021,
    synthetic: true,
  },
  {
    id: 'veh-003',
    ownerDriverId: 'drv-003',
    plateLabel: 'DEMO-103',
    make: UNKNOWN,
    model: UNKNOWN,
    year: UNKNOWN,
    synthetic: true,
  },
];

// demo identity -> seeded driver id. These are fake handles, not personal codes.
export const SEED_DEMO_IDENTITIES: Record<string, string> = {
  'DEMO-SID-001': 'drv-001',
  'DEMO-SID-002': 'drv-002',
  'DEMO-SID-003': 'drv-003',
};
