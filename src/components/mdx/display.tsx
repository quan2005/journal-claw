import { isValidElement, type ReactNode } from 'react'

// ── ProsCons ────────────────────────────────────────────

export function ProsCons({ children }: { children: ReactNode }) {
  return <div className="mdx-pros-cons">{children}</div>
}

// ── Stat ────────────────────────────────────────────────

export function Stat({
  label,
  value,
  trend,
  suffix,
}: {
  label: string
  value: string | number
  trend?: 'up' | 'down'
  suffix?: string
}) {
  return (
    <div className="mdx-stat">
      <div className="mdx-stat-value">
        {value}
        {suffix && <small>{suffix}</small>}
        {trend && (
          <span className={`mdx-stat-trend mdx-stat-trend--${trend}`}>
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
      <div className="mdx-stat-label">{label}</div>
    </div>
  )
}

export function StatGroup({ children }: { children: ReactNode }) {
  return <div className="mdx-stat-group">{children}</div>
}

// ── Table ───────────────────────────────────────────────

type TableColumn =
  | string
  | {
      key: string
      title?: ReactNode
      label?: ReactNode
      header?: ReactNode
    }

type TableRow = unknown[] | Record<string, unknown>

interface TableProps {
  headers?: ReactNode[]
  columns?: TableColumn[]
  rows?: TableRow[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function renderable(value: unknown): ReactNode {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value))
    return value.map((item, index) => <span key={index}>{renderable(item)}</span>)
  if (isValidElement(value)) return value
  if (isRecord(value)) return JSON.stringify(value)
  return String(value)
}

function tableColumnKey(column: TableColumn): string {
  return typeof column === 'string' ? column : column.key
}

function tableColumnHeader(column: TableColumn): ReactNode {
  if (typeof column === 'string') return column
  return column.title ?? column.label ?? column.header ?? column.key
}

function deriveObjectKeys(rows: TableRow[] = []): string[] {
  const firstObjectRow = rows.find(isRecord)
  return firstObjectRow ? Object.keys(firstObjectRow) : []
}

function normalizeTable({ headers, columns, rows = [] }: TableProps) {
  const columnKeys = columns?.map(tableColumnKey) ?? deriveObjectKeys(rows)
  const normalizedHeaders = headers ?? columns?.map(tableColumnHeader) ?? columnKeys
  const normalizedRows = rows.map((row) => {
    if (Array.isArray(row)) return row.map(renderable)
    if (columnKeys.length > 0) return columnKeys.map((key) => renderable(row[key]))
    return Object.values(row).map(renderable)
  })

  return { headers: normalizedHeaders.map(renderable), rows: normalizedRows }
}

function hasHeaderValue(header: ReactNode): boolean {
  if (header === null || header === undefined) return false
  if (typeof header === 'string') return header.trim().length > 0
  return true
}

export function Table(props: TableProps) {
  const { headers, rows } = normalizeTable(props)
  const hasHeaders = headers.some(hasHeaderValue)

  if (rows.length === 0) {
    return (
      <div className="mdx-component-error" role="note">
        <div className="mdx-component-error-title">Table has no rows</div>
      </div>
    )
  }

  return (
    <div className="mdx-table-wrap">
      <table className={`mdx-table ${hasHeaders ? 'mdx-table--has-header' : 'mdx-table--plain'}`}>
        {hasHeaders && (
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Timeline ────────────────────────────────────────────

export function Timeline({ items }: { items: { time: string; title: string; desc?: string }[] }) {
  return (
    <div className="mdx-timeline">
      {items.map((item, i) => (
        <div key={i} className="mdx-timeline-item">
          <div className="mdx-timeline-time">{item.time}</div>
          <div className="mdx-timeline-title">{item.title}</div>
          {item.desc && <div className="mdx-timeline-desc">{item.desc}</div>}
        </div>
      ))}
    </div>
  )
}

// ── TagList ─────────────────────────────────────────────

export function TagList({ tags }: { tags: string[] }) {
  return (
    <div className="mdx-tag-list">
      {tags.map((tag, i) => (
        <span key={i} className="mdx-tag">
          {tag}
        </span>
      ))}
    </div>
  )
}
