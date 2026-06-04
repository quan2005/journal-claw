import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { JournalBlockRenderer } from '../components/journal-blocks/JournalBlockRenderer'
import { JOURNAL_LAYOUT_MODULES } from '../lib/journalLayout'
import type { JournalBlock, LayoutIssue, ParsedBlockBody } from '../lib/journalLayout'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}))

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

  it('renders json object blocks with a dedicated renderer', () => {
    render(
      <JournalBlockRenderer
        block={block({
          name: 'definition',
          body: {
            format: 'json_object',
            value: { term: 'Catalog', description: 'Single source of truth' },
          },
        })}
      />,
    )

    expect(screen.getByText('Catalog')).toBeTruthy()
    expect(screen.getByText('Single source of truth')).toBeTruthy()
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

  it('renders every catalog module without falling back to coming soon', () => {
    const samples = new Map<string, { title?: string; body: ParsedBlockBody; expected: string }>([
      [
        'hero',
        {
          body: { format: 'fields', fields: { title: 'Hero Title', subtitle: 'Hero Subtitle' } },
          expected: 'Hero Title',
        },
      ],
      [
        'toc',
        { title: 'Contents', body: { format: 'rows', rows: [['01', 'Intro']] }, expected: 'Intro' },
      ],
      [
        'cards',
        {
          title: 'Cards',
          body: { format: 'rows', rows: [['Card A', 'Card detail']] },
          expected: 'Card A',
        },
      ],
      [
        'part',
        {
          body: { format: 'fields', fields: { label: 'Part 01', title: 'Opening Part' } },
          expected: 'Opening Part',
        },
      ],
      [
        'label-title',
        {
          body: { format: 'fields', fields: { label: 'Label', title: 'Label Title' } },
          expected: 'Label Title',
        },
      ],
      [
        'metrics',
        {
          title: 'Metrics',
          body: { format: 'rows', rows: [['Speed', '2x', 'Faster']] },
          expected: '2x',
        },
      ],
      [
        'compare',
        {
          title: 'Compare',
          body: { format: 'rows', rows: [['Path', 'Old', 'New']] },
          expected: 'New',
        },
      ],
      [
        'steps',
        {
          title: 'Steps',
          body: { format: 'rows', rows: [['Step A', 'Do it']] },
          expected: 'Step A',
        },
      ],
      [
        'timeline',
        {
          title: 'Timeline',
          body: { format: 'rows', rows: [['Now', 'Launch']] },
          expected: 'Launch',
        },
      ],
      [
        'infographic',
        {
          body: { format: 'fields', fields: { title: 'Infographic', summary: 'One big idea' } },
          expected: 'One big idea',
        },
      ],
      [
        'verdict',
        {
          body: { format: 'fields', fields: { title: 'Ship it', summary: 'Ready' } },
          expected: 'Ship it',
        },
      ],
      [
        'audience-fit',
        {
          title: 'Audience',
          body: { format: 'rows', rows: [['Designers', 'High', 'Need structure']] },
          expected: 'Designers',
        },
      ],
      [
        'myth-fact',
        {
          title: 'Myths',
          body: { format: 'rows', rows: [['Hard to read', 'Actually structured']] },
          expected: 'Actually structured',
        },
      ],
      [
        'manifesto',
        {
          title: 'Manifesto',
          body: { format: 'rows', rows: [['Clarity', 'Use structure']] },
          expected: 'Clarity',
        },
      ],
      [
        'bridge',
        {
          body: {
            format: 'fields',
            fields: { from: 'Raw notes', to: 'Structured reading', why: 'Scan faster' },
          },
          expected: 'Structured reading',
        },
      ],
      [
        'quote',
        {
          body: { format: 'fields', fields: { text: 'Quiet tools disappear.' } },
          expected: 'Quiet tools disappear.',
        },
      ],
      [
        'image-text',
        {
          body: {
            format: 'fields',
            fields: { image: '/tmp/image.png', title: 'Image Text', text: 'Inspectable evidence' },
          },
          expected: 'Inspectable evidence',
        },
      ],
      [
        'image-compare',
        {
          body: {
            format: 'fields',
            fields: { before: '/tmp/a.png', after: '/tmp/b.png', title: 'Before After' },
          },
          expected: 'Before After',
        },
      ],
      [
        'image-annotate',
        {
          body: {
            format: 'json_object',
            value: { image: '/tmp/a.png', title: 'Annotated', notes: ['Point A'] },
          },
          expected: 'Point A',
        },
      ],
      [
        'image-steps',
        {
          body: {
            format: 'json_array',
            value: [{ image: '/tmp/a.png', title: 'Frame A', text: 'Step image' }],
          },
          expected: 'Frame A',
        },
      ],
      [
        'cta',
        {
          body: {
            format: 'fields',
            fields: { title: 'Next action', description: 'Review this note' },
          },
          expected: 'Next action',
        },
      ],
      [
        'faq',
        {
          title: 'FAQ',
          body: { format: 'rows', rows: [['Question?', 'Answer']] },
          expected: 'Answer',
        },
      ],
      [
        'checklist',
        {
          title: 'Checklist',
          body: { format: 'rows', rows: [['Review', 'done']] },
          expected: 'Review',
        },
      ],
      [
        'cases',
        {
          title: 'Cases',
          body: { format: 'rows', rows: [['Case A', 'Worked', 'Note']] },
          expected: 'Worked',
        },
      ],
      [
        'summary',
        {
          body: { format: 'fields', fields: { title: 'Summary', body: 'Main takeaway' } },
          expected: 'Main takeaway',
        },
      ],
      [
        'notice',
        {
          body: { format: 'fields', fields: { title: 'Notice', text: 'Read carefully' } },
          expected: 'Read carefully',
        },
      ],
      [
        'logos',
        {
          title: 'Logos',
          body: { format: 'rows', rows: [['OpenAI', 'Model']] },
          expected: 'OpenAI',
        },
      ],
      [
        'pricing',
        {
          title: 'Pricing',
          body: { format: 'rows', rows: [['Team', '$10', 'Monthly']] },
          expected: '$10',
        },
      ],
      [
        'specs',
        {
          title: 'Specs',
          body: { format: 'rows', rows: [['Latency', 'Fast', 'Measured']] },
          expected: 'Latency',
        },
      ],
      [
        'toolbox',
        {
          title: 'Toolbox',
          body: { format: 'rows', rows: [['Parser', 'Split directives', 'local']] },
          expected: 'Parser',
        },
      ],
      [
        'author-card',
        {
          body: {
            format: 'fields',
            fields: { name: 'Yan', role: 'Editor', bio: 'Maintains notes' },
          },
          expected: 'Yan',
        },
      ],
      [
        'subscribe',
        {
          body: {
            format: 'fields',
            fields: { title: 'Follow topic', description: 'Watch updates' },
          },
          expected: 'Watch updates',
        },
      ],
      [
        'people',
        {
          title: 'People',
          body: { format: 'rows', rows: [['Ada', 'Owner', 'Decision maker']] },
          expected: 'Ada',
        },
      ],
      [
        'series',
        {
          title: 'Series',
          body: { format: 'rows', rows: [['Part One', 'done', '01.md']] },
          expected: 'Part One',
        },
      ],
      [
        'callout',
        {
          title: 'Callout',
          body: { format: 'rows', rows: [['Remember this']] },
          expected: 'Remember this',
        },
      ],
      [
        'definition',
        {
          body: {
            format: 'json_object',
            value: { term: 'Directive', description: 'A layout block' },
          },
          expected: 'Directive',
        },
      ],
      [
        'quote-card',
        {
          body: { format: 'fields', fields: { quote: 'Make it quiet.', source: 'JournalClaw' } },
          expected: 'Make it quiet.',
        },
      ],
      [
        'tweet',
        {
          body: { format: 'fields', fields: { text: 'Short public note', author: 'Yan' } },
          expected: 'Short public note',
        },
      ],
      [
        'stat-row',
        {
          body: { format: 'json_array', value: [{ label: 'Coverage', value: '43' }] },
          expected: 'Coverage',
        },
      ],
      [
        'question',
        {
          body: { format: 'fields', fields: { text: 'What changed?', context: 'Renderer path' } },
          expected: 'What changed?',
        },
      ],
      [
        'resource-list',
        {
          body: { format: 'json_array', value: [{ title: 'Docs', url: 'https://example.com' }] },
          expected: 'Docs',
        },
      ],
      [
        'comparison-table',
        {
          body: {
            format: 'json_object',
            value: { columns: ['A', 'B'], rows: [{ label: 'Speed', values: ['Slow', 'Fast'] }] },
          },
          expected: 'Speed',
        },
      ],
      [
        'changelog',
        {
          body: {
            format: 'json_array',
            value: [{ date: '2026-06-04', title: 'Added directives', note: 'All modules render' }],
          },
          expected: 'Added directives',
        },
      ],
    ])

    for (const spec of JOURNAL_LAYOUT_MODULES) {
      const sample = samples.get(spec.name)
      if (!sample) throw new Error(`missing sample for ${spec.name}`)
      const { container, unmount } = render(
        <JournalBlockRenderer
          block={block({
            name: spec.name,
            title: sample.title,
            body: sample.body,
          })}
        />,
      )

      expect(container.textContent).toContain(sample.expected)
      expect(container.textContent).not.toContain('layout block is registered')
      unmount()
    }
  })
})
