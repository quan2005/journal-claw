import { createElement, type ComponentType } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import manifest from '../components/mdx/component-manifest.json'
import { mdxComponents } from '../components/mdx'
import { MdxRuntimeProvider } from '../components/mdx/context'
import { JOURNAL_LAYOUT_MODULES } from '../lib/journalLayout'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}))

const fixtures: Record<string, Record<string, unknown>> = {
  Toc: { items: [{ label: '01', title: 'Section' }] },
  Cards: { items: [{ title: 'Card' }] },
  Metrics: { items: [{ label: 'Users', value: 3 }] },
  Steps: { items: [{ title: 'Step' }] },
  Timeline: { items: [{ time: 'Now', title: 'Event' }] },
  Verdict: { title: 'Verdict' },
  MythFact: { items: [{ myth: 'Myth', fact: 'Fact' }] },
  Quote: { text: 'Quote' },
  ImageText: { image: 'image.png' },
  ImageSteps: { items: [{ image: 'image.png', title: 'Step' }] },
  Cta: { title: 'Action' },
  Faq: { items: [{ question: 'Question', answer: 'Answer' }] },
  Checklist: { items: [{ text: 'Item' }] },
  Cases: { items: [{ case: 'Case', result: 'Result' }] },
  Summary: { title: 'Summary' },
  Toolbox: { items: [{ tool: 'Tool', use: 'Use' }] },
  AuthorCard: { name: 'Author' },
  Subscribe: { title: 'Subscribe' },
  Callout: { content: 'Callout' },
  Definition: { term: 'Term', description: 'Definition' },
  ResourceList: { items: [{ title: 'Resource', url: 'resource.mdx' }] },
  ComparisonTable: {
    columns: ['A'],
    rows: [{ label: 'Item', values: ['Value'] }],
  },
}

const retiredComponentNames = [
  'Pros',
  'Cons',
  'Col',
  'Options',
  'Option',
  'MacPreview',
  'PhonePreview',
  'Placeholder',
  'AudioCard',
  'VideoCard',
  'Tweet',
  'Transcript',
  'TimestampLink',
  'Split',
  'Compare',
  'Infographic',
  'Avatar',
  'AvatarGroup',
  'Progress',
  'People',
  'Series',
  'Logos',
  'Pricing',
  'Specs',
  'Notice',
  'Changelog',
  'ActionTable',
  'DecisionList',
  'RiskMatrix',
  'OptionMatrix',
  'IncidentTimeline',
  'EvidenceCard',
  'QuoteCard',
  'Hero',
  'Part',
  'LabelTitle',
  'AudienceFit',
  'Manifesto',
  'Bridge',
  'ImageCompare',
  'ImageAnnotate',
  'StatRow',
  'Question',
] as const

const retiredLayoutDirectives = [
  'hero',
  'part',
  'label-title',
  'compare',
  'infographic',
  'audience-fit',
  'manifesto',
  'bridge',
  'image-compare',
  'image-annotate',
  'notice',
  'logos',
  'pricing',
  'specs',
  'people',
  'series',
  'quote-card',
  'tweet',
  'stat-row',
  'question',
  'changelog',
] as const

describe('MDX layout component manifest', () => {
  it('does not expose retired article-irrelevant components', () => {
    const manifestNames = new Set(manifest.map((item) => item.jsxName))
    const registeredNames = new Set(Object.keys(mdxComponents))

    expect(retiredComponentNames.filter((name) => manifestNames.has(name))).toEqual([])
    expect(retiredComponentNames.filter((name) => registeredNames.has(name))).toEqual([])
  })

  it('does not register retired layout directives', () => {
    const manifestDirectives = new Set(
      manifest
        .filter((item) => item.kind === 'layout')
        .map((item) => item.directive)
        .filter(Boolean),
    )
    const catalogDirectives = new Set(JOURNAL_LAYOUT_MODULES.map((item) => item.name))

    expect(retiredLayoutDirectives.filter((name) => manifestDirectives.has(name))).toEqual([])
    expect(retiredLayoutDirectives.filter((name) => catalogDirectives.has(name))).toEqual([])
  })

  it('maps every directive module to a registered canonical JSX component', () => {
    const layout = manifest.filter((item) => item.kind === 'layout')

    expect(layout).toHaveLength(22)
    expect(new Set(layout.map((item) => item.directive))).toEqual(
      new Set(JOURNAL_LAYOUT_MODULES.map((item) => item.name)),
    )

    for (const item of layout) {
      expect(
        Object.prototype.hasOwnProperty.call(mdxComponents, item.jsxName),
        `${item.jsxName} must be registered`,
      ).toBe(true)
    }
  })

  it('documents every public MDX component without exposing unregistered names', () => {
    expect(new Set(manifest.map((item) => item.jsxName))).toEqual(
      new Set(Object.keys(mdxComponents)),
    )
  })

  it('registers the 61-component public surface including high-frequency stats', () => {
    expect(manifest).toHaveLength(61)
    expect(mdxComponents).toHaveProperty('StatGroup')
    expect(mdxComponents).toHaveProperty('Stat')
    expect(mdxComponents).toHaveProperty('Steps')
  })

  it('renders every canonical layout component through the shared journal block renderer', () => {
    for (const item of manifest.filter((entry) => entry.kind === 'layout')) {
      const Component = mdxComponents[item.jsxName as keyof typeof mdxComponents] as ComponentType<
        Record<string, unknown>
      >
      const { container, unmount } = render(
        <MdxRuntimeProvider entryPath="/tmp/journal/2606/demo.mdx">
          {createElement(Component, fixtures[item.jsxName])}
        </MdxRuntimeProvider>,
      )

      expect(container.querySelector('.journal-block'), item.jsxName).toBeTruthy()
      unmount()
    }
  })
})
