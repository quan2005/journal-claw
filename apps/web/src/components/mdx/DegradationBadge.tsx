import { useState, useCallback, type ReactNode } from 'react'
import type { BlockError } from '../../lib/mdx/types'

interface DegradationBadgeProps {
  children: ReactNode
  error: BlockError
}

/**
 * Wraps an L1 block (Markdown fallback) with a small yellow badge
 * in the top-right corner. Hovering/clicking reveals a tooltip
 * explaining why this block degraded.
 */
export function DegradationBadge({ children, error }: DegradationBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const handleToggle = useCallback(() => {
    setShowTooltip((prev) => !prev)
  }, [])

  return (
    <div className="mdx-degradation-wrapper">
      {children}
      <div
        className="mdx-degradation-badge"
        onClick={handleToggle}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        role="button"
        aria-label="此区块已降级显示"
        tabIndex={0}
      />
      {showTooltip && (
        <div className="mdx-degradation-tooltip">
          此区块的交互组件未能加载，已按纯文本显示。
          <br />
          原因：{error.friendly}
        </div>
      )}
    </div>
  )
}
