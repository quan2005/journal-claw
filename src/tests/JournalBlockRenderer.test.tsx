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

  it('renders process markers as centered reading affordances', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'steps',
          title: 'Steps',
          body: {
            format: 'rows',
            rows: [['Choose module', 'Decide what the paragraph is doing', 'hero / timeline']],
          },
        })}
      />,
    )

    const marker = container.querySelector('.journal-block-step-index')
    expect(marker?.classList.contains('journal-block-marker')).toBe(true)
    expect(marker?.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders toc rows with a left-aligned list rhythm', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'toc',
          title: 'Contents',
          body: {
            format: 'rows',
            rows: [
              ['01', 'Opening', 'hero, toc, cards'],
              ['02', 'Infographic', 'metrics, compare, timeline'],
            ],
          },
        })}
      />,
    )

    expect(container.querySelectorAll('.journal-block-toc-row')).toHaveLength(2)
    expect(
      container
        .querySelector('.journal-block-toc-row .journal-block-row-marker')
        ?.classList.contains('journal-block-marker'),
    ).toBe(true)
  })

  it('renders compare rows with a VS rail instead of a plain table', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'compare',
          title: 'Compare',
          body: {
            format: 'rows',
            rows: [
              ['Formatting', 'Manual cleanup every time', 'One directive renders consistently'],
            ],
          },
        })}
      />,
    )

    expect(container.querySelector('.journal-block-compare')).toBeTruthy()
    expect(container.querySelector('.journal-block-table-grid')).toBeFalsy()
    expect(container.querySelector('.journal-block-compare-vs')?.textContent).toBe('VS')
    expect(container.querySelector('.journal-block-compare-side-left')?.textContent).toContain(
      'Manual cleanup',
    )
    expect(container.querySelector('.journal-block-compare-side-right')?.textContent).toContain(
      'One directive',
    )
  })

  it('renders myth-fact with explicit contrast markers', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'myth-fact',
          title: 'Myth fact',
          body: {
            format: 'rows',
            rows: [['Directive is decoration', 'Directive is structure', 'It stabilizes output.']],
          },
        })}
      />,
    )

    const mythSide = container.querySelector('.journal-block-myth')
    expect(mythSide?.children[0]?.classList.contains('journal-block-myth-mark')).toBe(true)
    expect(mythSide?.children[1]?.classList.contains('journal-block-myth-fact-copy')).toBe(true)
    expect(container.querySelector('.journal-block-myth-mark')?.textContent).toBe('×')
    expect(container.querySelector('.journal-block-fact-mark')?.textContent).toBe('✓')
    expect(container.querySelector('.journal-block-fact-reason')?.textContent).toContain(
      'stabilizes',
    )
  })

  it('renders timeline as an in-place axis without duplicate top navigation', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'timeline',
          title: 'Timeline',
          body: {
            format: 'rows',
            rows: [
              ['2026-06-04', 'Build path', 'Parser and renderer share catalog'],
              ['2026-06-05', 'Verify path', 'All modules render locally'],
            ],
          },
        })}
      />,
    )

    expect(container.querySelector('.journal-block-timeline-nav')).toBeFalsy()
    expect(container.querySelectorAll('.journal-block-timeline-node')).toHaveLength(2)
    expect(container.querySelector('.journal-block-timeline-axis')).toBeTruthy()
    expect(container.querySelectorAll('.journal-block-timeline-date')).toHaveLength(2)
  })

  it('renders manifesto rows with a left-aligned list rhythm', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'manifesto',
          title: 'Manifesto',
          body: {
            format: 'rows',
            rows: [
              ['Markdown first', 'Let paragraphs and lists carry the base structure'],
              ['Directives second', 'Use stable blocks for scanning'],
            ],
          },
        })}
      />,
    )

    expect(container.querySelectorAll('.journal-block-manifesto-row')).toHaveLength(2)
    expect(
      container
        .querySelector('.journal-block-manifesto-row .journal-block-row-marker')
        ?.classList.contains('journal-block-marker'),
    ).toBe(true)
    expect(container.querySelector('.journal-block-manifesto-row h3')?.textContent).toBe(
      'Markdown first',
    )
  })

  it('keeps timeline body content as the only visible timeline labels', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'timeline',
          title: 'Timeline',
          body: {
            format: 'rows',
            rows: [
              ['2026-06-04', 'Build path', 'Parser and renderer share catalog'],
              ['2026-06-05', 'Verify path', 'All modules render locally'],
            ],
          },
        })}
      />,
    )

    expect(container.querySelector('.journal-block-timeline-nav')).toBeFalsy()
    expect(container.querySelector('.journal-block-timeline-item-active')).toBeTruthy()
    expect(container.querySelector('.journal-block-timeline-track')?.textContent).toContain(
      '2026-06-04',
    )
    expect(container.querySelector('.journal-block-timeline-track')?.textContent).toContain(
      'Build path',
    )
  })

  it('renders bridge as a transition module with a visible direction cue', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'bridge',
          body: {
            format: 'fields',
            fields: {
              from: 'AI 直接输出复杂 JSX',
              to: 'AI 输出 catalog-backed directives',
              why: '前者要求模型理解组件 props；后者只要求模型选择模块和 body format。',
            },
          },
        })}
      />,
    )

    expect(container.querySelector('.journal-block-bridge-node')?.textContent).toContain(
      'AI 直接输出复杂 JSX',
    )
    expect(container.querySelector('.journal-block-bridge-arrow')?.textContent).toBe('→')
    expect(container.querySelector('.journal-block-bridge-why')?.textContent).toContain(
      'body format',
    )
  })

  it('renders myth-fact as a continuous contrast list', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'myth-fact',
          title: 'Myth fact',
          body: {
            format: 'rows',
            rows: [
              ['Directive is decoration', 'Directive is structure', 'It stabilizes AI output.'],
              [
                'Every page needs hero',
                'Only strong judgments need hero',
                'Short notes stay quiet.',
              ],
            ],
          },
        })}
      />,
    )

    expect(container.querySelector('.journal-block-myth-fact')).toBeTruthy()
    expect(container.querySelectorAll('.journal-block-myth-fact-row')).toHaveLength(2)
    expect(container.querySelector('.journal-block-pair')).toBeFalsy()
    expect(container.querySelectorAll('.journal-block-fact-mark')).toHaveLength(2)
    expect(container.querySelector('.journal-block-fact-reason')?.textContent).toContain(
      'stabilizes',
    )
  })

  it('renders checklist items with fixed marker controls', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'checklist',
          title: 'Checklist',
          body: {
            format: 'rows',
            rows: [
              ['Every block has a closing fence', 'done'],
              ['Images use real paths', 'todo'],
            ],
          },
        })}
      />,
    )

    expect(container.querySelector('.journal-block-checklist-list')).toBeTruthy()
    expect(container.querySelectorAll('.journal-block-checklist-item')).toHaveLength(2)
    expect(container.querySelectorAll('.journal-block-check-marker')).toHaveLength(2)
    expect(container.querySelectorAll('.journal-block-check-icon')).toHaveLength(2)
    expect(container.querySelectorAll('.journal-block-check-icon-check')).toHaveLength(2)
    expect(container.querySelectorAll('.journal-block-check-icon-box')).toHaveLength(2)
    expect(container.querySelector('.journal-block-check-marker')?.textContent).toBe('')
    expect(
      container.querySelector('.journal-block-checklist-item')?.getAttribute('data-state'),
    ).toBe('done')
    expect(container.querySelector('.journal-block-checklist-text')?.textContent).toContain(
      'closing fence',
    )
  })

  it('renders author card as a compact byline', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'author-card',
          body: {
            format: 'fields',
            fields: {
              name: 'JournalClaw',
              role: 'Quiet knowledge workspace',
              bio: 'Focus on browsing and reading.',
            },
          },
        })}
      />,
    )

    expect(container.querySelector('.journal-block-author-card')).toBeTruthy()
    expect(container.querySelector('.journal-block-author-mark')?.textContent).toBe('J')
    expect(container.querySelector('.journal-block-author-name')?.textContent).toBe('JournalClaw')
    expect(container.querySelector('.journal-block-author-role')?.textContent).toBe(
      'Quiet knowledge workspace',
    )
    expect(container.querySelector('.journal-block-author-bio')?.textContent).toContain('browsing')
    expect(container.querySelector('.journal-block-avatar')).toBeFalsy()
  })

  it('renders series rows with the compact left-aligned list rhythm', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'series',
          title: 'Series',
          body: {
            format: 'rows',
            rows: [
              ['Layout Directives Demo', 'current', 'topics/demo/00-index.mdx'],
              ['Syntax Reference', 'reference', 'topics/demo/99-syntax-reference.mdx'],
            ],
          },
        })}
      />,
    )

    expect(container.querySelectorAll('.journal-block-series-row')).toHaveLength(2)
    expect(
      container
        .querySelector('.journal-block-series-row .journal-block-row-marker')
        ?.classList.contains('journal-block-marker'),
    ).toBe(true)
    expect(container.querySelector('.journal-block-series-row h3')?.textContent).toBe(
      'Layout Directives Demo',
    )
  })

  it('renders resource lists as file cards with readable path metadata', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'resource-list',
          body: {
            format: 'json_array',
            value: [
              {
                title: 'Layout Directives Guide',
                url: '/Users/yanwu/Projects/github/journal/.agents/skills/journal/references/layout-directives.md',
              },
            ],
          },
        })}
      />,
    )

    expect(container.querySelector('.journal-block-resource-card')).toBeTruthy()
    expect(container.querySelector('.journal-block-resource-title')?.textContent).toBe(
      'Layout Directives Guide',
    )
    expect(container.querySelector('.journal-block-resource-path')?.textContent).toContain(
      'layout-directives.md',
    )
    expect(container.querySelector('.journal-block-resource-path')?.getAttribute('title')).toBe(
      '/Users/yanwu/Projects/github/journal/.agents/skills/journal/references/layout-directives.md',
    )
    expect(container.querySelector('.journal-block-resource-kind')?.textContent).toBe('MD')
  })

  it('renders changelog dates as muted date markers', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'changelog',
          body: {
            format: 'json_array',
            value: [{ date: '2026-06-04', title: 'Added directives', note: 'All modules render' }],
          },
        })}
      />,
    )

    expect(container.querySelector('.journal-block-changelog-date')?.textContent).toBe('2026-06-04')
    expect(
      container
        .querySelector('.journal-block-changelog-date')
        ?.classList.contains('journal-block-marker'),
    ).toBe(true)
    expect(
      container
        .querySelector('.journal-block-changelog-date')
        ?.classList.contains('journal-block-row-marker'),
    ).toBe(true)
  })

  it('renders comparison tables with explicit header and cell classes', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'comparison-table',
          body: {
            format: 'json_object',
            value: {
              columns: ['Markdown', 'Directive', 'MDX JSX', 'AI stability'],
              rows: [
                { label: 'Best use', values: ['Prose', 'Layout', 'Complex semantics', 'High'] },
              ],
            },
          },
        })}
      />,
    )

    expect(container.querySelector('.journal-block-table-grid')?.getAttribute('role')).toBe('table')
    expect(container.querySelectorAll('.journal-block-table-cell-header').length).toBeGreaterThan(1)
    expect(container.querySelectorAll('.journal-block-table-cell').length).toBeGreaterThan(5)
    expect(
      (container.querySelector('.journal-block-table-grid') as HTMLElement | null)?.style
        .getPropertyValue('--journal-block-table-min-width')
        .trim(),
    ).toMatch(/^max\(100%,/)
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
