// Synthetic demo data only. Values we cannot know are explicit, never invented.

export interface Unknown {
  kind: 'unknown';
}

export type Maybe<T> = T | Unknown;

export const UNKNOWN: Unknown = { kind: 'unknown' };

export function isUnknown(value: unknown): value is Unknown {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'unknown'
  );
}

export interface Driver {
  id: string;
  displayName: string;
  licenseCategories: Maybe<string[]>;
  licenseSince: Maybe<string>; // ISO date
  // Static profile inputs for D's profile coefficient. Absent means unknown,
  // the same as UNKNOWN; they never change the behaviour score.
  claimsLast5y?: Maybe<number>; // at-fault incidents in the last 5 years
  penaltyPoints?: Maybe<number>;
  birthYear?: Maybe<number>; // year only (data minimisation); age is off by default in scoring
  synthetic: true;
}

export interface Vehicle {
  id: string;
  ownerDriverId: string;
  plateLabel: string; // fake label such as DEMO-101, not a real plate
  make: Maybe<string>;
  model: Maybe<string>;
  year: Maybe<number>;
  inspectionValidUntil?: Maybe<string>; // ISO date of the technical inspection expiry; absent = unknown
  // Registration-certificate style specs, for display and D's profile layer
  // only; they never change the 0-100 driving score. Absent = unknown.
  fuelType?: Maybe<FuelType>;
  powerKw?: Maybe<number>;
  bodyType?: Maybe<BodyType>;
  massKg?: Maybe<number>; // kerb mass
  seats?: Maybe<number>;
  synthetic: true;
}

export const FUEL_TYPES = ['petrol', 'diesel', 'hybrid', 'electric', 'lpg'] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export const BODY_TYPES = ['hatchback', 'sedan', 'estate', 'suv', 'van'] as const;
export type BodyType = (typeof BODY_TYPES)[number];

// kW per tonne of kerb mass; null when either value is unknown.
export function powerToWeight(vehicle: Vehicle): number | null {
  const kw = known(vehicle.powerKw);
  const kg = known(vehicle.massKg);
  return kw === null || kg === null || kg <= 0 ? null : Math.round((kw / kg) * 1000 * 10) / 10;
}

// Absent and UNKNOWN both read as unknown.
export function known<T>(value: Maybe<T> | undefined): T | null {
  return value === undefined || isUnknown(value) ? null : value;
}

// null when the inspection date is unknown.
export function isInspectionOverdue(vehicle: Vehicle, now: Date = new Date()): boolean | null {
  const until = known(vehicle.inspectionValidUntil);
  if (until === null) return null;
  // Valid through the end of the expiry day.
  return Date.parse(`${until}T23:59:59Z`) < now.getTime();
}

export interface Profile {
  driver: Driver;
  vehicles: Vehicle[];
}

export type SignInError = 'invalid_input' | 'unknown_identity' | 'data_missing';

export type SignInResult =
  | { ok: true; profile: Profile; demo: true }
  | { ok: false; error: SignInError };
