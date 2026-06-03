import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Component,
  Suspense,
  createElement,
  type ElementType,
  type ReactNode,
} from 'react'
import { compileMdx, getWorkspacePath, openFile } from '../lib/tauri'
import { resolveRelativePath } from '../lib/markdownUtils'
import { createMarkdownComponents } from '../lib/markdownComponents'
import { mdxComponents } from './mdx'
import { createMdxComponent, type MdxRuntimeComponent } from '../lib/mdxRuntime'
import { dispatchJournalFileOpen, resolveWorkspaceFilePath } from '../lib/fileNavigation'

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

type MdxComponentSourceMap = Map<string, string>

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

function ComponentFailureFallback({
  title,
  message,
  source,
}: {
  title: string
  message?: string
  source?: string
}) {
  return (
    <div className="mdx-component-error" role="note">
      <div className="mdx-component-error-title">{title}</div>
      {message && <div className="mdx-component-error-message">{message}</div>}
      {source && (
        <pre className="mdx-component-error-code">
          <code>{source}</code>
        </pre>
      )}
    </div>
  )
}

class MdxComponentErrorBoundary extends Component<
  { name: string; source?: string; children: ReactNode },
  State
> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ComponentFailureFallback
          title={`${this.props.name} render failed`}
          message={this.state.error?.message}
          source={this.props.source ?? fallbackComponentSource(this.props.name)}
        />
      )
    }
    return this.props.children
  }
}

function mdxLoadingFallback() {
  return <div className="mdx-loading" aria-busy="true" />
}

function isComponentLike(value: unknown): value is ElementType {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && '$$typeof' in value)
  )
}

const missingComponentCache = new Map<string, ElementType>()

function isLikelyMdxComponentName(name: string): boolean {
  return /^[A-Z]/.test(name)
}

function fallbackComponentSource(name: string): string {
  return `<${name} />`
}

function getMissingComponent(name: string, source?: string): ElementType {
  const cacheKey = `${name}\0${source ?? ''}`
  const cached = missingComponentCache.get(cacheKey)
  if (cached) return cached

  const MissingMdxComponent = ({ children }: { children?: ReactNode }) => (
    <ComponentFailureFallback
      title={`${name} component is not available`}
      message={
        children
          ? 'This MDX block could not be rendered with the current component set.'
          : undefined
      }
      source={source ?? fallbackComponentSource(name)}
    />
  )
  MissingMdxComponent.displayName = `MissingMdxComponent(${name})`
  missingComponentCache.set(cacheKey, MissingMdxComponent)
  return MissingMdxComponent
}

function withMissingComponentFallback(
  components: Record<string, unknown>,
  componentSources: MdxComponentSourceMap,
): Record<string, unknown> {
  return new Proxy(components, {
    get(target, prop, receiver) {
      if (typeof prop !== 'string') return Reflect.get(target, prop, receiver)
      const value = Reflect.get(target, prop, receiver)
      if (value !== undefined || prop in target || prop === 'wrapper') return value
      if (isLikelyMdxComponentName(prop)) return getMissingComponent(prop, componentSources.get(prop))
      return value
    },
  })
}

function wrapMdxComponents(
  components: Record<string, unknown>,
  componentSources: MdxComponentSourceMap,
) {
  const wrapped: Record<string, unknown> = {}

  for (const [name, component] of Object.entries(components)) {
    if (!isComponentLike(component)) {
      wrapped[name] = component
      continue
    }

    const ComponentType = component
    const WrappedMdxComponent = (props: Record<string, unknown>) => (
      <MdxComponentErrorBoundary name={name} source={componentSources.get(name)}>
        <Suspense fallback={mdxLoadingFallback()}>{createElement(ComponentType, props)}</Suspense>
      </MdxComponentErrorBoundary>
    )
    WrappedMdxComponent.displayName = `MdxComponentBoundary(${name})`
    wrapped[name] = WrappedMdxComponent
  }

  return wrapped
}

function findOpeningTagEnd(source: string, start: number): number {
  let quote: '"' | "'" | '`' | null = null
  let braceDepth = 0

  for (let i = start; i < source.length; i += 1) {
    const char = source[i]
    const prev = source[i - 1]

    if (quote) {
      if (char === quote && prev !== '\\') quote = null
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === '{') {
      braceDepth += 1
      continue
    }

    if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1)
      continue
    }

    if (char === '>' && braceDepth === 0) return i
  }

  return -1
}

function isSelfClosingTag(tagSource: string): boolean {
  return /\/\s*>$/.test(tagSource)
}

function findComponentBlockEnd(source: string, name: string, openingEnd: number): number {
  const openingSource = source.slice(0, openingEnd + 1)
  if (isSelfClosingTag(openingSource)) return openingEnd + 1

  let index = openingEnd + 1
  let depth = 1
  const openNeedle = `<${name}`
  const closeNeedle = `</${name}`

  while (index < source.length) {
    const nextOpen = source.indexOf(openNeedle, index)
    const nextClose = source.indexOf(closeNeedle, index)

    if (nextClose === -1) return openingEnd + 1

    if (nextOpen !== -1 && nextOpen < nextClose) {
      const nestedEnd = findOpeningTagEnd(source, nextOpen)
      if (nestedEnd === -1) return openingEnd + 1
      if (!isSelfClosingTag(source.slice(nextOpen, nestedEnd + 1))) depth += 1
      index = nestedEnd + 1
      continue
    }

    const closeEnd = source.indexOf('>', nextClose)
    if (closeEnd === -1) return openingEnd + 1
    depth -= 1
    if (depth === 0) return closeEnd + 1
    index = closeEnd + 1
  }

  return openingEnd + 1
}

function extractMdxComponentSources(source: string): MdxComponentSourceMap {
  const sources: MdxComponentSourceMap = new Map()
  const componentOpen = /<([A-Z][A-Za-z0-9_]*)\b/g
  let match: RegExpExecArray | null

  while ((match = componentOpen.exec(source))) {
    const [token, name] = match
    const start = match.index
    if (source[start + 1] === '/') continue

    const openingEnd = findOpeningTagEnd(source, start)
    if (openingEnd === -1) continue

    const end = findComponentBlockEnd(source, name, openingEnd)
    const snippet = source.slice(start, end).trim()
    if (snippet && !sources.has(name)) sources.set(name, snippet)

    componentOpen.lastIndex = Math.max(start + token.length, end)
  }

  return sources
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

  const componentSources = useMemo(() => extractMdxComponentSources(content), [content])

  const components = useMemo(
    () =>
      withMissingComponentFallback(
        wrapMdxComponents({ ...markdownComponents, ...mdxComponents }, componentSources),
        componentSources,
      ),
    [componentSources, markdownComponents],
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
      const target = e.target as HTMLElement
      const copyControl = target.closest<HTMLElement>('[data-copy-text]')
      if (copyControl) {
        e.preventDefault()
        const text = copyControl.getAttribute('data-copy-text') ?? ''
        let copied = false
        try {
          await navigator.clipboard?.writeText(text)
          copied = true
        } catch {
          copied = false
        }
        window.dispatchEvent(
          new CustomEvent('mdx-copy', {
            detail: { text, copied },
          }),
        )
        return
      }

      const anchor = target.closest('a')
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
        const path = resolveWorkspaceFilePath(ws, filepath)
        dispatchJournalFileOpen(path)
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
        {activeState.status === 'loading' && mdxLoadingFallback()}
        {activeState.status === 'error' && (
          <>
            <div className="mdx-error-banner">MDX compile failed: {activeState.error}</div>
            <pre className="mdx-fallback">{content}</pre>
          </>
        )}
        {activeState.status === 'ready' && Content && (
          <Suspense fallback={mdxLoadingFallback()}>
            <Content components={components} />
          </Suspense>
        )}
      </MdxErrorBoundary>
    </div>
  )
}
