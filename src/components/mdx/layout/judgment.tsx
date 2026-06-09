import { fieldsBlock, LayoutBlock, rowsBlock } from './blockFactory'

export function Verdict({
  title,
  summary,
  confidence,
  status,
  variant = 'default',
}: {
  title: string
  summary?: string
  confidence?: string
  status?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
}) {
  return (
    <LayoutBlock
      block={fieldsBlock('verdict', { title, summary, confidence, status }, { attrs: { variant } })}
    />
  )
}

export interface AudienceFitItem {
  audience: string
  fit: string
  reason?: string
}

export function AudienceFit({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: AudienceFitItem[]
}) {
  return (
    <LayoutBlock
      block={rowsBlock('audience-fit', items, ['audience', 'fit', 'reason'], {
        title: heading ?? title,
      })}
    />
  )
}

export interface MythFactItem {
  myth: string
  fact: string
  reason?: string
}

export function MythFact({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: MythFactItem[]
}) {
  return (
    <LayoutBlock
      block={rowsBlock('myth-fact', items, ['myth', 'fact', 'reason'], { title: heading ?? title })}
    />
  )
}

export interface ManifestoItem {
  principle: string
  detail?: string
}

export function Manifesto({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: ManifestoItem[]
}) {
  return (
    <LayoutBlock
      block={rowsBlock('manifesto', items, ['principle', 'detail'], { title: heading ?? title })}
    />
  )
}

export function Bridge({ from, to, why }: { from: string; to: string; why?: string }) {
  return <LayoutBlock block={fieldsBlock('bridge', { from, to, why })} />
}
