import { fieldsBlock, LayoutBlock } from './blockFactory'

export function AuthorCard({ name, role, bio }: { name: string; role?: string; bio?: string }) {
  return <LayoutBlock block={fieldsBlock('author-card', { name, role, bio })} />
}

export function Subscribe({ title, description }: { title: string; description?: string }) {
  return <LayoutBlock block={fieldsBlock('subscribe', { title, description })} />
}
