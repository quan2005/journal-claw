import type { ReactNode } from 'react'

export interface ReferenceSource {
  path: string
  label?: string
  type?: 'audio' | 'video' | 'file' | 'text' | 'url' | string
  note?: string
}

export function SourceCard({ path, label, type = 'file', note }: ReferenceSource) {
  const isUrl = /^https?:\/\//i.test(path)
  const attrs = isUrl ? { href: path } : { 'data-filepath': path }

  return (
    <a className="mdx-source-card mdx-specialized-content" {...attrs}>
      <span className="mdx-source-type">{type}</span>
      <span className="mdx-source-label">{label ?? path}</span>
      {note && <span className="mdx-source-note">{note}</span>}
    </a>
  )
}

export function ReferenceList({ sources }: { sources: ReferenceSource[] }) {
  return (
    <div className="mdx-reference-list mdx-specialized-content">
      {sources.map((source) => (
        <SourceCard key={`${source.path}-${source.label ?? ''}`} {...source} />
      ))}
    </div>
  )
}

export function TimestampLink({
  src,
  time,
  children,
}: {
  src: string
  time: string | number
  children?: ReactNode
}) {
  return (
    <a className="mdx-timestamp-link" data-media-src={src} data-media-time={time}>
      {children ?? String(time)}
    </a>
  )
}

export function CopyButton({
  text,
  label = '复制',
  children,
}: {
  text: string
  label?: string
  children?: ReactNode
}) {
  return (
    <button type="button" className="mdx-copy-button" data-copy-text={text}>
      {children ?? label}
    </button>
  )
}

export interface TranscriptItem {
  speaker?: string
  time?: string
  text: string
  src?: string
}

export function Transcript({
  items,
  collapsible = false,
  title = '转写片段',
}: {
  items: TranscriptItem[]
  collapsible?: boolean
  title?: string
}) {
  const body = (
    <div className="mdx-transcript-body">
      {items.map((item, index) => (
        <div key={`${item.time ?? index}-${item.speaker ?? ''}`} className="mdx-transcript-item">
          <div className="mdx-transcript-meta">
            {item.speaker && <span>{item.speaker}</span>}
            {item.time && item.src ? (
              <TimestampLink src={item.src} time={item.time}>
                {item.time}
              </TimestampLink>
            ) : item.time ? (
              <span>{item.time}</span>
            ) : null}
          </div>
          <p>{item.text}</p>
        </div>
      ))}
    </div>
  )

  if (collapsible) {
    return (
      <details className="mdx-transcript mdx-specialized-prose">
        <summary>{title}</summary>
        {body}
      </details>
    )
  }

  return (
    <section className="mdx-transcript mdx-specialized-prose">
      <div className="mdx-transcript-title">{title}</div>
      {body}
    </section>
  )
}
