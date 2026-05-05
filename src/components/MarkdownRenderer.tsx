import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getWorkspacePath, openFile } from '../lib/tauri'
import { convertFileSrc } from '@tauri-apps/api/core'
import DOMPurify from 'dompurify'
import { Marked } from 'marked'
import { normalizeNestedFences } from '../lib/markdownStream'
import { resolveRelativePath } from '../lib/markdownUtils'
import hljs from 'highlight.js/lib/core'

import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import cssLang from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import mdLang from 'highlight.js/lib/languages/markdown'
import '../styles/markdown.css'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('css', cssLang)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('markdown', mdLang)
hljs.registerLanguage('md', mdLang)

// ── Caches ──────────────────────────────────────────────────────────────────

const MAX_HTML_CACHE = 50
const htmlCache = new Map<string, string>()

function getCachedHtml(key: string): string | undefined {
  return htmlCache.get(key)
}

function setCachedHtml(key: string, html: string) {
  htmlCache.set(key, html)
  if (htmlCache.size > MAX_HTML_CACHE) {
    const toRemove = Math.floor(MAX_HTML_CACHE * 0.2)
    const keys = Array.from(htmlCache.keys()).slice(0, toRemove)
    for (const k of keys) htmlCache.delete(k)
  }
}

// ── Marked setup ────────────────────────────────────────────────────────────

const marked = new Marked({ gfm: true, breaks: true })

const FILE_PATH_RE =
  /(?<![/\w])(\d{4}\/(?:raw\/)?[^\s<>]+\.(?:txt|md|m4a|pdf|docx|wav|mp3|json|xlsx|csv|png|jpg|jpeg|webp))(?=[\s,;:)}\]。，；：）】]|$)/g

marked.use({
  renderer: {
    text({ text }: { text: string }) {
      return text.replace(FILE_PATH_RE, '<a class="md-link" data-filepath="$1">$1</a>')
    },
    codespan({ text }: { text: string }) {
      if (FILE_PATH_RE.test(text)) {
        FILE_PATH_RE.lastIndex = 0
        return `<code><a class="md-link" data-filepath="${text}">${text}</a></code>`
      }
      FILE_PATH_RE.lastIndex = 0
      return `<code>${text}</code>`
    },
    code({ text, lang }: { text: string; lang?: string }) {
      const language = lang && hljs.getLanguage(lang) ? lang : null
      const highlighted = language
        ? hljs.highlight(text, { language }).value
        : hljs.highlightAuto(text).value
      return `<pre><code class="hljs${language ? ` language-${language}` : ''}">${highlighted}</code></pre>`
    },
  },
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function postProcessHtml(raw: string, entryPath?: string): string {
  let html = raw
  if (entryPath) {
    const entryDir = entryPath.substring(0, entryPath.lastIndexOf('/'))
    html = html.replace(
      /(<img\s[^>]*src=")([^"]+)(")/g,
      (_m: string, pre: string, src: string, post: string) => {
        if (src.startsWith('http')) return pre + src + post
        const abs = src.startsWith('/')
          ? src
          : resolveRelativePath(entryDir, decodeURIComponent(src))
        return pre + convertFileSrc(abs) + post
      },
    )
    html = html.replace(
      /(<a\s[^>]*href=")([^"]*\.md)(")/gi,
      (_m: string, pre: string, href: string, post: string) => {
        if (href.startsWith('http')) return pre + href + post
        const decoded = decodeURIComponent(href)
        return `<a class="md-link" data-md-link="${decoded}" style="cursor:pointer"` + post.slice(1)
      },
    )
  }
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['data-filepath', 'data-md-link'],
  })
}

// ── Batch splitting ─────────────────────────────────────────────────────────

const LARGE_THRESHOLD = 100_000
const BATCH_TARGET = 50_000

function splitIntoBatches(md: string): string[] {
  const lines = md.split('\n')
  const batches: string[] = []
  let buf: string[] = []
  let bufLen = 0

  for (const line of lines) {
    buf.push(line)
    bufLen += line.length + 1
    if (bufLen >= BATCH_TARGET && line.trim() === '') {
      batches.push(buf.join('\n'))
      buf = []
      bufLen = 0
    }
  }
  if (buf.length > 0) batches.push(buf.join('\n'))
  return batches
}

// ── Virtualized large renderer ──────────────────────────────────────────────
// Splits markdown into ~50KB batches but only parses + mounts a sliding
// window around the viewport. Off-screen batches stay as raw strings;
// their DOM is replaced with height placeholders.

const VISIBLE_BUFFER = 2
const ESTIMATED_SECTION_HEIGHT = 2000

function VirtualizedMarkdown({
  content,
  entryPath,
  onClick,
}: {
  content: string
  entryPath?: string
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollParentRef = useRef<HTMLElement | null>(null)
  const heightsRef = useRef<number[]>([])
  const htmlCacheRef = useRef<Map<number, string>>(new Map())
  const [visibleRange, setVisibleRange] = useState<[number, number]>([0, 3])

  const batches = useMemo(() => {
    const normalized = normalizeNestedFences(content)
    return splitIntoBatches(normalized)
  }, [content])

  // Lazily parse only the batches we need
  const getHtml = useCallback(
    (idx: number): string => {
      const cache = htmlCacheRef.current
      let html = cache.get(idx)
      if (html !== undefined) return html
      const raw = marked.parse(batches[idx]) as string
      html = postProcessHtml(raw, entryPath)
      cache.set(idx, html)
      return html
    },
    [batches, entryPath],
  )

  // Reset cache when content changes
  useEffect(() => {
    htmlCacheRef.current = new Map()
    heightsRef.current = new Array(batches.length).fill(ESTIMATED_SECTION_HEIGHT)
    setVisibleRange([0, Math.min(3, batches.length - 1)])
  }, [batches])

  // Find scroll parent (the DetailPanel body div with overflowY: auto)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let parent = el.parentElement
    while (parent) {
      const style = getComputedStyle(parent)
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        scrollParentRef.current = parent
        break
      }
      parent = parent.parentElement
    }
  }, [])

  // Measure rendered sections and update stored heights
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const sections = el.querySelectorAll<HTMLElement>('[data-section-idx]')
    sections.forEach((section) => {
      const idx = parseInt(section.dataset.sectionIdx!, 10)
      if (!isNaN(idx)) {
        heightsRef.current[idx] = section.offsetHeight
      }
    })
  }, [visibleRange])

  // Scroll handler: determine which sections should be visible
  useEffect(() => {
    const scrollEl = scrollParentRef.current
    if (!scrollEl) return

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        const heights = heightsRef.current
        const scrollTop = scrollEl.scrollTop
        const viewHeight = scrollEl.clientHeight
        const viewBottom = scrollTop + viewHeight

        let cumTop = 0
        let firstVisible = 0
        let lastVisible = 0

        for (let i = 0; i < heights.length; i++) {
          const sectionBottom = cumTop + heights[i]
          if (sectionBottom > scrollTop && firstVisible === 0 && i > 0) {
            firstVisible = i
          }
          if (cumTop < viewBottom) {
            lastVisible = i
          }
          cumTop += heights[i]
        }

        const start = Math.max(0, firstVisible - VISIBLE_BUFFER)
        const end = Math.min(heights.length - 1, lastVisible + VISIBLE_BUFFER)

        setVisibleRange((prev) => {
          if (prev[0] === start && prev[1] === end) return prev
          return [start, end]
        })
      })
    }

    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => scrollEl.removeEventListener('scroll', onScroll)
  }, [batches.length])

  const heights = heightsRef.current
  const [start, end] = visibleRange

  // Top spacer: sum of heights before visible range
  let topHeight = 0
  for (let i = 0; i < start; i++) topHeight += heights[i] || ESTIMATED_SECTION_HEIGHT

  // Bottom spacer: sum of heights after visible range
  let bottomHeight = 0
  for (let i = end + 1; i < batches.length; i++)
    bottomHeight += heights[i] || ESTIMATED_SECTION_HEIGHT

  const visibleIndices: number[] = []
  for (let i = start; i <= end && i < batches.length; i++) visibleIndices.push(i)

  return (
    <div className="md-content" onClick={onClick} ref={containerRef}>
      {topHeight > 0 && <div style={{ height: topHeight }} />}
      {visibleIndices.map((idx) => (
        <section
          key={idx}
          data-section-idx={idx}
          className="md-section"
          dangerouslySetInnerHTML={{ __html: getHtml(idx) }}
        />
      ))}
      {bottomHeight > 0 && <div style={{ height: bottomHeight }} />}
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────────

interface MarkdownRendererProps {
  content: string
  entryPath?: string
}

export function MarkdownRenderer({ content, entryPath }: MarkdownRendererProps) {
  const isLarge = content.length > LARGE_THRESHOLD

  // Small files: synchronous parse
  const smallHtml = useMemo(() => {
    if (!content || isLarge) return ''
    const cacheKey = entryPath ? `${entryPath}\0${content.length}` : content
    const cached = getCachedHtml(cacheKey)
    if (cached) return cached
    const normalized = normalizeNestedFences(content)
    const raw = marked.parse(normalized) as string
    const result = postProcessHtml(raw, entryPath)
    setCachedHtml(cacheKey, result)
    return result
  }, [content, entryPath, isLarge])

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

  if (isLarge) {
    return <VirtualizedMarkdown content={content} entryPath={entryPath} onClick={handleClick} />
  }

  return (
    <div
      className="md-content"
      dangerouslySetInnerHTML={{ __html: smallHtml }}
      onClick={handleClick}
    />
  )
}
