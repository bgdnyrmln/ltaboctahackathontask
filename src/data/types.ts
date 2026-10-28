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
  synthetic: true;
}

export interface Vehicle {
  id: string;
  ownerDriverId: string;
  plateLabel: string; // fake label such as DEMO-101, not a real plate
  make: Maybe<string>;
  model: Maybe<string>;
  year: Maybe<number>;
  synthetic: true;
}

export interface Profile {
  driver: Driver;
  vehicles: Vehicle[];
}

export type SignInError = 'invalid_input' | 'unknown_identity' | 'data_missing';

export type SignInResult =
  | { ok: true; profile: Profile; demo: true }
  | { ok: false; error: SignInError };
