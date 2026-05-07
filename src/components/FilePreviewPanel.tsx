import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { convertFileSrc } from '@tauri-apps/api/core'
import {
  getWorkspacePath,
  getJournalEntryContent,
  openFile,
  type WorkspaceDirEntry,
} from '../lib/tauri'
import { fileKindFromName } from '../lib/fileKind'
import { createMarkdownComponents } from '../lib/markdownComponents'
import { stripFrontmatter } from '../lib/markdownUtils'
import hljs from 'highlight.js'
import { MarkdownRenderer } from './MarkdownRenderer'
import { Spinner } from './Spinner'
import { useTranslation } from '../contexts/I18nContext'

interface FilePreviewPanelProps {
  file: WorkspaceDirEntry | null
}

const FAST_RENDERER_THRESHOLD = 100_000

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  rs: 'rust',
  py: 'python',
  css: 'css',
  json: 'json',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  rb: 'ruby',
  php: 'php',
  lua: 'lua',
  scss: 'scss',
  less: 'less',
  vue: 'html',
  svelte: 'html',
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length === 0) return null
  const result: string[][] = []
  for (const line of lines) {
    const row: string[] = []
    let col = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            col += '"'
            i++
          } else inQuotes = false
        } else {
          col += ch
        }
      } else {
        if (ch === '"') {
          inQuotes = true
        } else if (ch === ',') {
          row.push(col)
          col = ''
        } else {
          col += ch
        }
      }
    }
    row.push(col)
    result.push(row)
  }
  return { headers: result[0], rows: result.slice(1) }
}

function buildHtmlBlobUrl(html: string, absolutePath: string): string {
  const dirPath = absolutePath.substring(0, absolutePath.lastIndexOf('/'))
  const baseUrl = convertFileSrc(dirPath + '/')
  const hasCharset = /<meta[^>]+charset/i.test(html)
  const charsetTag = hasCharset ? '' : '<meta charset="utf-8">'
  const hasBase = /<base\s/i.test(html)
  const baseTag = hasBase ? '' : `<base href="${baseUrl}">`
  const injection = charsetTag + baseTag

  let patched: string
  if (/<head[\s>]/i.test(html)) {
    patched = html.replace(/<head([\s>])/i, `<head$1${injection}`)
  } else if (/<html[\s>]/i.test(html)) {
    patched = html.replace(/<html([\s>][^>]*)>/i, `<html$1><head>${injection}</head>`)
  } else {
    patched = `<head>${injection}</head>${html}`
  }

  const blob = new Blob([patched], { type: 'text/html;charset=utf-8' })
  return URL.createObjectURL(blob)
}

export function FilePreviewPanel({ file }: FilePreviewPanelProps) {
  const { t } = useTranslation()
  const [workspacePath, setWorkspacePath] = useState('')
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    getWorkspacePath().then(setWorkspacePath)
  }, [])

  const absolutePath = workspacePath && file ? `${workspacePath}/${file.path}` : ''
  const kind = file ? fileKindFromName(file.name) : null

  useEffect(() => {
    if (!absolutePath || !kind) {
      setContent(null)
      return
    }
    if (
      kind === 'markdown' ||
      kind === 'text' ||
      kind === 'html' ||
      kind === 'code' ||
      kind === 'csv'
    ) {
      setLoading(true)
      getJournalEntryContent(absolutePath)
        .then((c) => {
          setContent(c)
          setLoading(false)
        })
        .catch(() => {
          setContent(null)
          setLoading(false)
        })
    } else {
      setContent(null)
    }
  }, [absolutePath, kind])

  useEffect(() => {
    if (kind === 'html' && content !== null && absolutePath) {
      const url = buildHtmlBlobUrl(content, absolutePath)
      setBlobUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setBlobUrl(null)
  }, [kind, content, absolutePath])

  const applyThemeToIframe = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    try {
      const doc = iframe.contentDocument
      if (!doc) return
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
      let style = doc.getElementById('__journal_theme')
      if (!style) {
        style = doc.createElement('style')
        style.id = '__journal_theme'
        doc.head.appendChild(style)
      }
      style.textContent = isDark
        ? ':root { color-scheme: dark; } body { background: #1a1a1a; color: #e0e0e0; }'
        : ':root { color-scheme: light; }'
    } catch {
      // cross-origin or not loaded yet
    }
  }, [])

  useEffect(() => {
    const observer = new MutationObserver(() => applyThemeToIframe())
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [applyThemeToIframe])

  const bodyNode = useMemo(() => {
    if (!file || !kind) return null

    if (kind === 'html' && blobUrl) {
      return (
        <iframe
          ref={iframeRef}
          src={blobUrl}
          onLoad={applyThemeToIframe}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
        />
      )
    }

    if (kind === 'markdown' && content !== null) {
      const stripped = stripFrontmatter(content)
      if (stripped.length > FAST_RENDERER_THRESHOLD) {
        return (
          <div style={{ padding: '24px 28px' }}>
            <div className="md-body">
              <MarkdownRenderer content={stripped} entryPath={absolutePath} />
            </div>
          </div>
        )
      }
      return (
        <div style={{ padding: '24px 28px' }}>
          <div className="md-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[[rehypeHighlight, { detect: false }]]}
              components={createMarkdownComponents(absolutePath)}
            >
              {stripped}
            </ReactMarkdown>
          </div>
        </div>
      )
    }

    if (kind === 'text' && content !== null) {
      return (
        <pre
          style={{
            padding: '24px 28px',
            margin: 0,
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--item-text)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.6,
          }}
        >
          {content}
        </pre>
      )
    }

    if (kind === 'image') {
      const src = convertFileSrc(absolutePath)
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <img
            src={src}
            alt={file.name}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 4,
            }}
          />
        </div>
      )
    }

    if (kind === 'pdf') {
      const src = convertFileSrc(absolutePath)
      return (
        <iframe
          src={src}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
        />
      )
    }

    if (kind === 'code' && content !== null) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      const lang = EXT_TO_LANG[ext]
      let html: string
      if (lang && hljs.getLanguage(lang)) {
        html = hljs.highlight(content, { language: lang }).value
      } else {
        html = hljs.highlightAuto(content).value
      }
      return (
        <pre
          className="hljs"
          style={{
            margin: 0,
            borderRadius: 0,
            flex: 1,
            overflow: 'auto',
            padding: '24px 28px',
            fontSize: 'var(--text-sm)',
            lineHeight: 1.6,
          }}
        >
          <code
            className={`hljs${lang ? ` language-${lang}` : ''}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </pre>
      )
    }

    if (kind === 'csv' && content !== null) {
      const data = parseCSV(content)
      if (!data) {
        return (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--item-meta)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {file.name}
          </div>
        )
      }
      return (
        <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse' as const,
                fontSize: 'var(--text-base)',
              }}
            >
              <thead>
                <tr>
                  {data.headers.map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: '6px 10px',
                        textAlign: 'left' as const,
                        fontWeight: 'var(--font-semibold)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--md-h3)',
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.05em',
                        borderBottom: '2px solid var(--divider)',
                        whiteSpace: 'nowrap' as const,
                        minWidth: 72,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        style={{
                          padding: '5px 10px',
                          color: 'var(--md-text)',
                          lineHeight: 1.6,
                          verticalAlign: 'top' as const,
                          borderBottom: '1px solid var(--divider)',
                          minWidth: 72,
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          color: 'var(--item-meta)',
        }}
      >
        <span style={{ fontSize: 'var(--text-base)' }}>{file.name}</span>
        <button
          onClick={() => openFile(absolutePath)}
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--segment-active-text)',
            background: 'transparent',
            border: '1px solid var(--divider)',
            borderRadius: 6,
            padding: '6px 16px',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          {t('openExternal')}
        </button>
      </div>
    )
  }, [file, kind, content, blobUrl, absolutePath, t, applyThemeToIframe])

  if (!file) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--detail-bg)',
          color: 'var(--item-meta)',
          fontSize: 'var(--text-sm)',
        }}
      >
        {t('selectFileToPreview')}
      </div>
    )
  }

  if (loading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--detail-bg)',
          color: 'var(--item-meta)',
        }}
      >
        <Spinner size={20} />
      </div>
    )
  }

  const isFullBleed = kind === 'html' || kind === 'image' || kind === 'pdf'

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--detail-bg)',
        overflow: isFullBleed ? 'hidden' : 'auto',
      }}
    >
      {bodyNode}
    </div>
  )
}
