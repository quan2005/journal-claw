import { arrayBlock, fieldsBlock, LayoutBlock, objectBlock } from './blockFactory'

export function Quote({
  text,
  author,
  context,
  source,
  url,
}: {
  text: string
  author?: string
  context?: string
  source?: string
  url?: string
}) {
  return <LayoutBlock block={fieldsBlock('quote', { text, author, context, source, url })} />
}

export function QuoteCard({
  text,
  author,
  source,
  variant = 'default',
}: {
  text: string
  author?: string
  source?: string
  variant?: 'default' | 'minimal' | 'large' | 'inline'
}) {
  return (
    <LayoutBlock
      block={fieldsBlock('quote-card', { text, author, source }, { attrs: { variant } })}
    />
  )
}

export function ImageText({
  image,
  title,
  text,
  alt,
  variant = 'default',
}: {
  image: string
  title?: string
  text?: string
  alt?: string
  variant?: 'default' | 'reverse'
}) {
  return (
    <LayoutBlock
      block={fieldsBlock('image-text', { image, title, text, alt }, { attrs: { variant } })}
    />
  )
}

export interface ImageStepItem {
  image?: string
  title: string
  text?: string
}

export function ImageSteps({ items }: { items: ImageStepItem[] }) {
  return <LayoutBlock block={arrayBlock('image-steps', items)} />
}

export interface CompareItem {
  leftTag?: string
  leftLabel: string
  leftText: string
  rightTag?: string
  rightLabel: string
  rightText: string
}

export function Compare({
  heading,
  items,
}: {
  heading?: string
  items: CompareItem[]
}) {
  return (
    <LayoutBlock
      block={objectBlock('compare', { heading, items })}
    />
  )
}
