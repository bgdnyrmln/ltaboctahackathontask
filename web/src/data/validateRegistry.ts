import { BODY_TYPES, FUEL_TYPES, isUnknown } from './types.ts';
import type { Driver, Vehicle } from './types.ts';

export interface RegistryProblem {
  entity: 'driver' | 'vehicle' | 'identity';
  id: string;
  problem: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LICENSE_CATEGORY = /^(AM|A1|A2|A|B1|B|BE|C1|C1E|C|CE|D1|D1E|D|DE|TR1|TR2|TRB)$/;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function checkMaybeString(v: unknown): string | null {
  if (isUnknown(v) || isNonEmptyString(v)) return null;
  return 'must be a non-empty string or unknown';
}

// Integrity check for seeded or provider-supplied registry data. Returns every
// problem instead of throwing so one run reports the whole data set.
export function validateRegistry(
  drivers: Driver[],
  vehicles: Vehicle[],
  identities: Record<string, string>,
  now: Date = new Date(),
): RegistryProblem[] {
  const problems: RegistryProblem[] = [];
  const add = (entity: RegistryProblem['entity'], id: string, problem: string) =>
    problems.push({ entity, id, problem });

  const driverIds = new Set<string>();
  for (const d of drivers) {
    const id = isNonEmptyString(d?.id) ? d.id : '(no id)';
    if (id === '(no id)') add('driver', id, 'id is required');
    else if (driverIds.has(id)) add('driver', id, 'duplicate id');
    driverIds.add(id);

    if (!isNonEmptyString(d?.displayName)) add('driver', id, 'displayName is required');
    if (d?.synthetic !== true) add('driver', id, 'synthetic must be true');

    const cats = d?.licenseCategories;
    if (!isUnknown(cats)) {
      if (!Array.isArray(cats) || cats.length === 0) {
        add('driver', id, 'licenseCategories must be a non-empty list or unknown');
      } else if (!cats.every((c) => typeof c === 'string' && LICENSE_CATEGORY.test(c))) {
        add('driver', id, 'licenseCategories has an unrecognised category');
      }
    }

    const since = d?.licenseSince;
    if (!isUnknown(since)) {
      if (typeof since !== 'string' || !ISO_DATE.test(since) || Number.isNaN(Date.parse(since))) {
        add('driver', id, 'licenseSince must be YYYY-MM-DD or unknown');
      } else if (Date.parse(since) > now.getTime()) {
        add('driver', id, 'licenseSince is in the future');
      }
    }

    for (const key of ['claimsLast5y', 'penaltyPoints'] as const) {
      const v = d?.[key];
      if (v !== undefined && !isUnknown(v) && !(Number.isInteger(v) && v >= 0 && v <= 50)) {
        add('driver', id, `${key} must be an integer 0-50 or unknown`);
      }
    }

    const birth = d?.birthYear;
    if (birth !== undefined && !isUnknown(birth)) {
      const maxBirth = now.getUTCFullYear() - 16;
      if (!Number.isInteger(birth) || birth < 1900 || birth > maxBirth) {
        add('driver', id, `birthYear must be an integer 1900-${maxBirth} or unknown`);
      } else if (typeof since === 'string' && ISO_DATE.test(since) && Number(since.slice(0, 4)) < birth + 15) {
        add('driver', id, 'licenseSince is before the driver could hold a licence');
      }
    }
  }

  const vehicleIds = new Set<string>();
  const plates = new Set<string>();
  for (const v of vehicles) {
    const id = isNonEmptyString(v?.id) ? v.id : '(no id)';
    if (id === '(no id)') add('vehicle', id, 'id is required');
    else if (vehicleIds.has(id)) add('vehicle', id, 'duplicate id');
    vehicleIds.add(id);

    if (!isNonEmptyString(v?.ownerDriverId)) {
      add('vehicle', id, 'ownerDriverId is required');
    } else if (!driverIds.has(v.ownerDriverId)) {
      add('vehicle', id, `ownerDriverId ${v.ownerDriverId} does not exist`);
    }

    if (!isNonEmptyString(v?.plateLabel) || !v.plateLabel.startsWith('DEMO-')) {
      add('vehicle', id, 'plateLabel must be a DEMO- label, not a real plate');
    } else if (plates.has(v.plateLabel)) {
      add('vehicle', id, 'duplicate plateLabel');
    } else {
      plates.add(v.plateLabel);
    }

    for (const key of ['make', 'model'] as const) {
      const issue = checkMaybeString(v?.[key]);
      if (issue) add('vehicle', id, `${key} ${issue}`);
    }
    const year = v?.year;
    if (!isUnknown(year)) {
      const maxYear = now.getUTCFullYear() + 1;
      if (typeof year !== 'number' || !Number.isInteger(year) || year < 1950 || year > maxYear) {
        add('vehicle', id, `year must be an integer 1950-${maxYear} or unknown`);
      }
    }
    const inspection = v?.inspectionValidUntil;
    if (inspection !== undefined && !isUnknown(inspection)) {
      if (typeof inspection !== 'string' || !ISO_DATE.test(inspection) || Number.isNaN(Date.parse(inspection))) {
        add('vehicle', id, 'inspectionValidUntil must be YYYY-MM-DD or unknown');
      }
    }
    const fuel = v?.fuelType;
    if (fuel !== undefined && !isUnknown(fuel) && !(FUEL_TYPES as readonly string[]).includes(fuel)) {
      add('vehicle', id, `fuelType must be one of ${FUEL_TYPES.join(', ')} or unknown`);
    }
    const body = v?.bodyType;
    if (body !== undefined && !isUnknown(body) && !(BODY_TYPES as readonly string[]).includes(body)) {
      add('vehicle', id, `bodyType must be one of ${BODY_TYPES.join(', ')} or unknown`);
    }
    const ranges = [
      ['powerKw', 20, 600],
      ['massKg', 500, 3500], // passenger cars and light vans (category B)
      ['seats', 1, 9],
    ] as const;
    for (const [key, min, max] of ranges) {
      const n = v?.[key];
      if (n !== undefined && !isUnknown(n) && !(Number.isInteger(n) && n >= min && n <= max)) {
        add('vehicle', id, `${key} must be an integer ${min}-${max} or unknown`);
      }
    }
    if (v?.synthetic !== true) add('vehicle', id, 'synthetic must be true');
  }

  for (const [demoId, driverId] of Object.entries(identities)) {
    if (!demoId.startsWith('DEMO-')) add('identity', demoId, 'demo id must start with DEMO-');
    if (!driverIds.has(driverId)) add('identity', demoId, `maps to missing driver ${driverId}`);
  }

  return problems;
}
