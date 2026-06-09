import { LayoutBlock, rowsBlock } from './blockFactory'

export interface MetricItem {
  label: string
  value: string | number
  description?: string
}

export function Metrics({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: MetricItem[]
}) {
  return (
    <LayoutBlock
      block={rowsBlock('metrics', items, ['label', 'value', 'description'], {
        title: heading ?? title,
      })}
    />
  )
}

export interface StepItem {
  title: string
  description?: string
  meta?: string
}

export function Steps({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: StepItem[]
}) {
  return (
    <LayoutBlock
      block={rowsBlock('steps', items, ['title', 'description', 'meta'], {
        title: heading ?? title,
      })}
    />
  )
}

export interface TimelineItem {
  time: string
  title: string
  description?: string
  desc?: string
}

export function Timeline({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: TimelineItem[]
}) {
  const normalized = items.map((item) => ({ ...item, description: item.description ?? item.desc }))
  return (
    <LayoutBlock
      block={rowsBlock('timeline', normalized, ['time', 'title', 'description'], {
        title: heading ?? title,
      })}
    />
  )
}
