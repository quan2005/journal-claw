type CalloutType = 'info' | 'warning' | 'tip' | 'note'

const typeLabels: Record<CalloutType, string> = {
  info: 'Info',
  warning: 'Warning',
  tip: 'Tip',
  note: 'Note',
}

export function Callout({
  type = 'note',
  title,
  children,
}: {
  type?: CalloutType
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className={`mdx-callout mdx-callout--${type}`}>
      <div className="mdx-callout-title">{title ?? typeLabels[type]}</div>
      {children}
    </div>
  )
}

export function Quote({ text, source, url }: { text: string; source?: string; url?: string }) {
  return (
    <blockquote className="mdx-quote">
      <p>{text}</p>
      {source && (
        <div className="mdx-quote-source">&mdash; {url ? <a href={url}>{source}</a> : source}</div>
      )}
    </blockquote>
  )
}

export function RelatedEntry({ path, label }: { path: string; label?: string }) {
  return (
    <a className="mdx-related-link" data-md-link={path} style={{ cursor: 'pointer' }}>
      {label ?? path}
    </a>
  )
}

export function RelatedIdentity({ path, label }: { path: string; label?: string }) {
  return (
    <a className="mdx-related-link" data-md-link={path} style={{ cursor: 'pointer' }}>
      {label ?? path}
    </a>
  )
}
