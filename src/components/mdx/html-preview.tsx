import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { SandboxPreview } from '../SandboxPreview'
import { getJournalEntryContent, getWorkspacePath } from '../../lib/tauri'
import { extractCodeText } from '../../lib/markdownUtils'
import { resolveWorkspaceFilePath } from '../../lib/fileNavigation'

interface HtmlPreviewProps {
  src?: string
  html?: string
  title?: string
  height?: number | string
  className?: string
  children?: ReactNode
}

interface HtmlState {
  status: 'ready' | 'loading' | 'error'
  html: string
  error?: string
}

function cssHeight(value: HtmlPreviewProps['height']) {
  return value ?? 420
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function HtmlPreview({ src, html, title, height, className, children }: HtmlPreviewProps) {
  const inlineHtml = useMemo(() => html ?? extractCodeText(children), [children, html])
  const [state, setState] = useState<HtmlState>(() => ({
    status: src ? 'loading' : 'ready',
    html: src ? '' : inlineHtml,
  }))

  useEffect(() => {
    let cancelled = false

    if (!src) {
      setState({ status: 'ready', html: inlineHtml })
      return
    }

    setState({ status: 'loading', html: '' })
    getWorkspacePath()
      .then((workspacePath) => resolveWorkspaceFilePath(workspacePath, src))
      .then((path) => getJournalEntryContent(path))
      .then((loadedHtml) => {
        if (!cancelled) setState({ status: 'ready', html: loadedHtml })
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ status: 'error', html: '', error: errorMessage(error) })
        }
      })

    return () => {
      cancelled = true
    }
  }, [inlineHtml, src])

  const cls = className ? `mdx-html-preview ${className}` : 'mdx-html-preview'

  if (state.status === 'error') {
    return (
      <div className={cls}>
        <div className="mdx-component-error" role="note">
          <div className="mdx-component-error-title">HtmlPreview render failed</div>
          {state.error && <div className="mdx-component-error-message">{state.error}</div>}
        </div>
      </div>
    )
  }

  if (state.status === 'loading') {
    return <div className={`${cls} mdx-loading`} aria-busy="true" />
  }

  return (
    <div className={cls}>
      <SandboxPreview html={state.html} title={title ?? src} style={{ height: cssHeight(height) }} />
    </div>
  )
}
