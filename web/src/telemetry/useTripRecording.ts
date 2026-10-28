import type { TripSummary } from '@data'
import { useCallback, useEffect, useRef, useState } from 'react'
import { postLiveTrip } from './liveChannel'
import { canRecordTrips, isPhoneSimulator } from './platform'
import {
  PLACES,
  pickRandomSimTrip,
  runLengthSec,
  simTrip,
  startSimulatedDrive,
  type SimTripId,
  SIMULATION_SPEED,
} from './simulatedDrive'
import { obdConnectedDevice } from './obdLink'
import { rememberSimTrip } from './tripAnalysis'
import { TripRecorder, type GpsFix, type LiveStats } from './tripRecorder'

export type RecordingStatus = 'idle' | 'requesting' | 'recording' | 'denied' | 'unsupported' | 'error'

type WakeLockSentinelLike = { release: () => Promise<void> }

// Records one trip from the phone's GPS. Keeps the screen awake while recording,
// because a web app cannot track location in the background.
export function useTripRecording() {
  const [status, setStatus] = useState<RecordingStatus>(() =>
    typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'idle' : 'unsupported',
  )
  const [stats, setStats] = useState<LiveStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recorder = useRef<TripRecorder | null>(null)
  const watchId = useRef<number | null>(null)
  const wakeLock = useRef<WakeLockSentinelLike | null>(null)
  const ticker = useRef<number | null>(null)
  const stopSimulation = useRef<(() => void) | null>(null)
  const [routeDone, setRouteDone] = useState(false)
  const eventCounts = useRef({ brake: 0, accel: 0 })
  const simTripId = useRef<SimTripId | null>(null)

  // Feed one fix to the recorder, update the screen and broadcast it to the live map.
  const ingest = useCallback((fix: GpsFix) => {
    const rec = recorder.current
    if (!rec) return
    rec.add(fix)
    const s = rec.stats()
    setStats(s)
    postLiveTrip({
      type: 'fix',
      lat: fix.lat,
      lon: fix.lon,
      kmh: s.speedKmh,
      limitKmh: s.limitKmh,
      limitName: s.limitName,
      overLimit: s.overLimit,
      tooSlow: s.tooSlow,
      distanceKm: s.distanceKm,
      elapsedSec: s.elapsedSec,
    })
    if (s.harshBrakes > eventCounts.current.brake)
      postLiveTrip({ type: 'event', kind: 'brake', lat: fix.lat, lon: fix.lon })
    if (s.harshAccels > eventCounts.current.accel)
      postLiveTrip({ type: 'event', kind: 'accel', lat: fix.lat, lon: fix.lon })
    eventCounts.current = { brake: s.harshBrakes, accel: s.harshAccels }
  }, [])

  const cleanup = useCallback(() => {
    stopSimulation.current?.()
    stopSimulation.current = null
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
    if (ticker.current !== null) window.clearInterval(ticker.current)
    ticker.current = null
    wakeLock.current?.release().catch(() => {})
    wakeLock.current = null
  }, [])

  useEffect(() => cleanup, [cleanup])

  const start = useCallback(async () => {
    // Trips start only on a phone (native app or the site's phone simulator), never on desktop.
    if (!canRecordTrips()) {
      setStatus('unsupported')
      return
    }
    setRouteDone(false)
    eventCounts.current = { brake: 0, accel: 0 }
    if (isPhoneSimulator()) {
      // No GPS in a desktop browser: drive a random scripted Riga trip through the same recorder.
      const tripId = pickRandomSimTrip()
      simTripId.current = tripId
      const trip = simTrip(tripId)
      postLiveTrip({
        type: 'start',
        at: Date.now(),
        from: PLACES[trip.from].name,
        to: PLACES[trip.to].name,
        speed: SIMULATION_SPEED,
        durationSec: runLengthSec(tripId),
      })
      setError(null)
      // With the (simulated) OBD-II adapter connected, trips are labelled as OBD data.
      recorder.current = new TripRecorder(obdConnectedDevice() ? 'obd_mock' : 'synthetic')
      setStatus('recording')
      stopSimulation.current = startSimulatedDrive(tripId, ingest, () => setRouteDone(true))
      return
    }
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }
    if (!window.isSecureContext) {
      setStatus('error')
      setError('Location needs HTTPS. Open the app over https:// (or localhost).')
      return
    }
    postLiveTrip({ type: 'start', at: Date.now() })
    setError(null)
    setStatus('requesting')
    recorder.current = new TripRecorder()
    setStats(recorder.current.stats())

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setStatus('recording')
        ingest({
          t: pos.timestamp,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          cleanup()
          recorder.current = null
          setStatus('denied')
        } else {
          setError(err.code === err.TIMEOUT ? 'Waiting for GPS signal…' : 'GPS position unavailable.')
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )

    ticker.current = window.setInterval(() => {
      if (recorder.current) setStats(recorder.current.stats())
    }, 1000)

    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } }
      wakeLock.current = (await nav.wakeLock?.request('screen')) ?? null
    } catch {
      // Wake lock not granted: recording still works while the screen stays on.
    }
  }, [cleanup, ingest])

  const stop = useCallback(
    (driverId: string, vehicleId: string | null): TripSummary | null => {
      cleanup()
      const last = recorder.current?.stats()
      const trip = recorder.current?.finish(driverId, vehicleId) ?? null
      // Simulated trips can be replayed later from their script (no positions stored).
      if (trip && trip.source !== 'phone' && simTripId.current) rememberSimTrip(trip.id, simTripId.current)
      simTripId.current = null
      postLiveTrip({
        type: 'end',
        saved: trip !== null,
        distanceKm: trip?.distanceKm ?? last?.distanceKm ?? 0,
        harshBrakes: trip?.harshBrakeCount ?? last?.harshBrakes ?? 0,
        harshAccels: trip?.harshAccelCount ?? last?.harshAccels ?? 0,
        secTooSlow: last?.secTooSlow ?? 0,
      })
      recorder.current = null
      setStatus('idle')
      setStats(null)
      return trip
    },
    [cleanup],
  )

  // Phone use while driving (D's phone KPI): touches on the driving screen and
  // leaving/returning to the app while a trip records. Other apps, calls and unlocks
  // are not visible to a web app.
  const markPhone = useCallback(() => recorder.current?.markPhoneActivity(), [])
  useEffect(() => {
    if (status !== 'recording') return
    const onVisibility = () => recorder.current?.markPhoneActivity()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [status])

  return { status, stats, error, routeDone, start, stop, markPhone }
}
