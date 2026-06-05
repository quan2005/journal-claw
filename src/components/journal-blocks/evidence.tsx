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
  return (
    <blockquote className="journal-block journal-block-prose journal-block-quote">
      <p>{data.text}</p>
      {data.source && <cite>{data.url ? <a href={data.url}>{data.source}</a> : data.source}</cite>}
    </blockquote>
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

export function ImageCompareBlock({
  block,
  entryPath,
}: {
  block: JournalBlock
  entryPath?: string
}) {
  const data = fields(block)
  return (
    <section className="journal-block journal-block-wide journal-block-image-compare">
      {data.title && <div className="journal-block-section-title">{data.title}</div>}
      <div className="journal-block-image-compare-grid">
        <figure>
          <img
            src={resolveImage(data.before, entryPath)}
            alt={data.title ? `${data.title} before` : 'Before'}
          />
          <figcaption>Before</figcaption>
        </figure>
        <div className="journal-block-image-compare-vs" aria-hidden="true">
          VS
        </div>
        <figure>
          <img
            src={resolveImage(data.after, entryPath)}
            alt={data.title ? `${data.title} after` : 'After'}
          />
          <figcaption>After</figcaption>
        </figure>
      </div>
      {data.caption && <p>{data.caption}</p>}
    </section>
  )
}

export function ImageAnnotateBlock({
  block,
  entryPath,
}: {
  block: JournalBlock
  entryPath?: string
}) {
  const data = block.body.format === 'json_object' ? block.body.value : {}
  const notes = Array.isArray(data.notes) ? data.notes : []
  return (
    <section className="journal-block journal-block-content journal-block-image-annotate">
      {stringValue(data.title) && (
        <div className="journal-block-section-title">{stringValue(data.title)}</div>
      )}
      {stringValue(data.image) && (
        <img src={resolveImage(stringValue(data.image), entryPath)} alt={stringValue(data.title)} />
      )}
      <ul className="journal-block-plain-list">
        {notes.map((note, index) => (
          <li key={index}>
            <span className="journal-block-marker journal-block-row-marker" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span>{stringValue(note) || JSON.stringify(note)}</span>
          </li>
        ))}
      </ul>
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
