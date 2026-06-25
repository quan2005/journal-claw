import { describe, expect, it } from 'vitest'
import {
  IMPLEMENTED_LAYOUT_MODULES,
  JOURNAL_LAYOUT_MODULES,
  getLayoutModuleSpec,
  resolveLayoutModuleName,
} from '../lib/journalLayout'

describe('journal layout catalog', () => {
  it('registers the complete 22-module article catalog', () => {
    expect(JOURNAL_LAYOUT_MODULES).toHaveLength(22)
    expect(new Set(JOURNAL_LAYOUT_MODULES.map((spec) => spec.name)).size).toBe(22)
  })

  it('marks every registered layout module as implemented', () => {
    expect(IMPLEMENTED_LAYOUT_MODULES).toHaveLength(22)
    expect(IMPLEMENTED_LAYOUT_MODULES).toEqual(JOURNAL_LAYOUT_MODULES.map((spec) => spec.name))
  })

  it('resolves aliases without changing canonical names', () => {
    expect(resolveLayoutModuleName('admonition')).toBe('callout')
    expect(resolveLayoutModuleName('resource-list')).toBe('resource-list')
    expect(getLayoutModuleSpec('admonition')?.name).toBe('callout')
  })

  it('stores schema data used by validation', () => {
    expect(getLayoutModuleSpec('verdict')).toMatchObject({
      bodyFormat: 'fields',
      requiredFields: ['title'],
      implemented: true,
    })
    expect(getLayoutModuleSpec('resource-list')).toMatchObject({
      bodyFormat: 'json_array',
      implemented: true,
    })
  })
})
