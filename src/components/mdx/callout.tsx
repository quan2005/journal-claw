type CalloutType = 'info' | 'warning' | 'tip' | 'note'

export function Callout({ type: _type = 'note', title: _title, children }: { type?: CalloutType; title?: string; children: React.ReactNode }) {
  return <div>{children}</div>
}

export function Quote({ text, source: _source, url: _url }: { text: string; source?: string; url?: string }) {
  return <blockquote>{text}</blockquote>
}

export function RelatedEntry({ path, label }: { path: string; label?: string }) {
  return <a data-md-link={path}>{label ?? path}</a>
}

export function RelatedIdentity({ path, label }: { path: string; label?: string }) {
  return <a data-md-link={path}>{label ?? path}</a>
}
