import { FATIGUE_STRETCH_MIN } from '@data'

// Driving without a break: the limit comes from Agent D's scoring constant, so the
// app shows the same number the score uses (proposal: raise it to 5 h, see
// docs/break-limit-proposal.md).
export const BREAK_LIMIT_MIN = FATIGUE_STRETCH_MIN
export const BREAK_WARN_BEFORE_MIN = 15

export type BreakStatus = 'ok' | 'soon' | 'due'

export function breakStatus(continuousMin: number): BreakStatus {
  if (continuousMin >= BREAK_LIMIT_MIN) return 'due'
  if (continuousMin >= BREAK_LIMIT_MIN - BREAK_WARN_BEFORE_MIN) return 'soon'
  return 'ok'
}

export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  return h > 0 ? `${h} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`
}

export const breakLimitLabel = () =>
  BREAK_LIMIT_MIN % 60 === 0 ? `${BREAK_LIMIT_MIN / 60} h` : fmtDuration(BREAK_LIMIT_MIN)
