import type { ReactNode } from 'react'
import {
  arrayBlock,
  fieldsBlock,
  LayoutBlock,
  nodeText,
  objectBlock,
  rowsBlock,
} from './blockFactory'

export type CalloutTone = 'note' | 'tip' | 'info' | 'warning' | 'danger'

export function Callout({
  heading,
  type,
  tone,
  title,
  content,
  children,
}: {
  heading?: string
  type?: CalloutTone
  tone?: CalloutTone
  title?: string
  content?: string
  children?: ReactNode
}) {
  const modifier = tone ?? type ?? 'note'
  return (
    <LayoutBlock
      block={rowsBlock('callout', [{ content: content ?? nodeText(children) }], ['content'], {
        title: heading ?? title,
        modifier,
      })}
    />
  )
}

export function Definition({ term, description }: { term: string; description: string }) {
  return <LayoutBlock block={objectBlock('definition', { term, description })} />
}

export function QuoteCard({ quote, source }: { quote: string; source?: string }) {
  return <LayoutBlock block={fieldsBlock('quote-card', { quote, source })} />
}

export function Tweet({ text, author, url }: { text: string; author?: string; url?: string }) {
  return <LayoutBlock block={fieldsBlock('tweet', { text, author, url })} />
}

export interface StatRowItem {
  label: string
  value: string | number
}

export function StatRow({ items }: { items: StatRowItem[] }) {
  return <LayoutBlock block={arrayBlock('stat-row', items)} />
}

export function Question({ text, context }: { text: string; context?: string }) {
  return <LayoutBlock block={fieldsBlock('question', { text, context })} />
}

export interface ResourceItem {
  title: string
  url: string
}

export function ResourceList({ items }: { items: ResourceItem[] }) {
  return <LayoutBlock block={arrayBlock('resource-list', items)} />
}

export interface ComparisonTableRow {
  label: string
  values: Array<string | number | boolean>
}

export function ComparisonTable({
  heading,
  title,
  columns,
  rows,
}: {
  heading?: string
  title?: string
  columns: string[]
  rows: ComparisonTableRow[]
}) {
  return (
    <LayoutBlock
      block={objectBlock('comparison-table', { columns, rows }, { title: heading ?? title })}
    />
  )
}

export interface ChangelogItem {
  date: string
  title: string
  note?: string
}

export function Changelog({ items }: { items: ChangelogItem[] }) {
  return <LayoutBlock block={arrayBlock('changelog', items)} />
}
