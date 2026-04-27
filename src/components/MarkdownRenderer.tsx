import { useCallback, useMemo } from 'react'
import { getWorkspacePath, openFile } from '../lib/tauri'
import DOMPurify from 'dompurify'
import { Marked } from 'marked'
import { normalizeNestedFences } from '../lib/markdownStream'
import hljs from 'highlight.js/lib/core'

// ── Module-level caches (ported from lobe-ui) ────────────────────────────────

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

const MAX_HIGHLIGHT_CACHE = 200
const highlightCache = new Map<string, string>()

function getCachedHighlight(lang: string, code: string): string | undefined {
  return highlightCache.get(`${lang}\0${code}`)
}

function setCachedHighlight(lang: string, code: string, html: string) {
  const key = `${lang}\0${code}`
  highlightCache.set(key, html)
  if (highlightCache.size > MAX_HIGHLIGHT_CACHE) {
    const toRemove = Math.floor(MAX_HIGHLIGHT_CACHE * 0.2)
    const keys = Array.from(highlightCache.keys()).slice(0, toRemove)
    for (const k of keys) highlightCache.delete(k)
  }
}
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
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
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)

const marked = new Marked({
  gfm: true,
  breaks: true,
})

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
      const cacheKey = language ?? '__auto'
      const cached = getCachedHighlight(cacheKey, text)
      if (cached) {
        return `<pre><code class="hljs${language ? ` language-${language}` : ''}">${cached}</code></pre>`
      }
      const highlighted = language
        ? hljs.highlight(text, { language }).value
        : hljs.highlightAuto(text).value
      setCachedHighlight(cacheKey, text, highlighted)
      return `<pre><code class="hljs${language ? ` language-${language}` : ''}">${highlighted}</code></pre>`
    },
  },
})

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const html = useMemo(() => {
    if (!content) return ''
    const cached = getCachedHtml(content)
    if (cached) return cached
    const normalized = normalizeNestedFences(content)
    const result = DOMPurify.sanitize(marked.parse(normalized) as string, {
      ADD_ATTR: ['data-filepath'],
    })
    setCachedHtml(content, result)
    return result
  }, [content])

  const handleClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest('a')
    if (!anchor) return
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
  }, [])

  return (
    <div className="md-content" dangerouslySetInnerHTML={{ __html: html }} onClick={handleClick} />
  )
}
