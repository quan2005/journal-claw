import { describe, it, expect } from 'vitest'
import { extractScope } from '../lib/mdx/scopeManager'
import type { Block } from '../lib/mdx/types'

function makeBlock(source: string, kind: 'markdown' | 'jsx' | 'esm' = 'markdown'): Block {
  return { source, startLine: 1, endLine: 1, kind }
}

describe('mdx scope manager', () => {
  it('extracts ESM blocks from block list', () => {
    const blocks: Block[] = [
      makeBlock('import { Chart } from "./Chart"', 'esm'),
      makeBlock('# Title', 'markdown'),
      makeBlock('export const data = [1,2,3]', 'esm'),
    ]
    const scope = extractScope(blocks)
    expect(scope.esmBlocks).toHaveLength(2)
    expect(scope.esmBlocks[0].source).toContain('import')
    expect(scope.esmBlocks[1].source).toContain('export const')
  })

  it('extracts link reference definitions from markdown blocks', () => {
    const blocks: Block[] = [
      makeBlock('[react]: https://react.dev\n[vue]: https://vuejs.org', 'markdown'),
      makeBlock('# Title', 'markdown'),
    ]
    const scope = extractScope(blocks)
    expect(scope.linkDefinitions).toHaveLength(2)
    expect(scope.linkDefinitions[0]).toContain('react')
  })

  it('extracts footnote definitions', () => {
    const blocks: Block[] = [
      makeBlock('[^1]: This is a footnote.', 'markdown'),
      makeBlock('Some text[^1]', 'markdown'),
    ]
    const scope = extractScope(blocks)
    expect(scope.footnoteDefinitions).toHaveLength(1)
    expect(scope.footnoteDefinitions[0]).toContain('footnote')
  })

  it('returns empty scope for blocks with no cross-references', () => {
    const blocks: Block[] = [makeBlock('# Simple', 'markdown')]
    const scope = extractScope(blocks)
    expect(scope.esmBlocks).toHaveLength(0)
    expect(scope.linkDefinitions).toHaveLength(0)
    expect(scope.footnoteDefinitions).toHaveLength(0)
  })
})
