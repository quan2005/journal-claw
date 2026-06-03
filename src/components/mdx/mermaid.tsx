import { isValidElement, useEffect, useState, useRef, useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  detectMermaidType,
  getMermaidErrorMessage,
  normalizeMermaidSource,
  renderMermaidToElement,
} from './mermaidRuntime'

interface Props {
  chart?: string
  caption?: string
  children?: ReactNode
}

function dedent(str: string): string {
  const lines = str.split('\n')
  const minIndent = lines
    .filter((l) => l.trim().length > 0)
    .reduce((min, l) => Math.min(min, l.match(/^ */)?.[0].length ?? 0), Infinity)
  if (minIndent === Infinity || minIndent === 0) return str
  return lines.map((l) => l.slice(minIndent)).join('\n')
}

function childrenToText(children: ReactNode): string {
  if (children === null || children === undefined || typeof children === 'boolean') return ''
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(childrenToText).join('')
  if (isValidElement<{ children?: ReactNode }>(children)) {
    if (children.type === 'br') return '<br/>'
    return childrenToText(children.props.children)
  }
  return ''
}

export function Mermaid({ chart, caption, children }: Props) {
  const source = chart ?? childrenToText(children)
  const containerRef = useRef<HTMLDivElement>(null)
  const normalizedChart = useMemo(() => normalizeMermaidSource(dedent(source)), [source])
  const diagramType = useMemo(() => detectMermaidType(normalizedChart), [normalizedChart])
  const [renderError, setRenderError] = useState<string | null>(null)
  const [themeTick, setThemeTick] = useState(0)

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
    if (!container) return

    let cancelled = false

    async function render() {
      const el = container!
      el.innerHTML = ''

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

      try {
        await renderMermaidToElement({ element: el, source: normalizedChart, isDark })
        if (cancelled) {
          el.innerHTML = ''
          return
        }
        setRenderError(null)
      } catch (e) {
        if (cancelled) return
        el.innerHTML = ''
        setRenderError(getMermaidErrorMessage(e))
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [normalizedChart, themeTick])

  const typeClass =
    diagramType === 'gantt'
      ? ' mdx-diagram-frame--gantt'
      : diagramType === 'flowchart'
        ? ' mdx-diagram-frame--flowchart'
        : ''

  if (!normalizedChart.trim()) {
    return (
      <div className={`mdx-diagram-frame${typeClass}`}>
        <div className="mdx-diagram-body">
          <div className="mdx-diagram-error">
            <div className="mdx-diagram-error-title">Diagram render failed</div>
            <div className="mdx-diagram-error-message">Mermaid chart source is empty.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`mdx-diagram-frame${typeClass}`}>
      <div className="mdx-diagram-body">
        <div ref={containerRef} className="mdx-mermaid-svg" />
        {renderError && (
          <div className="mdx-diagram-error">
            <div className="mdx-diagram-error-title">Diagram render failed</div>
            <div className="mdx-diagram-error-message">{renderError}</div>
            <details className="mdx-diagram-error-source">
              <summary>View Mermaid source</summary>
              <pre>{normalizedChart}</pre>
            </details>
          </div>
        )}
      </div>
      {caption && <div className="mdx-diagram-caption">{caption}</div>}
    </div>
  )
}
