import { createMockElm327, parseObdReply } from '@data'
import { useCallback, useEffect, useRef, useState } from 'react'

// Simulated Bluetooth connection to an OBD-II (ELM327) adapter for the demo. The
// handshake runs real ELM327 commands against Agent C's mock dongle, so the log
// shows genuine requests and replies. No Bluetooth hardware is used.

export type BtDevice = { id: string; name: string; detail: string; rssi: number; obd: boolean }
export type ObdStatus = 'disconnected' | 'scanning' | 'found' | 'pairing' | 'initializing' | 'connected' | 'error'
export type ObdLogLine = { dir: 'out' | 'in' | 'info'; text: string }

const DEVICES: BtDevice[] = [
  { id: 'elm327', name: 'OBDII', detail: 'ELM327 v1.5 · Bluetooth LE', rssi: -48, obd: true },
  { id: 'vgate', name: 'Vgate iCar Pro', detail: 'OBD-II · Bluetooth LE', rssi: -69, obd: true },
  { id: 'jbl', name: 'JBL Flip 5', detail: 'Audio device', rssi: -82, obd: false },
]

const KEY = 'foc.obd'
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

export function obdConnectedDevice(): BtDevice | null {
  try {
    const id = localStorage.getItem(KEY)
    return DEVICES.find((d) => d.id === id) ?? null
  } catch {
    return null
  }
}

// Engine speed for a given road speed with a simple 5-gear model (for the live screen).
export function rpmFor(kmh: number): number {
  if (kmh < 5) return 820
  const ratios = [95, 58, 41, 32, 26]
  const gear = Math.min(4, Math.floor(kmh / 22))
  return Math.round(1000 + kmh * ratios[gear] * 0.6)
}

export function useObdLink() {
  const [device, setDevice] = useState<BtDevice | null>(() => obdConnectedDevice())
  const [status, setStatus] = useState<ObdStatus>(() => (obdConnectedDevice() ? 'connected' : 'disconnected'))
  const [found, setFound] = useState<BtDevice[]>([])
  const [log, setLog] = useState<ObdLogLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const [idleRpm, setIdleRpm] = useState<number | null>(null)
  const cancelled = useRef(false)

  useEffect(
    () => () => {
      cancelled.current = true
    },
    [],
  )

  const scan = useCallback(async () => {
    cancelled.current = false
    setError(null)
    setFound([])
    setStatus('scanning')
    for (const d of DEVICES) {
      await wait(700)
      if (cancelled.current) return
      setFound((list) => [...list, d])
    }
    setStatus('found')
  }, [])

  const connect = useCallback(async (d: BtDevice) => {
    cancelled.current = false
    setError(null)
    setLog([])
    setStatus('pairing')
    await wait(1200)
    if (cancelled.current) return
    if (!d.obd) {
      setStatus('error')
      setError(`${d.name} is not an OBD-II adapter. Pick the adapter plugged into the car.`)
      return
    }
    setStatus('initializing')
    const add = (line: ObdLogLine) => setLog((l) => [...l, line])
    add({ dir: 'info', text: `Connected to ${d.name} (${d.detail})` })
    const dongle = createMockElm327(() => ({ speedKmh: 0, rpm: 820, throttlePct: 14 }))
    for (const cmd of ['ATZ', 'ATE0', 'ATL0', 'ATSP0', '010C', '010D']) {
      await wait(450)
      if (cancelled.current) return
      add({ dir: 'out', text: cmd })
      const reply = (await dongle.send(cmd)).replace(/[\r>]/g, ' ').trim()
      const value = parseObdReply(reply)
      add({
        dir: 'in',
        text:
          reply +
          (value?.pid === 'rpm' ? `  → engine ${Math.round(value.value)} rpm` : '') +
          (value?.pid === 'speed' ? `  → ${value.value} km/h` : ''),
      })
      if (value?.pid === 'rpm') setIdleRpm(Math.round(value.value))
    }
    await wait(400)
    try {
      localStorage.setItem(KEY, d.id)
    } catch {
      // Storage unavailable: connected for this page view only.
    }
    setDevice(d)
    setStatus('connected')
  }, [])

  const disconnect = useCallback(() => {
    try {
      localStorage.removeItem(KEY)
    } catch {
      // ignore
    }
    setDevice(null)
    setLog([])
    setStatus('disconnected')
  }, [])

  const cancel = useCallback(() => {
    cancelled.current = true
    setStatus(obdConnectedDevice() ? 'connected' : 'disconnected')
  }, [])

  return { device, status, found, log, error, idleRpm, scan, connect, disconnect, cancel }
}
