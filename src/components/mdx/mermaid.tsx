import { useEffect, useState } from 'react'
import type mermaidType from 'mermaid'

interface Props {
  chart: string
  caption?: string
}

let mermaidPromise: Promise<typeof mermaidType> | null = null

function getMermaid(): Promise<typeof mermaidType> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: 'neutral',
        themeVariables: {
          primaryColor: '#b8782a',
          primaryBorderColor: '#b8782a',
          lineColor: '#6a7278',
        },
      })
      return m.default
    })
  }
  return mermaidPromise
}

export function Mermaid({ chart, caption }: Props) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSvg(null)
    setError(null)

    getMermaid()
      .then(async (mermaid) => {
        const id = `mermaid-${Math.random().toString(36).slice(2, 8)}`
        const { svg: rendered } = await mermaid.render(id, chart)
        if (!cancelled) setSvg(rendered)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })

    return () => { cancelled = true }
  }, [chart])

  return (
    <div className="mdx-mermaid">
      {svg && (
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      )}
      {error && (
        <div style={{ color: '#ff3b30', fontSize: 'var(--text-xs)' }}>
          Mermaid error: {error}
        </div>
      )}
      {!svg && !error && (
        <div style={{ minHeight: 200 }} />
      )}
      {caption && <div className="mdx-mermaid-caption">{caption}</div>}
    </div>
  )
}
