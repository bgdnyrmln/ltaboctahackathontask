import {
  buildTrend,
  buildWeeklyReport,
  createCsddMockRegistry,
  createPersistentTripRepository,
  defaultStorage,
  DELETED_KEY,
  DEMO_WEEKS,
  dScore,
  finalScore,
  generateDemoTrips,
  inputsFromProfile,
  profileRisk,
  recentWeeks,
  SEED_DRIVERS,
  weekStartOf,
  type Profile,
  type ProfileRisk,
  type TrendPoint,
  type TripSummary,
  type WeeklyReport,
} from '@data'

// Insurer view over the same data store the driver app uses (in the prototype:
// this browser's storage; in production: a central EU database). Insurers only
// get weekly summaries of drivers who opted in to sharing; never trips, routes
// or positions.

// Demo defaults for the seeded drivers; a driver's own choice at registration wins.
const DEMO_SHARING: Record<string, boolean> = { 'drv-001': true, 'drv-002': true, 'drv-003': false }

export type DriverRow = {
  driverId: string
  name: string
  plate: string | null
  vehicle: string | null
  sharing: boolean
  deleted: boolean
  shared: null | {
    report: WeeklyReport
    trend: TrendPoint[]
    risk: ProfileRisk
    final: number | null
    profile: Profile
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function sharingOf(driverId: string): boolean {
  const reg = readJson<{ consent?: { shareSummary?: boolean } } | null>(`foc.registration.${driverId}`, null)
  return reg?.consent ? Boolean(reg.consent.shareSummary) : (DEMO_SHARING[driverId] ?? false)
}

const show = (v: unknown) => (typeof v === 'object' && v !== null && 'kind' in v ? null : v)

export async function loadPortfolio(now = new Date()): Promise<DriverRow[]> {
  const storage = defaultStorage()
  const deleted = new Set(readJson<string[]>(DELETED_KEY, []))
  // Same trips the app shows: deterministic demo trips plus anything saved (e.g. phone trips).
  const byId = new Map<string, TripSummary>()
  for (const t of generateDemoTrips(recentWeeks(now, DEMO_WEEKS), now)) if (!deleted.has(t.driverId)) byId.set(t.id, t)
  for (const t of await createPersistentTripRepository(storage).list()) byId.set(t.id, t)
  const trips = [...byId.values()]
  const registry = createCsddMockRegistry()
  const week = weekStartOf(now)

  return Promise.all(
    SEED_DRIVERS.map(async (driver): Promise<DriverRow> => {
      const profile = await registry.getProfile(driver.id)
      const vehicle = profile?.vehicles[0]
      const sharing = sharingOf(driver.id)
      const isDeleted = deleted.has(driver.id)
      const base = {
        driverId: driver.id,
        name: driver.displayName,
        plate: vehicle?.plateLabel ?? null,
        vehicle: vehicle ? [show(vehicle.make), show(vehicle.model)].filter(Boolean).join(' ') || null : null,
        sharing,
        deleted: isDeleted,
      }
      if (!sharing || isDeleted || !profile) return { ...base, shared: null }
      const mine = trips.filter((t) => t.driverId === driver.id)
      const report = buildWeeklyReport(week, mine, dScore)
      const risk = profileRisk(inputsFromProfile(profile, now), now)
      return {
        ...base,
        shared: {
          report,
          trend: buildTrend(recentWeeks(now, 4), mine, dScore),
          risk,
          final: finalScore(report.result.score, risk).final,
          profile,
        },
      }
    }),
  )
}

// CSV of shared weekly summaries only (what an insurer may export).
export function portfolioCsv(rows: DriverRow[]): string {
  const head = [
    'driver_id',
    'name',
    'plate',
    'week_start',
    'final_score',
    'behaviour_score',
    'profile_factor',
    'band',
    'confidence',
    'distance_km',
    'trips',
    'octa_direction',
  ]
  const lines = rows
    .filter((r) => r.shared)
    .map((r) => {
      const s = r.shared!
      return [
        r.driverId,
        r.name,
        r.plate ?? '',
        s.report.weekStart,
        s.final ?? '',
        s.report.result.score ?? '',
        s.risk.p.toFixed(2),
        s.report.result.band ?? '',
        s.report.result.confidence,
        Math.round(s.report.totals.distanceKm),
        s.report.trips,
        s.report.octa.direction ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    })
  return [head.join(','), ...lines].join('\n')
}
