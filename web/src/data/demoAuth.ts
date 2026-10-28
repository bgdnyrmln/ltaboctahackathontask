import type { DriverRegistry } from './registry.ts';
import { SEED_DEMO_IDENTITIES } from './seed.ts';
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

export function createDemoSmartIdAuth(
  registry: DriverRegistry,
  identities: Record<string, string> = SEED_DEMO_IDENTITIES,
): IdentityProvider & { listDemoIdentities(): Promise<DemoIdentityOption[]> } {
  return {
    async signIn(identity) {
      const demoId = typeof identity === 'string' ? identity.trim() : '';
      if (!demoId || PERSONAL_CODE_LIKE.test(demoId)) {
        return { ok: false, error: 'invalid_input' };
      }
      const driverId = Object.hasOwn(identities, demoId)
        ? identities[demoId]
        : undefined;
      if (!driverId) return { ok: false, error: 'unknown_identity' };

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
