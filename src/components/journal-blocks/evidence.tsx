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

export function QuoteBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  return (
    <blockquote className="journal-block journal-block-quote">
      <p>{data.text}</p>
      {data.source && <cite>{data.url ? <a href={data.url}>{data.source}</a> : data.source}</cite>}
    </blockquote>
  )
}

export function ImageTextBlock({
  block,
  entryPath,
}: {
  block: JournalBlock
  entryPath?: string
}) {
  const data = fields(block)
  const variant = block.attrs.variant === 'reverse' ? ' journal-block-image-text-reverse' : ''
  return (
    <section className={`journal-block journal-block-image-text${variant}`}>
      <img src={resolveImage(data.image, entryPath)} alt={data.alt ?? data.title ?? ''} />
      <div>
        {data.title && <h3>{data.title}</h3>}
        {data.text && <p>{data.text}</p>}
      </div>
    </section>
  )
}
