import { describe, expect, it } from 'vitest'
import { resolveActiveNav } from '../settings/navigation'

describe('resolveActiveNav', () => {
  const sectionTops = {
    general: 0,
    ai: 120,
    voice: 180,
    guide: 220,
    plugins: 420,
    about: 520,
  } as const

  it('keeps the topmost visible section highlighted', () => {
    expect(resolveActiveNav(sectionTops, 0)).toBe('general')
    expect(resolveActiveNav(sectionTops, 89)).toBe('general')
    expect(resolveActiveNav(sectionTops, 90)).toBe('ai')
    expect(resolveActiveNav(sectionTops, 150)).toBe('voice')
  })

  it('activates short trailing sections at the bottom', () => {
    expect(resolveActiveNav(sectionTops, 390)).toBe('plugins')
    expect(resolveActiveNav(sectionTops, 490)).toBe('about')
  })
})
