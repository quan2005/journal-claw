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
      <div className="mdx-mockup-header">
        <span className="mdx-mockup-dots">
          <span className="mdx-mockup-dot mdx-mockup-dot--red" />
          <span className="mdx-mockup-dot mdx-mockup-dot--yellow" />
          <span className="mdx-mockup-dot mdx-mockup-dot--green" />
        </span>
        {title && <span className="mdx-mockup-header-title">{title}</span>}
      </div>
      <div className="mdx-mockup-body">{children}</div>
    </div>
  )
}

export function Placeholder({ children }: { children: React.ReactNode }) {
  return <div className="mdx-placeholder">{children}</div>
}

export function DeviceShowcase({ children }: { children: React.ReactNode }) {
  return <div className="mdx-device-showcase">{children}</div>
}
