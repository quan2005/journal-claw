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
  const variantClass =
    variant !== 'default' ? ` journal-block-quote-card-${variant}` : ''
  const hasMeta = Boolean(data.author || data.source)

  return (
    <figure className={`journal-block journal-block-content journal-block-quote-card${variantClass}`}>
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

  return (
    <section className="journal-block journal-block-content journal-block-compare">
      {heading && <h2 className="journal-block-compare-heading">{heading}</h2>}
      <div className="journal-block-compare-list">
        {items.map((item, index) => {
          const row = asRecord(item)
          return (
            <div key={index} className="journal-block-compare-item">
              <div className="journal-block-compare-card-left">
                {stringValue(row.leftTag) && (
                  <span className="journal-block-compare-tag">{stringValue(row.leftTag)}</span>
                )}
                <div className="journal-block-compare-label">{stringValue(row.leftLabel)}</div>
                <p className="journal-block-compare-text">{stringValue(row.leftText)}</p>
              </div>
              <div className="journal-block-compare-card-right">
                {stringValue(row.rightTag) && (
                  <span className="journal-block-compare-tag">{stringValue(row.rightTag)}</span>
                )}
                <div className="journal-block-compare-label">{stringValue(row.rightLabel)}</div>
                <p className="journal-block-compare-text">{stringValue(row.rightText)}</p>
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
