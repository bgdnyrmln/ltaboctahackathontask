import type { DriverRegistry } from './registry.ts';
import { SEED_DEMO_IDENTITIES, SEED_DEMO_PERSONAL_CODES } from './seed.ts';
import type { SignInResult } from './types.ts';

export const DEMO_LABEL = 'DEMO login, not Smart-ID';

// Replacement boundary: a future approved identity provider implements this.
export interface IdentityProvider {
  signIn(identity: string): Promise<SignInResult>;
}

export interface DemoIdentityOption {
  demoId: string;
  displayName: string;
}

// Looks like a Latvian personal code (123456-12345 or 11 digits). Rejected
// without lookup, echo or storage so real codes are never handled.
const PERSONAL_CODE_LIKE = /^\d{6}-?\d{5}$/;

// Normalised to DDMMYY-XNNNN.
const normalizeCode = (input: string) => `${input.slice(0, 6)}-${input.replace('-', '').slice(6)}`;

// True when the DDMMYY part is not a real calendar date. Only such codes can sign in, so a real
// person's code can never be accepted even by mistake. The century digit follows the hyphen.
export function isImpossibleDate(code: string): boolean {
  const m = /^(\d{2})(\d{2})(\d{2})-?(\d)\d{4}$/.exec(code);
  if (!m) return false;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const century = ({ '0': 1800, '1': 1900, '2': 2000 } as Record<string, number>)[m[4]] ?? 1900;
  const date = new Date(Date.UTC(century + Number(m[3]), month - 1, day));
  const real =
    month >= 1 &&
    month <= 12 &&
    date.getUTCFullYear() === century + Number(m[3]) &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return !real;
}

export function createDemoSmartIdAuth(
  registry: DriverRegistry,
  identities: Record<string, string> = SEED_DEMO_IDENTITIES,
  personalCodes: Record<string, string> = SEED_DEMO_PERSONAL_CODES,
): IdentityProvider & { listDemoIdentities(): Promise<DemoIdentityOption[]> } {
  return {
    async signIn(identity) {
      const demoId = typeof identity === 'string' ? identity.trim().replace(/\s+/g, '') : '';
      if (!demoId) return { ok: false, error: 'invalid_input' };

      let driverId: string | undefined;
      if (PERSONAL_CODE_LIKE.test(demoId)) {
        // Only the fictional test codes on impossible dates; anything else that looks like a personal
        // code is refused without lookup and never echoed or stored.
        const code = normalizeCode(demoId);
        if (!isImpossibleDate(code) || !Object.hasOwn(personalCodes, code)) {
          return { ok: false, error: 'invalid_input' };
        }
        driverId = personalCodes[code];
      } else {
        driverId = Object.hasOwn(identities, demoId) ? identities[demoId] : undefined;
        if (!driverId) return { ok: false, error: 'unknown_identity' };
      }

      const profile = await registry.getProfile(driverId);
      if (!profile) return { ok: false, error: 'data_missing' };
      return { ok: true, profile, demo: true };
    },

    async listDemoIdentities() {
      const options: DemoIdentityOption[] = [];
      for (const [demoId, driverId] of Object.entries(identities)) {
        const driver = await registry.getDriver(driverId);
        if (driver) options.push({ demoId, displayName: driver.displayName });
      }
      return options;
    },
  };
}
