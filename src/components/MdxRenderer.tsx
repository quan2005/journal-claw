import { useState, useEffect, useCallback, Component, type ReactNode } from 'react'
import { evaluate } from '@mdx-js/mdx'
import * as runtime from 'react/jsx-runtime'
import { getWorkspacePath, openFile } from '../lib/tauri'
import { resolveRelativePath } from '../lib/markdownUtils'
import { mdxComponents } from './mdx'

interface Props {
  content: string
  entryPath?: string
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

export function MdxRenderer({ content, entryPath }: Props) {
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

  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return

      const mdLink = anchor.getAttribute('data-md-link')
      if (mdLink && entryPath) {
        e.preventDefault()
        const entryDir = entryPath.substring(0, entryPath.lastIndexOf('/'))
        const targetPath = resolveRelativePath(entryDir, mdLink)
        const targetFilename = targetPath.substring(targetPath.lastIndexOf('/') + 1)
        window.dispatchEvent(
          new CustomEvent('journal-entry-navigate', {
            detail: { path: targetPath, filename: targetFilename },
          }),
        )
        return
      }

      const filepath = anchor.getAttribute('data-filepath')
      if (filepath) {
        e.preventDefault()
        const ws = await getWorkspacePath()
        openFile(`${ws}/${filepath}`)
        return
      }
      const href = anchor.getAttribute('href')
      if (!href) return
      if (/^https?:\/\//i.test(href)) {
        e.preventDefault()
        openFile(href)
      }
    },
    [entryPath],
  )

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
    <div className="md-content" onClick={handleClick}>
      <MdxErrorBoundary key={content} fallback={fallback}>
        <MdxContent components={mdxComponents} />
      </MdxErrorBoundary>
    </div>
  )
}
