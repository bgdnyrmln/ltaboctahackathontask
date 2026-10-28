import { DEMO_LABEL, type DemoIdentityOption, type SignInError } from '@data'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { nextStepPath, useAuth } from '../auth/AuthContext'
import { appApi } from '../auth/appApi'
import { codeForDemoId, nameForDemoId } from '../demo/personas'
import { AppShell, Stepper } from '../components/AppShell'
import { useT } from '../i18n'
import './App.css'

// Messages per HACK-17 contract. Never echo what the user typed.
const ERROR_TEXT: Record<SignInError, string> = {
  invalid_input: 'Choose a test profile or enter one of its test personal codes. Real personal codes are never accepted.',
  unknown_identity: 'Demo profile not found. Pick one from the list.',
  data_missing: 'Profile data is unavailable. Try again or pick another profile.',
}

const CONFIRM_MS = 2600

type Step = { kind: 'choose' } | { kind: 'confirm'; demoId: string; code: string }

export function Login() {
  const t = useT()
  const { state, signIn } = useAuth()
  const navigate = useNavigate()
  const [options, setOptions] = useState<DemoIdentityOption[]>([])
  const [selected, setSelected] = useState('')
  const [typed, setTyped] = useState('')
  const [step, setStep] = useState<Step>({ kind: 'choose' })
  const [error, setError] = useState<SignInError | null>(null)
  const cancelled = useRef(false)

  useEffect(() => {
    appApi()
      .listDemoProfiles()
      .then((list) => {
        setOptions(list)
        setSelected((current) => current || list[0]?.demoId || '')
      })
  }, [])

  // Signed in (already, or after the fake confirmation): continue where registration stopped.
  useEffect(() => {
    if (state.status === 'signedIn') navigate(nextStepPath(state.registration), { replace: true })
  }, [state, navigate])

  const start = (e: FormEvent) => {
    e.preventDefault()
    const demoId = (typed.trim() || selected).trim()
    setError(null)
    if (!demoId) {
      setError('invalid_input')
      return
    }
    cancelled.current = false
    // Fake Smart-ID verification code, like the real app shows before PIN1.
    const code = String(1000 + Math.floor(Math.random() * 9000))
    setStep({ kind: 'confirm', demoId, code })
    window.setTimeout(async () => {
      if (cancelled.current) return
      const result = await signIn(demoId)
      if (cancelled.current) return
      if (!result.ok) {
        setError(result.error)
        setTyped('')
        setStep({ kind: 'choose' })
      }
    }, CONFIRM_MS)
  }

  const cancel = () => {
    cancelled.current = true
    setStep({ kind: 'choose' })
  }

  return (
    <AppShell>
      <div className="container auth-page">
        <Stepper current={1} />
        <div className="auth-card">
          <div className="auth-card__head">
            <span className="sid-mark" aria-hidden="true">
              ID
            </span>
            <div>
              <h1 className="auth-card__title">{t('Sign in with Smart-ID')}</h1>
              <p className="demo-label">{t(DEMO_LABEL)}</p>
            </div>
          </div>

          {step.kind === 'choose' ? (
            <form onSubmit={start} className="auth-form" noValidate>
              {error && (
                <p className="form-error" role="alert">
                  {t(ERROR_TEXT[error])}
                </p>
              )}

              <fieldset className="profile-picker">
                <legend>{t('Choose a test profile')}</legend>
                {options.map((option) => (
                  <label key={option.demoId} className="profile-option">
                    <input
                      type="radio"
                      name="demo-profile"
                      value={option.demoId}
                      checked={!typed && selected === option.demoId}
                      onChange={() => {
                        setSelected(option.demoId)
                        setTyped('')
                      }}
                    />
                    <span className="profile-option__body">
                      <span className="profile-option__name">{nameForDemoId(option.demoId, option.displayName)}</span>
                      <span className="profile-option__id">{codeForDemoId(option.demoId) ?? option.demoId}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <label className="field">
                <span className="field__label">{t('Or enter a test personal code')}</span>
                <input
                  className="field__input"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="300291-17428"
                  autoComplete="off"
                  inputMode="text"
                />
                <span className="field__hint">{t('Test codes only. Real personal codes are rejected and never stored.')}</span>
              </label>

              <button type="submit" className="btn btn--primary auth-form__submit">
                {t('Continue')}
              </button>
            </form>
          ) : (
            <div className="sid-confirm" role="status" aria-live="polite">
              <p className="sid-confirm__label">{t('Verification code')}</p>
              <p className="sid-confirm__code">{step.code}</p>
              <p className="sid-confirm__text">
                {t('In the real Smart-ID app you would check this code and enter PIN1. This demo confirms automatically.')}
              </p>
              <div className="progress" aria-hidden="true">
                <span style={{ animationDuration: `${CONFIRM_MS}ms` }} />
              </div>
              <button type="button" className="btn btn--outline" onClick={cancel}>
                {t('Cancel')}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
