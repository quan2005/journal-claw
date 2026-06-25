import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Suspense } from 'react'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}))

vi.mock('../components/SandboxPreview', () => ({
  SandboxPreview: ({ html, title }: { html: string; title?: string }) => (
    <div data-testid="sandbox-preview" data-title={title}>
      {html}
    </div>
  ),
}))

vi.mock('../lib/tauri', () => ({
  getWorkspacePath: vi.fn(async () => '/tmp/journal'),
  getJournalEntryContent: vi.fn(async (path: string) => `<main>${path}</main>`),
}))

vi.mock('../components/mdx/mermaidRuntime', async () => {
  const actual = await vi.importActual<typeof import('../components/mdx/mermaidRuntime')>(
    '../components/mdx/mermaidRuntime',
  )
  return {
    ...actual,
    renderMermaidToElement: vi.fn(
      async ({ element, source }: { element: HTMLElement; source: string }) => {
        const normalizedSource = actual.normalizeMermaidSource(source)
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.textContent = normalizedSource
        element.replaceChildren(svg)
        return { diagramType: actual.detectMermaidType(normalizedSource), source: normalizedSource }
      },
    ),
  }
})

// Mock chart-impl to avoid canvas/SVG rendering in jsdom
vi.mock('../components/mdx/chart-impl', () => ({
  BarChartImpl: () => <div data-testid="bar-chart-impl" />,
  LineChartImpl: () => <div data-testid="line-chart-impl" />,
  PieChartImpl: () => <div data-testid="pie-chart-impl" />,
  RadarChartImpl: () => <div data-testid="radar-chart-impl" />,
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  // Layout series
  Card as LayoutCard,
  Cards as LayoutCards,
  Toc,
  Metrics,
  Steps,
  Timeline,
  MythFact,
  Verdict,
  ImageSteps,
  ImageText,
  Quote,
  Cases,
  Checklist,
  Cta,
  Faq,
  Summary,
  Toolbox,
  AuthorCard,
  Subscribe,
  Callout,
  ComparisonTable,
  Definition,
  ResourceList,
  // Direct exports
  Columns,
  Column,
  ProsCons,
  Stat,
  StatGroup,
  Table,
  TagList,
  RelatedEntry,
  RelatedIdentity,
  Kanban,
  Counter,
  RatingBar,
  Stack,
  ImageViewer,
  FileCard,
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  Mermaid,
  InlineMath,
  BlockMath,
  Section,
  Subtitle,
  Label,
  Divider,
  HtmlPreview,
  Grid,
  Flow,
  DecisionRecord,
  StatusBadge,
  ComparisonMatrix,
  RACI,
  MilestoneTimeline,
  InsightCard,
  SourceCard,
  ReferenceList,
  CopyButton,
} from '../components/mdx'

// ── Helper ───────────────────────────────────────────────────────────────────

function renderSafe(ui: React.ReactElement) {
  return expect(() => render(<Suspense fallback={null}>{ui}</Suspense>)).not.toThrow()
}

// ═══════════════════════════════════════════════════════════════════════════════
// Layout series (via blockFactory / LayoutBlock)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Layout components (blockFactory)', () => {
  describe('Card (layout)', () => {
    it('renders with minimal props', () => {
      renderSafe(<LayoutCard title="Test Card" />)
    })

    it('renders with all optional props', () => {
      renderSafe(
        <LayoutCard title="Card" description="desc" image="img.png" variant="elevated" />,
      )
    })
  })

  describe('Cards (layout)', () => {
    it('renders with items', () => {
      renderSafe(<LayoutCards items={[{ title: 'A' }, { title: 'B' }]} />)
    })

    it('renders with empty items', () => {
      renderSafe(<LayoutCards items={[]} />)
    })

    it('renders with only title', () => {
      renderSafe(<LayoutCards title="My Cards" items={[{ title: 'X' }]} />)
    })
  })

  describe('Toc', () => {
    it('renders with items', () => {
      renderSafe(<Toc items={[{ label: '1', title: 'Intro' }]} />)
    })

    it('renders with empty items', () => {
      renderSafe(<Toc items={[]} />)
    })
  })

  describe('Metrics', () => {
    it('renders with items', () => {
      renderSafe(<Metrics items={[{ label: 'Users', value: 100 }]} />)
    })

    it('renders with empty items', () => {
      renderSafe(<Metrics items={[]} />)
    })
  })

  describe('Steps', () => {
    it('renders with items', () => {
      renderSafe(<Steps items={[{ title: 'Step 1' }]} />)
    })

    it('renders with empty items', () => {
      renderSafe(<Steps items={[]} />)
    })
  })

  describe('Timeline', () => {
    it('renders with items', () => {
      renderSafe(<Timeline items={[{ time: '2024-01', title: 'Launch' }]} />)
    })

    it('renders with empty items', () => {
      renderSafe(<Timeline items={[]} />)
    })

    it('renders with desc alias', () => {
      renderSafe(<Timeline items={[{ time: '2024-01', title: 'X', desc: 'Details' }]} />)
    })
  })

  describe('MythFact', () => {
    it('renders with items', () => {
      renderSafe(<MythFact items={[{ myth: 'M', fact: 'F' }]} />)
    })

    it('renders with empty items', () => {
      renderSafe(<MythFact items={[]} />)
    })
  })

  describe('Verdict', () => {
    it('renders with minimal props', () => {
      renderSafe(<Verdict title="Pass" />)
    })

    it('renders with all optional props', () => {
      renderSafe(
        <Verdict title="Review" summary="Looks good" confidence="High" status="approved" variant="success" />,
      )
    })
  })

  describe('ImageSteps', () => {
    it('renders with items', () => {
      renderSafe(<ImageSteps items={[{ title: 'Step 1' }]} />)
    })

    it('renders with empty items', () => {
      renderSafe(<ImageSteps items={[]} />)
    })
  })

  describe('ImageText', () => {
    it('renders with minimal props', () => {
      renderSafe(<ImageText image="test.png" />)
    })

    it('renders with all optional props', () => {
      renderSafe(<ImageText image="test.png" title="Title" text="body" alt="alt" variant="reverse" />)
    })
  })

  describe('Quote', () => {
    it('renders with minimal props', () => {
      renderSafe(<Quote text="Hello world" />)
    })

    it('renders with all optional props', () => {
      renderSafe(<Quote text="Quote" author="Author" context="Context" source="Src" url="http://x" />)
    })
  })

  describe('Cases', () => {
    it('renders with items', () => {
      renderSafe(<Cases items={[{ case: 'A', result: 'B' }]} />)
    })

    it('renders with empty items', () => {
      renderSafe(<Cases items={[]} />)
    })
  })

  describe('Checklist', () => {
    it('renders with items', () => {
      renderSafe(<Checklist items={[{ text: 'Do this', checked: true }]} />)
    })

    it('renders with empty items', () => {
      renderSafe(<Checklist items={[]} />)
    })

    it('renders with item alias and state', () => {
      renderSafe(<Checklist items={[{ item: 'Task', state: 'done' }]} />)
    })
  })

  describe('Cta', () => {
    it('renders with minimal props', () => {
      renderSafe(<Cta title="Sign Up" />)
    })

    it('renders with all optional props', () => {
      renderSafe(<Cta title="Sign Up" description="Free trial" action="Start" />)
    })
  })

  describe('Faq', () => {
    it('renders with items', () => {
      renderSafe(<Faq items={[{ question: 'Q?', answer: 'A.' }]} />)
    })

    it('renders with empty items', () => {
      renderSafe(<Faq items={[]} />)
    })
  })

  describe('Summary', () => {
    it('renders with minimal props', () => {
      renderSafe(<Summary title="Sum" />)
    })

    it('renders with body', () => {
      renderSafe(<Summary title="Sum" body="Body text" />)
    })
  })

  describe('Toolbox', () => {
    it('renders with items', () => {
      renderSafe(<Toolbox items={[{ tool: 'VS Code', use: 'Editor' }]} />)
    })

    it('renders with empty items', () => {
      renderSafe(<Toolbox items={[]} />)
    })
  })

  describe('AuthorCard', () => {
    it('renders with minimal props', () => {
      renderSafe(<AuthorCard name="John" />)
    })

    it('renders with all optional props', () => {
      renderSafe(<AuthorCard name="John" role="Dev" bio="Builds things" />)
    })
  })

  describe('Subscribe', () => {
    it('renders with minimal props', () => {
      renderSafe(<Subscribe title="Subscribe" />)
    })

    it('renders with description', () => {
      renderSafe(<Subscribe title="Sub" description="Get updates" />)
    })
  })

  describe('Callout (layout)', () => {
    it('renders with children', () => {
      renderSafe(<Callout>Note content</Callout>)
    })

    it('renders with all optional props', () => {
      renderSafe(<Callout tone="warning" title="Watch out" content="Be careful" />)
    })

    it('renders with type alias', () => {
      renderSafe(<Callout type="tip">A tip</Callout>)
    })
  })

  describe('ComparisonTable', () => {
    it('renders with data', () => {
      renderSafe(
        <ComparisonTable
          columns={['A', 'B']}
          rows={[{ label: 'Row1', values: ['x', 'y'] }]}
        />,
      )
    })

    it('renders with empty rows', () => {
      renderSafe(<ComparisonTable columns={['A']} rows={[]} />)
    })
  })

  describe('Definition', () => {
    it('renders with required props', () => {
      renderSafe(<Definition term="API" description="Application Programming Interface" />)
    })
  })

  describe('ResourceList', () => {
    it('renders with items', () => {
      renderSafe(<ResourceList items={[{ title: 'Doc', url: 'http://x' }]} />)
    })

    it('renders with empty items', () => {
      renderSafe(<ResourceList items={[]} />)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Direct exports
// ═══════════════════════════════════════════════════════════════════════════════

describe('Direct export components', () => {
  describe('Columns / Column', () => {
    it('renders Columns with children', () => {
      renderSafe(
        <Columns>
          <Column>A</Column>
          <Column>B</Column>
        </Columns>,
      )
    })

    it('renders Columns with cols prop', () => {
      renderSafe(
        <Columns cols={3}>
          <Column>1</Column>
          <Column>2</Column>
          <Column>3</Column>
        </Columns>,
      )
    })
  })

  describe('ProsCons', () => {
    it('renders with children', () => {
      renderSafe(<ProsCons><div>Pro: Fast</div></ProsCons>)
    })
  })

  describe('Stat', () => {
    it('renders with minimal props', () => {
      renderSafe(<Stat label="Users" value={42} />)
    })

    it('renders with all optional props', () => {
      renderSafe(<Stat label="Revenue" value="$1M" trend="up" suffix="/mo" />)
    })
  })

  describe('StatGroup', () => {
    it('renders with children', () => {
      renderSafe(
        <StatGroup>
          <Stat label="A" value={1} />
          <Stat label="B" value={2} />
        </StatGroup>,
      )
    })
  })

  describe('Table', () => {
    it('renders with headers and rows', () => {
      renderSafe(<Table headers={['Name', 'Age']} rows={[['Alice', '30']]} />)
    })

    it('renders with empty rows (shows error message)', () => {
      const { container } = render(<Table headers={['X']} rows={[]} />)
      expect(container.querySelector('.mdx-component-error')).toBeTruthy()
    })

    it('renders with object rows and columns', () => {
      renderSafe(
        <Table
          columns={[{ key: 'name', title: 'Name' }, { key: 'age', title: 'Age' }]}
          rows={[{ name: 'Bob', age: 25 }]}
        />,
      )
    })
  })

  describe('TagList', () => {
    it('renders with tags', () => {
      const { container } = render(<TagList tags={['react', 'typescript']} />)
      expect(container.querySelector('.mdx-tag-list')).toBeTruthy()
    })

    it('renders with empty tags (returns null)', () => {
      const { container } = render(<TagList tags={[]} />)
      expect(container.innerHTML).toBe('')
    })
  })

  describe('RelatedEntry', () => {
    it('renders with path', () => {
      renderSafe(<RelatedEntry path="/entries/123" />)
    })

    it('renders with label', () => {
      renderSafe(<RelatedEntry path="/entries/123" label="My Entry" />)
    })
  })

  describe('RelatedIdentity', () => {
    it('renders with path', () => {
      renderSafe(<RelatedIdentity path="/identities/abc" />)
    })

    it('renders with label', () => {
      renderSafe(<RelatedIdentity path="/identities/abc" label="Person" />)
    })
  })

  describe('Kanban', () => {
    it('renders with columns', () => {
      renderSafe(
        <Kanban
          columns={[
            { title: 'Todo', items: [{ text: 'Task 1' }] },
            { title: 'Done', items: [{ text: 'Task 2', tags: ['urgent'] }] },
          ]}
        />,
      )
    })

    it('renders with empty columns (returns null)', () => {
      const { container } = render(<Kanban columns={[]} />)
      expect(container.innerHTML).toBe('')
    })
  })

  describe('Counter', () => {
    it('renders with required props', () => {
      renderSafe(<Counter count={7} label="issues" />)
    })
  })

  describe('RatingBar', () => {
    it('renders with minimal props', () => {
      renderSafe(<RatingBar score={3} />)
    })

    it('renders with all optional props', () => {
      renderSafe(<RatingBar score={4} max={10} label="Quality" />)
    })
  })

  describe('Stack', () => {
    it('renders with children', () => {
      renderSafe(<Stack><div>A</div><div>B</div></Stack>)
    })

    it('renders with custom gap', () => {
      renderSafe(<Stack gap={8}><div>X</div></Stack>)
    })
  })

  describe('ImageViewer', () => {
    it('renders with minimal props', () => {
      renderSafe(<ImageViewer src="photo.png" />)
    })

    it('renders with all optional props', () => {
      renderSafe(<ImageViewer src="photo.png" alt="A photo" caption="Figure 1" width="200px" />)
    })
  })

  describe('FileCard', () => {
    it('renders with path', () => {
      renderSafe(<FileCard path="/docs/readme.md" />)
    })

    it('renders with label', () => {
      renderSafe(<FileCard path="/docs/readme.md" label="README" />)
    })
  })

  describe('Charts (lazy)', () => {
    it('BarChart renders with data', () => {
      renderSafe(<BarChart data={[{ label: 'A', value: 10 }]} />)
    })

    it('BarChart renders with empty data', () => {
      const { container } = render(
        <Suspense fallback={null}><BarChart data={[]} /></Suspense>,
      )
      expect(container.querySelector('.mdx-chart-empty')).toBeTruthy()
    })

    it('LineChart renders with data', () => {
      renderSafe(<LineChart data={[{ label: 'Jan', value: 5 }]} />)
    })

    it('LineChart renders with empty data', () => {
      const { container } = render(
        <Suspense fallback={null}><LineChart data={[]} /></Suspense>,
      )
      expect(container.querySelector('.mdx-chart-empty')).toBeTruthy()
    })

    it('PieChart renders with data', () => {
      renderSafe(<PieChart data={[{ label: 'Slice', value: 50 }]} />)
    })

    it('PieChart renders with empty data', () => {
      const { container } = render(
        <Suspense fallback={null}><PieChart data={[]} /></Suspense>,
      )
      expect(container.querySelector('.mdx-chart-empty')).toBeTruthy()
    })

    it('RadarChart renders with data', () => {
      renderSafe(<RadarChart data={[{ label: 'Speed', value: 8 }]} />)
    })

    it('RadarChart renders with empty data', () => {
      const { container } = render(
        <Suspense fallback={null}><RadarChart data={[]} /></Suspense>,
      )
      expect(container.querySelector('.mdx-chart-empty')).toBeTruthy()
    })

    it('BarChart renders with title and color', () => {
      renderSafe(<BarChart data={[{ label: 'X', value: 1 }]} title="Revenue" color="#333" />)
    })
  })

  describe('Mermaid (lazy)', () => {
    it('renders with chart prop', () => {
      renderSafe(<Mermaid chart="graph TD; A-->B" />)
    })

    it('renders with children', () => {
      renderSafe(<Mermaid>graph LR; A--&gt;B</Mermaid>)
    })

    it('renders with empty source (shows error)', () => {
      const { container } = render(
        <Suspense fallback={null}><Mermaid chart="" /></Suspense>,
      )
      expect(container.querySelector('.mdx-diagram-error')).toBeTruthy()
    })
  })

  describe('InlineMath', () => {
    it('renders with math prop', () => {
      renderSafe(<InlineMath math="E=mc^2" />)
    })

    it('renders with children', () => {
      renderSafe(<InlineMath>x^2</InlineMath>)
    })

    it('renders with empty source (shows fallback)', () => {
      const { container } = render(<InlineMath math="" />)
      expect(container.querySelector('.mdx-math-fallback')).toBeTruthy()
    })
  })

  describe('BlockMath', () => {
    it('renders with math prop', () => {
      renderSafe(<BlockMath math="\\sum_{i=0}^n x_i" />)
    })

    it('renders with children', () => {
      renderSafe(<BlockMath>a^2 + b^2 = c^2</BlockMath>)
    })

    it('renders with empty source (shows fallback)', () => {
      const { container } = render(<BlockMath math="" />)
      expect(container.querySelector('.mdx-math-fallback')).toBeTruthy()
    })
  })

  describe('Section', () => {
    it('renders with children', () => {
      renderSafe(<Section><p>Content</p></Section>)
    })

    it('renders with compact density', () => {
      renderSafe(<Section density="compact"><p>Compact</p></Section>)
    })

    it('renders with relaxed density', () => {
      renderSafe(<Section density="relaxed"><p>Relaxed</p></Section>)
    })
  })

  describe('Subtitle', () => {
    it('renders with children', () => {
      renderSafe(<Subtitle>My Subtitle</Subtitle>)
    })
  })

  describe('Label', () => {
    it('renders with children', () => {
      renderSafe(<Label>Status</Label>)
    })
  })

  describe('Divider', () => {
    it('renders without label', () => {
      renderSafe(<Divider />)
    })

    it('renders with label', () => {
      renderSafe(<Divider label="Section Break" />)
    })
  })

  describe('HtmlPreview', () => {
    it('renders with inline html', () => {
      renderSafe(<HtmlPreview html="<h1>Hello</h1>" />)
    })

    it('renders with title and height', () => {
      renderSafe(<HtmlPreview html="<p>Test</p>" title="Preview" height={300} />)
    })

    it('renders with children', () => {
      renderSafe(<HtmlPreview>{'<div>child</div>'}</HtmlPreview>)
    })
  })

  describe('Grid', () => {
    it('renders with children', () => {
      renderSafe(<Grid><div>Cell</div></Grid>)
    })

    it('renders with custom cols and gap', () => {
      renderSafe(<Grid cols={6} gap={8}><div>A</div><div>B</div></Grid>)
    })
  })

  describe('Flow', () => {
    it('renders with children', () => {
      renderSafe(<Flow><span>A</span><span>B</span></Flow>)
    })

    it('renders with all optional props', () => {
      renderSafe(<Flow gap={20} justify="center" align="end"><span>X</span></Flow>)
    })
  })

  describe('DecisionRecord', () => {
    it('renders with minimal props', () => {
      renderSafe(<DecisionRecord question="Use React?" decision="Yes" />)
    })

    it('renders with all optional props', () => {
      renderSafe(
        <DecisionRecord
          question="Framework?"
          decision="React"
          owner="Alice"
          due="Friday"
          options={[{ label: 'React', tradeoff: 'Large ecosystem' }]}
          rationale="Most popular"
        />,
      )
    })

    it('renders with empty options', () => {
      renderSafe(<DecisionRecord question="Q" decision="D" options={[]} />)
    })
  })

  describe('StatusBadge', () => {
    it('renders with minimal props', () => {
      renderSafe(<StatusBadge status="open" />)
    })

    it('renders with tone', () => {
      renderSafe(<StatusBadge status="done" tone="success" />)
    })
  })

  describe('ComparisonMatrix', () => {
    it('renders with data', () => {
      renderSafe(
        <ComparisonMatrix
          columns={['Speed', 'Cost']}
          rows={[{ label: 'Option A', values: ['Fast', 'High'] }]}
        />,
      )
    })

    it('renders with empty rows (returns null)', () => {
      const { container } = render(<ComparisonMatrix columns={['X']} rows={[]} />)
      expect(container.innerHTML).toBe('')
    })
  })

  describe('RACI', () => {
    it('renders with rows', () => {
      renderSafe(
        <RACI rows={[{ work: 'Design', responsible: 'Alice', accountable: 'Bob' }]} />,
      )
    })

    it('renders with empty rows (returns null)', () => {
      const { container } = render(<RACI rows={[]} />)
      expect(container.innerHTML).toBe('')
    })

    it('renders with minimal row data', () => {
      renderSafe(<RACI rows={[{ work: 'Task' }]} />)
    })
  })

  describe('MilestoneTimeline', () => {
    it('renders with items', () => {
      renderSafe(
        <MilestoneTimeline items={[{ time: '2024-Q1', title: 'Launch' }]} />,
      )
    })

    it('renders with empty items (returns null)', () => {
      const { container } = render(<MilestoneTimeline items={[]} />)
      expect(container.innerHTML).toBe('')
    })
  })

  describe('InsightCard', () => {
    it('renders with required props', () => {
      renderSafe(<InsightCard title="Key Finding"><p>Details here</p></InsightCard>)
    })
  })

  describe('SourceCard', () => {
    it('renders with minimal props', () => {
      renderSafe(<SourceCard path="/audio/recording.m4a" />)
    })

    it('renders with all optional props', () => {
      renderSafe(
        <SourceCard path="https://example.com" label="Example" type="url" note="Main source" />,
      )
    })
  })

  describe('ReferenceList', () => {
    it('renders with sources', () => {
      renderSafe(
        <ReferenceList sources={[{ path: '/a.md', label: 'Doc A' }, { path: '/b.md' }]} />,
      )
    })

    it('renders with empty sources', () => {
      const { container } = render(<ReferenceList sources={[]} />)
      expect(container.querySelector('.mdx-reference-list')).toBeTruthy()
    })
  })

  describe('CopyButton', () => {
    it('renders with text', () => {
      renderSafe(<CopyButton text="Hello" />)
    })

    it('renders with custom label', () => {
      renderSafe(<CopyButton text="Code" label="Copy Code" />)
    })

    it('renders with children', () => {
      renderSafe(<CopyButton text="X"><span>Click to copy</span></CopyButton>)
    })
  })
})
