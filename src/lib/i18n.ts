import { en } from '../locales/en'
import { zh } from '../locales/zh'
import type { Strings } from '../locales/en'

export type Lang = 'en' | 'zh'

export function detectLang(): Lang {
  return navigator.language.startsWith('zh') ? 'zh' : 'en'
}

const locales: Record<Lang, Strings> = { en, zh }

/**
 * Returns a translation function for the given language.
 * Supports simple variable substitution: t('key', { name: 'Alice' })
 * where the string contains {name}.
 */
export function createTranslator(lang: Lang) {
  const strings = locales[lang]
  return function t(key: keyof Strings, vars?: Record<string, string | number>): string {
    const val = strings[key]
    const str = Array.isArray(val) ? (val as string[]).join(',') : String(val)
    if (!vars) return str
    return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
  }
}
