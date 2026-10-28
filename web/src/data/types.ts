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
  synthetic: true;
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
