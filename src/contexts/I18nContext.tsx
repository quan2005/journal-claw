import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { detectLang, createTranslator, type Lang } from '../lib/i18n'
import { en, type Strings } from '../locales/en'
import { zh } from '../locales/zh'

type TFn = (key: keyof Strings, vars?: Record<string, string | number>) => string

interface I18nContextValue {
  lang: Lang
  t: TFn
  /** Raw strings object — use for array values like s.weekdays[n] */
  s: Strings
}

const locales: Record<Lang, Strings> = { en, zh }

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  t: (key) => String(en[key]),
  s: en,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const value = useMemo<I18nContextValue>(() => {
    const lang = detectLang()
    const s = locales[lang]
    return { lang, t: createTranslator(lang), s }
  }, [])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslation() {
  return useContext(I18nContext)
}
