import React, { useState, useEffect, useRef, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { createMarkdownComponents } from '../lib/markdownComponents'
import { stripFrontmatter } from '../lib/markdownUtils'
import { MarkdownRenderer } from './MarkdownRenderer'
import type { JournalEntry } from '../types'
import { getJournalEntryContent, getWorkspacePath, openFile } from '../lib/tauri'
import { pickDisplayTags } from '../lib/tags'
import { fileKindFromName } from '../lib/fileKind'
import { Spinner } from './Spinner'
import { FindBar } from './FindBar'
import { createTranslator, detectLang } from '../lib/i18n'

// Module-level translator for components that can't use hooks (CodeBlock is defined outside component)
const getT = () => createTranslator(detectLang())

interface DetailPanelProps {
  entry: JournalEntry | null
  entries: JournalEntry[]
  onDeselect: () => void
  onRecord: () => void
  onOpenDock: () => void
  onSelectSample: () => void
  onAddToTodo?: (text: string, source: string) => void
  onProcess?: (entry: JournalEntry) => void
  onVisualDesign?: (entry: JournalEntry) => void
}

// ── Detail context menu ───────────────────────────────────────────────────────
function DetailContextMenu({
  menuRef,
  onProcess,
  onVisualDesign,
  onCopySelection,
  onCopyRaw,
  onAddToTodo,
  onClose,
}: {
  menuRef: React.RefObject<HTMLDivElement | null>
  onProcess: () => void
  onVisualDesign: () => void
  onCopySelection: () => void
  onCopyRaw: () => void
  onAddToTodo: () => void
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
      {/* Process entry */}
      <div
        style={itemStyle}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)')
        }
        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
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
      {/* Visual design book */}
      <div
        style={itemStyle}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)')
        }
        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
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
      <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
      {/* Add to todo */}
      <div
        data-role="add-to-todo"
        style={itemStyle}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)')
        }
        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
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
      {/* Copy raw markdown */}
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

// ── Component ─────────────────────────────────────────────────────────────────
export const DetailPanel = React.memo(function DetailPanel({
  entry,
  entries,
  onDeselect,
  onRecord,
  onOpenDock,
  onSelectSample,
  onAddToTodo,
  onProcess,
  onVisualDesign,
}: DetailPanelProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFind, setShowFind] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!entry) {
      setContent(null)
      setLoading(false)
      return
    }
    CSS.highlights?.delete('search-result')
    CSS.highlights?.delete('search-current')
    setShowFind(false)
    setLoading(true)
    getJournalEntryContent(entry.path).then((c) => {
      setContent(c)
      setLoading(false)
    })
  }, [entry?.path, entry?.mtime_secs])

  // Show/hide context menu imperatively — no state, no re-render, no selection loss
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
    // Adjust if overflowing viewport
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

  // Close on outside click or Escape
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showFind) onDeselect()
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

  const displayTags = entry ? pickDisplayTags(entry.tags, Infinity) : []

  // Memoize markdown DOM so text selection survives parent re-renders
  // Large files (>100KB) use the fast innerHTML-based renderer to avoid
  // creating tens of thousands of React elements.
  const FAST_RENDERER_THRESHOLD = 100_000
  const markdownNode = useMemo(() => {
    if (content === null) return null
    const stripped = stripFrontmatter(content)
    if (stripped.length > FAST_RENDERER_THRESHOLD) {
      return (
        <div className="md-body">
          <MarkdownRenderer content={stripped} entryPath={entry?.path} />
        </div>
      )
    }
    return (
      <div className="md-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeHighlight, { detect: false }]]}
          components={createMarkdownComponents(entry?.path ?? '')}
        >
          {stripped}
        </ReactMarkdown>
      </div>
    )
  }, [content, entry?.path])

  if (!entry) {
    const isEmpty = entries.length === 0
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

            {/* 粘贴卡片 */}
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

            {/* 创建示例卡片：只在工作目录为空时显示 */}
            {isEmpty && (
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
      </div>
    )
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
      {/* Scrollable body */}
      <div
        ref={bodyRef}
        style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}
        onContextMenu={(e) => {
          e.preventDefault()
          showContextMenu(e.clientX, e.clientY)
        }}
      >
        {/* Header: summary + tags */}
        <div
          style={{
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: '0.5px solid var(--divider)',
          }}
        >
          {/* Summary */}
          {entry.summary && (
            <div
              style={{
                fontSize: 'var(--text-base)',
                color: 'var(--detail-summary)',
                lineHeight: 1.8,
                marginBottom: displayTags.length > 0 ? 10 : 0,
              }}
            >
              {entry.summary}
            </div>
          )}

          {(displayTags.length > 0 || entry.sources.length > 0) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {displayTags.map((cfg, i) => (
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

        {/* Markdown content */}
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
        onProcess={() => {
          if (entry && onProcess) onProcess(entry)
        }}
        onVisualDesign={() => {
          if (entry && onVisualDesign) onVisualDesign(entry)
        }}
        onCopySelection={() => {
          const sel = window.getSelection()?.toString()
          if (sel) navigator.clipboard.writeText(sel)
        }}
        onCopyRaw={() => {
          if (content) navigator.clipboard.writeText(content)
        }}
        onAddToTodo={() => {
          const sel = window.getSelection()?.toString()?.trim()
          if (sel && onAddToTodo && entry) onAddToTodo(sel, entry.filename)
        }}
        onClose={hideContextMenu}
      />
    </div>
  )
})
