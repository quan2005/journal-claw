import { describe, expect, it } from 'vitest'
import {
  IMPLEMENTED_LAYOUT_MODULES,
  JOURNAL_LAYOUT_MODULES,
  getLayoutModuleSpec,
  resolveLayoutModuleName,
} from '../lib/journalLayout'

describe('journal layout catalog', () => {
  it('registers the complete 43-module catalog', () => {
    expect(JOURNAL_LAYOUT_MODULES).toHaveLength(43)
    expect(new Set(JOURNAL_LAYOUT_MODULES.map((spec) => spec.name)).size).toBe(43)
  })

  it('marks exactly the phase 1 renderer modules as implemented', () => {
    expect(IMPLEMENTED_LAYOUT_MODULES).toEqual([
      'callout',
      'hero',
      'cards',
      'metrics',
      'steps',
      'timeline',
      'verdict',
      'quote',
      'image-text',
      'faq',
    ])
  })

  it('resolves aliases without changing canonical names', () => {
    expect(resolveLayoutModuleName('admonition')).toBe('callout')
    expect(resolveLayoutModuleName('stat-row')).toBe('stat-row')
    expect(getLayoutModuleSpec('admonition')?.name).toBe('callout')
  })

  it('stores schema data used by validation', () => {
    expect(getLayoutModuleSpec('hero')).toMatchObject({
      bodyFormat: 'fields',
      requiredFields: ['title'],
      implemented: true,
    })
    expect(getLayoutModuleSpec('resource-list')).toMatchObject({
      bodyFormat: 'json_array',
      implemented: false,
    })
  })
})
