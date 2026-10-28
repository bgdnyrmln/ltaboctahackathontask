// Live trip feed from the phone (app or phone frame) to other windows of the
// same site, e.g. the live map next to the phone. Positions are shown live
// only; they are never stored.
export type LiveTripMessage =
  | { type: 'start'; at: number }
  | {
      type: 'fix'
      lat: number
      lon: number
      kmh: number
      limitKmh: number
      limitName: string | null
      overLimit: boolean
      distanceKm: number
      elapsedSec: number
    }
  | { type: 'event'; kind: 'brake' | 'accel'; lat: number; lon: number }
  | { type: 'end'; saved: boolean; distanceKm: number; harshBrakes: number; harshAccels: number }

const CHANNEL = 'foc-live-trip'

let channel: BroadcastChannel | null = null
function getChannel() {
  if (typeof BroadcastChannel === 'undefined') return null
  return (channel ??= new BroadcastChannel(CHANNEL))
}

export function postLiveTrip(message: LiveTripMessage) {
  getChannel()?.postMessage(message)
}

// Messages from other windows/frames (BroadcastChannel never echoes to the sender).
export function onLiveTrip(fn: (message: LiveTripMessage) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const listener = new BroadcastChannel(CHANNEL)
  listener.onmessage = (e: MessageEvent<LiveTripMessage>) => fn(e.data)
  return () => listener.close()
}
