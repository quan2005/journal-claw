import { describe, expect, it } from 'vitest'
import { fileTypeIconKindFromName } from '../lib/fileTypeIconKind'
import { fileKindFromName } from '../lib/fileKind'

describe('fileTypeIconKindFromName', () => {
  it('distinguishes mdx from markdown for file icons without changing render kind', () => {
    expect(fileKindFromName('component-guide.mdx')).toBe('markdown')
    expect(fileTypeIconKindFromName('component-guide.mdx')).toBe('mdx')
    expect(fileTypeIconKindFromName('notes.md')).toBe('markdown')
  })
})
