export function Mermaid({ chart: _chart, caption }: { chart: string; caption?: string }) {
  return <div data-mermaid="true">{caption}</div>
}
