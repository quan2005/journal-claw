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

function RelatedLink({ path, label }: { path: string; label?: string }) {
  return (
    <a className="mdx-related-link" data-md-link={path} style={{ cursor: 'pointer' }}>
      {label ?? path}
    </a>
  )
}

export function RelatedEntry(props: { path: string; label?: string }) {
  return <RelatedLink {...props} />
}

export function RelatedIdentity(props: { path: string; label?: string }) {
  return <RelatedLink {...props} />
}
