import { useEffect, useState, useRef, useMemo } from 'react'
import type mermaidType from 'mermaid'

interface Props {
  chart: string
  caption?: string
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

async function getMermaid(isDark: boolean, type: string) {
  if (!mermaidModule) {
    mermaidModule = (await import('mermaid')).default
  }

  const base: Record<string, any> = {
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'strict',
    htmlLabels: false,
    fontFamily: 'Inter, ui-sans-serif, system-ui',
    themeVariables: isDark
      ? {
          primaryColor: '#c8933b',
          primaryBorderColor: '#c8933b',
          lineColor: '#3a3a3c',
          textColor: '#a2a6ae',
          primaryTextColor: '#e8e8e8',
          mainBkg: '#1c1c1e',
          secondBkg: '#2c2c2e',
          tertiaryColor: '#101010',
          background: '#101010',
          fontSize: '13px',
          titleColor: '#e8e8e8',
          tertiaryTextColor: '#a2a6ae',
        }
      : {
          primaryColor: '#b8782a',
          primaryBorderColor: '#b8782a',
          lineColor: '#d8dce0',
          textColor: '#4a5058',
          primaryTextColor: '#1c1c1e',
          mainBkg: '#ffffff',
          secondBkg: '#f7f8f9',
          tertiaryColor: '#f5f6f7',
          background: '#fafaf8',
          fontSize: '13px',
          titleColor: '#1c1c1e',
          tertiaryTextColor: '#6a7278',
        },
  }

  if (type === 'gantt') {
    base.gantt = {
      useWidth: 960,
      leftPadding: 100,
      topPadding: 40,
      barHeight: 28,
      barGap: 8,
      gridLineStartPadding: 24,
      fontSize: 13,
      numberSectionStyles: 4,
      axisFormat: '%m-%d',
      titleTopMargin: 20,
    }
    base.themeVariables = {
      ...base.themeVariables,
      // Light task bars → dark text for contrast
      taskBkgColor: isDark ? '#d4d4d4' : '#d8d8d8',
      taskTextColor: '#1a1a1a',
      taskTextDarkColor: '#1a1a1a',
      taskTextOutsideColor: isDark ? '#b0b0b0' : '#3a3a3a',
      taskBorderColor: isDark ? '#888888' : '#a0a0a0',
      // Active task → dark amber, dark text
      activeTaskBkgColor: isDark ? '#c8933b' : '#b8782a',
      activeTaskBorderColor: isDark ? '#a07820' : '#8a6500',
      activeTaskTextColor: '#0f0f0f',
      activeTaskTextDarkColor: '#0f0f0f',
      // Sections — subtle
      sectionBkgColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
      sectionBkgColor2: isDark ? 'rgba(200,147,59,0.04)' : 'rgba(184,120,42,0.03)',
      altSectionBkgColor: isDark ? 'rgba(200,147,59,0.04)' : 'rgba(184,120,42,0.03)',
      // Grid & accent
      gridColor: isDark ? '#2c2c2e' : '#e5e5e7',
      todayLineColor: isDark ? '#c8933b' : '#b8782a',
      // Title
      titleColor: isDark ? '#d0d0d0' : '#2a2a2a',
    }
  }

  mermaidModule.initialize(base)
  return mermaidModule
}

export function Mermaid({ chart, caption }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const diagramType = useMemo(() => detectMermaidType(chart), [chart])
  const normalizedChart = useMemo(() => dedent(chart), [chart])
  const [themeTick, setThemeTick] = useState(0)

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeTick((n) => n + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
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

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

      try {
        const mermaid = await getMermaid(isDark, diagramType)
        if (cancelled) return

        const id = `mermaid-${Math.random().toString(36).slice(2, 8)}`
        el.innerHTML = `<pre class="mermaid" id="${id}">${normalizedChart}</pre>`

        await mermaid.run({ nodes: [el.querySelector(`#${id}`)!] })

        if (cancelled) { el.innerHTML = ''; return }
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
    return () => { cancelled = true }
  }, [normalizedChart, diagramType, themeTick])

  const typeClass = diagramType === 'gantt' ? ' mdx-diagram-frame--gantt' : diagramType === 'flowchart' ? ' mdx-diagram-frame--flowchart' : ''

  return (
    <div className={`mdx-diagram-frame${typeClass}`}>
      <div className="mdx-diagram-body">
        <div ref={containerRef} className="mdx-mermaid-svg" />
        <div ref={errorRef} />
      </div>
      {caption && <div className="mdx-diagram-caption">{caption}</div>}
    </div>
  )
}
