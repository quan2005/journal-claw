import { useEffect, useState, useRef, useMemo } from 'react'
import type mermaidType from 'mermaid'

interface Props {
  chart: string
  caption?: string
}

function resolveThemeVars(): Record<string, string> {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  return dark
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

function dedent(str: string): string {
  const lines = str.split('\n')
  const minIndent = lines
    .filter((l) => l.trim().length > 0)
    .reduce((min, l) => Math.min(min, l.match(/^ */)?.[0].length ?? 0), Infinity)
  if (minIndent === Infinity || minIndent === 0) return str
  return lines.map((l) => l.slice(minIndent)).join('\n')
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

export function Mermaid({ chart, caption }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const diagramType = useMemo(() => detectMermaidType(chart), [chart])
  const normalizedChart = useMemo(() => dedent(chart), [chart])
  const [themeTick, setThemeTick] = useState(0)

  // Re-render on theme change
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeTick((n) => n + 1))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const errorEl = errorRef.current
    if (!container || !errorEl) return

    let cancelled = false

    async function render() {
      const el = container!
      const err = errorEl!
      el.innerHTML = ''

      const themeVars = resolveThemeVars()

      try {
        const mermaid = await getMermaid(themeVars)

        if (cancelled) return

        const id = `mermaid-${Math.random().toString(36).slice(2, 8)}`
        el.innerHTML = `<pre class="mermaid" id="${id}">${normalizedChart}</pre>`

        await mermaid.run({
          nodes: [el.querySelector(`#${id}`)!],
        })

        if (cancelled) {
          el.innerHTML = ''
          return
        }

        err.innerHTML = ''
      } catch (e) {
        if (cancelled) return
        el.innerHTML = ''
        err.innerHTML = `
            <div class="mdx-diagram-error">
              <div class="mdx-diagram-error-title">Diagram render failed</div>
              <div class="mdx-diagram-error-message">${e instanceof Error ? e.message : String(e)}</div>
              <details class="mdx-diagram-error-source">
                <summary>View Mermaid source</summary>
                <pre>${normalizedChart.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
              </details>
            </div>`
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [normalizedChart, themeTick])

  return (
    <div className={`mdx-diagram-frame${diagramType === 'gantt' ? ' mdx-diagram-frame--gantt' : ''}`}>
      <div className="mdx-diagram-body">
        <div ref={containerRef} className="mdx-mermaid-svg" />
        <div ref={errorRef} />
      </div>
      {caption && <div className="mdx-diagram-caption">{caption}</div>}
    </div>
  )
}
