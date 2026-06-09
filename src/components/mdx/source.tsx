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
