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
  Hero: { title: 'Hero' },
  Toc: { items: [{ label: '01', title: 'Section' }] },
  Cards: { items: [{ title: 'Card' }] },
  Part: { title: 'Part' },
  LabelTitle: { title: 'Label title' },
  Metrics: { items: [{ label: 'Users', value: 3 }] },
  Compare: { items: [{ item: 'Mode', left: 'Old', right: 'New' }] },
  Steps: { items: [{ title: 'Step' }] },
  Timeline: { items: [{ time: 'Now', title: 'Event' }] },
  Infographic: { title: 'Infographic' },
  Verdict: { title: 'Verdict' },
  AudienceFit: { items: [{ audience: 'Team', fit: 'High' }] },
  MythFact: { items: [{ myth: 'Myth', fact: 'Fact' }] },
  Manifesto: { items: [{ principle: 'Principle' }] },
  Bridge: { from: 'Before', to: 'After' },
  Quote: { text: 'Quote' },
  ImageText: { image: 'image.png' },
  ImageCompare: { before: 'before.png', after: 'after.png' },
  ImageAnnotate: { image: 'image.png', notes: ['Note'] },
  ImageSteps: { items: [{ image: 'image.png', title: 'Step' }] },
  Cta: { title: 'Action' },
  Faq: { items: [{ question: 'Question', answer: 'Answer' }] },
  Checklist: { items: [{ text: 'Item' }] },
  Cases: { items: [{ case: 'Case', result: 'Result' }] },
  Summary: { title: 'Summary' },
  Notice: { text: 'Notice' },
  Logos: { items: [{ name: 'Name' }] },
  Pricing: { items: [{ plan: 'Plan', price: '$0' }] },
  Specs: { items: [{ name: 'Name', value: 'Value' }] },
  Toolbox: { items: [{ tool: 'Tool', use: 'Use' }] },
  AuthorCard: { name: 'Author' },
  Subscribe: { title: 'Subscribe' },
  People: { items: [{ name: 'Person' }] },
  Series: { items: [{ title: 'Entry' }] },
  Callout: { content: 'Callout' },
  Definition: { term: 'Term', description: 'Definition' },
  QuoteCard: { quote: 'Quote' },
  Tweet: { text: 'Post' },
  StatRow: { items: [{ label: 'Metric', value: 1 }] },
  Question: { text: 'Question' },
  ResourceList: { items: [{ title: 'Resource', url: 'resource.mdx' }] },
  ComparisonTable: {
    columns: ['A'],
    rows: [{ label: 'Item', values: ['Value'] }],
  },
  Changelog: { items: [{ date: '2026-06-09', title: 'Change' }] },
}

describe('MDX layout component manifest', () => {
  it('maps every directive module to a registered canonical JSX component', () => {
    const layout = manifest.filter((item) => item.kind === 'layout')

    expect(layout).toHaveLength(43)
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
