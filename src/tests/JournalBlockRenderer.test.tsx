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
    name: 'verdict',
    attrs: {},
    body: { format: 'fields', fields: { title: 'Directive design' } },
    source: ':::verdict\ntitle: Directive design\n:::',
    sourceRange: { startLine: 1, endLine: 3 },
    ...overrides,
  }
}

describe('JournalBlockRenderer', () => {
  it('renders implemented verdict blocks', () => {
    render(
      <JournalBlockRenderer
        block={block({
          body: {
            format: 'fields',
            fields: {
              status: 'Journal Layout',
              title: 'Structure before style',
              summary: 'Modules define reading rhythm',
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

  it('renders inline markdown in summary body fields', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'summary',
          body: {
            format: 'fields',
            fields: {
              title: '三件事',
              body: '一个信号：**自然语言生成工作流**仍是压倒性第一需求。',
            },
          },
        })}
      />,
    )

    const strong = container.querySelector('.journal-block-summary strong')
    expect(strong?.textContent).toBe('自然语言生成工作流')
    expect(container.textContent).toContain('一个信号：自然语言生成工作流仍是压倒性第一需求。')
  })

  it('renders quote evidence with author and context as a compact voice item', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'quote',
          body: {
            format: 'fields',
            fields: {
              text: '最看重的是效果，不是效率。',
              author: '冯灿威',
              context: '新用户（<1 月），与其他用户「效率优先」的诉求形成对比',
            },
          },
        })}
      />,
    )

    const quote = container.querySelector('.journal-block-quote')
    expect(quote?.tagName).toBe('FIGURE')
    expect(quote?.classList.contains('journal-block-content')).toBe(true)
    expect(container.querySelector('.journal-block-quote-mark')).toBeNull()
    expect(container.querySelector('.journal-block-quote-body')?.tagName).toBe('BLOCKQUOTE')
    expect(container.querySelector('.journal-block-quote-text')?.textContent).toBe(
      '最看重的是效果，不是效率。',
    )
    expect(container.querySelector('.journal-block-quote-author')?.textContent).toContain('冯灿威')
    expect(container.querySelector('.journal-block-quote-context')?.textContent).toContain(
      '新用户（<1 月）',
    )
  })

  it('renders card description br tokens as line breaks', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'cards',
          body: {
            format: 'rows',
            rows: [
              [
                'M1 模型接入网关',
                '开源起步（LiteLLM/Portkey）<br><br>1.1 统一API·协议适配 [ · ] P1<br/>1.2 多模型路由 [ · ] P1',
              ],
            ],
          },
        })}
      />,
    )

    expect(container.querySelectorAll('.journal-layout-card p br').length).toBe(3)
    expect(container.textContent).not.toContain('<br>')
    expect(screen.getByText(/1.2 多模型路由/)).toBeTruthy()
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
            rows: [['Choose module', 'Decide what the paragraph is doing', 'timeline / checklist']],
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
              ['01', 'Opening', 'toc, cards'],
              ['02', 'Infographic', 'metrics, timeline'],
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
                'Every note needs a hero',
                'Article notes stay quiet',
                'Short notes keep prose first.',
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
    expect(container.querySelector('.journal-block-timeline-item-active')).toBeTruthy()
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

  it('renders resource lists as file cards with readable path metadata', () => {
    const { container } = render(
      <JournalBlockRenderer
        block={block({
          name: 'resource-list',
          body: {
            format: 'json_array',
            value: [
              {
                title: 'Component Catalog',
                url: '/Users/yanwu/Projects/github/journal/.agents/skills/journal/references/component-catalog.md',
              },
            ],
          },
        })}
      />,
    )

    expect(container.querySelector('.journal-block-resource-card')).toBeTruthy()
    expect(container.querySelector('.journal-block-resource-title')?.textContent).toBe(
      'Component Catalog',
    )
    expect(container.querySelector('.journal-block-resource-path')?.textContent).toContain(
      'component-catalog.md',
    )
    expect(container.querySelector('.journal-block-resource-path')?.getAttribute('title')).toBe(
      '/Users/yanwu/Projects/github/journal/.agents/skills/journal/references/component-catalog.md',
    )
    expect(container.querySelector('.journal-block-resource-kind')?.textContent).toBe('MD')
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

  it('renders every retained catalog module without falling back to coming soon', () => {
    const samples = new Map<string, { title?: string; body: ParsedBlockBody; expected: string }>([
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
        'metrics',
        {
          title: 'Metrics',
          body: { format: 'rows', rows: [['Speed', '2x', 'Faster']] },
          expected: '2x',
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
        'verdict',
        {
          body: { format: 'fields', fields: { title: 'Ship it', summary: 'Ready' } },
          expected: 'Ship it',
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
