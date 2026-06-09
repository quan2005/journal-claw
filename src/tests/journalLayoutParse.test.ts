import { describe, expect, it } from 'vitest'
import { parseRawJournalLayout } from '../lib/journalLayout'

describe('parseRawJournalLayout', () => {
  it('parses name, modifier, title, attrs, body, source, and line range', () => {
    const result = parseRawJournalLayout(`# Before

:::metrics compact[Key Results]{columns=2 tone=accent}
Structure | 43 modules | catalog-driven
Effort | -42% | no JSX required
:::

After`)

    expect(result.containsLayout).toBe(true)
    expect(result.segments).toHaveLength(3)
    const block = result.segments[1]
    expect(block.kind).toBe('raw_block')
    if (block.kind !== 'raw_block') throw new Error('expected raw block')
    expect(block.block).toMatchObject({
      name: 'metrics',
      modifier: 'compact',
      title: 'Key Results',
      attrs: { columns: 2, tone: 'accent' },
      bodyRaw: 'Structure | 43 modules | catalog-driven\nEffort | -42% | no JSX required',
      sourceRange: { startLine: 3, endLine: 6 },
    })
  })

  it('ignores directives inside fenced code blocks', () => {
    const source = `Text

\`\`\`md
:::callout tip
inside code
:::
\`\`\`
`
    const result = parseRawJournalLayout(source)

    expect(result.containsLayout).toBe(false)
    expect(result.segments).toEqual([
      {
        kind: 'markdown',
        value: source,
        sourceRange: { startLine: 1, endLine: 8 },
      },
    ])
  })

  it('returns a local syntax error for an unclosed directive', () => {
    const result = parseRawJournalLayout(`Intro

:::verdict
title: Missing close`)

    expect(result.containsLayout).toBe(true)
    expect(result.segments[result.segments.length - 1]).toMatchObject({
      kind: 'error',
      issue: {
        kind: 'syntax',
        blockName: 'verdict',
        message: 'Directive is not closed.',
        sourceRange: { startLine: 3, endLine: 4 },
      },
    })
  })

  it('parses multiple directives without swallowing surrounding markdown', () => {
    const result = parseRawJournalLayout(`A

:::callout tip
one
:::

B

:::verdict
title: Ship it
:::

C`)

    expect(result.segments.map((segment) => segment.kind)).toEqual([
      'markdown',
      'raw_block',
      'markdown',
      'raw_block',
      'markdown',
    ])
  })

  it('reports malformed opening lines as syntax errors', () => {
    const result = parseRawJournalLayout(`:::verdict[bad title
title: Broken
:::`)

    expect(result.containsLayout).toBe(true)
    expect(result.segments[0]).toMatchObject({
      kind: 'error',
      issue: {
        kind: 'syntax',
        message: 'Directive opening line is malformed.',
        hint: 'Use :::name modifier[title]{key=value}.',
      },
    })
  })

  it('preserves malformed directive source and keeps following markdown local', () => {
    const result = parseRawJournalLayout(`Before

:::verdict[bad title
title: Broken
subtitle: Keep this visible in the local error
:::

After`)

    expect(result.segments).toHaveLength(3)
    expect(result.segments[0]).toMatchObject({ kind: 'markdown', value: 'Before\n' })
    expect(result.segments[1]).toMatchObject({
      kind: 'error',
      issue: {
        kind: 'syntax',
        message: 'Directive opening line is malformed.',
        source:
          ':::verdict[bad title\ntitle: Broken\nsubtitle: Keep this visible in the local error\n:::',
        sourceRange: { startLine: 3, endLine: 6 },
      },
    })
    expect(result.segments[2]).toMatchObject({ kind: 'markdown', value: '\nAfter' })
  })
})
