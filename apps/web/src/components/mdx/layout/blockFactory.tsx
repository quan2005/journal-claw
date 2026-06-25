/* eslint-disable react-refresh/only-export-components -- this module is a typed block factory, not a refresh boundary */
import { isValidElement, type ReactNode } from 'react'
import type { JournalBlock, LayoutAttrs } from '../../../lib/journalLayout'
import { JournalBlockRenderer } from '../../journal-blocks/JournalBlockRenderer'
import { useMdxRuntime } from '../runtimeContext'

const sourceRange = { startLine: 0, endLine: 0 }

export function textValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children)
  return ''
}

function sourceFor(name: string, value: unknown): string {
  return JSON.stringify({ name, value })
}

export function fieldsBlock(
  name: string,
  fields: Record<string, unknown>,
  options: { title?: string; attrs?: LayoutAttrs; modifier?: string } = {},
): JournalBlock {
  const normalized = Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, textValue(value)]),
  )

  return {
    name,
    title: options.title,
    modifier: options.modifier,
    attrs: options.attrs ?? {},
    body: { format: 'fields', fields: normalized },
    source: sourceFor(name, normalized),
    sourceRange,
  }
}

export function rowsBlock(
  name: string,
  items: readonly unknown[],
  columns: readonly string[],
  options: { title?: string; attrs?: LayoutAttrs; modifier?: string } = {},
): JournalBlock {
  const rows = items.map((item) => {
    const record =
      item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : { [columns[0]]: item }
    return columns.map((column) => textValue(record[column]))
  })

  return {
    name,
    title: options.title,
    modifier: options.modifier,
    attrs: options.attrs ?? {},
    body: { format: 'rows', rows },
    source: sourceFor(name, rows),
    sourceRange,
  }
}

export function objectBlock(
  name: string,
  value: Record<string, unknown>,
  options: { title?: string; attrs?: LayoutAttrs; modifier?: string } = {},
): JournalBlock {
  return {
    name,
    title: options.title,
    modifier: options.modifier,
    attrs: options.attrs ?? {},
    body: { format: 'json_object', value },
    source: sourceFor(name, value),
    sourceRange,
  }
}

export function arrayBlock(
  name: string,
  value: readonly unknown[],
  options: { title?: string; attrs?: LayoutAttrs; modifier?: string } = {},
): JournalBlock {
  return {
    name,
    title: options.title,
    modifier: options.modifier,
    attrs: options.attrs ?? {},
    body: { format: 'json_array', value: [...value] },
    source: sourceFor(name, value),
    sourceRange,
  }
}

export function LayoutBlock({ block }: { block: JournalBlock }) {
  const { entryPath } = useMdxRuntime()
  return <JournalBlockRenderer block={block} entryPath={entryPath} />
}
