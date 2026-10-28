// Pure translation function, kept free of React so tests can import it.
import { LV } from './lv/index.ts'

export type Lang = 'en' | 'lv'
export type Params = Record<string, string | number>

// The English text is the key. A missing Latvian entry falls back to English.
export function translate(lang: Lang, text: string, params?: Params): string {
  const base = lang === 'lv' ? (LV[text] ?? text) : text
  return params ? base.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : base
}
