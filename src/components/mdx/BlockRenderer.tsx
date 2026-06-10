import { Suspense } from 'react'
import type { CompiledBlock } from '../../lib/mdx/types'
import { BlockErrorBoundary } from './BlockErrorBoundary'
import { ErrorCard } from './ErrorCard'
import { DegradationBadge } from './DegradationBadge'

interface BlockRendererProps {
  compiled: CompiledBlock
  components: Record<string, unknown>
}

function BlockLoading() {
  return <div className="mdx-loading" aria-busy="true" />
}

/**
 * Renders a single compiled block according to its degradation level:
 * - L0: Full MDX component render with ErrorBoundary
 * - L1: Markdown HTML with degradation badge
 * - L2: Error card with source view
 */
export function BlockRenderer({ compiled, components }: BlockRendererProps) {
  const { block, level, component: Component, markdownHtml, error } = compiled

  // L2: Error card
  if (level === 'L2' && error) {
    return <ErrorCard block={block} error={error} />
  }

  // L1: Markdown fallback with badge
  if (level === 'L1' && markdownHtml && error) {
    return (
      <DegradationBadge error={error}>
        <div className="mdx-block-degraded" dangerouslySetInnerHTML={{ __html: markdownHtml }} />
      </DegradationBadge>
    )
  }

  // L0: Full MDX render
  if (Component) {
    return (
      <BlockErrorBoundary block={block}>
        <Suspense fallback={<BlockLoading />}>
          <Component components={components} />
        </Suspense>
      </BlockErrorBoundary>
    )
  }

  // Empty block
  return null
}
