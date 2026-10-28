// Live trip recording runs only inside the native mobile app shell (Capacitor on
// iOS/Android), where GPS works reliably and in the background. In a desktop or
// mobile browser the Drive screen points to the app and offers the demo dongle.
type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string }

export function isNativeMobileApp(): boolean {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor
  if (!cap?.isNativePlatform?.()) return false
  const platform = cap.getPlatform?.()
  return platform === 'ios' || platform === 'android'
}
