import type { JournalBlock } from '../../lib/journalLayout'

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

function fields(block: JournalBlock): Record<string, string> {
  return block.body.format === 'fields' ? block.body.fields : {}
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

export function DefinitionBlock({ block }: { block: JournalBlock }) {
  const data = block.body.format === 'json_object' ? block.body.value : {}
  return (
    <section className="journal-block journal-block-definition">
      <h3>{stringValue(data.term)}</h3>
      <p>{stringValue(data.description)}</p>
    </section>
  )
}

export function QuoteCardBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  return (
    <section className="journal-block journal-block-quote-card">
      <blockquote>{data.quote}</blockquote>
      {data.source && <div className="journal-block-meta">{data.source}</div>}
    </section>
  )
}

export function TweetBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  return (
    <section className="journal-block journal-block-tweet">
      <p>{data.text}</p>
      {data.author && <div className="journal-block-meta">{data.author}</div>}
    </section>
  )
}

export function StatRowBlock({ block }: { block: JournalBlock }) {
  const items = block.body.format === 'json_array' ? block.body.value : []
  return (
    <section className="journal-block journal-block-stat-row">
      {items.map((item, index) => {
        const data = asRecord(item)
        return (
          <div key={index} className="journal-block-metric">
            <div className="journal-block-metric-value">{stringValue(data.value)}</div>
            <div className="journal-block-metric-label">{stringValue(data.label)}</div>
          </div>
        )
      })}
    </section>
  )
}

export function QuestionBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  return (
    <section className="journal-block journal-block-question">
      <div className="journal-block-kicker">Question</div>
      <h2>{data.text}</h2>
      {data.context && <p>{data.context}</p>}
    </section>
  )
}

export function ResourceListBlock({ block }: { block: JournalBlock }) {
  const items = block.body.format === 'json_array' ? block.body.value : []
  return (
    <section className="journal-block journal-block-resources">
      {items.map((item, index) => {
        const data = asRecord(item)
        const title = stringValue(data.title)
        const url = stringValue(data.url)
        return (
          <a key={`${title}-${index}`} className="journal-block-resource" href={url || undefined}>
            <strong>{title}</strong>
            {url && <span>{url}</span>}
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
  return (
    <section
      className="journal-block journal-block-table"
      aria-label={block.title ?? 'Comparison table'}
    >
      <div
        className="journal-block-table-grid"
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, columns.length + 1)}, minmax(0, 1fr))`,
        }}
      >
        <div className="journal-block-table-row journal-block-table-header">
          <strong>Item</strong>
          {columns.map((column) => (
            <strong key={column}>{column}</strong>
          ))}
        </div>
        {rows.map((item, index) => {
          const row = asRecord(item)
          const values = Array.isArray(row.values) ? row.values.map(stringValue) : []
          return (
            <div key={index} className="journal-block-table-row">
              <strong>{stringValue(row.label)}</strong>
              {columns.map((_, valueIndex) => (
                <span key={valueIndex}>{values[valueIndex]}</span>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function ChangelogBlock({ block }: { block: JournalBlock }) {
  const items = block.body.format === 'json_array' ? block.body.value : []
  return (
    <section className="journal-block journal-block-changelog">
      {items.map((item, index) => {
        const data = asRecord(item)
        return (
          <article key={index} className="journal-block-row">
            <span className="journal-block-row-marker">{stringValue(data.date)}</span>
            <div>
              <h3>{stringValue(data.title)}</h3>
              {stringValue(data.note) && <p>{stringValue(data.note)}</p>}
            </div>
          </article>
        )
      })}
    </section>
  )
}
