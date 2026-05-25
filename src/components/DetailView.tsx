import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { renderMarkdown } from '../lib/markdown'
import type { JournalEntry, IdentityEntry, TodoItem } from '../types'
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
import { Spinner } from './Spinner'
import { TodoSidebar } from './TodoSidebar'
import { FindBar } from './FindBar'
import { convertFileSrc } from '@tauri-apps/api/core'
import { createTranslator, detectLang } from '../lib/i18n'
import { ask } from '@tauri-apps/plugin-dialog'

// ── Constants ───────────────────────────────────────────────────────────────────
const SOUL_PATH = '__soul__'
const getT = () => createTranslator(detectLang())

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

  // Ideas (todo list)
  todos?: TodoItem[]
  onToggleTodo?: (lineIndex: number, checked: boolean, doneFile: boolean) => void
  onAddTodo?: (text: string, due?: string, source?: string, path?: string) => void
  onDeleteTodo?: (lineIndex: number, doneFile: boolean) => void
  onSetTodoDue?: (lineIndex: number, due: string | null, doneFile: boolean) => void
  onUpdateTodoText?: (lineIndex: number, text: string, doneFile: boolean) => void
  onSetTodoPath?: (lineIndex: number, path: string | null, doneFile: boolean) => void
  onRemoveTodoPath?: (lineIndex: number, doneFile: boolean) => void
  onOpenTodoConversation?: (opts: {
    mode: 'chat'
    context: string
    sessionId: string | null
    lineIndex: number
    doneFile: boolean
  }) => void
  onNavigateTodoSource?: (filename: string) => void

  // Shared callbacks (all optional)
  onDeselect?: () => void
  onRecord?: () => void
  onOpenDock?: () => void
  onSelectSample?: () => void
  onAddToTodo?: (text: string, source: string) => void
  onProcess?: (entry: JournalEntry) => void
  onVisualDesign?: (entry: JournalEntry) => void
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

// ── CSV parser ─────────────────────────────────────────────────────────────────
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

// ── HTML blob URL builder ──────────────────────────────────────────────────────
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

// ── Code language mapping ──────────────────────────────────────────────────────
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

// ── Main component ─────────────────────────────────────────────────────────────
export const DetailView = React.memo(function DetailView({
  type,
  entry,
  entries = [],
  identity,
  file,
  todos,
  onToggleTodo,
  onAddTodo,
  onDeleteTodo,
  onSetTodoDue,
  onUpdateTodoText,
  onSetTodoPath,
  onRemoveTodoPath,
  onOpenTodoConversation,
  onNavigateTodoSource,
  onDeselect,
  onRecord,
  onOpenDock,
  onSelectSample,
  onAddToTodo,
  onProcess,
  onVisualDesign,
}: DetailViewProps) {
  // ── State ──────────────────────────────────────────────────────────────
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFind, setShowFind] = useState(false)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [workspacePath, setWorkspacePath] = useState('')
  const [resetCooldown, setResetCooldown] = useState(false)

  const bodyRef = useRef<HTMLDivElement>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const isSoul = type === 'identity' && identity?.path === SOUL_PATH

  // ── Workspace path ──────────────────────────────────────────────────────
  useEffect(() => {
    getWorkspacePath().then(setWorkspacePath)
  }, [])

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
    } else if (type === 'topic-file' && file) {
      setContent(null)
      setLoading(false)
      if (workspacePath) {
        const absolutePath = `${workspacePath}/${file.path}`
        const kind = fileKindFromName(file.name)
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
  }, [type, entry?.path, entry?.mtime_secs, identity?.path, identity?.mtime_secs, file?.path, isSoul, workspacePath])

  // ── HTML blob URL ───────────────────────────────────────────────────────
  useEffect(() => {
    const fileKind = file ? fileKindFromName(file.name) : null
    if (fileKind === 'html' && content !== null && file) {
      const absolutePath = `${workspacePath}/${file.path}`
      const url = buildHtmlBlobUrl(content, absolutePath)
      setBlobUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setBlobUrl(null)
  }, [content, file, workspacePath])

  // ── Iframe theme sync ───────────────────────────────────────────────────
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
  const fileAbsolutePath = workspacePath && file ? `${workspacePath}/${file.path}` : ''

  // Markdown node for read mode
  const markdownNode = useMemo(() => {
    if (content === null) return null
    let absPath = ''
    if (isJournalMode && entry) absPath = entry.path
    else if (isIdentityMode && identity) absPath = identity.path
    else if (isFileMode && file) absPath = fileAbsolutePath
    return renderMarkdown(content, absPath)
  }, [content, entry?.path, identity?.path, fileAbsolutePath, isJournalMode, isIdentityMode, isFileMode])

  // ── Empty state ─────────────────────────────────────────────────────────
  const hasSelection = (isJournalMode && entry) || (isIdentityMode && identity) || (isFileMode && file)

  const isIdeasMode = type === 'ideas'

  // Ideas mode: render TodoSidebar in center area
  if (isIdeasMode) {
    const uncheckedCount = todos?.filter(t => !t.done).length ?? 0
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--detail-bg)',
          overflow: 'hidden',
        }}
      >
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
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--accent, #B8782A)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              fontWeight: 'var(--font-medium)',
            }}
          >
            想法
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--duration-text)' }}>
            {uncheckedCount} 个待办
          </span>
        </div>

        {/* TodoSidebar content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {todos !== undefined && onToggleTodo && onAddTodo && onDeleteTodo ? (
            <TodoSidebar
              todos={todos}
              onToggle={onToggleTodo}
              onAdd={onAddTodo}
              onDelete={onDeleteTodo}
              onSetDue={onSetTodoDue ?? (() => {})}
              onUpdateText={onUpdateTodoText ?? (() => {})}
              onSetPath={onSetTodoPath ?? (() => {})}
              onRemovePath={onRemoveTodoPath ?? (() => {})}
              onOpenConversation={onOpenTodoConversation}
              onNavigateToSource={onNavigateTodoSource}
            />
          ) : null}
        </div>
      </div>
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
              {/* 录音卡片 */}
              {onRecord && (
                <button
                  onClick={onRecord}
                  style={{
                    flex: 1,
                    background: 'color-mix(in srgb, var(--detail-bg) 25%, transparent)',
                    border: '1px solid var(--divider)',
                    borderRadius: 10,
                    padding: '16px 12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'opacity 0.15s, background 0.15s',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--item-meta)'
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      'color-mix(in srgb, var(--item-hover-bg) 30%, transparent)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--divider)'
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      'color-mix(in srgb, var(--detail-bg) 25%, transparent)'
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
                      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                      <path d="M19 10a7 7 0 0 1-14 0" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                      <line x1="8" y1="22" x2="16" y2="22" />
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
                    录音记录
                  </div>
                  <div
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--item-meta)', lineHeight: 1.6 }}
                  >
                    说出你的想法
                    <br />
                    AI 自动整理成日志
                  </div>
                </button>
              )}

              {/* 粘贴卡片 */}
              {onOpenDock && (
                <button
                  onClick={onOpenDock}
                  style={{
                    flex: 1,
                    background: 'color-mix(in srgb, var(--detail-bg) 25%, transparent)',
                    border: '1px solid var(--divider)',
                    borderRadius: 10,
                    padding: '16px 12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'opacity 0.15s, background 0.15s',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--item-meta)'
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      'color-mix(in srgb, var(--item-hover-bg) 30%, transparent)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--divider)'
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      'color-mix(in srgb, var(--detail-bg) 25%, transparent)'
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
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--item-meta)', lineHeight: 1.6 }}
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
                    background: 'color-mix(in srgb, var(--detail-bg) 25%, transparent)',
                    border: '1px dashed var(--divider)',
                    borderStyle: 'dashed',
                    borderRadius: 10,
                    padding: '16px 12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'opacity 0.15s, background 0.15s',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderStyle = 'solid'
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      'color-mix(in srgb, var(--item-hover-bg) 30%, transparent)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--divider)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderStyle = 'dashed'
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      'color-mix(in srgb, var(--detail-bg) 25%, transparent)'
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
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--item-meta)', lineHeight: 1.6 }}
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
  if (isFileMode && loading) {
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
    // Image
    if (fileKind === 'image') {
      const src = convertFileSrc(fileAbsolutePath)
      return (
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
        </div>
      )
    }

    // PDF
    if (fileKind === 'pdf') {
      const src = convertFileSrc(fileAbsolutePath)
      return (
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
        </div>
      )
    }

    // HTML via iframe
    if (fileKind === 'html' && blobUrl) {
      return (
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
            ref={iframeRef}
            src={blobUrl}
            onLoad={applyThemeToIframe}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
          />
        </div>
      )
    }

    // Other (unsupported) file type
    if (fileKind === 'other') {
      return (
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
        </div>
      )
    }

    // Text file (plain text, not markdown)
    if (fileKind === 'text' && content !== null) {
      return (
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
      )
    }

    // Code file
    if (fileKind === 'code' && content !== null) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      const lang = EXT_TO_LANG[ext]
      return (
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
            <code className={`hljs${lang ? ` language-${lang}` : ''}`}>
              {content}
            </code>
          </pre>
        </div>
      )
    }

    // CSV
    if (fileKind === 'csv' && content !== null) {
      const data = parseCSV(content)
      if (!data) {
        return (
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
          </div>
        )
      }
      return (
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
      )
    }
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
      {showFind && (
        <FindBar
          containerRef={bodyRef}
          onClose={() => {
            CSS.highlights?.delete('search-result')
            CSS.highlights?.delete('search-current')
            setShowFind(false)
          }}
        />
      )}

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
        <span
          style={{
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--item-text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
            marginRight: 12,
          }}
        >
          {isJournalMode && entry ? entry.title : ''}
          {isIdentityMode && identity ? identity.name : ''}
          {isFileMode && file ? file.name : ''}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
        ref={bodyRef}
        style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}
        onContextMenu={(e) => {
          e.preventDefault()
          showContextMenu(e.clientX, e.clientY)
        }}
      >
        {/* Header: summary + tags + sources (journal) */}
        {isJournalMode && entry && (
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
                  marginBottom: (pickDisplayTags(entry.tags, Infinity).length > 0 || entry.sources.length > 0) ? 10 : 0,
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
        {isIdentityMode && identity && (
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
                    (identity.speaker_id || pickDisplayTags(identity.tags, Infinity).length > 0) ? 10 : 0,
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
                      background: 'rgba(255,255,255,0.10)',
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
        {content === null && !loading ? (
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
        mode={
          isJournalMode ? 'journal' : isIdentityMode ? 'identity' : 'file'
        }
        onProcess={
          isJournalMode && onProcess && entry
            ? () => onProcess(entry)
            : undefined
        }
        onVisualDesign={
          isJournalMode && onVisualDesign && entry
            ? () => onVisualDesign(entry)
            : undefined
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
