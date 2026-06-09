import { Children, isValidElement, type ReactNode } from 'react'
import { fieldsBlock, LayoutBlock, rowsBlock } from './blockFactory'

export function Hero({
  eyebrow,
  title,
  subtitle,
  meta,
  variant = 'default',
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  meta?: string
  variant?: 'default' | 'quiet' | 'accent'
}) {
  return (
    <LayoutBlock
      block={fieldsBlock('hero', { eyebrow, title, subtitle, meta }, { attrs: { variant } })}
    />
  )
}

export interface TocItem {
  label: string
  title: string
  description?: string
}

export function Toc({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: TocItem[]
}) {
  return (
    <LayoutBlock
      block={rowsBlock('toc', items, ['label', 'title', 'description'], {
        title: heading ?? title,
      })}
    />
  )
}

export interface CardItem {
  image?: string
  title: string
  description?: string
  meta?: string
  variant?: 'default' | 'subtle' | 'elevated' | 'accent'
}

export function Card(props: CardItem) {
  return <Cards items={[props]} />
}

function cardsFromChildren(children: ReactNode): CardItem[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<CardItem>(child) || !child.props.title) return []
    return [child.props]
  })
}

export function Cards({
  heading,
  title,
  items,
  children,
}: {
  heading?: string
  title?: string
  items?: CardItem[]
  children?: ReactNode
}) {
  const normalizedItems = items ?? cardsFromChildren(children)
  return (
    <LayoutBlock
      block={rowsBlock('cards', normalizedItems, ['title', 'description', 'meta', 'variant'], {
        title: heading ?? title,
      })}
    />
  )
}

export function Part({
  label,
  title,
  subtitle,
}: {
  label?: string
  title: string
  subtitle?: string
}) {
  return <LayoutBlock block={fieldsBlock('part', { label, title, subtitle })} />
}

export function LabelTitle({
  label,
  title,
  subtitle,
}: {
  label?: string
  title: string
  subtitle?: string
}) {
  return <LayoutBlock block={fieldsBlock('label-title', { label, title, subtitle })} />
}
