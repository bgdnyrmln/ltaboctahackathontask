import { SEED_DEMO_IDENTITIES } from '@data'

// Fictional people for the three seeded demo drivers, so screens look like a
// real app. Personal codes use the Latvian DDMMYY-XNNNN layout but with dates
// that do not exist (30 Feb, 31 Apr, 31 Jun), so they can never belong to a
// real person. The login still uses the DEMO-SID handles, never these codes.
export type Persona = { firstName: string; lastName: string; personalCode: string }

export const PERSONAS: Record<string, Persona> = {
  'drv-001': { firstName: 'Anna', lastName: 'Bērziņa', personalCode: '300291-17428' },
  'drv-002': { firstName: 'Jānis', lastName: 'Kalniņš', personalCode: '310405-20716' },
  'drv-003': { firstName: 'Marta', lastName: 'Ozoliņa', personalCode: '310688-13059' },
}

export const PERSONAL_CODE_NOTE = 'Demo personal code: the date does not exist, so it cannot belong to a real person.'

export function personaOf(driverId: string): Persona | null {
  return PERSONAS[driverId] ?? null
}

export function fullName(driver: { id: string; displayName: string }): string {
  const p = personaOf(driver.id)
  return p ? `${p.firstName} ${p.lastName}` : driver.displayName
}

export function firstName(driver: { id: string; displayName: string }): string {
  return personaOf(driver.id)?.firstName ?? driver.displayName.split(' ').pop() ?? driver.displayName
}

// Name for a login option (C's API lists demo handles with the seed display name).
export function nameForDemoId(demoId: string, fallback: string): string {
  const driverId = SEED_DEMO_IDENTITIES[demoId]
  const p = driverId ? personaOf(driverId) : null
  return p ? `${p.firstName} ${p.lastName}` : fallback
}

// Masked for lists: 300291-*****
export const maskCode = (code: string) => code.replace(/-(\d+)$/, (_, d: string) => `-${'*'.repeat(d.length)}`)
