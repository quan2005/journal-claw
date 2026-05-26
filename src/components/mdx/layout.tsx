export function Split({ children }: { children: React.ReactNode }) {
  return <div className="mdx-split">{children}</div>
}

export function Columns({ cols = 2, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) {
  return <div className={`mdx-columns mdx-columns--${cols}`}>{children}</div>
}

export function Column({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function Mockup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mdx-mockup">
      {title && <div className="mdx-mockup-header">{title}</div>}
      <div className="mdx-mockup-body">{children}</div>
    </div>
  )
}

export function Placeholder({ children }: { children: React.ReactNode }) {
  return <div className="mdx-placeholder">{children}</div>
}
