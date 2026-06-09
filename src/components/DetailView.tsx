import React, { useState, useEffect, useRef, useMemo } from 'react'
import { renderMarkdown } from '../lib/markdown'
import type { JournalEntry, IdentityEntry } from '../types'
import {
  getJournalEntryContent,
  getIdentityContent,
  getWorkspacePrompt,
  resetWorkspacePrompt,
  getWorkspacePath,
  openFile,
  type WorkspaceDirEntry,
} from '../lib/tauri'
import { pickDisplayTags } from '../lib/tags'
import { fileKindFromName, type FileKind } from '../lib/fileKind'
import { parseCSV } from '../lib/parseCSV'
import { EXT_TO_LANG } from '../lib/extToLang'
import { Spinner } from './Spinner'
import { IdeasWorkbench, type IdeaConversationRequest } from './IdeasWorkbench'
import { FindBar } from './FindBar'
import { convertFileSrc } from '@tauri-apps/api/core'
import { createTranslator, detectLang } from '../lib/i18n'
import { ask } from '@tauri-apps/plugin-dialog'
import { SandboxPreview } from './SandboxPreview'
import { ArrowLeft, Check, Code2, Copy, Eye, Maximize2, Minimize2 } from 'lucide-react'
import { isAbsoluteFilePath } from '../lib/fileNavigation'
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
import markdownLang from 'highlight.js/lib/languages/markdown'

// ── Constants ───────────────────────────────────────────────────────────────────
const SOUL_PATH = '__soul__'
const getT = () => createTranslator(detectLang())

function registerSourceLanguage(
  name: string,
  language: Parameters<typeof hljs.registerLanguage>[1],
) {
  if (!hljs.getLanguage(name)) {
    hljs.registerLanguage(name, language)
  }
}

registerSourceLanguage('javascript', javascript)
registerSourceLanguage('js', javascript)
registerSourceLanguage('typescript', typescript)
registerSourceLanguage('ts', typescript)
registerSourceLanguage('python', python)
registerSourceLanguage('rust', rust)
registerSourceLanguage('bash', bash)
registerSourceLanguage('sh', bash)
registerSourceLanguage('shell', bash)
registerSourceLanguage('json', json)
registerSourceLanguage('css', cssLang)
registerSourceLanguage('html', xml)
registerSourceLanguage('xml', xml)
registerSourceLanguage('sql', sql)
registerSourceLanguage('yaml', yaml)
registerSourceLanguage('yml', yaml)
registerSourceLanguage('markdown', markdownLang)
registerSourceLanguage('md', markdownLang)

function topicWorkspaceRelativePath(path: string): string {
  return path.startsWith('topics/') ? path : `topics/${path}`
}

function topicFileAbsolutePath(workspacePath: string, path: string): string {
  if (!path) return ''
  if (isAbsoluteFilePath(path)) return path
  if (!workspacePath) return ''
  return `${workspacePath}/${topicWorkspaceRelativePath(path)}`
}

function topicFileDisplayPath(workspacePath: string, path: string): string {
  if (!path) return ''
  if (path.startsWith('topics/')) return path.slice('topics/'.length)
  if (workspacePath && path.startsWith(`${workspacePath}/topics/`)) {
    return path.slice(`${workspacePath}/topics/`.length)
  }
  if (workspacePath && path.startsWith(`${workspacePath}/`)) {
    return path.slice(`${workspacePath}/`.length)
  }
  return path
}

function topicFileCopyPath(workspacePath: string, path: string): string {
  if (!path) return ''
  if (path.startsWith('topics/')) return path
  if (workspacePath && path.startsWith(`${workspacePath}/topics/`)) {
    return path.slice(`${workspacePath}/`.length)
  }
  if (isAbsoluteFilePath(path)) return path
  return topicWorkspaceRelativePath(path)
}

type FileViewMode = 'preview' | 'code'

interface TopicBreadcrumbSegment {
  label: string
  path: string
  isFile: boolean
}

function topicBreadcrumbSegments(path: string): TopicBreadcrumbSegment[] {
  const parts = path.split('/').filter(Boolean)
  return parts.map((label, index) => ({
    label,
    path: parts.slice(0, index + 1).join('/'),
    isFile: index === parts.length - 1,
  }))
}

function formatFileTimestamp(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(seconds * 1000))
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function highlightSourceLine(line: string, language: string): string {
  if (!line) return '&nbsp;'
  if (language !== 'text' && language !== 'csv' && hljs.getLanguage(language)) {
    return hljs.highlight(line, { language }).value
  }
  return escapeHtml(line)
}

interface FilePreviewMetadataData {
  summary?: string
  tags: string[]
  sources: string[]
}

function extractFrontmatterBlock(content: string): string | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  return match?.[1] ?? null
}

function cleanFrontmatterValue(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'")
  }
  return trimmed
}

function splitFrontmatterList(value: string): string[] {
  const trimmed = value.trim()
  const listText = trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed
  const values: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let escaping = false

  for (const char of listText) {
    if (escaping) {
      current += char
      escaping = false
      continue
    }
    if (quote && char === '\\') {
      current += char
      escaping = true
      continue
    }
    if (quote) {
      if (char === quote) quote = null
      current += char
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }
    if (char === ',') {
      const cleaned = cleanFrontmatterValue(current)
      if (cleaned) values.push(cleaned)
      current = ''
      continue
    }
    current += char
  }

  const cleaned = cleanFrontmatterValue(current)
  if (cleaned) values.push(cleaned)
  return values
}

function parseFrontmatterValues(content: string): Map<string, string[]> {
  const block = extractFrontmatterBlock(content)
  const values = new Map<string, string[]>()
  if (!block) return values

  let activeKey = ''
  for (const rawLine of block.split(/\r?\n/)) {
    const keyMatch = rawLine.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (keyMatch) {
      activeKey = keyMatch[1]
      values.set(activeKey, keyMatch[2] ? [keyMatch[2]] : [])
      continue
    }

    if (!activeKey) continue
    const listItemMatch = rawLine.match(/^\s*-\s+(.*)$/)
    if (listItemMatch) {
      values.set(activeKey, [...(values.get(activeKey) ?? []), listItemMatch[1]])
      continue
    }

    if (/^\s+/.test(rawLine)) {
      const current = values.get(activeKey) ?? []
      const lastIndex = current.length - 1
      if (lastIndex >= 0) {
        current[lastIndex] = `${current[lastIndex]} ${rawLine.trim()}`
        values.set(activeKey, current)
      }
    }
  }

  return values
}

function parseFrontmatterListValue(parts: string[] | undefined): string[] {
  if (!parts || parts.length === 0) return []
  if (parts.length > 1) return parts.map(cleanFrontmatterValue).filter(Boolean)
  const value = parts[0]
  if (!value) return []
  if (value.trim().startsWith('[')) return splitFrontmatterList(value)
  const cleaned = cleanFrontmatterValue(value)
  return cleaned ? [cleaned] : []
}

function parseFilePreviewMetadata(content: string): FilePreviewMetadataData | null {
  const values = parseFrontmatterValues(content)
  if (values.size === 0) return null

  const summary = cleanFrontmatterValue(values.get('summary')?.join(' ') ?? '')
  const tags = parseFrontmatterListValue(values.get('tags'))
  const sources = parseFrontmatterListValue(values.get('sources'))

  if (!summary && tags.length === 0 && sources.length === 0) return null
  return { summary: summary || undefined, tags, sources }
}

function ReturnButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`返回 ${label}`}
      title={`返回 ${label}`}
      onClick={onClick}
      style={{
        height: 28,
        maxWidth: 180,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        flexShrink: 0,
        padding: '0 9px',
        borderRadius: 6,
        border: '1px solid var(--divider)',
        background: 'transparent',
        color: 'var(--item-meta)',
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-body)',
        fontWeight: 'var(--font-medium)',
        cursor: 'pointer',
      }}
    >
      <ArrowLeft size={13} />
      <span
        style={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        返回
      </span>
    </button>
  )
}

function FileViewShell({
  rootLabel,
  file,
  displayPath,
  copyPath,
  returnTargetLabel,
  onReturnToPrevious,
  fullscreen,
  viewMode,
  onViewModeChange,
  onToggleFullscreen,
  onNavigateToPath,
  showViewToggle = true,
  findBar,
  children,
}: {
  rootLabel: string
  file: WorkspaceDirEntry
  displayPath?: string
  copyPath?: string
  returnTargetLabel?: string
  onReturnToPrevious?: () => void
  fullscreen: boolean
  viewMode: FileViewMode
  onViewModeChange: (mode: FileViewMode) => void
  onToggleFullscreen: () => void
  onNavigateToPath?: (path: string, isFile: boolean) => void
  showViewToggle?: boolean
  findBar?: React.ReactNode
  children: React.ReactNode
}) {
  const visiblePath = displayPath ?? file.path
  const pathToCopy = copyPath ?? visiblePath
  const [pathCopied, setPathCopied] = useState(false)
  const copyTimerRef = useRef<number | null>(null)
  const segments = topicBreadcrumbSegments(visiblePath)
  const modifiedAt = formatFileTimestamp(file.mtime_secs)

  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
      }
    },
    [],
  )

  const handleCopyPath = () => {
    void navigator.clipboard?.writeText(pathToCopy)
    setPathCopied(true)
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current)
    }
    copyTimerRef.current = window.setTimeout(() => {
      setPathCopied(false)
      copyTimerRef.current = null
    }, 1200)
  }

  const toggleButtonStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: 28,
    padding: '0 9px',
    borderRadius: 6,
    border: active ? '1px solid var(--divider-active)' : '1px solid transparent',
    background: active ? 'var(--segment-active-bg)' : 'transparent',
    color: active ? 'var(--segment-active-text)' : 'var(--item-meta)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-body)',
    fontWeight: active ? 'var(--font-semibold)' : 'var(--font-medium)',
    cursor: 'pointer',
  })

  return (
    <div
      data-testid="file-view-shell"
      data-fullscreen={fullscreen ? 'true' : 'false'}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--detail-bg)',
        overflow: 'hidden',
        position: fullscreen ? 'fixed' : 'relative',
        inset: fullscreen ? 0 : undefined,
        zIndex: fullscreen ? 9000 : undefined,
      }}
    >
      {findBar}
      <div
        style={{
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '0 16px 0 18px',
          borderBottom: '0.5px solid var(--divider)',
          background: 'var(--detail-bg)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flex: 1,
          }}
        >
          {onReturnToPrevious && returnTargetLabel && (
            <ReturnButton label={returnTargetLabel} onClick={onReturnToPrevious} />
          )}

          <nav
            aria-label={`${rootLabel}路径`}
            style={{
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--item-meta)',
              fontSize: 'var(--text-sm)',
            }}
          >
            <span style={{ flexShrink: 0, color: 'var(--duration-text)' }}>{rootLabel}</span>
            {segments.map((segment) => (
              <React.Fragment key={segment.path}>
                <span aria-hidden="true" style={{ color: 'var(--duration-text)', opacity: 0.7 }}>
                  /
                </span>
                <button
                  type="button"
                  aria-label={
                    segment.isFile
                      ? `定位到${rootLabel}文件 ${segment.label}`
                      : `定位到${rootLabel} ${segment.label}`
                  }
                  onClick={() => onNavigateToPath?.(segment.path, segment.isFile)}
                  style={{
                    minWidth: 0,
                    maxWidth: segment.isFile ? 220 : 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    padding: '2px 3px',
                    border: 'none',
                    borderRadius: 4,
                    background: 'transparent',
                    color: segment.isFile ? 'var(--item-text)' : 'var(--item-meta)',
                    fontSize: 'inherit',
                    fontFamily: 'var(--font-body)',
                    fontWeight: segment.isFile ? 'var(--font-semibold)' : 'var(--font-medium)',
                    cursor: 'pointer',
                  }}
                >
                  {segment.label}
                </button>
              </React.Fragment>
            ))}
            <button
              type="button"
              aria-label={pathCopied ? `已复制路径 ${pathToCopy}` : `复制路径 ${pathToCopy}`}
              data-copied={pathCopied ? 'true' : 'false'}
              title={pathCopied ? '已复制' : '复制路径'}
              onClick={handleCopyPath}
              style={{
                width: 22,
                height: 22,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginLeft: 1,
                border: 'none',
                borderRadius: 5,
                background: pathCopied ? 'var(--segment-active-bg)' : 'transparent',
                color: pathCopied ? 'var(--segment-active-text)' : 'var(--duration-text)',
                opacity: pathCopied ? 1 : 0.72,
                transform: pathCopied ? 'scale(1.08)' : 'scale(1)',
                transition:
                  'color 0.16s var(--ease-out), background 0.16s var(--ease-out), opacity 0.16s var(--ease-out), transform 0.16s var(--ease-out)',
                cursor: 'pointer',
              }}
            >
              {pathCopied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </nav>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
            color: 'var(--duration-text)',
            fontSize: 'var(--text-xs)',
          }}
        >
          {modifiedAt && (
            <span aria-label={`最后修改 ${modifiedAt}`} title={`最后修改 ${modifiedAt}`}>
              {modifiedAt}
            </span>
          )}

          <button
            type="button"
            aria-label={fullscreen ? '退出全屏' : '进入全屏'}
            onClick={onToggleFullscreen}
            style={{
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              border: '1px solid transparent',
              background: 'transparent',
              color: 'var(--item-meta)',
              cursor: 'pointer',
            }}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {showViewToggle && (
            <div
              role="group"
              aria-label="文件显示方式"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                padding: 2,
                borderRadius: 8,
                background: 'var(--segment-bg)',
                border: '1px solid var(--divider)',
              }}
            >
              <button
                type="button"
                aria-pressed={viewMode === 'preview'}
                onClick={() => onViewModeChange('preview')}
                style={toggleButtonStyle(viewMode === 'preview')}
              >
                <Eye size={13} />
                预览
              </button>
              <button
                type="button"
                aria-pressed={viewMode === 'code'}
                onClick={() => onViewModeChange('code')}
                style={toggleButtonStyle(viewMode === 'code')}
              >
                <Code2 size={13} />
                源码
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div>
    </div>
  )
}

function SourceView({
  content,
  language,
  containerRef,
}: {
  content: string
  language: string
  containerRef?: React.RefObject<HTMLDivElement | null>
}) {
  const [sourceCopied, setSourceCopied] = useState(false)
  const copyTimerRef = useRef<number | null>(null)
  const lines = useMemo(() => content.split('\n'), [content])
  const highlightedLines = useMemo(
    () => lines.map((line) => highlightSourceLine(line, language)),
    [language, lines],
  )

  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
      }
    },
    [],
  )

  const handleCopySource = () => {
    void navigator.clipboard?.writeText(content)
    setSourceCopied(true)
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current)
    }
    copyTimerRef.current = window.setTimeout(() => {
      setSourceCopied(false)
      copyTimerRef.current = null
    }, 1200)
  }

  return (
    <div
      ref={containerRef}
      data-testid="source-view"
      data-wrap="true"
      className="hljs"
      style={{
        height: '100%',
        overflow: 'auto',
        boxSizing: 'border-box',
        border: 'none',
        background: 'var(--detail-bg)',
        color: 'var(--md-pre-text)',
        padding: '18px 0',
        fontSize: 'var(--text-sm)',
        lineHeight: 1.6,
        fontFamily: 'var(--font-mono, monospace)',
      }}
    >
      <div
        data-find-ignore="true"
        style={{
          position: 'sticky',
          top: 10,
          zIndex: 5,
          height: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          paddingRight: 16,
          pointerEvents: 'none',
        }}
      >
        <button
          type="button"
          aria-label={sourceCopied ? '已复制源码' : '复制源码'}
          data-copied={sourceCopied ? 'true' : 'false'}
          title={sourceCopied ? '已复制源码' : '复制源码'}
          onClick={handleCopySource}
          style={{
            width: 28,
            height: 28,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            border: '1px solid var(--divider)',
            background: sourceCopied ? 'var(--segment-active-bg)' : 'var(--detail-bg)',
            color: sourceCopied ? 'var(--segment-active-text)' : 'var(--item-meta)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
            opacity: sourceCopied ? 1 : 0.82,
            transform: sourceCopied ? 'scale(1.06)' : 'scale(1)',
            transition:
              'color 0.16s var(--ease-out), background 0.16s var(--ease-out), opacity 0.16s var(--ease-out), transform 0.16s var(--ease-out)',
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
        >
          {sourceCopied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
      {highlightedLines.map((html, index) => (
        <div
          key={index}
          style={{
            display: 'grid',
            gridTemplateColumns: '48px minmax(0, 1fr)',
            alignItems: 'start',
            padding: '0 24px 0 0',
          }}
        >
          <span
            data-testid="source-line-number"
            data-line-number={index + 1}
            aria-hidden="true"
            className="source-line-number"
            style={{
              paddingRight: 13,
              textAlign: 'right',
              color: 'var(--duration-text)',
              opacity: 0.52,
              userSelect: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
          />
          <code
            data-source-code="true"
            className={`hljs language-${language}`}
            style={{
              minWidth: 0,
              display: 'block',
              overflow: 'visible',
              padding: 0,
              background: 'transparent',
              borderRadius: 0,
              color: 'inherit',
              fontSize: 'inherit',
              lineHeight: 'inherit',
              fontFamily: 'inherit',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      ))}
    </div>
  )
}

function FilePreviewMetadata({ metadata }: { metadata: FilePreviewMetadataData }) {
  const tags = pickDisplayTags(metadata.tags, Infinity)
  const hasChipRow = tags.length > 0 || metadata.sources.length > 0

  return (
    <div
      data-testid="file-preview-metadata"
      style={{
        marginBottom: 20,
        paddingBottom: 16,
        borderBottom: '0.5px solid var(--divider)',
      }}
    >
      {metadata.summary && (
        <div
          style={{
            fontSize: 'var(--text-base)',
            color: 'var(--detail-summary)',
            lineHeight: 1.8,
            marginBottom: hasChipRow ? 10 : 0,
          }}
        >
          {metadata.summary}
        </div>
      )}
      {hasChipRow && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {tags.map((cfg, i) => (
            <span
              key={i}
              style={{
                fontSize: 'var(--text-xs)',
                padding: '2px 8px',
                borderRadius: 4,
                fontWeight: 'var(--font-medium)',
                color: 'var(--tag-text)',
                background: 'var(--tag-bg)',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
              }}
            >
              {cfg.label}
            </span>
          ))}
          {metadata.sources.map((src, i) => {
            const filename = src.split('/').pop() ?? src
            const dotIdx = filename.lastIndexOf('.')
            const namePart = dotIdx > 0 ? filename.slice(0, dotIdx) : filename
            const extLabel = dotIdx > 0 ? filename.slice(dotIdx + 1).toUpperCase() : ''
            return (
              <span
                key={`src-${i}`}
                data-testid="sources-row"
                title={src}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 'var(--text-xs)',
                  padding: '2px 7px',
                  borderRadius: 4,
                  color: 'var(--item-meta)',
                  background: 'var(--item-icon-bg)',
                  fontFamily: 'var(--font-mono)',
                  maxWidth: 240,
                  transition: 'color 0.15s ease-out',
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {namePart}
                </span>
                {extLabel && (
                  <span
                    style={{
                      flexShrink: 0,
                      fontWeight: 'var(--font-medium)',
                      opacity: 0.5,
                    }}
                  >
                    {extLabel}
                  </span>
                )}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilePreviewPane({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: 'var(--journal-detail-padding)',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────────
export interface DetailViewProps {
  type: 'journal' | 'identity' | 'topic-file' | 'ideas'

  // Journal
  entry?: JournalEntry
  entries?: JournalEntry[]

  // Identity
  identity?: IdentityEntry

  // Topic file
  file?: WorkspaceDirEntry

  // Shared callbacks (all optional)
  onDeselect?: () => void
  onOpenDock?: () => void
  onSelectSample?: () => void
  onAddToTodo?: (text: string, source: string) => void
  onProcess?: (entry: JournalEntry) => void
  onVisualDesign?: (entry: JournalEntry) => void
  onOpenIdeaConversation?: (opts: IdeaConversationRequest) => void
  onNavigateToIdeaSource?: (filename: string) => void
  onNavigateToTopicPath?: (path: string, isFile: boolean) => void
  returnTargetLabel?: string
  onReturnToPrevious?: () => void
}

// ── Detail context menu ────────────────────────────────────────────────────────
function DetailContextMenu({
  menuRef,
  mode,
  onProcess,
  onVisualDesign,
  onCopySelection,
  onCopyRaw,
  onAddToTodo,
  onClose,
}: {
  menuRef: React.RefObject<HTMLDivElement | null>
  mode: 'journal' | 'identity' | 'file'
  onProcess?: () => void
  onVisualDesign?: () => void
  onCopySelection: () => void
  onCopyRaw: () => void
  onAddToTodo?: () => void
  onClose: () => void
}) {
  const iconColor = 'var(--item-meta)'
  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 12px',
    fontSize: 'var(--text-sm)',
    cursor: 'pointer',
    color: 'var(--item-text)',
  }

  const showJournalActions = mode === 'journal'

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        background: 'var(--context-menu-bg)',
        border: '1px solid var(--context-menu-border)',
        borderRadius: 8,
        boxShadow: '0 4px 20px var(--context-menu-shadow)',
        minWidth: 160,
        overflow: 'hidden',
        padding: '4px 0',
        display: 'none',
      }}
    >
      {showJournalActions && onProcess && (
        <>
          <div
            style={itemStyle}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLDivElement).style.background = 'transparent')
            }
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onProcess()
              onClose()
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={iconColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <text
                x="12"
                y="18"
                textAnchor="middle"
                fontSize="22"
                fontWeight="700"
                fill={iconColor}
                stroke="none"
              >
                @
              </text>
            </svg>
            <span>{getT()('referenceEntry')}</span>
          </div>
          {onVisualDesign && (
            <div
              style={itemStyle}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLDivElement).style.background = 'transparent')
              }
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onVisualDesign()
                onClose()
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={iconColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              <span>{getT()('visualDesignBook')}</span>
            </div>
          )}
          <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
        </>
      )}

      {showJournalActions && onAddToTodo && (
        <>
          <div
            data-role="add-to-todo"
            style={itemStyle}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLDivElement).style.background = 'transparent')
            }
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onAddToTodo()
              onClose()
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={iconColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <span>{getT()('addToTodo')}</span>
          </div>
          <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
        </>
      )}

      {/* Copy selection */}
      <div
        data-role="copy-selection"
        style={itemStyle}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)')
        }
        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onCopySelection()
          onClose()
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={iconColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <span>{getT()('copySelected')}</span>
      </div>
      <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
      {/* Copy raw */}
      <div
        style={itemStyle}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)')
        }
        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onCopyRaw()
          onClose()
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={iconColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="7" y1="8" x2="17" y2="8" />
          <line x1="7" y1="12" x2="17" y2="12" />
          <line x1="7" y1="16" x2="13" y2="16" />
        </svg>
        <span>{getT()('copyMarkdown')}</span>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export const DetailView = React.memo(function DetailView({
  type,
  entry,
  entries = [],
  identity,
  file,
  onDeselect,
  onOpenDock,
  onSelectSample,
  onAddToTodo,
  onProcess,
  onVisualDesign,
  onOpenIdeaConversation,
  onNavigateToIdeaSource,
  onNavigateToTopicPath,
  returnTargetLabel,
  onReturnToPrevious,
}: DetailViewProps) {
  // ── State ──────────────────────────────────────────────────────────────
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFind, setShowFind] = useState(false)
  const [workspacePath, setWorkspacePath] = useState('')
  const [resetCooldown, setResetCooldown] = useState(false)
  const [fileViewMode, setFileViewMode] = useState<FileViewMode>('preview')
  const [fileFullscreen, setFileFullscreen] = useState(false)

  const bodyRef = useRef<HTMLDivElement>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)

  const isSoul = type === 'identity' && identity?.path === SOUL_PATH
  const topicFileName = file?.name ?? ''
  const topicFilePath = file?.path ?? ''
  const topicFileMtime = file?.mtime_secs ?? 0

  // ── Workspace path ──────────────────────────────────────────────────────
  useEffect(() => {
    getWorkspacePath().then(setWorkspacePath)
  }, [])

  useEffect(() => {
    setFileViewMode('preview')
    setFileFullscreen(false)
    setShowFind(false)
    CSS.highlights?.delete('search-result')
    CSS.highlights?.delete('search-current')
  }, [entry?.path, identity?.path, topicFilePath])

  // ── Content loading ─────────────────────────────────────────────────────
  useEffect(() => {
    if (type === 'journal' && entry) {
      CSS.highlights?.delete('search-result')
      CSS.highlights?.delete('search-current')
      setShowFind(false)
      setLoading(true)
      getJournalEntryContent(entry.path).then((c) => {
        setContent(c)
        setLoading(false)
      })
    } else if (type === 'identity' && identity) {
      CSS.highlights?.delete('search-result')
      CSS.highlights?.delete('search-current')
      setShowFind(false)
      setContent(null)
      if (isSoul) {
        getWorkspacePrompt().then(setContent)
      } else {
        getIdentityContent(identity.path).then(setContent)
      }
    } else if (type === 'topic-file' && topicFilePath) {
      setContent(null)
      setLoading(false)
      const absolutePath = topicFileAbsolutePath(workspacePath, topicFilePath)
      if (absolutePath) {
        const kind = fileKindFromName(topicFileName)
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
        }
      }
    } else {
      // No selection
      setContent(null)
      setLoading(false)
      setShowFind(false)
      CSS.highlights?.delete('search-result')
      CSS.highlights?.delete('search-current')
    }
  }, [
    type,
    entry,
    entry?.path,
    entry?.mtime_secs,
    identity,
    identity?.path,
    identity?.mtime_secs,
    topicFileName,
    topicFilePath,
    topicFileMtime,
    isSoul,
    workspacePath,
  ])

  // ── Context menu ────────────────────────────────────────────────────────
  const showContextMenu = (x: number, y: number) => {
    const el = ctxMenuRef.current
    if (!el) return
    // Update "copy selection" item enabled state
    const hasSelection = !!window.getSelection()?.toString()
    const copySelItem = el.querySelector('[data-role="copy-selection"]') as HTMLDivElement | null
    if (copySelItem) {
      copySelItem.style.opacity = hasSelection ? '1' : '0.35'
      copySelItem.style.cursor = hasSelection ? 'pointer' : 'default'
      copySelItem.style.pointerEvents = hasSelection ? 'auto' : 'none'
    }
    const addTodoItem = el.querySelector('[data-role="add-to-todo"]') as HTMLDivElement | null
    if (addTodoItem) {
      addTodoItem.style.opacity = hasSelection ? '1' : '0.35'
      addTodoItem.style.cursor = hasSelection ? 'pointer' : 'default'
      addTodoItem.style.pointerEvents = hasSelection ? 'auto' : 'none'
    }
    el.style.display = 'block'
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (rect.right > vw) el.style.left = `${Math.max(4, vw - rect.width - 8)}px`
    if (rect.bottom > vh) el.style.top = `${Math.max(4, vh - rect.height - 8)}px`
  }

  const hideContextMenu = () => {
    const el = ctxMenuRef.current
    if (el) el.style.display = 'none'
  }

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) hideContextMenu()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideContextMenu()
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  // ── Keyboard shortcuts (read mode) ──────────────────────────────────────
  // Escape → deselect
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showFind) {
        onDeselect?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onDeselect, showFind])

  // Cmd+F opens find bar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setShowFind(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Cmd+A select all
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'a') return
      if (!bodyRef.current) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      e.preventDefault()
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(bodyRef.current)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Computed values ─────────────────────────────────────────────────────
  const isJournalMode = type === 'journal'
  const isIdentityMode = type === 'identity'
  const isFileMode = type === 'topic-file'

  const fileKind: FileKind | null = file ? fileKindFromName(file.name) : null
  const fileAbsolutePath = file ? topicFileAbsolutePath(workspacePath, file.path) : ''

  const closeFindBar = () => {
    CSS.highlights?.delete('search-result')
    CSS.highlights?.delete('search-current')
    setShowFind(false)
  }

  // Detect HTML journal entries — render as SandboxPreview, not markdown
  const isHtmlContent =
    (isJournalMode && entry?.filename.match(/\.html?$/i)) || (isFileMode && fileKind === 'html')
  const isStandardDetailSourceMode =
    (isJournalMode || isIdentityMode) && !isHtmlContent && fileViewMode === 'code'

  const sourceFindBar = showFind ? <FindBar containerRef={bodyRef} onClose={closeFindBar} /> : null

  // Markdown node for read mode
  const markdownNode = useMemo(() => {
    if (content === null || isHtmlContent) return null
    let absPath = ''
    if (isJournalMode && entry) absPath = entry.path
    else if (isIdentityMode && identity) absPath = identity.path
    else if (isFileMode && file) absPath = fileAbsolutePath
    return renderMarkdown(content, absPath)
  }, [
    content,
    entry,
    identity,
    file,
    fileAbsolutePath,
    isJournalMode,
    isIdentityMode,
    isFileMode,
    isHtmlContent,
  ])

  const topicFilePreviewMetadata = useMemo(() => {
    if (!isFileMode || fileKind !== 'markdown' || content === null) return null
    return parseFilePreviewMetadata(content)
  }, [content, fileKind, isFileMode])

  // ── Empty state ─────────────────────────────────────────────────────────
  const hasSelection =
    (isJournalMode && entry) || (isIdentityMode && identity) || (isFileMode && file)

  const isIdeasMode = type === 'ideas'

  // Ideas mode: render the center workbench.
  if (isIdeasMode) {
    return (
      <IdeasWorkbench
        onOpenConversation={onOpenIdeaConversation}
        onNavigateToSource={onNavigateToIdeaSource}
      />
    )
  }

  if (!hasSelection) {
    const isEmpty = isJournalMode && entries.length === 0
    const showCards = isJournalMode

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--detail-bg)',
          userSelect: 'none',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Watermark */}
        <span
          style={{
            fontSize: '84vh',
            fontWeight: 900,
            letterSpacing: '0.06em',
            color: 'var(--item-text)',
            opacity: 0.035,
            lineHeight: 1,
            fontFamily:
              '"Noto Serif SC", "Source Han Serif SC", "Source Han Serif CN", "STSong", "SimSun", "Songti SC", serif',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            position: 'absolute',
          }}
        >
          謹跡
        </span>

        {showCards && (
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              padding: '0 32px',
              width: '100%',
              maxWidth: 520,
            }}
          >
            <div
              style={{
                fontSize: 'var(--text-base)',
                color: 'var(--item-meta)',
                letterSpacing: '0.04em',
                opacity: 0.6,
              }}
            >
              通过以下方式开始记录
            </div>
            <div style={{ display: 'flex', gap: 12, width: '100%' }}>
              {/* 粘贴卡片 */}
              {onOpenDock && (
                <button
                  onClick={onOpenDock}
                  style={{
                    flex: 1,
                    background: 'var(--detail-case-bg)',
                    border: '1px solid var(--divider)',
                    borderRadius: 10,
                    padding: '16px 12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'opacity 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--item-meta)'
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      'color-mix(in srgb, var(--item-hover-bg) 30%, transparent)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--divider)'
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      'var(--detail-case-bg)'
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'var(--item-icon-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 8px',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--item-meta)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--item-text)',
                      fontWeight: 'var(--font-semibold)',
                      marginBottom: 4,
                    }}
                  >
                    粘贴 / 拖文件
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--item-meta)',
                      lineHeight: 1.6,
                    }}
                  >
                    会议记录、日记
                    <br />
                    AI 自动提炼关键信息
                  </div>
                </button>
              )}

              {/* 创建示例卡片：只在工作目录为空时显示 */}
              {isEmpty && onSelectSample && (
                <button
                  onClick={onSelectSample}
                  style={{
                    flex: 1,
                    background: 'var(--detail-case-bg)',
                    border: '1px dashed var(--divider)',
                    borderStyle: 'dashed',
                    borderRadius: 10,
                    padding: '16px 12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'opacity 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--record-btn)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderStyle = 'solid'
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      'color-mix(in srgb, var(--item-hover-bg) 30%, transparent)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--divider)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderStyle = 'dashed'
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      'var(--detail-case-bg)'
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'var(--item-icon-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 8px',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--item-meta)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2a7 7 0 0 1 7 7c0 4-3 6-4 8H9c-1-2-4-4-4-8a7 7 0 0 1 7-7z" />
                      <line x1="9" y1="21" x2="15" y2="21" />
                      <line x1="10" y1="17" x2="14" y2="17" />
                    </svg>
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--item-text)',
                      fontWeight: 'var(--font-semibold)',
                      marginBottom: 4,
                    }}
                  >
                    创建示例条目
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--item-meta)',
                      lineHeight: 1.6,
                    }}
                  >
                    生成一条示例
                    <br />
                    了解 AI 整理效果
                  </div>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Loading state for file preview ──────────────────────────────────────
  if (isFileMode && loading && !file) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--detail-bg)',
        }}
      >
        <Spinner size={20} />
      </div>
    )
  }

  // ── File non-text rendering (image, pdf, html via iframe) ───────────────
  if (isFileMode && file) {
    const renderTopicFileShell = (
      children: React.ReactNode,
      showViewToggle = true,
      showSourceFind = false,
    ) => (
      <FileViewShell
        rootLabel="专题"
        file={file}
        displayPath={topicFileDisplayPath(workspacePath, file.path)}
        copyPath={topicFileCopyPath(workspacePath, file.path)}
        returnTargetLabel={returnTargetLabel}
        onReturnToPrevious={onReturnToPrevious}
        fullscreen={fileFullscreen}
        viewMode={fileViewMode}
        onViewModeChange={setFileViewMode}
        onToggleFullscreen={() => setFileFullscreen((value) => !value)}
        onNavigateToPath={onNavigateToTopicPath}
        showViewToggle={showViewToggle}
        findBar={showSourceFind ? sourceFindBar : null}
      >
        {children}
      </FileViewShell>
    )

    if (loading) {
      const hasPreviewSourceToggle =
        fileKind === 'markdown' || fileKind === 'text' || fileKind === 'html' || fileKind === 'csv'
      return renderTopicFileShell(
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--detail-bg)',
          }}
        >
          <Spinner size={20} />
        </div>,
        hasPreviewSourceToggle,
      )
    }

    // Image
    if (fileKind === 'image') {
      const src = convertFileSrc(fileAbsolutePath)
      return renderTopicFileShell(
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--detail-bg)',
            overflow: 'hidden',
          }}
        >
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
        </div>,
        false,
      )
    }

    // PDF
    if (fileKind === 'pdf') {
      const src = convertFileSrc(fileAbsolutePath)
      return renderTopicFileShell(
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--detail-bg)',
            overflow: 'hidden',
          }}
        >
          <iframe
            src={src}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
          />
        </div>,
        false,
      )
    }

    // Markdown / MDX via the shared file shell
    if (fileKind === 'markdown' && content !== null) {
      return renderTopicFileShell(
        <>
          {fileViewMode === 'preview' ? (
            <FilePreviewPane>
              {topicFilePreviewMetadata && (
                <FilePreviewMetadata metadata={topicFilePreviewMetadata} />
              )}
              {markdownNode}
            </FilePreviewPane>
          ) : (
            <SourceView content={content} language="markdown" containerRef={bodyRef} />
          )}
        </>,
        true,
        fileViewMode === 'code',
      )
    }

    // HTML via SandboxPreview
    if (fileKind === 'html' && content !== null) {
      return renderTopicFileShell(
        <>
          {fileViewMode === 'preview' ? (
            <SandboxPreview html={content} title={file.name} />
          ) : (
            <SourceView content={content} language="html" containerRef={bodyRef} />
          )}
        </>,
        true,
        fileViewMode === 'code',
      )
    }

    // Other (unsupported) file type
    if (fileKind === 'other' || fileKind === 'audio' || fileKind === 'docx') {
      return renderTopicFileShell(
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            background: 'var(--detail-bg)',
            color: 'var(--item-meta)',
          }}
        >
          <span style={{ fontSize: 'var(--text-base)' }}>{file.name}</span>
          <button
            onClick={() => openFile(fileAbsolutePath)}
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
            {getT()('openExternal')}
          </button>
        </div>,
        false,
      )
    }

    // Text file (plain text, not markdown)
    if (fileKind === 'text' && content !== null) {
      return renderTopicFileShell(
        <>
          {fileViewMode === 'preview' ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--detail-bg)',
                overflow: 'auto',
              }}
            >
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
            </div>
          ) : (
            <SourceView content={content} language="text" containerRef={bodyRef} />
          )}
        </>,
        true,
        fileViewMode === 'code',
      )
    }

    // Code file
    if (fileKind === 'code' && content !== null) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      const lang = EXT_TO_LANG[ext]
      return renderTopicFileShell(
        <SourceView content={content} language={lang ?? ext} containerRef={bodyRef} />,
        false,
        true,
      )
    }

    // CSV
    if (fileKind === 'csv' && content !== null) {
      const data = parseCSV(content)
      if (!data) {
        return renderTopicFileShell(
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--detail-bg)',
              color: 'var(--item-meta)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {file.name}
          </div>,
          false,
        )
      }
      return renderTopicFileShell(
        <>
          {fileViewMode === 'preview' ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--detail-bg)',
                overflow: 'auto',
              }}
            >
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
            </div>
          ) : (
            <SourceView content={content} language="csv" containerRef={bodyRef} />
          )}
        </>,
        true,
        fileViewMode === 'code',
      )
    }

    return renderTopicFileShell(
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--detail-bg)',
        }}
      >
        <Spinner size={20} />
      </div>,
      fileKind === 'markdown' || fileKind === 'text' || fileKind === 'html' || fileKind === 'csv',
    )
  }

  if (isJournalMode && entry && isHtmlContent && content !== null) {
    const journalHtmlFile: WorkspaceDirEntry = {
      name: entry.filename,
      path: `${entry.year_month}/${entry.filename}`,
      is_dir: false,
      created_secs: entry.created_at_secs,
      mtime_secs: entry.mtime_secs,
    }

    return (
      <FileViewShell
        rootLabel="日志"
        file={journalHtmlFile}
        fullscreen={fileFullscreen}
        viewMode={fileViewMode}
        returnTargetLabel={returnTargetLabel}
        onReturnToPrevious={onReturnToPrevious}
        onViewModeChange={setFileViewMode}
        onToggleFullscreen={() => setFileFullscreen((value) => !value)}
        onNavigateToPath={(path, isFile) => {
          if (!isFile) return
          const filename = path.split('/').pop()
          if (!filename) return
          window.dispatchEvent(
            new CustomEvent('journal-entry-navigate', {
              detail: { filename },
            }),
          )
        }}
        findBar={fileViewMode === 'code' ? sourceFindBar : null}
      >
        {fileViewMode === 'preview' ? (
          <SandboxPreview html={content} title={entry.title} />
        ) : (
          <SourceView content={content} language="html" containerRef={bodyRef} />
        )}
      </FileViewShell>
    )
  }

  // ── Journal / Identity / Markdown file reading mode ─────────────────────
  const btnStyle: React.CSSProperties = {
    padding: '4px 14px',
    borderRadius: 6,
    border: '1px solid var(--divider)',
    background: 'transparent',
    color: 'var(--item-meta)',
    fontSize: 'var(--text-xs)',
    cursor: 'pointer',
    minWidth: 48,
    textAlign: 'center',
    transition: 'color 0.15s, background 0.15s, opacity 0.15s',
  }

  const detailToggleButtonStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: 28,
    padding: '0 9px',
    borderRadius: 6,
    border: active ? '1px solid var(--divider-active)' : '1px solid transparent',
    background: active ? 'var(--segment-active-bg)' : 'transparent',
    color: active ? 'var(--segment-active-text)' : 'var(--item-meta)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-body)',
    fontWeight: active ? 'var(--font-semibold)' : 'var(--font-medium)',
    cursor: 'pointer',
  })

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--detail-bg)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {showFind && <FindBar containerRef={bodyRef} onClose={closeFindBar} />}

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 20px',
          flexShrink: 0,
          borderBottom: '0.5px solid var(--divider)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
            flex: 1,
            marginRight: 12,
          }}
        >
          {onReturnToPrevious && returnTargetLabel && (
            <ReturnButton label={returnTargetLabel} onClick={onReturnToPrevious} />
          )}
          <span
            style={{
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--font-semibold)',
              color: 'var(--item-text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            {isJournalMode && entry ? entry.title : ''}
            {isIdentityMode && identity ? identity.name : ''}
            {isFileMode && file ? file.name : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(isJournalMode || isIdentityMode) && (
            <div
              role="group"
              aria-label="详情显示方式"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                padding: 2,
                borderRadius: 8,
                background: 'var(--segment-bg)',
                border: '1px solid var(--divider)',
              }}
            >
              <button
                type="button"
                aria-pressed={fileViewMode === 'preview'}
                onClick={() => setFileViewMode('preview')}
                style={detailToggleButtonStyle(fileViewMode === 'preview')}
              >
                <Eye size={13} />
                预览
              </button>
              <button
                type="button"
                aria-pressed={fileViewMode === 'code'}
                onClick={() => setFileViewMode('code')}
                style={detailToggleButtonStyle(fileViewMode === 'code')}
              >
                <Code2 size={13} />
                源码
              </button>
            </div>
          )}

          {isSoul && (
            <button
              onClick={() => {
                if (resetCooldown) return
                setResetCooldown(true)
                ask('确认重置助手提示词？', {
                  title: '重置助手提示词',
                  kind: 'warning',
                  okLabel: '重置',
                  cancelLabel: '取消',
                }).then((yes) => {
                  if (!yes) {
                    setResetCooldown(false)
                    return
                  }
                  resetWorkspacePrompt().then((defaultContent) => {
                    setContent(defaultContent)
                    setResetCooldown(false)
                  })
                })
              }}
              disabled={resetCooldown}
              style={{
                ...btnStyle,
                opacity: resetCooldown ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = 'var(--item-text)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = 'var(--item-meta)')
              }
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              重置
            </button>
          )}
        </div>
      </div>

      {/* Read mode */}
      <div
        ref={isStandardDetailSourceMode ? undefined : bodyRef}
        style={{
          flex: 1,
          overflowY: isStandardDetailSourceMode ? 'hidden' : 'auto',
          padding:
            isHtmlContent || isStandardDetailSourceMode ? 0 : 'var(--journal-detail-padding)',
          width: '100%',
          boxSizing: isHtmlContent || isStandardDetailSourceMode ? undefined : 'border-box',
          margin: 0,
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          showContextMenu(e.clientX, e.clientY)
        }}
      >
        {/* Header: summary + tags + sources (journal) */}
        {isJournalMode && entry && !isHtmlContent && !isStandardDetailSourceMode && (
          <div
            style={{
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: '0.5px solid var(--divider)',
            }}
          >
            {entry.summary && (
              <div
                style={{
                  fontSize: 'var(--text-base)',
                  color: 'var(--detail-summary)',
                  lineHeight: 1.8,
                  marginBottom:
                    pickDisplayTags(entry.tags, Infinity).length > 0 || entry.sources.length > 0
                      ? 10
                      : 0,
                }}
              >
                {entry.summary}
              </div>
            )}
            {(pickDisplayTags(entry.tags, Infinity).length > 0 || entry.sources.length > 0) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {pickDisplayTags(entry.tags, Infinity).map((cfg, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 'var(--text-xs)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 'var(--font-medium)',
                      color: 'var(--tag-text)',
                      background: 'var(--tag-bg)',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cfg.label}
                  </span>
                ))}
                {entry.sources.map((src, i) => {
                  const filename = src.split('/').pop() ?? src
                  const kind = fileKindFromName(filename)
                  const dotIdx = filename.lastIndexOf('.')
                  const namePart = dotIdx > 0 ? filename.slice(0, dotIdx) : filename
                  const extLabel = dotIdx > 0 ? filename.slice(dotIdx + 1).toUpperCase() : ''
                  const handleSourceClick = async () => {
                    const srcFilename = src.split('/').pop() ?? src
                    if (kind === 'markdown') {
                      const match = entries.find((e) => e.filename === srcFilename)
                      if (match) {
                        window.dispatchEvent(
                          new CustomEvent('journal-entry-navigate', {
                            detail: { filename: srcFilename },
                          }),
                        )
                      } else {
                        try {
                          const ws = await getWorkspacePath()
                          await openFile(`${ws}/${src}`)
                        } catch (e) {
                          console.error('[source-click] open failed:', e)
                        }
                      }
                    } else {
                      try {
                        const ws = await getWorkspacePath()
                        await openFile(`${ws}/${src}`)
                      } catch (e) {
                        console.error('[source-click] open failed:', e)
                      }
                    }
                  }
                  return (
                    <span
                      key={`src-${i}`}
                      data-testid="sources-row"
                      onClick={handleSourceClick}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLElement).style.color = 'var(--item-selected-text)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLElement).style.color = 'var(--item-meta)'
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 'var(--text-xs)',
                        padding: '2px 7px',
                        borderRadius: 4,
                        color: 'var(--item-meta)',
                        background: 'var(--item-icon-bg)',
                        fontFamily: 'var(--font-mono)',
                        maxWidth: 240,
                        cursor: 'pointer',
                        transition: 'color 0.15s ease-out',
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          minWidth: 0,
                        }}
                      >
                        {namePart}
                      </span>
                      {extLabel && (
                        <span
                          style={{
                            flexShrink: 0,
                            fontWeight: 'var(--font-medium)',
                            opacity: 0.5,
                          }}
                        >
                          {extLabel}
                        </span>
                      )}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Header: summary + tags + speaker (identity) */}
        {isIdentityMode && identity && !isStandardDetailSourceMode && (
          <div
            style={{
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: '0.5px solid var(--divider)',
            }}
          >
            {identity.summary && (
              <div
                style={{
                  fontSize: 'var(--text-base)',
                  color: 'var(--detail-summary)',
                  lineHeight: 1.8,
                  marginBottom:
                    identity.speaker_id || pickDisplayTags(identity.tags, Infinity).length > 0
                      ? 10
                      : 0,
                }}
              >
                {identity.summary}
              </div>
            )}
            {(identity.speaker_id || pickDisplayTags(identity.tags, Infinity).length > 0) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {identity.speaker_id && (
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      padding: '2px 9px',
                      borderRadius: 4,
                      fontWeight: 'var(--font-medium)',
                      color: 'var(--item-meta)',
                      background: 'var(--item-icon-bg)',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                    {identity.speaker_id}
                  </span>
                )}
                {pickDisplayTags(identity.tags, Infinity).map((cfg, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 'var(--text-xs)',
                      padding: '2px 9px',
                      borderRadius: 4,
                      fontWeight: 'var(--font-medium)',
                      color: 'var(--tag-text)',
                      background: 'var(--tag-bg)',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cfg.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Body content */}
        {isStandardDetailSourceMode && content !== null ? (
          <SourceView content={content} language="markdown" containerRef={bodyRef} />
        ) : isHtmlContent && content !== null ? (
          <SandboxPreview html={content} title={entry?.title ?? file?.name} />
        ) : content === null && !loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
            <Spinner size={20} />
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {loading && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  paddingTop: 24,
                  position: 'absolute',
                  inset: 0,
                  zIndex: 1,
                }}
              >
                <Spinner size={20} />
              </div>
            )}
            <div style={{ opacity: loading ? 0.3 : 1, transition: 'opacity 0.15s ease-out' }}>
              {markdownNode}
            </div>
          </div>
        )}
      </div>

      <DetailContextMenu
        menuRef={ctxMenuRef}
        mode={isJournalMode ? 'journal' : isIdentityMode ? 'identity' : 'file'}
        onProcess={isJournalMode && onProcess && entry ? () => onProcess(entry) : undefined}
        onVisualDesign={
          isJournalMode && onVisualDesign && entry ? () => onVisualDesign(entry) : undefined
        }
        onCopySelection={() => {
          const sel = window.getSelection()?.toString()
          if (sel) navigator.clipboard.writeText(sel)
        }}
        onCopyRaw={() => {
          if (content) navigator.clipboard.writeText(content)
        }}
        onAddToTodo={
          isJournalMode && onAddToTodo && entry
            ? () => {
                const sel = window.getSelection()?.toString()?.trim()
                if (sel) onAddToTodo(sel, entry.filename)
              }
            : undefined
        }
        onClose={hideContextMenu}
      />
    </div>
  )
})
