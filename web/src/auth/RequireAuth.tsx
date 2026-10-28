import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { nextStepPath, useAuth } from './AuthContext'

type Stage = 'consent' | 'profile' | 'app'

const stagePath: Record<Stage, string> = {
  consent: '/register/consent',
  profile: '/register/profile',
  app: '/app',
}

// Lets the user see a page only when they are signed in and at that registration stage.
export function RequireAuth({ stage, children }: { stage: Stage; children: ReactNode }) {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') {
    return (
      <div className="app-loading" role="status">
        <span className="spinner" aria-hidden="true" />
        Loading…
      </div>
    )
  }
  if (state.status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const expected = nextStepPath(state.session)
  if (stage === 'app' ? expected !== '/app' : expected !== stagePath[stage]) {
    // Allow going back from profile to consent; otherwise send to the current step.
    if (!(stage === 'consent' && expected === '/register/profile')) {
      return <Navigate to={expected} replace />
    }
  }
  return children
}
