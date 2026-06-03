export function Split({ children }: { children: React.ReactNode }) {
  return <div className="mdx-split">{children}</div>
}

export function Columns({ cols = 2, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) {
  return <div className={`mdx-columns mdx-columns--${cols}`}>{children}</div>
}

export function Column({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function MacPreview({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mdx-mac-preview">
      <div className="mdx-mac-preview-header">
        <span className="mdx-mac-preview-dots">
          <span className="mdx-mac-preview-dot mdx-mac-preview-dot--red" />
          <span className="mdx-mac-preview-dot mdx-mac-preview-dot--yellow" />
          <span className="mdx-mac-preview-dot mdx-mac-preview-dot--green" />
        </span>
        {title && <span className="mdx-mac-preview-header-title">{title}</span>}
      </div>
      <div className="mdx-mac-preview-body">{children}</div>
    </div>
  )
}

export function Placeholder({ children }: { children: React.ReactNode }) {
  return <div className="mdx-placeholder">{children}</div>
}
