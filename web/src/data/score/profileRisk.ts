// Profile layer: a bounded risk coefficient P from static driver and vehicle
// data, kept apart from the behaviour score. The final score is
// behaviour / P, so a higher P (riskier profile) lowers it. Only experience and
// vehicle age exist in C's mock data today; the other inputs are skipped as
// "no data" until they are added. All numbers are preliminary and illustrative.
import { isUnknown } from '../types.ts';
import type { Profile } from '../types.ts';

export const P_MIN = 0.8;
export const P_MAX = 1.3;

export interface ProfileInputs {
  licenseSince?: string | null; // ISO date
  vehicleYear?: number | null;
  claimsLast5y?: number | null; // count of at-fault incidents
  penaltyPoints?: number | null;
  inspectionOverdue?: boolean | null;
  driverAge?: number | null; // only used when includeAge is true
}

export interface ProfileFactor {
  id: 'experience' | 'claims' | 'penalties' | 'vehicle_age' | 'inspection' | 'driver_age';
  label: string;
  detail: string;
  adjustment: number; // added to 1.0; 0 when the input is missing
  known: boolean;
}

export interface ProfileRisk {
  p: number; // clamped to P_MIN..P_MAX
  factors: ProfileFactor[];
}

const YEAR_MS = 365.25 * 24 * 3600 * 1000;
const r2 = (x: number) => Math.round(x * 100) / 100;

function yearsSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t > now.getTime()) return null;
  return (now.getTime() - t) / YEAR_MS;
}

const missing = (id: ProfileFactor['id'], label: string): ProfileFactor => ({
  id,
  label,
  detail: 'no data',
  adjustment: 0,
  known: false,
});

// Driver age is the most sensitive input (discrimination risk), so it is off unless asked for.
export function profileRisk(inputs: ProfileInputs, now: Date, includeAge = false): ProfileRisk {
  const factors: ProfileFactor[] = [];

  const years = yearsSince(inputs.licenseSince, now);
  if (years === null) factors.push(missing('experience', 'Driving experience'));
  else {
    const adj = years < 2 ? 0.15 : years < 5 ? 0.05 : years < 10 ? 0 : -0.1;
    factors.push({
      id: 'experience',
      label: 'Driving experience',
      detail: `${Math.floor(years)} years`,
      adjustment: adj,
      known: true,
    });
  }

  const claims = inputs.claimsLast5y;
  if (claims === null || claims === undefined || !Number.isFinite(claims) || claims < 0) {
    factors.push(missing('claims', 'Incidents in the last 5 years'));
  } else {
    const adj = claims === 0 ? -0.05 : claims === 1 ? 0.1 : 0.2;
    factors.push({ id: 'claims', label: 'Incidents in the last 5 years', detail: `${claims}`, adjustment: adj, known: true });
  }

  const pts = inputs.penaltyPoints;
  if (pts === null || pts === undefined || !Number.isFinite(pts) || pts < 0) {
    factors.push(missing('penalties', 'Penalty points'));
  } else {
    factors.push({
      id: 'penalties',
      label: 'Penalty points',
      detail: `${pts}`,
      adjustment: Math.min(0.1, 0.02 * pts),
      known: true,
    });
  }

  const year = inputs.vehicleYear;
  if (year === null || year === undefined || !Number.isFinite(year) || year > now.getUTCFullYear()) {
    factors.push(missing('vehicle_age', 'Vehicle age'));
  } else {
    const age = now.getUTCFullYear() - year;
    factors.push({
      id: 'vehicle_age',
      label: 'Vehicle age',
      detail: `${age} years`,
      adjustment: age > 12 ? 0.03 : 0,
      known: true,
    });
  }

  if (inputs.inspectionOverdue === null || inputs.inspectionOverdue === undefined) {
    factors.push(missing('inspection', 'Technical inspection'));
  } else {
    factors.push({
      id: 'inspection',
      label: 'Technical inspection',
      detail: inputs.inspectionOverdue ? 'overdue' : 'valid',
      adjustment: inputs.inspectionOverdue ? 0.05 : 0,
      known: true,
    });
  }

  if (includeAge) {
    const age = inputs.driverAge;
    if (age === null || age === undefined || !Number.isFinite(age) || age < 16) {
      factors.push(missing('driver_age', 'Driver age'));
    } else {
      factors.push({
        id: 'driver_age',
        label: 'Driver age',
        detail: `${age}`,
        adjustment: age < 25 || age > 70 ? 0.05 : 0,
        known: true,
      });
    }
  }

  const sum = factors.reduce((s, f) => s + f.adjustment, 0);
  const p = Math.min(P_MAX, Math.max(P_MIN, 1 + sum));
  return { p: r2(p), factors };
}

// Maps C's mock Profile onto the inputs that exist there today.
export function inputsFromProfile(profile: Profile): ProfileInputs {
  const { driver, vehicles } = profile;
  const year = vehicles[0]?.year;
  return {
    licenseSince: isUnknown(driver.licenseSince) ? null : driver.licenseSince,
    vehicleYear: year === undefined || isUnknown(year) ? null : year,
  };
}

export interface FinalScore {
  final: number | null; // 0..100; null when there is no behaviour score
  behavior: number | null;
  p: number;
  shift: number | null; // final - behavior, in points
}

export function finalScore(behavior: number | null, risk: ProfileRisk): FinalScore {
  if (behavior === null) return { final: null, behavior: null, p: risk.p, shift: null };
  const final = Math.min(100, Math.max(0, Math.round(behavior / risk.p)));
  return { final, behavior, p: risk.p, shift: final - behavior };
}
