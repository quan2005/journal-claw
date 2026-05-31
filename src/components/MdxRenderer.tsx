import { useCallback, useEffect, useMemo, useState, Component, type ReactNode } from 'react'
import { compileMdx, getWorkspacePath, openFile } from '../lib/tauri'
import { resolveRelativePath } from '../lib/markdownUtils'
import { createMarkdownComponents } from '../lib/markdownComponents'
import { mdxComponents } from './mdx'
import { createMdxComponent, type MdxRuntimeComponent } from '../lib/mdxRuntime'

interface Props {
  content: string
  entryPath?: string
}

interface State {
  hasError: boolean
  error?: Error
}

interface CompileState {
  key: string
  status: 'loading' | 'ready' | 'error'
  component?: MdxRuntimeComponent
  error?: string
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

// ── Compile cache ──────────────────────────────────────────────────────────

const MAX_COMPILED_CACHE = 50
const compiledCache = new Map<string, MdxRuntimeComponent>()

function getCachedComponent(key: string): MdxRuntimeComponent | undefined {
  return compiledCache.get(key)
}

function setCachedComponent(key: string, component: MdxRuntimeComponent) {
  compiledCache.set(key, component)
  if (compiledCache.size > MAX_COMPILED_CACHE) {
    const firstKey = compiledCache.keys().next().value
    if (firstKey) compiledCache.delete(firstKey)
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function parseMediaTime(value: string): number {
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value)
  const parts = value.split(':').map((part) => Number(part))
  if (parts.some((part) => Number.isNaN(part))) return 0
  return parts.reduce((total, part) => total * 60 + part, 0)
}

// ── Component ──────────────────────────────────────────────────────────────

export function MdxRenderer({ content, entryPath }: Props) {
  const cacheKey = `${entryPath ?? ''}\0${content}`
  const [compileState, setCompileState] = useState<CompileState>(() => {
    const cached = getCachedComponent(cacheKey)
    return cached
      ? { key: cacheKey, status: 'ready', component: cached }
      : { key: cacheKey, status: 'loading' }
  })

  const markdownComponents = useMemo(
    () => createMarkdownComponents({ entryPath: entryPath || '' }),
    [entryPath],
  )

  const components = useMemo(
    () => ({ ...markdownComponents, ...mdxComponents }),
    [markdownComponents],
  )

  useEffect(() => {
    let cancelled = false
    const cached = getCachedComponent(cacheKey)

    if (cached) {
      setCompileState({ key: cacheKey, status: 'ready', component: cached })
      return
    }

    setCompileState({ key: cacheKey, status: 'loading' })
    compileMdx(content, entryPath)
      .then((compiled) => createMdxComponent(compiled))
      .then((component) => {
        setCachedComponent(cacheKey, component)
        if (!cancelled) {
          setCompileState({ key: cacheKey, status: 'ready', component })
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCompileState({ key: cacheKey, status: 'error', error: getErrorMessage(error) })
        }
      })

    return () => {
      cancelled = true
    }
  }, [cacheKey, content, entryPath])

  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return

      const mediaSrc = anchor.getAttribute('data-media-src')
      const mediaTime = anchor.getAttribute('data-media-time')
      if (mediaSrc && mediaTime) {
        e.preventDefault()
        const seconds = parseMediaTime(mediaTime)
        const media = document.querySelector<HTMLMediaElement>(
          `audio[src="${CSS.escape(mediaSrc)}"], video[src="${CSS.escape(mediaSrc)}"]`,
        )
        if (media) {
          media.currentTime = seconds
          void media.play().catch(() => undefined)
        }
        window.dispatchEvent(
          new CustomEvent('mdx-media-seek', {
            detail: { src: mediaSrc, time: mediaTime, seconds },
          }),
        )
        return
      }

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
    <div className="md-content mdx-content">
      <div className="mdx-error-banner">MDX render failed.</div>
      <pre className="mdx-fallback">{content}</pre>
    </div>
  )

  const activeState: CompileState =
    compileState.key === cacheKey ? compileState : { key: cacheKey, status: 'loading' }
  const Content = activeState.component

  return (
    <div className="md-content mdx-content" onClick={handleClick}>
      <MdxErrorBoundary key={cacheKey} fallback={fallback}>
        {activeState.status === 'loading' && <div className="mdx-loading" aria-busy="true" />}
        {activeState.status === 'error' && (
          <>
            <div className="mdx-error-banner">MDX compile failed: {activeState.error}</div>
            <pre className="mdx-fallback">{content}</pre>
          </>
        )}
        {activeState.status === 'ready' && Content && <Content components={components} />}
      </MdxErrorBoundary>
    </div>
  )
}
