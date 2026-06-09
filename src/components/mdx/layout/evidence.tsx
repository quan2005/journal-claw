import { fieldsBlock, LayoutBlock, arrayBlock, objectBlock } from './blockFactory'

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

export function ImageCompare({
  before,
  after,
  title,
  caption,
}: {
  before: string
  after: string
  title?: string
  caption?: string
}) {
  return <LayoutBlock block={fieldsBlock('image-compare', { before, after, title, caption })} />
}

export function ImageAnnotate({
  image,
  title,
  notes = [],
}: {
  image: string
  title?: string
  notes?: unknown[]
}) {
  return <LayoutBlock block={objectBlock('image-annotate', { image, title, notes })} />
}

export interface ImageStepItem {
  image?: string
  title: string
  text?: string
}

export function ImageSteps({ items }: { items: ImageStepItem[] }) {
  return <LayoutBlock block={arrayBlock('image-steps', items)} />
}
