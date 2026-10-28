// Scripted GPS drive through Riga for the phone simulator on the website (a
// desktop has no real GPS). It produces the same fixes a phone would, so the
// real recorder, speed limit map and aggregator run on it. Trips are saved as
// synthetic.
import type { GpsFix } from './tripRecorder.ts'

// Real Riga streets (road geometry from OpenStreetMap via the OSRM router, ©
// OpenStreetMap contributors, fetched once and bundled): Old Riga -> 11. novembra
// krastmala -> Radzina krastmala -> Krasta iela -> Akropole Riga car park, ~6.4 km.
export const ROUTE: Array<[number, number]> = [
  [56.94864, 24.10651],
  [56.94831, 24.10656],
  [56.94825, 24.10658],
  [56.94819, 24.10662],
  [56.94805, 24.10689],
  [56.94799, 24.10698],
  [56.94765, 24.10743],
  [56.94763, 24.10745],
  [56.94742, 24.10771],
  [56.94729, 24.10787],
  [56.94718, 24.10799],
  [56.94693, 24.1083],
  [56.94669, 24.10724],
  [56.94666, 24.10714],
  [56.94666, 24.10713],
  [56.94664, 24.10705],
  [56.94657, 24.10671],
  [56.94646, 24.1062],
  [56.94642, 24.10604],
  [56.94637, 24.1059],
  [56.94625, 24.10556],
  [56.94648, 24.10517],
  [56.94657, 24.105],
  [56.9468, 24.10463],
  [56.94717, 24.10396],
  [56.94743, 24.10355],
  [56.94754, 24.10334],
  [56.94757, 24.10322],
  [56.94763, 24.10309],
  [56.9477, 24.10293],
  [56.94777, 24.1028],
  [56.94777, 24.10278],
  [56.94778, 24.10276],
  [56.94778, 24.10275],
  [56.94777, 24.10272],
  [56.94776, 24.10269],
  [56.94775, 24.10267],
  [56.94773, 24.10266],
  [56.94769, 24.10266],
  [56.94761, 24.10268],
  [56.94733, 24.10297],
  [56.94723, 24.10304],
  [56.9471, 24.10314],
  [56.94705, 24.10319],
  [56.94695, 24.10328],
  [56.94684, 24.10339],
  [56.94683, 24.1034],
  [56.94659, 24.10372],
  [56.94629, 24.10418],
  [56.9461, 24.10448],
  [56.94577, 24.10505],
  [56.94565, 24.10525],
  [56.94556, 24.10544],
  [56.94533, 24.10593],
  [56.94525, 24.10616],
  [56.94514, 24.10646],
  [56.94503, 24.1068],
  [56.94496, 24.10709],
  [56.94476, 24.10769],
  [56.94465, 24.10801],
  [56.94453, 24.10828],
  [56.94441, 24.1085],
  [56.94423, 24.10882],
  [56.94411, 24.10894],
  [56.94402, 24.10907],
  [56.94396, 24.10918],
  [56.94381, 24.10943],
  [56.94371, 24.10961],
  [56.94368, 24.10966],
  [56.9436, 24.10983],
  [56.94353, 24.10996],
  [56.94345, 24.11014],
  [56.94339, 24.11028],
  [56.94334, 24.11041],
  [56.94321, 24.11075],
  [56.94296, 24.11139],
  [56.94286, 24.11164],
  [56.94284, 24.1117],
  [56.94228, 24.11304],
  [56.94165, 24.1146],
  [56.94121, 24.1156],
  [56.94093, 24.11626],
  [56.9407, 24.11689],
  [56.94066, 24.11699],
  [56.94064, 24.11704],
  [56.94056, 24.11721],
  [56.94041, 24.11761],
  [56.94008, 24.11847],
  [56.93999, 24.11868],
  [56.93995, 24.11882],
  [56.93991, 24.11894],
  [56.93982, 24.11923],
  [56.93972, 24.11955],
  [56.93959, 24.12],
  [56.93956, 24.12009],
  [56.93933, 24.12088],
  [56.93911, 24.12161],
  [56.93877, 24.12301],
  [56.93809, 24.1259],
  [56.93779, 24.12718],
  [56.9375, 24.12839],
  [56.93676, 24.13154],
  [56.93643, 24.13291],
  [56.93602, 24.13434],
  [56.93577, 24.13514],
  [56.93547, 24.13606],
  [56.93502, 24.13738],
  [56.93491, 24.1377],
  [56.93455, 24.13891],
  [56.9343, 24.13973],
  [56.93412, 24.14041],
  [56.9341, 24.1405],
  [56.93407, 24.14062],
  [56.93366, 24.14223],
  [56.93336, 24.14343],
  [56.93318, 24.14401],
  [56.9331, 24.1443],
  [56.93306, 24.14448],
  [56.93297, 24.14484],
  [56.93294, 24.14495],
  [56.93279, 24.14553],
  [56.9327, 24.14588],
  [56.93216, 24.14782],
  [56.93194, 24.14852],
  [56.93182, 24.14884],
  [56.93172, 24.14907],
  [56.93114, 24.15027],
  [56.93091, 24.1507],
  [56.92907, 24.15407],
  [56.9285, 24.15509],
  [56.92733, 24.15716],
  [56.9264, 24.15887],
  [56.92595, 24.15976],
  [56.92588, 24.15992],
  [56.92569, 24.16032],
  [56.92509, 24.16155],
  [56.92473, 24.16228],
  [56.92466, 24.16244],
  [56.92455, 24.16267],
  [56.92398, 24.1639],
  [56.92328, 24.16546],
  [56.92307, 24.16596],
  [56.92292, 24.16648],
  [56.92274, 24.16701],
  [56.92257, 24.16759],
  [56.92242, 24.16804],
  [56.92234, 24.16835],
  [56.92215, 24.16898],
  [56.9221, 24.16916],
  [56.92209, 24.16923],
  [56.92205, 24.16935],
  [56.92201, 24.1695],
  [56.92184, 24.16992],
  [56.9218, 24.17001],
  [56.92174, 24.17013],
  [56.92171, 24.17026],
  [56.92169, 24.17032],
  [56.92162, 24.17046],
  [56.92158, 24.17059],
  [56.92157, 24.17067],
  [56.92158, 24.17074],
  [56.92159, 24.17081],
  [56.92161, 24.17089],
  [56.92162, 24.17093],
  [56.92169, 24.17099],
  [56.92172, 24.171],
  [56.92182, 24.17099],
  [56.92189, 24.17095],
  [56.92217, 24.17078],
  [56.92226, 24.17072],
  [56.92232, 24.17068],
  [56.92244, 24.1706],
  [56.92273, 24.17043],
  [56.92281, 24.17038],
  [56.92289, 24.17033],
  [56.92295, 24.17028],
  [56.92307, 24.17024],
  [56.9232, 24.17013],
  [56.92331, 24.17006],
  [56.92341, 24.17001],
  [56.92348, 24.17001],
  [56.92353, 24.17005],
  [56.9236, 24.17015],
  [56.92364, 24.17021],
  [56.92379, 24.17046],
  [56.92418, 24.17106],
  [56.92436, 24.17134],
  [56.92445, 24.17151],
  [56.92454, 24.1717],
  [56.92484, 24.17225],
  [56.92531, 24.17293],
  [56.92566, 24.17354],
  [56.92565, 24.1736],
  [56.92562, 24.17369],
  [56.92556, 24.17381],
  [56.92564, 24.17392],
  [56.92567, 24.17398],
  [56.92571, 24.17404],
  [56.92574, 24.17415],
  [56.92574, 24.17427],
  [56.9257, 24.1744],
  [56.92561, 24.17452],
]

// Named ends of the route (OpenStreetMap / Nominatim, fetched once).
export const PLACES = {
  oldRiga: { name: 'Old Riga, Doma laukums', lat: 56.94965, lon: 24.10523 },
  akropole: { name: 'Akropole Rīga', lat: 56.92397, lon: 24.17516 },
} as const
export type PlaceId = keyof typeof PLACES

type Step = ['ramp', number, number, number] | ['hold', number, number]

// Speed in km/h for each second of the drive.
function profileFrom(steps: Step[]): number[] {
  const p: number[] = []
  for (const step of steps) {
    if (step[0] === 'ramp') {
      const [, from, to, secs] = step
      for (let i = 1; i <= secs; i++) p.push(from + ((to - from) * i) / secs)
    } else {
      const [, v, secs] = step
      for (let i = 0; i < secs; i++) p.push(v + Math.sin(p.length / 7) * 1.5)
    }
  }
  return p
}

export type SimTripId = 'rushed' | 'calm' | 'evening'

// A few scripted fake trips on the same real streets. Each is stretched to end at
// its destination (see fitToRoute).
export const SIM_TRIPS: Array<{
  id: SimTripId
  label: string
  note: string
  reverse: boolean
  from: PlaceId
  to: PlaceId
  steps: Step[]
}> = [
  {
    id: 'rushed',
    label: 'Rushed commute',
    note: 'Speeding in Old Riga and on Krasta iela, one harsh braking and one harsh acceleration.',
    reverse: false,
    from: 'oldRiga',
    to: 'akropole',
    steps: [
      ['ramp', 0, 30, 8],
      ['hold', 35, 118], // Old Riga 30 zone: slightly over
      ['ramp', 35, 50, 8],
      ['hold', 48, 55], // embankment, within 50
      ['ramp', 48, 80, 12],
      ['hold', 80, 55], // Krasta iela: speeding
      ['ramp', 80, 40, 3], // harsh braking, about -3.7 m/s²
      ['hold', 42, 35],
      ['ramp', 42, 66, 2], // harsh acceleration, about +3.3 m/s²
      ['hold', 64, 30],
      ['ramp', 64, 48, 6],
      ['hold', 47, 45],
      ['ramp', 47, 0, 12],
    ],
  },
  {
    id: 'calm',
    label: 'Calm drive',
    note: 'Within every limit, smooth speed changes. Watch the score go up.',
    reverse: false,
    from: 'oldRiga',
    to: 'akropole',
    steps: [
      ['ramp', 0, 27, 10],
      ['hold', 26, 165], // Old Riga 30 zone
      ['ramp', 26, 46, 15],
      ['hold', 46, 150],
      ['ramp', 46, 38, 15], // gentle slow-down, still a sensible speed
      ['hold', 38, 10],
      ['ramp', 38, 46, 15],
      ['hold', 46, 150],
      ['ramp', 46, 0, 15],
    ],
  },
  {
    id: 'evening',
    label: 'Evening return',
    note: 'Back into Old Riga: moderate speeding, one harsh braking, a crawl far below the limit, calm in the old town.',
    reverse: true,
    from: 'akropole',
    to: 'oldRiga',
    steps: [
      ['ramp', 0, 50, 10],
      ['hold', 50, 60],
      ['ramp', 50, 64, 8],
      ['hold', 64, 90], // over the city 50
      ['ramp', 64, 30, 3], // harsh braking, about -3.1 m/s²
      ['hold', 40, 30],
      ['ramp', 40, 50, 10],
      ['hold', 49, 40],
      ['ramp', 49, 21, 8],
      ['hold', 21, 30], // crawling at ~20 on a 50 road: far below the limit
      ['ramp', 21, 49, 8],
      ['hold', 49, 78], // slow down only when reaching Old Riga
      ['ramp', 49, 30, 10],
      ['hold', 29, 120], // Old Riga 30 zone, within
      ['ramp', 29, 0, 10],
    ],
  },
]

const toRad = (d: number) => (d * Math.PI) / 180
function segmentKm(a: [number, number], b: [number, number]) {
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// Position after travelling `km` along the route (clamped to its end).
function pointAt(route: Array<[number, number]>, km: number): [number, number] {
  let left = km
  for (let i = 1; i < route.length; i++) {
    const len = segmentKm(route[i - 1], route[i])
    if (left <= len) {
      const f = len > 0 ? left / len : 0
      return [
        route[i - 1][0] + (route[i][0] - route[i - 1][0]) * f,
        route[i - 1][1] + (route[i][1] - route[i - 1][1]) * f,
      ]
    }
    left -= len
  }
  return route[route.length - 1]
}

// Route length in km.
function routeKm(route: Array<[number, number]>): number {
  let km = 0
  for (let i = 1; i < route.length; i++) km += segmentKm(route[i - 1], route[i])
  return km
}

// Make the drive end exactly at the destination: cruise a little longer before
// the final stop if the script is shorter than the route.
function fitToRoute(steps: Step[], km: number): number[] {
  const scripted = profileFrom(steps)
  const covered = scripted.reduce((sum, v) => sum + v / 3600, 0)
  const last = steps[steps.length - 1]
  if (covered >= km || last[0] !== 'ramp') return scripted
  const cruise = last[1]
  const extraSec = Math.ceil(((km - covered) / cruise) * 3600)
  return profileFrom([...steps.slice(0, -1), ['hold', cruise, extraSec], last])
}

// 12x by default for quick demos; the simulated clock follows the same speed. 1x is real time.
export const SIMULATION_SPEEDS = [1, 12] as const
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number]
export const DEFAULT_SIMULATION_SPEED: SimulationSpeed = 12

let lastPicked: SimTripId | null = null

// A random fake trip for each Start, never the same one twice in a row.
export function simTrip(id: SimTripId) {
  return SIM_TRIPS.find((t) => t.id === id) ?? SIM_TRIPS[0]
}

export function pickRandomSimTrip(): SimTripId {
  const options = SIM_TRIPS.map((t) => t.id).filter((id) => id !== lastPicked)
  lastPicked = options[Math.floor(Math.random() * options.length)]
  return lastPicked
}

// All fixes of a scripted trip, one per simulated second, ending at `end`.
export function simulatedFixes(tripId: SimTripId = 'rushed', end = Date.now()): GpsFix[] {
  const trip = SIM_TRIPS.find((t) => t.id === tripId) ?? SIM_TRIPS[0]
  const route = trip.reverse ? [...ROUTE].reverse() : ROUTE
  const profile = fitToRoute(trip.steps, routeKm(route))
  const start = end - profile.length * 1000
  let km = 0
  return profile.map((kmh, i) => {
    km += kmh / 3600
    const [lat, lon] = pointAt(route, km)
    return { t: start + i * 1000, lat, lon, accuracy: 6, speed: kmh / 3.6 }
  })
}

// Simulated length of a trip in seconds.
export const runLengthSec = (tripId: SimTripId) => simulatedFixes(tripId, 0).length

// The fixes of one run. The trip starts at the moment of the press and the simulated clock advances one
// second per fix, so minutes, the trip's start and end and the phone clock (see simClock.ts) agree at any
// speed. At 12x the whole trip is delivered in a twelfth of its length.
export function fixesForRun(tripId: SimTripId, _speed: SimulationSpeed, now = Date.now()): GpsFix[] {
  return simulatedFixes(tripId, now + runLengthSec(tripId) * 1000)
}

// Feeds the fixes `speed` times faster than the simulated clock (1 = real time).
export function startSimulatedDrive(
  tripId: SimTripId,
  onFix: (fix: GpsFix) => void,
  onDone: () => void,
  speed: SimulationSpeed = DEFAULT_SIMULATION_SPEED,
): () => void {
  const fixes = fixesForRun(tripId, speed)
  let i = 0
  const timer = setInterval(() => {
    if (i >= fixes.length) {
      clearInterval(timer)
      onDone()
      return
    }
    onFix(fixes[i++])
  }, 1000 / speed)
  return () => clearInterval(timer)
}
