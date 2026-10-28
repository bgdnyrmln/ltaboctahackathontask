import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { recentWeeks, type TrendPoint, type TripSummary, type WeeklyReport } from '@data'
import { appApi, onSharedDataChange } from '../auth/appApi'

const TREND_WEEKS = 4
const TRIP_WEEKS = 4

type DriverData = {
  loading: boolean
  report: WeeklyReport | null
  trend: TrendPoint[]
  trips: TripSummary[] // recent weeks, newest first
  addTrip: (trip: TripSummary) => Promise<void>
  recordDemoObdTrip: () => Promise<TripSummary>
  deleteMyData: () => Promise<number>
  resetDemo: () => Promise<void>
}

const DriverDataContext = createContext<DriverData | null>(null)

// Loads the signed-in driver's report, trend and trips from Agent C's API.
export function DriverDataProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [trips, setTrips] = useState<TripSummary[]>([])

  const reload = useCallback(async () => {
    const weeks = recentWeeks(new Date(), TRIP_WEEKS)
    const [nextReport, nextTrend, perWeek] = await Promise.all([
      appApi().getWeeklyReport(),
      appApi().getTrend(TREND_WEEKS),
      Promise.all(weeks.map((w) => appApi().listTrips(w))),
    ])
    setReport(nextReport)
    setTrend(nextTrend)
    setTrips(perWeek.flat().sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)))
  }, [])

  useEffect(() => {
    reload()
    // Trips saved in another window or the phone frame show up here without a reload.
    return onSharedDataChange(() => {
      reload().catch(() => {
        // Signed out elsewhere: AuthProvider redirects to login.
      })
    })
  }, [reload])

  const value = useMemo<DriverData>(
    () => ({
      loading: report === null,
      report,
      trend,
      trips,
      async addTrip(trip) {
        await appApi().saveTrip(trip)
        await reload()
      },
      async recordDemoObdTrip() {
        const trip = await appApi().recordDemoObdTrip()
        await reload()
        return trip
      },
      async deleteMyData() {
        const { tripsDeleted } = await appApi().deleteMyData()
        return tripsDeleted
      },
      async resetDemo() {
        await appApi().resetDemo()
        await reload()
      },
    }),
    [report, trend, trips, reload],
  )

  return createElement(DriverDataContext.Provider, { value }, children)
}

export function useDriverData() {
  const context = useContext(DriverDataContext)
  if (!context) throw new Error('useDriverData must be used inside DriverDataProvider')
  return context
}
