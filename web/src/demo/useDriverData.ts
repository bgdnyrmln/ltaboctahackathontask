import { createMemoryTripRepository, sumTrips, validateTrip, type TripSummary } from '@trips'
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { buildWeeklyReport, type WeeklyReport } from '../score/provisional'
import { sampleTripsFor } from './sampleTrips'

// Agent C's in-memory trip store. Synthetic history is generated per driver; trips
// recorded on this phone are also kept in localStorage so they survive a reload.
const repository = createMemoryTripRepository()
const seededDrivers = new Set<string>()
const DELETED_KEY = 'foc.deleted'
const recordedKey = (driverId: string) => `foc.trips.${driverId}`

const DAY = 24 * 60 * 60 * 1000
export const WEEKS_SHOWN = 4

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode): data lasts for this page view.
  }
}

function isDeleted(driverId: string) {
  return readJson<string[]>(DELETED_KEY, []).includes(driverId)
}

function setDeleted(driverId: string, deleted: boolean) {
  const list = new Set(readJson<string[]>(DELETED_KEY, []))
  if (deleted) list.add(driverId)
  else list.delete(driverId)
  writeJson(DELETED_KEY, [...list])
}

function readRecorded(driverId: string): TripSummary[] {
  return readJson<TripSummary[]>(recordedKey(driverId), []).filter((t) => {
    try {
      validateTrip(t)
      return true
    } catch {
      return false
    }
  })
}

export type WeekReport = WeeklyReport & { from: string; to: string }

type DriverData = {
  loading: boolean
  trips: TripSummary[]
  weeks: WeekReport[]
  addTrip: (trip: TripSummary) => Promise<void>
  deleteMyData: () => Promise<void>
  restoreSampleData: () => Promise<void>
}

const DriverDataContext = createContext<DriverData | null>(null)

export function DriverDataProvider({
  driverId,
  vehicleId,
  children,
}: {
  driverId: string
  vehicleId: string | null
  children: ReactNode
}) {
  const [trips, setTrips] = useState<TripSummary[] | null>(null)

  const load = useCallback(async () => {
    if (!seededDrivers.has(driverId)) {
      const seed = isDeleted(driverId) ? [] : sampleTripsFor(driverId, vehicleId)
      await repository.save([...seed, ...readRecorded(driverId)])
      seededDrivers.add(driverId)
    }
    setTrips(await repository.list({ driverId }))
  }, [driverId, vehicleId])

  useEffect(() => {
    load()
  }, [load])

  // Rolling 7-day windows ending now; the last entry is the current week.
  const weeks = useMemo<WeekReport[]>(() => {
    if (!trips) return []
    const now = Date.now()
    return Array.from({ length: WEEKS_SHOWN }, (_, i) => {
      const to = now - (WEEKS_SHOWN - 1 - i) * 7 * DAY
      const from = to - 7 * DAY
      const inWeek = trips.filter((t) => {
        const start = Date.parse(t.startedAt)
        return start >= from && start < to
      })
      return { ...buildWeeklyReport(sumTrips(inWeek)), from: new Date(from).toISOString(), to: new Date(to).toISOString() }
    })
  }, [trips])

  const value = useMemo<DriverData>(
    () => ({
      loading: trips === null,
      trips: trips ?? [],
      weeks,
      async addTrip(trip) {
        await repository.save([trip]) // validates; throws TripValidationError on bad data
        writeJson(recordedKey(driverId), [...readRecorded(driverId), trip])
        setTrips(await repository.list({ driverId }))
      },
      async deleteMyData() {
        await repository.deleteByDriver(driverId)
        writeJson(recordedKey(driverId), null)
        setDeleted(driverId, true)
        setTrips([])
      },
      async restoreSampleData() {
        setDeleted(driverId, false)
        await repository.save(sampleTripsFor(driverId, vehicleId))
        setTrips(await repository.list({ driverId }))
      },
    }),
    [trips, weeks, driverId, vehicleId],
  )

  return createElement(DriverDataContext.Provider, { value }, children)
}

export function useDriverData() {
  const context = useContext(DriverDataContext)
  if (!context) throw new Error('useDriverData must be used inside DriverDataProvider')
  return context
}
