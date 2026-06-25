import '../../styles/mdx.css'

export function Section({
  children,
  density = 'default',
}: {
  children: React.ReactNode
  density?: 'compact' | 'default' | 'relaxed'
}) {
  const cls = density === 'default' ? 'mdx-section' : `mdx-section mdx-section--${density}`
  return <section className={cls}>{children}</section>
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <p className="mdx-subtitle">{children}</p>
}

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="mdx-label">{children}</span>
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="mdx-divider" />
  return (
    <div className="mdx-divider--labeled">
      <hr />
      <span>{label}</span>
      <hr />
    </div>
  )
}
