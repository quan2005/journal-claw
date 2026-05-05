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
import { MarkdownRenderer } from './MarkdownRenderer'
import { Spinner } from './Spinner'
import { useTranslation } from '../contexts/I18nContext'

interface FilePreviewPanelProps {
  file: WorkspaceDirEntry | null
}

const FAST_RENDERER_THRESHOLD = 100_000

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
    if (kind === 'markdown' || kind === 'text' || kind === 'html') {
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

  const isFullBleed = kind === 'html' || kind === 'image'

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
