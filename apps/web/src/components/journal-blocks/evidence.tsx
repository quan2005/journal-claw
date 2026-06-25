import { convertFileSrc } from '@tauri-apps/api/core'
import type { JournalBlock } from '../../lib/journalLayout'
import { resolveRelativePath } from '../../lib/markdownUtils'

function fields(block: JournalBlock): Record<string, string> {
  return block.body.format === 'fields' ? block.body.fields : {}
}

function resolveImage(src: string, entryPath?: string): string {
  if (!src || src.startsWith('http')) return src
  if (!entryPath) return convertFileSrc(src)
  const entryDir = entryPath.substring(0, entryPath.lastIndexOf('/'))
  return convertFileSrc(src.startsWith('/') ? src : resolveRelativePath(entryDir, src))
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

export function QuoteBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  const sourceLabel = data.source || data.url
  const hasMeta = Boolean(data.author || data.context || sourceLabel)

  return (
    <figure className="journal-block journal-block-content journal-block-quote">
      <blockquote className="journal-block-quote-body">
        <p className="journal-block-quote-text">{data.text}</p>
      </blockquote>
      {hasMeta && (
        <figcaption className="journal-block-quote-meta">
          {data.author && <span className="journal-block-quote-author">{data.author}</span>}
          {sourceLabel && (
            <cite className="journal-block-quote-source">
              {data.url ? <a href={data.url}>{sourceLabel}</a> : sourceLabel}
            </cite>
          )}
          {data.context && <span className="journal-block-quote-context">{data.context}</span>}
        </figcaption>
      )}
    </figure>
  )
}

export function QuoteCardBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  const variant = (block.attrs.variant as string) || 'default'
  const variantClass = variant !== 'default' ? ` journal-block-quote-card-${variant}` : ''
  const hasMeta = Boolean(data.author || data.source)

  return (
    <figure
      className={`journal-block journal-block-content journal-block-quote-card${variantClass}`}
    >
      <blockquote className="journal-block-quote-card-body">
        <p className="journal-block-quote-card-text">{data.text}</p>
      </blockquote>
      {hasMeta && (
        <figcaption className="journal-block-quote-card-footer">
          <span className="journal-block-quote-card-dash" aria-hidden="true" />
          {data.author && <cite className="journal-block-quote-card-author">{data.author}</cite>}
          {data.source && <span className="journal-block-quote-card-source">{data.source}</span>}
        </figcaption>
      )}
    </figure>
  )
}

export function CompareBlock({ block }: { block: JournalBlock }) {
  const data = block.body.format === 'json_object' ? block.body.value : {}
  const heading = stringValue(data.heading)
  const items = Array.isArray(data.items) ? data.items : []

  // First row may be a header row defining left/right labels
  let leftTag = ''
  let rightTag = ''
  let dataItems = items

  if (items.length > 0) {
    const first = asRecord(items[0])
    const firstItem = stringValue(first.item)
    // Detect header row: "item" field is a generic label like "痛点"
    // and left/right describe what the columns mean
    if (firstItem && !stringValue(first.leftLabel) && !stringValue(first.leftText)) {
      // New format: { item, left, right }
      leftTag = stringValue(first.left)
      rightTag = stringValue(first.right)
      dataItems = items.slice(1)
    }
  }

  return (
    <section className="journal-block journal-block-content journal-block-compare">
      {heading && <h2 className="journal-block-compare-heading">{heading}</h2>}
      <div className="journal-block-compare-list">
        {dataItems.map((item, index) => {
          const row = asRecord(item)
          const rowLeftLabel = stringValue(row.leftLabel) || stringValue(row.item)
          const rowLeftText = stringValue(row.leftText) || stringValue(row.left)
          const rowRightLabel = stringValue(row.rightLabel) || stringValue(row.item)
          const rowRightText = stringValue(row.rightText) || stringValue(row.right)
          const rowLeftTag = stringValue(row.leftTag) || leftTag
          const rowRightTag = stringValue(row.rightTag) || rightTag

          return (
            <div key={index} className="journal-block-compare-item">
              <div className="journal-block-compare-card-left">
                {rowLeftTag && <span className="journal-block-compare-tag">{rowLeftTag}</span>}
                <h3 className="journal-block-compare-label">{rowLeftLabel}</h3>
                <p className="journal-block-compare-text">{rowLeftText}</p>
              </div>
              <div className="journal-block-compare-card-right">
                {rowRightTag && <span className="journal-block-compare-tag">{rowRightTag}</span>}
                <h3 className="journal-block-compare-label">{rowRightLabel}</h3>
                <p className="journal-block-compare-text">{rowRightText}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function ImageTextBlock({ block, entryPath }: { block: JournalBlock; entryPath?: string }) {
  const data = fields(block)
  const variant = block.attrs.variant === 'reverse' ? ' journal-block-image-text-reverse' : ''
  return (
    <section className={`journal-block journal-block-content journal-block-image-text${variant}`}>
      <img src={resolveImage(data.image, entryPath)} alt={data.alt ?? data.title ?? ''} />
      <div>
        {data.title && <h3>{data.title}</h3>}
        {data.text && <p>{data.text}</p>}
      </div>
    </section>
  )
}

export function ImageStepsBlock({ block, entryPath }: { block: JournalBlock; entryPath?: string }) {
  const items = block.body.format === 'json_array' ? block.body.value : []
  return (
    <section className="journal-block journal-block-content journal-block-image-steps">
      {items.map((item, index) => {
        const data = asRecord(item)
        return (
          <article key={index} className="journal-block-image-step">
            {stringValue(data.image) && (
              <img
                src={resolveImage(stringValue(data.image), entryPath)}
                alt={stringValue(data.title)}
              />
            )}
            <div>
              <div className="journal-block-marker journal-block-row-marker" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </div>
              <h3>{stringValue(data.title)}</h3>
              {stringValue(data.text) && <p>{stringValue(data.text)}</p>}
            </div>
          </article>
        )
      })}
    </section>
  )
}
