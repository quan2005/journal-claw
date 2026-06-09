import { fieldsBlock, LayoutBlock, rowsBlock } from './blockFactory'

export function AuthorCard({ name, role, bio }: { name: string; role?: string; bio?: string }) {
  return <LayoutBlock block={fieldsBlock('author-card', { name, role, bio })} />
}

export function Subscribe({ title, description }: { title: string; description?: string }) {
  return <LayoutBlock block={fieldsBlock('subscribe', { title, description })} />
}

export interface PersonItem {
  name: string
  role?: string
  note?: string
}

export function People({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: PersonItem[]
}) {
  return (
    <LayoutBlock
      block={rowsBlock('people', items, ['name', 'role', 'note'], { title: heading ?? title })}
    />
  )
}

export interface SeriesItem {
  title: string
  status?: string
  path?: string
}

export function Series({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: SeriesItem[]
}) {
  return (
    <LayoutBlock
      block={rowsBlock('series', items, ['title', 'status', 'path'], { title: heading ?? title })}
    />
  )
}
