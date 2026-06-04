import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { JournalBlockRenderer } from '../components/journal-blocks/JournalBlockRenderer'
import type { JournalBlock, LayoutIssue } from '../lib/journalLayout'

function block(overrides: Partial<JournalBlock>): JournalBlock {
  return {
    name: 'hero',
    attrs: {},
    body: { format: 'fields', fields: { title: 'Directive design' } },
    source: ':::hero\ntitle: Directive design\n:::',
    sourceRange: { startLine: 1, endLine: 3 },
    ...overrides,
  }
}

describe('JournalBlockRenderer', () => {
  it('renders implemented hero blocks', () => {
    render(
      <JournalBlockRenderer
        block={block({
          body: {
            format: 'fields',
            fields: {
              eyebrow: 'Journal Layout',
              title: 'Structure before style',
              subtitle: 'Modules define reading rhythm',
            },
          },
        })}
      />,
    )

    expect(screen.getByText('Journal Layout')).toBeTruthy()
    expect(screen.getByText('Structure before style')).toBeTruthy()
    expect(screen.getByText('Modules define reading rhythm')).toBeTruthy()
  })

  it('renders callout body rows with modifier tone', () => {
    render(
      <JournalBlockRenderer
        block={block({
          name: 'callout',
          modifier: 'tip',
          title: 'Use this',
          body: { format: 'rows', rows: [['Keep prose calm and precise.']] },
        })}
      />,
    )

    expect(screen.getByText('Use this')).toBeTruthy()
    expect(screen.getByText('Keep prose calm and precise.')).toBeTruthy()
  })

  it('renders registered modules without a renderer as coming soon', () => {
    render(
      <JournalBlockRenderer
        block={block({
          name: 'definition',
          body: { format: 'json_object', value: { term: 'Catalog' } },
        })}
      />,
    )

    expect(screen.getByText('definition layout block is registered')).toBeTruthy()
  })

  it('renders localized block errors', () => {
    const issue: LayoutIssue = {
      kind: 'schema',
      blockName: 'metrics',
      message: 'metrics row 2 expected at least 3 columns, got 2.',
      hint: 'Use pipe-separated columns.',
      source: ':::metrics\nA | B\n:::',
      sourceRange: { startLine: 12, endLine: 14 },
    }

    render(<JournalBlockRenderer issue={issue} />)

    expect(screen.getByText('metrics block failed')).toBeTruthy()
    expect(
      screen.getByText('Line 12-14: metrics row 2 expected at least 3 columns, got 2.'),
    ).toBeTruthy()
    expect(screen.getByText('Use pipe-separated columns.')).toBeTruthy()
  })
})
