export function Columns({ cols = 2, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) {
  return <div className={`mdx-columns mdx-columns--${cols}`}>{children}</div>
}

export function Column({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
