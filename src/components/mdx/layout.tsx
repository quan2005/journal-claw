export function Split({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function Columns({ cols: _cols = 2, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) {
  return <div>{children}</div>
}

export function Column({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

export function Mockup({ title: _title, children }: { title?: string; children: React.ReactNode }) {
  return <div>{children}</div>
}

export function Placeholder({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
