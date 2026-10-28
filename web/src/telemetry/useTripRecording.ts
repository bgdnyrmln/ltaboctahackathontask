import type { TripSummary } from '@trips'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TripRecorder, type LiveStats } from './tripRecorder'

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

  const cleanup = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
    if (ticker.current !== null) window.clearInterval(ticker.current)
    ticker.current = null
    wakeLock.current?.release().catch(() => {})
    wakeLock.current = null
  }, [])

  useEffect(() => cleanup, [cleanup])

  const start = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }
    if (!window.isSecureContext) {
      setStatus('error')
      setError('Location needs HTTPS. Open the app over https:// (or localhost).')
      return
    }
    setError(null)
    setStatus('requesting')
    recorder.current = new TripRecorder()
    setStats(recorder.current.stats())

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setStatus('recording')
        recorder.current?.add({
          t: pos.timestamp,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
        })
        if (recorder.current) setStats(recorder.current.stats())
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
  }, [cleanup])

  const stop = useCallback(
    (driverId: string, vehicleId: string | null): TripSummary | null => {
      cleanup()
      const trip = recorder.current?.finish(driverId, vehicleId) ?? null
      recorder.current = null
      setStatus('idle')
      setStats(null)
      return trip
    },
    [cleanup],
  )

  return { status, stats, error, start, stop }
}
