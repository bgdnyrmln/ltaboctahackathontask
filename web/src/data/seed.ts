import { UNKNOWN } from './types.ts';
import type { Driver, Vehicle } from './types.ts';

// Profiles differ on purpose so D's profile coefficient has something to show:
// Anna is experienced with a clean record, Janis is a new driver with one
// incident and penalty points, Marta has unknown fields ("no data" path).
export const SEED_DRIVERS: Driver[] = [
  {
    id: 'drv-001',
    displayName: 'Demo Driver Anna',
    licenseCategories: ['B'],
    licenseSince: '2016-05-01',
    claimsLast5y: 0,
    penaltyPoints: 0,
    birthYear: 1991,
    synthetic: true,
  },
  {
    id: 'drv-002',
    displayName: 'Demo Driver Janis',
    licenseCategories: ['B'],
    licenseSince: '2025-03-10', // under 2 years on the demo date
    claimsLast5y: 1,
    penaltyPoints: 4,
    birthYear: 2005,
    synthetic: true,
  },
  {
    // Deliberately incomplete to exercise the "unknown" path.
    id: 'drv-003',
    displayName: 'Demo Driver Marta',
    licenseCategories: UNKNOWN,
    licenseSince: UNKNOWN,
    claimsLast5y: UNKNOWN,
    penaltyPoints: UNKNOWN,
    birthYear: UNKNOWN,
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
    inspectionValidUntil: '2027-04-30',
    fuelType: 'petrol',
    powerKw: 110,
    bodyType: 'estate',
    massKg: 1350,
    seats: 5,
    synthetic: true,
  },
  {
    id: 'veh-002',
    ownerDriverId: 'drv-002',
    plateLabel: 'DEMO-102',
    make: 'Volvo',
    model: 'V60',
    year: 2021,
    inspectionValidUntil: '2026-09-30', // overdue on the demo date
    fuelType: 'hybrid',
    powerKw: 145,
    bodyType: 'estate',
    massKg: 1900,
    seats: 5,
    synthetic: true,
  },
  {
    id: 'veh-003',
    ownerDriverId: 'drv-003',
    plateLabel: 'DEMO-103',
    make: UNKNOWN,
    model: UNKNOWN,
    year: UNKNOWN,
    inspectionValidUntil: UNKNOWN,
    fuelType: UNKNOWN,
    powerKw: UNKNOWN,
    bodyType: UNKNOWN,
    massKg: UNKNOWN,
    seats: UNKNOWN,
    synthetic: true,
  },
];

// demo identity -> seeded driver id. These are fake handles, not personal codes.
export const SEED_DEMO_IDENTITIES: Record<string, string> = {
  'DEMO-SID-001': 'drv-001',
  'DEMO-SID-002': 'drv-002',
  'DEMO-SID-003': 'drv-003',
};

// Test personal codes -> seeded driver id. Latvian DDMMYY-XNNNN layout on dates that do not exist
// (30 Feb, 31 Apr, 31 Jun), so they can never belong to a real person. Sign-in accepts only codes
// like these (see isImpossibleDate in demoAuth.ts); any other personal-code-like input is rejected.
export const SEED_DEMO_PERSONAL_CODES: Record<string, string> = {
  '300291-17428': 'drv-001',
  '310405-20716': 'drv-002',
  '310688-13059': 'drv-003',
};
