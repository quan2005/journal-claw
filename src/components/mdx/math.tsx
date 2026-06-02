import type { ReactNode } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface MathProps {
  math?: string
  children?: ReactNode
}

function childrenToText(children: ReactNode): string {
  if (children === null || children === undefined || typeof children === 'boolean') return ''
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(childrenToText).join('')
  return ''
}

function renderMathSource(source: string, displayMode: boolean) {
  return katex.renderToString(source, {
    displayMode,
    throwOnError: true,
    strict: 'ignore',
    trust: false,
  })
}

function MathFallback({
  source,
  displayMode,
  error,
}: {
  source: string
  displayMode: boolean
  error: unknown
}) {
  const message = error instanceof Error ? error.message : String(error)
  const className = displayMode
    ? 'mdx-math-fallback mdx-math-fallback--block'
    : 'mdx-math-fallback mdx-math-fallback--inline'

  if (displayMode) {
    return (
      <div className={className} role="note">
        <div className="mdx-math-fallback-title">Formula render failed</div>
        <code>{source}</code>
        {message && <div className="mdx-math-fallback-message">{message}</div>}
      </div>
    )
  }

  return (
    <span className={className} role="note" title={message}>
      {source}
    </span>
  )
}

function MathFormula({ math, children, displayMode }: MathProps & { displayMode: boolean }) {
  const source = (math ?? childrenToText(children)).trim()

  if (!source) {
    return <MathFallback source="" displayMode={displayMode} error="Formula source is empty." />
  }

  try {
    const html = renderMathSource(source, displayMode)
    const className = displayMode ? 'mdx-math mdx-math--block' : 'mdx-math mdx-math--inline'
    const Element = displayMode ? 'div' : 'span'

    return <Element className={className} dangerouslySetInnerHTML={{ __html: html }} />
  } catch (error) {
    return <MathFallback source={source} displayMode={displayMode} error={error} />
  }
}

export function InlineMath(props: MathProps) {
  return <MathFormula {...props} displayMode={false} />
}

export function BlockMath(props: MathProps) {
  return <MathFormula {...props} displayMode />
}
