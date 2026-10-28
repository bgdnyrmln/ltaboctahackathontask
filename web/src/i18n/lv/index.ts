// Latvian translations, keyed by the English source text. Split by area so they are easy to review.
import { APP } from './app.ts'
import { AUTH } from './auth.ts'
import { DRIVE } from './drive.ts'
import { INSURER } from './insurer.ts'
import { LANDING } from './landing.ts'
import { PROFILE } from './profile.ts'

export const LV: Record<string, string> = { ...APP, ...PROFILE, ...DRIVE, ...AUTH, ...LANDING, ...INSURER }
