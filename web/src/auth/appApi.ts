import { createApi, dScore, type OctaApi } from '@data'

// One shared data store for every screen of the site (web account, phone app,
// phone simulator): Agent C's API on localStorage, scored with Agent D's dScore.
// When another window or the phone frame changes the data, the browser fires a
// `storage` event here; we rebuild the API from storage and notify screens.
let current: OctaApi = createApi({ scoreFn: dScore })
const listeners = new Set<() => void>()

const SHARED_PREFIXES = ['octa.', 'foc.']

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== null && !SHARED_PREFIXES.some((p) => e.key!.startsWith(p))) return
    current = createApi({ scoreFn: dScore })
    listeners.forEach((fn) => fn())
  })
}

export function appApi(): OctaApi {
  return current
}

// Called when data changed in another window or frame. Returns an unsubscribe.
export function onSharedDataChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
