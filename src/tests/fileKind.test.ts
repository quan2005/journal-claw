import { describe, expect, it } from 'vitest'
import { fileKindFromName } from '../lib/fileKind'

describe('fileKindFromName', () => {
  it('classifies mdx files as markdown so topic manuals render in-app', () => {
    expect(fileKindFromName('component-guide.mdx')).toBe('markdown')
  })

  it('classifies common topic file extensions for tree icons', () => {
    expect(fileKindFromName('budget.xlsx')).toBe('spreadsheet')
    expect(fileKindFromName('roadmap.pptx')).toBe('presentation')
    expect(fileKindFromName('demo.mp4')).toBe('video')
    expect(fileKindFromName('archive.zip')).toBe('archive')
  })
})
