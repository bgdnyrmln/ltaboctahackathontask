// Live trip recording runs only inside a phone: the native mobile app shell
// (Capacitor on iOS/Android) or the phone simulator frame on the website's live
// demo page. A desktop or mobile browser shows the app-only notice instead.
type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string }

// The demo page loads the app into an iframe with this name.
export const PHONE_FRAME_NAME = 'foc-phone'

export function isNativeMobileApp(): boolean {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor
  if (!cap?.isNativePlatform?.()) return false
  const platform = cap.getPlatform?.()
  return platform === 'ios' || platform === 'android'
}

export function isPhoneSimulator(): boolean {
  return typeof window !== 'undefined' && window.name === PHONE_FRAME_NAME
}

export function canRecordTrips(): boolean {
  return isNativeMobileApp() || isPhoneSimulator()
}
