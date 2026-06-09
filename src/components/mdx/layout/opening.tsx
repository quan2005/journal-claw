import { Children, isValidElement, type ReactNode } from 'react'
import { LayoutBlock, objectBlock, rowsBlock } from './blockFactory'

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

export function Hero({
  eyebrow,
  kicker,
  title,
  subtitle,
  lead,
  meta,
}: {
  eyebrow?: string
  kicker?: string
  title: string
  subtitle?: string
  lead?: string
  meta?: string
}) {
  return (
    <LayoutBlock
      block={objectBlock('hero', {
        eyebrow: eyebrow ?? kicker,
        title,
        subtitle: subtitle ?? lead,
        meta,
      })}
    />
  )
}
