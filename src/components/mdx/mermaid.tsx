import { useEffect, useState, useId, useMemo } from 'react'
import type mermaidType from 'mermaid'

interface Props {
  chart: string
  caption?: string
}

function useMermaidTheme() {
  const resolve = () =>
    document.documentElement.getAttribute('data-theme') === 'dark'

  const [isDark, setIsDark] = useState(resolve)

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(resolve()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return {
    isDark,
    themeVariables: isDark
      ? {
          primaryColor: '#c8933b',
          primaryBorderColor: '#c8933b',
          lineColor: '#8e8e93',
          textColor: '#a8acb4',
          primaryTextColor: '#e8e8e8',
          mainBkg: '#1c1c1e',
          secondBkg: '#2c2c2e',
          tertiaryColor: '#0f0f0f',
          background: '#0f0f0f',
        }
      : {
          primaryColor: '#b8782a',
          primaryBorderColor: '#b8782a',
          lineColor: '#6a7278',
          textColor: '#2a3038',
          primaryTextColor: '#1c1c1e',
          mainBkg: '#ffffff',
          secondBkg: '#f7f8f9',
          tertiaryColor: '#f5f6f7',
          background: '#ffffff',
        },
  }
}

function detectMermaidType(chart: string): string {
  const first = chart.trim().split('\n')[0]?.trim() ?? ''
  if (first.startsWith('flowchart') || first.startsWith('graph')) return 'flowchart'
  if (first.startsWith('sequenceDiagram')) return 'sequence'
  if (first.startsWith('gantt')) return 'gantt'
  if (first.startsWith('classDiagram')) return 'class'
  if (first.startsWith('erDiagram')) return 'er'
  if (first.startsWith('pie')) return 'pie'
  if (first.startsWith('stateDiagram')) return 'state'
  return 'unknown'
}

let mermaidModule: typeof mermaidType | null = null

async function getMermaid(themeVars: Record<string, string>) {
  if (!mermaidModule) {
    mermaidModule = (await import('mermaid')).default
  }
  mermaidModule.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: themeVars,
    securityLevel: 'strict',
    htmlLabels: false,
  })
  return mermaidModule
}

function dedent(str: string): string {
  const lines = str.split('\n')
  const minIndent = lines
    .filter((l) => l.trim().length > 0)
    .reduce((min, l) => Math.min(min, l.match(/^ */)?.[0].length ?? 0), Infinity)
  if (minIndent === Infinity || minIndent === 0) return str
  return lines.map((l) => l.slice(minIndent)).join('\n')
}

export function Mermaid({ chart, caption }: Props) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { themeVariables } = useMermaidTheme()
  const baseId = useId().replace(/:/g, '')
  const diagramType = useMemo(() => detectMermaidType(chart), [chart])
  const normalizedChart = useMemo(() => dedent(chart), [chart])

  useEffect(() => {
    let cancelled = false
    setSvg(null)
    setError(null)

    getMermaid(themeVariables)
      .then(async (mermaid) => {
        const { svg: rendered } = await mermaid.render(`mermaid-${baseId}`, normalizedChart)
        if (!cancelled) {
          setSvg(rendered || null)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
        }
      })

    return () => { cancelled = true }
  }, [baseId, normalizedChart, themeVariables])

  return (
    <div className={`mdx-diagram-frame${diagramType === 'gantt' ? ' mdx-diagram-frame--gantt' : ''}`}>
      <div className="mdx-diagram-body">
        {error ? (
          <div className="mdx-diagram-error">
            <div className="mdx-diagram-error-title">Diagram render failed</div>
            <div className="mdx-diagram-error-message">{error}</div>
            <details className="mdx-diagram-error-source">
              <summary>View Mermaid source</summary>
              <pre>{normalizedChart}</pre>
            </details>
          </div>
        ) : svg != null ? (
          <div
            className="mdx-mermaid-svg"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="mdx-diagram-loading">Rendering diagram...</div>
        )}
      </div>
      {caption && <div className="mdx-diagram-caption">{caption}</div>}
    </div>
  )
}
