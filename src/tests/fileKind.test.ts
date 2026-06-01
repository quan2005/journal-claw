import { describe, expect, it } from 'vitest'
import { fileKindFromName } from '../lib/fileKind'

describe('fileKindFromName', () => {
  it('classifies mdx files as markdown so topic manuals render in-app', () => {
    expect(fileKindFromName('component-guide.mdx')).toBe('markdown')
  })
})
