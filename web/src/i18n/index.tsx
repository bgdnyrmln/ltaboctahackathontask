// Minimal EN | LV translation. The English text is the key: t('Sign in') shows the Latvian entry from
// lv/ when the language is LV and the English text otherwise, so a missing entry degrades to English.
// Placeholders look like {name} and are filled from the second argument. i18n.test.ts checks that
// every t('...') literal in the source has a Latvian entry.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { translate, type Lang, type Params } from './translate.ts'

export type { Lang, Params }
export type TFn = (text: string, params?: Params) => string
export type TnFn = (n: number, one: string, many: string, params?: Params) => string

const STORAGE_KEY = 'octa.lang'

function readStored(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'lv' || v === 'en') return v
  } catch {
    // storage can be unavailable (private window); fall back to English
  }
  return 'en'
}

interface LangContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: TFn
  tn: TnFn
}

const isSingular = (lang: Lang, n: number) =>
  lang === 'lv' ? n % 10 === 1 && n % 100 !== 11 : n === 1

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (text, params) => translate('en', text, params),
  tn: (n, one, many, params) => translate('en', n === 1 ? one : many, { n, ...params }),
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStored)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // Another window (for example the phone frame of the demo) changed the language.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLangState(readStored())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // keep the choice for this session only
    }
  }, [])

  const t = useCallback<TFn>((text, params) => translate(lang, text, params), [lang])
  const tn = useCallback<TnFn>(
    (n, one, many, params) => translate(lang, isSingular(lang, n) ? one : many, { n, ...params }),
    [lang],
  )
  const value = useMemo(() => ({ lang, setLang, t, tn }), [lang, setLang, t, tn])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)
export const useT = (): TFn => useContext(LangContext).t
export const useTn = (): TnFn => useContext(LangContext).tn

// A tip carries an English fill (text) and, when it was built from a template, the template and numbers.
export function tipText(t: TFn, tip: { text: string; template?: string; params?: { from: number; to: number } }): string {
  return tip.template && tip.params ? t(tip.template, tip.params) : t(tip.text)
}

export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang()
  return (
    <div className={`lang-switch ${className}`.trim()} role="group" aria-label="Language">
      {(['en', 'lv'] as const).map((l) => (
        <button
          key={l}
          type="button"
          className={`lang-switch__btn${lang === l ? ' is-active' : ''}`}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
