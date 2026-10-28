import { createCsddMockRegistry, createDemoSmartIdAuth, type Profile, type SignInResult } from '@data'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// Agent C's mock providers. A real identity/registry provider replaces only these two lines.
const registry = createCsddMockRegistry()
export const identityProvider = createDemoSmartIdAuth(registry)

const STORAGE_KEY = 'foc.session'

// Only the demo handle and registration flags are stored, never profile data.
type StoredSession = {
  demoId: string
  consent?: { trips: true; shareSummary: boolean; at: string }
  registeredAt?: string
}

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; profile: Profile; session: StoredSession }

type AuthContextValue = {
  state: AuthState
  signIn: (demoId: string) => Promise<SignInResult>
  giveConsent: (shareSummary: boolean) => void
  completeRegistration: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

function writeSession(session: StoredSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable (private mode): the session lasts for this page view only.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  // Restore a previous demo session by signing in again with the stored handle.
  useEffect(() => {
    const stored = readSession()
    if (!stored) {
      setState({ status: 'signedOut' })
      return
    }
    identityProvider.signIn(stored.demoId).then((result) => {
      if (result.ok) setState({ status: 'signedIn', profile: result.profile, session: stored })
      else {
        writeSession(null)
        setState({ status: 'signedOut' })
      }
    })
  }, [])

  const updateSession = useCallback((patch: Partial<StoredSession>) => {
    setState((current) => {
      if (current.status !== 'signedIn') return current
      const session = { ...current.session, ...patch }
      writeSession(session)
      return { ...current, session }
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      async signIn(demoId) {
        const result = await identityProvider.signIn(demoId)
        if (result.ok) {
          const previous = readSession()
          const session = previous?.demoId === demoId.trim() ? previous : { demoId: demoId.trim() }
          writeSession(session)
          setState({ status: 'signedIn', profile: result.profile, session })
        }
        return result
      },
      giveConsent(shareSummary) {
        updateSession({ consent: { trips: true, shareSummary, at: new Date().toISOString() } })
      },
      completeRegistration() {
        updateSession({ registeredAt: new Date().toISOString() })
      },
      signOut() {
        writeSession(null)
        setState({ status: 'signedOut' })
      },
    }),
    [state, updateSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

// Where a signed-in user should be, given how far registration got.
export function nextStepPath(session: StoredSession): string {
  if (!session.consent) return '/register/consent'
  if (!session.registeredAt) return '/register/profile'
  return '/app'
}
