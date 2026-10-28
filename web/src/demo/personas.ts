import { SEED_DEMO_IDENTITIES, SEED_DEMO_PERSONAL_CODES } from '@data'

// Fictional people for the three seeded demo drivers, so screens look like a
// real app. Personal codes use the Latvian DDMMYY-XNNNN layout but with dates
// that do not exist (30 Feb, 31 Apr, 31 Jun), so they can never belong to a
// real person. Sign-in accepts exactly these test codes (and still the DEMO-SID handles).
export type Persona = { firstName: string; lastName: string; personalCode: string }

// The test codes live in the data layer (SEED_DEMO_PERSONAL_CODES), which is also what sign-in accepts.
const codeOf = (driverId: string) =>
  Object.entries(SEED_DEMO_PERSONAL_CODES).find(([, id]) => id === driverId)?.[0] ?? ''

export const PERSONAS: Record<string, Persona> = {
  'drv-001': { firstName: 'Anna', lastName: 'Bērziņa', personalCode: codeOf('drv-001') },
  'drv-002': { firstName: 'Jānis', lastName: 'Kalniņš', personalCode: codeOf('drv-002') },
  'drv-003': { firstName: 'Marta', lastName: 'Ozoliņa', personalCode: codeOf('drv-003') },
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

// Test personal code shown on a login option instead of the DEMO-SID handle.
export function codeForDemoId(demoId: string): string | null {
  const driverId = SEED_DEMO_IDENTITIES[demoId]
  const code = driverId ? personaOf(driverId)?.personalCode : undefined
  return code || null
}

// Name for a login option (C's API lists demo handles with the seed display name).
export function nameForDemoId(demoId: string, fallback: string): string {
  const driverId = SEED_DEMO_IDENTITIES[demoId]
  const p = driverId ? personaOf(driverId) : null
  return p ? `${p.firstName} ${p.lastName}` : fallback
}

// Masked for lists: 300291-*****
export const maskCode = (code: string) => code.replace(/-(\d+)$/, (_, d: string) => `-${'*'.repeat(d.length)}`)
