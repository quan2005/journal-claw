import { Component, type ReactNode } from 'react'
import { ErrorCard } from './ErrorCard'
import { translateError } from '../../lib/mdx/errorTranslation'
import type { Block } from '../../lib/mdx/types'

interface Props {
  block: Block
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * Per-block React ErrorBoundary. If a compiled MDX block throws during render,
 * this catches it and displays an ErrorCard (L2) instead of crashing the page.
 */
export class BlockErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      const rawMessage = this.state.error?.message ?? 'Unknown render error'
      const blockError = translateError(rawMessage)
      if (blockError.line !== undefined) {
        blockError.line = this.props.block.startLine + blockError.line - 1
      }
      return <ErrorCard block={this.props.block} error={blockError} />
    }
    return this.props.children
  }
}
