import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createApi, dScore, type Profile, type SignInResult } from '@data'

// Agent C's API owns the demo session and data; scoring is Agent D's dScore (plugged in
// via scoreFn as the API docs describe). This context adds registration progress.
export const api = createApi({ scoreFn: dScore })

const registrationKey = (driverId: string) => `foc.registration.${driverId}`

// Only consent flags and timestamps are stored here, never profile data.
export type Registration = {
  consent?: { trips: true; shareSummary: boolean; at: string }
  registeredAt?: string
}

type AuthState =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; profile: Profile; registration: Registration }

type AuthContextValue = {
  state: AuthState
  signIn: (demoId: string) => Promise<SignInResult>
  giveConsent: (shareSummary: boolean) => void
  completeRegistration: () => void
  signOut: () => Promise<void>
  markSignedOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readRegistration(driverId: string): Registration {
  try {
    return JSON.parse(localStorage.getItem(registrationKey(driverId)) ?? '{}') as Registration
  } catch {
    return {}
  }
}

function writeRegistration(driverId: string, registration: Registration) {
  try {
    localStorage.setItem(registrationKey(driverId), JSON.stringify(registration))
  } catch {
    // Storage unavailable (private mode): progress lasts for this page view only.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    api.getSession().then((profile) => {
      setState(
        profile
          ? { status: 'signedIn', profile, registration: readRegistration(profile.driver.id) }
          : { status: 'signedOut' },
      )
    })
  }, [])

  const updateRegistration = useCallback((patch: Partial<Registration>) => {
    setState((current) => {
      if (current.status !== 'signedIn') return current
      const registration = { ...current.registration, ...patch }
      writeRegistration(current.profile.driver.id, registration)
      return { ...current, registration }
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      async signIn(demoId) {
        const result = await api.signIn(demoId)
        if (result.ok) {
          setState({
            status: 'signedIn',
            profile: result.profile,
            registration: readRegistration(result.profile.driver.id),
          })
        }
        return result
      },
      giveConsent(shareSummary) {
        updateRegistration({ consent: { trips: true, shareSummary, at: new Date().toISOString() } })
      },
      completeRegistration() {
        updateRegistration({ registeredAt: new Date().toISOString() })
      },
      async signOut() {
        await api.signOut()
        setState({ status: 'signedOut' })
      },
      // After deleteMyData the API has already ended the session.
      markSignedOut() {
        setState({ status: 'signedOut' })
      },
    }),
    [state, updateRegistration],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

// Where a signed-in user should be, given how far registration got.
export function nextStepPath(registration: Registration): string {
  if (!registration.consent) return '/register/consent'
  if (!registration.registeredAt) return '/register/profile'
  return '/app'
}
