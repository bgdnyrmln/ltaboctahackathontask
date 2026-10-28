import type { TripSummary } from '@data'
import { PLACES, ROUTE } from '../telemetry/simulatedDrive'
import {
  analyzeSimTrip,
  illustrativeRoute,
  simTripOf,
  type RouteEvent,
  type RoutePoint,
} from '../telemetry/tripAnalysis'
import { STATIC_ROUTES } from './staticRoutes'

export type TripRoute = {
  points: RoutePoint[]
  events: RouteEvent[]
  from: string
  to: string
  kind: 'replayed' | 'illustrative'
}

const ALL_ROUTES = [
  ...STATIC_ROUTES,
  { id: 'oldriga-akropole', from: PLACES.oldRiga.name, to: PLACES.akropole.name, km: 6.43, points: ROUTE },
]

const cache = new Map<string, TripRoute | null>()

// Route to draw for a trip in history:
// - phone-simulator trips: replayed exactly from their script;
// - generated demo trips and demo OBD trips: an illustrative static Riga route with
//   the trip's real totals laid on it;
// - real phone GPS trips: none (routes are never stored).
export function routeForTrip(trip: TripSummary): TripRoute | null {
  if (cache.has(trip.id)) return cache.get(trip.id)!
  let route: TripRoute | null = null
  const sim = simTripOf(trip.id)
  if (sim) {
    const r = analyzeSimTrip(sim, trip.startedAt, trip.endedAt)
    route = {
      points: r.points,
      events: r.events,
      from: PLACES[r.trip.from].name,
      to: PLACES[r.trip.to].name,
      kind: 'replayed',
    }
  } else if (trip.source !== 'phone' && trip.distanceKm > 0) {
    route = { ...illustrativeRoute(trip, ALL_ROUTES), kind: 'illustrative' }
  }
  cache.set(trip.id, route)
  return route
}
