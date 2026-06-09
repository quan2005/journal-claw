import type { ReactNode } from 'react'
import { arrayBlock, LayoutBlock, nodeText, objectBlock, rowsBlock } from './blockFactory'

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
