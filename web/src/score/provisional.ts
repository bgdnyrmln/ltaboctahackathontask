// PROVISIONAL scoring for the demo UI. Implements docs/driver-score-spec-draft.md
// (Agent C draft, aligned with D's HACK-14 analysis). Weights and thresholds are NOT
// approved (HACK-1). Replace with Agent D's scoring module once it exists; the UI
// depends only on the WeeklyReport shape below.
import type { TripTotals } from '@trips'

export type Confidence = 'high' | 'medium' | 'low' | 'insufficient'
export type KpiId = 'speeding' | 'harshBrake' | 'harshAccel'

type KpiSpec = {
  id: KpiId
  label: string
  unit: string
  weight: number
  good: number
  bad: number
  prior: number // reference "average" value used for low-mileage smoothing
  advice: (from: number, to: number) => string
}

export const KPI_SPECS: KpiSpec[] = [
  {
    id: 'speeding',
    label: 'Speeding',
    unit: '% of driving time',
    weight: 0.5,
    good: 2,
    bad: 20,
    prior: 8,
    advice: (from, to) => `Cut time above the limit from ${fmt(from)}% to ${fmt(to)}%`,
  },
  {
    id: 'harshBrake',
    label: 'Harsh braking',
    unit: 'per 100 km',
    weight: 0.3,
    good: 1,
    bad: 15,
    prior: 5,
    advice: (from, to) => `Keep more distance: harsh braking from ${fmt(from)} to ${fmt(to)} per 100 km`,
  },
  {
    id: 'harshAccel',
    label: 'Harsh acceleration',
    unit: 'per 100 km',
    weight: 0.2,
    good: 1,
    bad: 12,
    prior: 4,
    advice: (from, to) => `Accelerate more gently: from ${fmt(from)} to ${fmt(to)} per 100 km`,
  },
]

const SMOOTHING_KM = 50

export type KpiResult = {
  id: KpiId
  label: string
  unit: string
  weight: number
  value: number // raw, as measured
  adjusted: number // smoothed toward the prior for low mileage
  subscore: number // 0..100
  lostPoints: number // weight * (100 - subscore)
}

export type RiskZone = {
  id: 'low' | 'moderateLow' | 'moderate' | 'elevated'
  label: string
  octaDirection: string
}

export type WeeklyReport = {
  totals: TripTotals
  kpis: KpiResult[]
  score: number | null // null when confidence is insufficient
  confidence: Confidence
  zone: RiskZone | null
  tip: { kpi: KpiId; text: string; projectedScore: number } | null
  nightShare: number // context only, never scored
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toString()
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function rawValue(id: KpiId, t: TripTotals): number {
  if (id === 'speeding') return t.drivingSec > 0 ? (t.secOverLimit / t.drivingSec) * 100 : 0
  const count = id === 'harshBrake' ? t.harshBrakeCount : t.harshAccelCount
  return t.distanceKm > 0 ? (count / t.distanceKm) * 100 : 0
}

function subscore(spec: KpiSpec, x: number) {
  return 100 * (1 - clamp((x - spec.good) / (spec.bad - spec.good), 0, 1))
}

function confidenceFor(t: TripTotals): Confidence {
  const levels: Confidence[] = ['insufficient', 'low', 'medium', 'high']
  let level = t.distanceKm < 30 ? 0 : t.distanceKm < 100 ? 1 : t.distanceKm < 300 ? 2 : 3
  // Poor data coverage lowers confidence one step, never the score.
  if (level > 0 && t.coverage < 0.7) level -= 1
  return levels[level]
}

export function zoneFor(score: number): RiskZone {
  if (score >= 85) return { id: 'low', label: 'Low risk', octaDirection: 'Potential discount' }
  if (score >= 70) return { id: 'moderateLow', label: 'Moderate-low risk', octaDirection: 'Potential discount' }
  if (score >= 50) return { id: 'moderate', label: 'Moderate risk', octaDirection: 'No change' }
  return { id: 'elevated', label: 'Elevated risk', octaDirection: 'Possible surcharge' }
}

export function buildWeeklyReport(totals: TripTotals): WeeklyReport {
  const kpis: KpiResult[] = KPI_SPECS.map((spec) => {
    const value = rawValue(spec.id, totals)
    const adjusted = (value * totals.distanceKm + spec.prior * SMOOTHING_KM) / (totals.distanceKm + SMOOTHING_KM)
    const s = subscore(spec, adjusted)
    return {
      id: spec.id,
      label: spec.label,
      unit: spec.unit,
      weight: spec.weight,
      value,
      adjusted,
      subscore: s,
      lostPoints: spec.weight * (100 - s),
    }
  })

  const confidence = confidenceFor(totals)
  const rawScore = kpis.reduce((sum, k) => sum + k.weight * k.subscore, 0)
  const score = confidence === 'insufficient' ? null : Math.round(rawScore)

  let tip: WeeklyReport['tip'] = null
  if (score !== null) {
    const worst = [...kpis].sort((a, b) => b.lostPoints - a.lostPoints)[0]
    const spec = KPI_SPECS.find((s) => s.id === worst.id)!
    if (worst.lostPoints >= 1) {
      // Suggest closing half the gap to "good" and show what that would do to the score.
      const target = Math.max(spec.good, worst.adjusted - (worst.adjusted - spec.good) / 2)
      const projected = Math.round(rawScore + spec.weight * (subscore(spec, target) - worst.subscore))
      tip = { kpi: worst.id, text: spec.advice(worst.adjusted, target), projectedScore: projected }
    }
  }

  return {
    totals,
    kpis,
    score,
    confidence,
    zone: score === null ? null : zoneFor(score),
    tip,
    nightShare: totals.distanceKm > 0 ? (totals.nightKm / totals.distanceKm) * 100 : 0,
  }
}
