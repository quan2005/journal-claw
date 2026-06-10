import { describe, it, expect } from 'vitest'
import type { Block } from '../lib/mdx/types'

describe('mdx segmenter', () => {
  it('placeholder', () => {
    const block: Block = { source: '# Hi', startLine: 1, endLine: 1, kind: 'markdown' }
    expect(block.kind).toBe('markdown')
  })
})
