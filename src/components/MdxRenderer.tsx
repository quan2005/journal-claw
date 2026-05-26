import { useState, useEffect, Component, type ReactNode } from 'react'
import { evaluate } from '@mdx-js/mdx'
import * as runtime from 'react/jsx-runtime'
import { mdxComponents } from './mdx'

interface Props {
  content: string
  _entryPath?: string
}

interface State {
  hasError: boolean
  error?: Error
}

class MdxErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

export function MdxRenderer({ content }: Props) {
  const [MdxContent, setMdxContent] = useState<React.ComponentType<any> | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function compile() {
      try {
        const result = await evaluate(content, {
          ...runtime,
          baseUrl: import.meta.url,
        })
        if (!cancelled) {
          setError(null)
          // Function wrapper prevents React from treating the component as a state updater
          setMdxContent(() => result.default)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)))
        }
      }
    }

    compile()
    return () => { cancelled = true }
  }, [content])

  const fallback = (
    <div className="md-content">
      <pre className="mdx-fallback">{content}</pre>
    </div>
  )

  if (error) {
    return (
      <div className="md-content">
        <div className="mdx-error-banner">
          MDX compile error — showing raw source. {error.message}
        </div>
        <pre className="mdx-fallback">{content}</pre>
      </div>
    )
  }

  if (!MdxContent) {
    return <div className="md-content md-content--loading" />
  }

  return (
    <div className="md-content">
      <MdxErrorBoundary key={content} fallback={fallback}>
        <MdxContent components={mdxComponents} />
      </MdxErrorBoundary>
    </div>
  )
}
