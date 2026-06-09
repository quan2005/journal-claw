import type { ReactNode } from 'react'
import { fieldsBlock, LayoutBlock, rowsBlock } from './blockFactory'

export function Cta({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: string
}) {
  return <LayoutBlock block={fieldsBlock('cta', { title, description, action })} />
}

export interface FaqItem {
  question: string
  answer: string
}

export function Faq({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: FaqItem[]
}) {
  return (
    <LayoutBlock
      block={rowsBlock('faq', items, ['question', 'answer'], { title: heading ?? title })}
    />
  )
}

export interface ChecklistItem {
  text?: string
  item?: string
  state?: 'todo' | 'done' | 'checked'
  checked?: boolean
}

export function Checklist({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: ChecklistItem[]
}) {
  const normalized = items.map((item) => ({
    item: item.item ?? item.text ?? '',
    state: item.state ?? (item.checked ? 'done' : 'todo'),
  }))
  return (
    <LayoutBlock
      block={rowsBlock('checklist', normalized, ['item', 'state'], { title: heading ?? title })}
    />
  )
}

export interface CaseItem {
  case: string
  result: string
  note?: string
}

export function Cases({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: CaseItem[]
}) {
  return (
    <LayoutBlock
      block={rowsBlock('cases', items, ['case', 'result', 'note'], { title: heading ?? title })}
    />
  )
}

export function Summary({
  title,
  body,
  children,
}: {
  title: string
  body?: string
  children?: ReactNode
}) {
  return <LayoutBlock block={fieldsBlock('summary', { title, body: body ?? children })} />
}

export function Notice({ title, text }: { title?: string; text: string }) {
  return <LayoutBlock block={fieldsBlock('notice', { title, text })} />
}

export interface LogoItem {
  name: string
  meta?: string
}

export function Logos({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: LogoItem[]
}) {
  return (
    <LayoutBlock block={rowsBlock('logos', items, ['name', 'meta'], { title: heading ?? title })} />
  )
}

export interface PricingItem {
  plan: string
  price: string
  note?: string
}

export function Pricing({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: PricingItem[]
}) {
  return (
    <LayoutBlock
      block={rowsBlock('pricing', items, ['plan', 'price', 'note'], { title: heading ?? title })}
    />
  )
}

export interface SpecItem {
  name: string
  value: string
  note?: string
}

export function Specs({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: SpecItem[]
}) {
  return (
    <LayoutBlock
      block={rowsBlock('specs', items, ['name', 'value', 'note'], { title: heading ?? title })}
    />
  )
}

export interface ToolboxItem {
  tool: string
  use: string
  link?: string
}

export function Toolbox({
  heading,
  title,
  items,
}: {
  heading?: string
  title?: string
  items: ToolboxItem[]
}) {
  return (
    <LayoutBlock
      block={rowsBlock('toolbox', items, ['tool', 'use', 'link'], { title: heading ?? title })}
    />
  )
}
