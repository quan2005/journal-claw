import { useState, useCallback } from 'react'
import type { BlockError, Block } from '../../lib/mdx/types'

interface ErrorCardProps {
  block: Block
  error: BlockError
}

export function ErrorCard({ block, error }: ErrorCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  const handleCopyError = useCallback(() => {
    const text = `Line ${error.line ?? '?'}: ${error.raw}`
    navigator.clipboard?.writeText(text)
  }, [error])

  return (
    <div className="mdx-error-card" role="alert">
      {/* Status bar */}
      <div className="mdx-error-card-status">
        <span className="mdx-error-card-icon">⚠</span>
        <span className="mdx-error-card-message">{error.friendly}</span>
        {error.line && (
          <span className="mdx-error-card-location">· 第 {error.line} 行</span>
        )}
      </div>

      {/* Source degradation area */}
      <pre className="mdx-error-card-source">
        <code>
          {block.source.split('\n').map((line, i) => {
            const lineNum = block.startLine + i
            const isErrorLine = lineNum === error.line
            return (
              <span
                key={i}
                className={isErrorLine ? 'mdx-error-card-source-highlight' : undefined}
              >
                <span className="mdx-error-card-line-num">{lineNum}</span>
                {line}
                {'\n'}
              </span>
            )
          })}
        </code>
      </pre>

      {/* Collapsible details */}
      <details
        className="mdx-error-card-details"
        open={detailsOpen}
        onToggle={(e) => setDetailsOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary>查看原始错误信息</summary>
        <pre className="mdx-error-card-raw">{error.raw}</pre>
      </details>

      {/* Action bar */}
      <div className="mdx-error-card-actions">
        <button className="mdx-error-card-btn" onClick={handleCopyError}>
          复制错误
        </button>
        {error.fixHint && (
          <span className="mdx-error-card-hint">{error.fixHint}</span>
        )}
      </div>
    </div>
  )
}
