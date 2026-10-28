// Scripted GPS drive through Riga for the phone simulator on the website (a
// desktop has no real GPS). It produces the same fixes a phone would, so the
// real recorder, speed limit map and aggregator run on it. Trips are saved as
// synthetic.
import type { GpsFix } from './tripRecorder'

// Old Riga (30 zone) -> Krasta iela (70) -> city streets (50).
const ROUTE: Array<[number, number]> = [
  [56.9475, 24.104],
  [56.9425, 24.111],
  [56.938, 24.128],
  [56.933, 24.145],
  [56.926, 24.165],
  [56.918, 24.185],
]

// Speed in km/h for each second of the drive.
function speedProfile(): number[] {
  const p: number[] = []
  const ramp = (from: number, to: number, secs: number) => {
    for (let i = 1; i <= secs; i++) p.push(from + ((to - from) * i) / secs)
  }
  const hold = (v: number, secs: number) => {
    for (let i = 0; i < secs; i++) p.push(v + Math.sin(p.length / 7) * 1.5)
  }
  ramp(0, 30, 8)
  hold(35, 60) // Old Riga: slightly over 30
  ramp(35, 60, 10)
  hold(60, 60) // Krasta iela, within 70
  ramp(60, 82, 8)
  hold(82, 45) // Krasta iela: speeding
  ramp(82, 40, 3) // hard braking, about -3.9 m/s²
  hold(48, 50)
  ramp(45, 70, 2) // sharp acceleration, about +3.5 m/s²
  hold(66, 40) // city 50: speeding again
  ramp(66, 0, 14)
  return p
}

const toRad = (d: number) => (d * Math.PI) / 180
function segmentKm(a: [number, number], b: [number, number]) {
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// Position after travelling `km` along the route (clamped to its end).
function pointAt(km: number): [number, number] {
  let left = km
  for (let i = 1; i < ROUTE.length; i++) {
    const len = segmentKm(ROUTE[i - 1], ROUTE[i])
    if (left <= len) {
      const f = left / len
      return [
        ROUTE[i - 1][0] + (ROUTE[i][0] - ROUTE[i - 1][0]) * f,
        ROUTE[i - 1][1] + (ROUTE[i][1] - ROUTE[i - 1][1]) * f,
      ]
    }
    left -= len
  }
  return ROUTE[ROUTE.length - 1]
}

export const SIMULATION_SPEEDUP = 10

// Feeds one fix per simulated second, SIMULATION_SPEEDUP times faster than real
// time. Timestamps end at "now" so the trip lands in the current week.
export function startSimulatedDrive(onFix: (fix: GpsFix) => void, onDone: () => void): () => void {
  const profile = speedProfile()
  const start = Date.now() - profile.length * 1000
  let i = 0
  let km = 0
  const timer = window.setInterval(() => {
    if (i >= profile.length) {
      window.clearInterval(timer)
      onDone()
      return
    }
    const kmh = profile[i]
    km += kmh / 3600
    const [lat, lon] = pointAt(km)
    onFix({ t: start + i * 1000, lat, lon, accuracy: 6, speed: kmh / 3.6 })
    i++
  }, 1000 / SIMULATION_SPEEDUP)
  return () => window.clearInterval(timer)
}
