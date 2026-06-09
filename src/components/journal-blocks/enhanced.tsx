import type { JournalBlock } from '../../lib/journalLayout'
import type { CSSProperties } from 'react'

const labels: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  info: 'Info',
  warning: 'Warning',
  danger: 'Danger',
}

export function CalloutBlock({ block }: { block: JournalBlock }) {
  const tone = block.modifier ?? 'note'
  const rows = block.body.format === 'rows' ? block.body.rows : []
  const content = rows.map((row) => row.join(' | ')).join('\n')

  return (
    <aside className={`journal-block journal-block-callout journal-block-callout-${tone}`}>
      <div className="journal-block-callout-title">{block.title ?? labels[tone] ?? 'Note'}</div>
      <div className="journal-block-callout-body">{content}</div>
    </aside>
  )
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function resourceKind(url: string): string {
  const cleanUrl = url.split(/[?#]/)[0] ?? url
  const extension = cleanUrl.match(/\.([A-Za-z0-9]+)$/)?.[1]?.toUpperCase()
  if (extension === 'MDX') return 'MDX'
  if (extension === 'MD') return 'MD'
  if (extension) return extension.slice(0, 4)
  if (/^https?:\/\//i.test(url)) return 'WEB'
  return 'FILE'
}

function compactResourcePath(url: string): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url)
      return `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '')
    } catch {
      return url
    }
  }

  const parts = url.split('/').filter(Boolean)
  if (parts.length <= 2) return url
  return `.../${parts.slice(-2).join('/')}`
}

function isLocalResource(url: string): boolean {
  return Boolean(url) && !/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)
}

export function DefinitionBlock({ block }: { block: JournalBlock }) {
  const data = block.body.format === 'json_object' ? block.body.value : {}
  return (
    <section className="journal-block journal-block-prose journal-block-definition">
      <h3>{stringValue(data.term)}</h3>
      <p>{stringValue(data.description)}</p>
    </section>
  )
}

export function ResourceListBlock({ block }: { block: JournalBlock }) {
  const items = block.body.format === 'json_array' ? block.body.value : []
  return (
    <section className="journal-block journal-block-content journal-block-resources">
      {items.map((item, index) => {
        const data = asRecord(item)
        const title = stringValue(data.title)
        const url = stringValue(data.url)
        const local = isLocalResource(url)
        return (
          <a
            key={`${title}-${index}`}
            className="journal-block-resource journal-block-resource-card"
            href={url || undefined}
            data-filepath={local ? url : undefined}
          >
            <span className="journal-block-resource-main">
              <strong className="journal-block-resource-title">{title}</strong>
              {url && (
                <span className="journal-block-resource-path" title={url}>
                  {compactResourcePath(url)}
                </span>
              )}
            </span>
            {url && <span className="journal-block-resource-kind">{resourceKind(url)}</span>}
          </a>
        )
      })}
    </section>
  )
}

export function ComparisonTableBlock({ block }: { block: JournalBlock }) {
  const data = block.body.format === 'json_object' ? block.body.value : {}
  const columns = Array.isArray(data.columns) ? data.columns.map(stringValue) : []
  const rows = Array.isArray(data.rows) ? data.rows : []
  const templateColumns = `minmax(116px, 0.8fr) repeat(${Math.max(
    1,
    columns.length,
  )}, minmax(0, 1fr))`
  const tableMinWidth = `max(100%, ${Math.max(560, 116 + columns.length * 108)}px)`

  return (
    <section
      className="journal-block journal-block-wide journal-block-table"
      aria-label={block.title ?? 'Comparison table'}
    >
      <div
        className="journal-block-table-grid"
        role="table"
        style={
          {
            '--journal-block-table-columns': templateColumns,
            '--journal-block-table-min-width': tableMinWidth,
          } as CSSProperties
        }
      >
        <div className="journal-block-table-row journal-block-table-header" role="row">
          <strong
            className="journal-block-table-cell journal-block-table-cell-header"
            role="columnheader"
          >
            Item
          </strong>
          {columns.map((column) => (
            <strong
              key={column}
              className="journal-block-table-cell journal-block-table-cell-header"
              role="columnheader"
            >
              {column}
            </strong>
          ))}
        </div>
        {rows.map((item, index) => {
          const row = asRecord(item)
          const values = Array.isArray(row.values) ? row.values.map(stringValue) : []
          return (
            <div key={index} className="journal-block-table-row" role="row">
              <strong className="journal-block-table-cell" role="rowheader">
                {stringValue(row.label)}
              </strong>
              {columns.map((_, valueIndex) => (
                <span key={valueIndex} className="journal-block-table-cell" role="cell">
                  {values[valueIndex]}
                </span>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}
