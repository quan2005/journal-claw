import { describe, it, expect } from 'vitest'
import { segmentMdx } from '../lib/mdx/segmenter'

describe('mdx segmenter', () => {
  it('splits plain markdown by blank lines', () => {
    const source = '# Title\n\nParagraph one.\n\nParagraph two.'
    const blocks = segmentMdx(source)
    expect(blocks).toHaveLength(3)
    expect(blocks[0].source).toBe('# Title')
    expect(blocks[0].startLine).toBe(1)
    expect(blocks[0].endLine).toBe(1)
    expect(blocks[0].kind).toBe('markdown')
    expect(blocks[1].source).toBe('Paragraph one.')
    expect(blocks[1].startLine).toBe(3)
    expect(blocks[2].source).toBe('Paragraph two.')
    expect(blocks[2].startLine).toBe(5)
  })

  it('keeps fenced code blocks as a single block', () => {
    const source = '# Title\n\n```js\nconst x = 1\n\nconst y = 2\n```\n\nAfter.'
    const blocks = segmentMdx(source)
    expect(blocks).toHaveLength(3)
    expect(blocks[1].source).toContain('const x = 1')
    expect(blocks[1].source).toContain('const y = 2')
    expect(blocks[1].kind).toBe('markdown')
  })

  it('keeps JSX container components as a single block', () => {
    const source =
      '<Tabs>\n  <Tab label="A">\n    Content A\n  </Tab>\n\n  <Tab label="B">\n    Content B\n  </Tab>\n</Tabs>'
    const blocks = segmentMdx(source)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].kind).toBe('jsx')
    expect(blocks[0].startLine).toBe(1)
    expect(blocks[0].endLine).toBe(9)
  })

  it('identifies ESM blocks (import/export)', () => {
    const source = 'import { Chart } from "./Chart"\n\n# Title\n\n<Chart />'
    const blocks = segmentMdx(source)
    expect(blocks[0].kind).toBe('esm')
    expect(blocks[0].source).toBe('import { Chart } from "./Chart"')
    expect(blocks[1].kind).toBe('markdown')
    expect(blocks[2].kind).toBe('jsx')
  })

  it('forces convergence on unclosed JSX after reaching a heading', () => {
    const source = '<Broken\n  no close here\n\n# Next Section\n\nContent.'
    const blocks = segmentMdx(source)
    // The unclosed JSX should NOT swallow the heading and content
    expect(blocks.length).toBeGreaterThanOrEqual(2)
    const lastBlock = blocks[blocks.length - 1]
    expect(lastBlock.source).toContain('Content.')
  })

  it('does not split inside frontmatter fences', () => {
    const source = '---\nsummary: hello\ntags: [a]\n---\n\n# Title'
    const blocks = segmentMdx(source)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].source).toContain('---')
    expect(blocks[1].source).toBe('# Title')
  })

  it('handles self-closing JSX tags without tracking depth', () => {
    const source = '<Chart data={x} />\n\nParagraph.'
    const blocks = segmentMdx(source)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].kind).toBe('jsx')
    expect(blocks[1].kind).toBe('markdown')
  })

  it('handles empty input', () => {
    expect(segmentMdx('')).toHaveLength(0)
  })

  it('handles consecutive blank lines as single separator', () => {
    const source = '# A\n\n\n\n# B'
    const blocks = segmentMdx(source)
    expect(blocks).toHaveLength(2)
  })
})
