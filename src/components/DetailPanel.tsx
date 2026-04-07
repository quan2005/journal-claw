import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check } from 'lucide-react'
import type { JournalEntry } from '../types'
import { getJournalEntryContent } from '../lib/tauri'
import { pickDisplayTags } from '../lib/tags'
import { Spinner } from './Spinner'
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
}

// ── Detail context menu ───────────────────────────────────────────────────────
function DetailContextMenu({ menuRef, onCopySelection, onCopyRaw, onAddToTodo, onClose }: {
  menuRef: React.RefObject<HTMLDivElement | null>
  onCopySelection: () => void
  onCopyRaw: () => void
  onAddToTodo: () => void
  onClose: () => void
}) {
  const iconColor = 'var(--item-meta)'
  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 12px', fontSize: 'var(--text-sm)', cursor: 'pointer',
    color: 'var(--item-text)',
  }

  return (
    <div ref={menuRef} style={{
      position: 'fixed', top: 0, left: 0, zIndex: 9999,
      background: 'var(--context-menu-bg)',
      border: '1px solid var(--context-menu-border)',
      borderRadius: 8,
      boxShadow: '0 4px 20px var(--context-menu-shadow)',
      minWidth: 160, overflow: 'hidden',
      padding: '4px 0',
      display: 'none',
    }}>
      {/* Add to todo */}
      <div data-role="add-to-todo" style={itemStyle}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
        onMouseDown={e => e.preventDefault()}
        onClick={() => { onAddToTodo(); onClose() }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <span>{getT()('addToTodo')}</span>
      </div>
      <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
      {/* Copy selection */}
      <div data-role="copy-selection" style={itemStyle}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
        onMouseDown={e => e.preventDefault()}
        onClick={() => { onCopySelection(); onClose() }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        <span>{getT()('copySelected')}</span>
      </div>
      <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
      {/* Copy raw markdown */}
      <div style={itemStyle}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
        onMouseDown={e => e.preventDefault()}
        onClick={() => { onCopyRaw(); onClose() }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/>
        </svg>
        <span>{getT()('copyMarkdown')}</span>
      </div>
    </div>
  )
}

// ── Code block with copy button ───────────────────────────────────────────────
function CodeBlock({ children, rawText }: { className?: string; children?: React.ReactNode; rawText?: string }) {
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText ?? '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div
      style={{ position: 'relative', margin: '12px 0' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {(hovered || copied) && (
        <button
          onClick={handleCopy}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
            background: copied ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: copied ? '#34c759' : 'var(--item-meta)',
            fontSize: 'var(--text-xs)',
            padding: '2px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            transition: 'color 0.15s, background 0.15s',
            userSelect: 'none',
          }}
        >
          {copied ? <><Check size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{getT()('copied')}</> : getT()('copy')}
        </button>
      )}
      <pre style={{
        margin: 0,
        background: 'var(--md-pre-bg)',
        borderRadius: 8,
        padding: '10px 14px',
        overflowX: 'auto',
        fontSize: 'var(--text-base)',
        lineHeight: 1.7,
        color: 'var(--md-pre-text)',
        fontFamily: 'var(--font-mono)',
      }}>
        {children}
      </pre>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export function DetailPanel({ entry, entries, onDeselect, onRecord, onOpenDock, onSelectSample, onAddToTodo }: DetailPanelProps) {
  const [content, setContent] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!entry) { setContent(null); return }
    setContent(null)
    getJournalEntryContent(entry.path).then(setContent)
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
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onDeselect() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onDeselect])

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

  if (!entry) {
    const isEmpty = entries.length === 0
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--detail-bg)',
        userSelect: 'none',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Watermark */}
        <span style={{
          fontSize: '84vh',
          fontWeight: 900,
          letterSpacing: '0.06em',
          color: 'var(--item-text)',
          opacity: 0.035,
          lineHeight: 1,
          fontFamily: '"Noto Serif SC", "Source Han Serif SC", "Source Han Serif CN", "STSong", "SimSun", "Songti SC", serif',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          position: 'absolute',
        }}>
          谨迹
        </span>

        <div style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          padding: '0 32px',
          width: '100%',
          maxWidth: 520,
        }}>
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--item-meta)', letterSpacing: '0.04em', opacity: 0.6 }}>
            通过以下方式开始记录
          </div>
          <div style={{ display: 'flex', gap: 12, width: '100%' }}>
            {/* 录音卡片 */}
            <button
              onClick={onRecord}
              style={{
                flex: 1, background: 'var(--detail-bg)', border: '1px solid var(--divider)',
                borderRadius: 10, padding: '16px 12px', textAlign: 'center', cursor: 'pointer',
                transition: 'opacity 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--item-meta)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--item-hover-bg)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--divider)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--detail-bg)' }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--item-icon-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--item-meta)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                  <path d="M19 10a7 7 0 0 1-14 0"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                  <line x1="8" y1="22" x2="16" y2="22"/>
                </svg>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--item-text)', fontWeight: 'var(--font-semibold)', marginBottom: 4 }}>录音记录</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--item-meta)', lineHeight: 1.6 }}>说出你的想法<br/>AI 自动整理成日志</div>
            </button>

            {/* 粘贴卡片 */}
            <button
              onClick={onOpenDock}
              style={{
                flex: 1, background: 'var(--detail-bg)', border: '1px solid var(--divider)',
                borderRadius: 10, padding: '16px 12px', textAlign: 'center', cursor: 'pointer',
                transition: 'opacity 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--item-meta)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--item-hover-bg)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--divider)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--detail-bg)' }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--item-icon-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--item-meta)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--item-text)', fontWeight: 'var(--font-semibold)', marginBottom: 4 }}>粘贴 / 拖文件</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--item-meta)', lineHeight: 1.6 }}>会议记录、日记<br/>AI 自动提炼关键信息</div>
            </button>

            {/* 创建示例卡片：只在工作目录为空时显示 */}
            {isEmpty && (
              <button
                onClick={onSelectSample}
                style={{
                  flex: 1, background: 'var(--detail-bg)',
                  border: '1px dashed var(--divider)', borderStyle: 'dashed',
                  borderRadius: 10, padding: '16px 12px', textAlign: 'center', cursor: 'pointer',
                  transition: 'opacity 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.borderStyle = 'solid'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--item-hover-bg)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--divider)'; (e.currentTarget as HTMLButtonElement).style.borderStyle = 'dashed'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--detail-bg)' }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--item-icon-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--item-meta)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a7 7 0 0 1 7 7c0 4-3 6-4 8H9c-1-2-4-4-4-8a7 7 0 0 1 7-7z"/>
                    <line x1="9" y1="21" x2="15" y2="21"/>
                    <line x1="10" y1="17" x2="14" y2="17"/>
                  </svg>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--item-text)', fontWeight: 'var(--font-semibold)', marginBottom: 4 }}>创建示例条目</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--item-meta)', lineHeight: 1.6 }}>生成一条示例<br/>了解 AI 整理效果</div>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--detail-bg)',
    }}>
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
        <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '0.5px solid var(--divider)' }}>
          {/* Summary */}
          {entry.summary && (
            <div style={{
              fontSize: 'var(--text-base)',
              color: 'var(--detail-summary)',
              lineHeight: 1.8,
              marginBottom: displayTags.length > 0 ? 10 : 0,
            }}>
              {entry.summary}
            </div>
          )}

          {displayTags.length > 0 && (
            <div style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
            }}>
              {displayTags.map((cfg, i) => (
                <span key={i} style={{
                  fontSize: 'var(--text-xs)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontWeight: 'var(--font-medium)',
                  color: cfg.color,
                  background: cfg.bg,
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}>
                  {cfg.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Markdown content */}
        {content === null ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
            <Spinner size={20} />
          </div>
        ) : (
          <div className="md-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[[rehypeHighlight, { detect: false }]]}
              components={{
                // Headings
                h1: ({ children }) => (
                  <h1 style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 'var(--text-xl)', fontWeight: 'var(--font-semibold)', color: 'var(--md-h1)', margin: '0 0 16px', lineHeight: 1.4,
                  }}>{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', color: 'var(--md-h2)', margin: '28px 0 10px', lineHeight: 1.5,
                  }}>{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 'var(--text-md)', fontWeight: 'var(--font-semibold)', color: 'var(--md-h3)', margin: '20px 0 6px', lineHeight: 1.5,
                  }}>{children}</h3>
                ),
                h4: ({ children }) => (
                  <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--md-h3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '14px 0 5px' }}>{children}</h4>
                ),
                h5: ({ children }) => (
                  <h5 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--md-h3)', margin: '12px 0 4px' }}>{children}</h5>
                ),
                h6: ({ children }) => (
                  <h6 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--md-h3)', margin: '10px 0 4px' }}>{children}</h6>
                ),
                // Paragraph
                p: ({ children }) => (
                  <p style={{ fontSize: 'var(--text-md)', color: 'var(--md-text)', lineHeight: 1.9, margin: '0 0 10px' }}>{children}</p>
                ),
                // Lists
                ul: ({ children }) => (
                  <ul style={{ paddingLeft: 0, margin: '6px 0 10px', display: 'flex', flexDirection: 'column', gap: 3, listStyle: 'none' }}>{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol style={{ paddingLeft: 20, margin: '6px 0 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</ol>
                ),
                li: ({ children, ...liProps }) => {
                  const ordered = (liProps as { ordered?: boolean }).ordered
                  if (ordered) {
                    return <li style={{ fontSize: 'var(--text-md)', color: 'var(--md-text)', lineHeight: 1.75 }}>{children}</li>
                  }
                  const isTask = (liProps as { className?: string }).className?.includes('task-list-item')
                  if (isTask) {
                    const childArray = React.Children.toArray(children)
                    const checkbox = childArray[0]
                    const rest = childArray.slice(1)
                    return (
                      <li style={{ fontSize: 'var(--text-md)', color: 'var(--md-text)', lineHeight: 1.75, display: 'flex', alignItems: 'flex-start', listStyle: 'none' }}>
                        <span style={{ flexShrink: 0, width: 20, display: 'inline-flex', justifyContent: 'center', marginTop: 5 }}>{checkbox}</span>
                        <span style={{ flex: 1 }}>{rest}</span>
                      </li>
                    )
                  }
                  return (
                    <li style={{ fontSize: 'var(--text-md)', color: 'var(--md-text)', lineHeight: 1.75, display: 'flex', alignItems: 'flex-start' }}>
                      <span style={{ flexShrink: 0, width: 20, display: 'inline-flex', justifyContent: 'center', marginTop: 8 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--md-bullet)' }} />
                      </span>
                      <span>{children}</span>
                    </li>
                  )
                },
                // Inline
                strong: ({ children }) => (
                  <strong style={{ fontWeight: 'var(--font-semibold)', color: 'var(--md-strong)' }}>{children}</strong>
                ),
                em: ({ children }) => (
                  <em style={{ fontStyle: 'italic', color: 'var(--md-em)' }}>{children}</em>
                ),
                code: ({ className, children }) => {
                  return <code className={className}>{children}</code>
                },
                pre: ({ children }) => {
                  const codeEl = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>
                  const rawText = extractCodeText(codeEl?.props?.children)
                  return (
                    <CodeBlock className={codeEl?.props?.className} rawText={rawText}>
                      {children}
                    </CodeBlock>
                  )
                },
                // Links
                a: ({ href, children }) => {
                  const isMdLink = href && /\.md$/i.test(href) && !href.startsWith('http')
                  return (
                    <a
                      href={isMdLink ? undefined : href}
                      target={isMdLink ? undefined : '_blank'}
                      rel={isMdLink ? undefined : 'noopener noreferrer'}
                      className="md-link"
                      onClick={isMdLink ? (e) => {
                        e.preventDefault()
                        const decodedHref = decodeURIComponent(href!)
                        const entryDir = entry!.path.substring(0, entry!.path.lastIndexOf('/'))
                        const targetPath = resolveRelativePath(entryDir, decodedHref)
                        const targetFilename = targetPath.substring(targetPath.lastIndexOf('/') + 1)
                        window.dispatchEvent(new CustomEvent('journal-entry-navigate', {
                          detail: { path: targetPath, filename: targetFilename },
                        }))
                      } : undefined}
                      style={{ cursor: 'pointer' }}
                    >
                      {children}
                    </a>
                  )
                },
                // Blockquote
                blockquote: ({ children }) => (
                  <blockquote style={{
                    borderLeft: '3px solid var(--md-quote-bar)',
                    paddingLeft: 12,
                    margin: '8px 0',
                    color: 'var(--md-quote-text)',
                  }}>
                    {children}
                  </blockquote>
                ),
                // HR
                hr: () => (
                  <hr style={{ border: 'none', borderTop: '1px solid var(--divider)', margin: '16px 0' }} />
                ),
                // Table
                table: ({ children }) => (
                  <div style={{ overflowX: 'auto', margin: '10px 0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-base)' }}>{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th style={{
                    padding: '6px 10px', textAlign: 'left', fontWeight: 'var(--font-semibold)',
                    fontSize: 'var(--text-sm)', color: 'var(--md-h3)', textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: '2px solid var(--divider)', whiteSpace: 'nowrap',
                    minWidth: 72,
                  }}>{children}</th>
                ),
                td: ({ children }) => (
                  <td style={{
                    padding: '5px 10px', color: 'var(--md-text)', lineHeight: 1.6,
                    verticalAlign: 'top', borderBottom: '1px solid var(--divider)',
                    minWidth: 72,
                  }}>{children}</td>
                ),
              }}
            >
              {stripFrontmatter(content)}
            </ReactMarkdown>
          </div>
        )}
      </div>

      <DetailContextMenu
        menuRef={ctxMenuRef}
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
}

function resolveRelativePath(baseDir: string, relative: string): string {
  const parts = baseDir.split('/')
  for (const segment of relative.split('/')) {
    if (segment === '..') parts.pop()
    else if (segment !== '.') parts.push(segment)
  }
  return parts.join('/')
}

function stripFrontmatter(md: string): string {
  return md.replace(/^---[\s\S]*?---\n?/, '').trim()
}

// Extract plain text from React children (used for clipboard copy)
function extractCodeText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(extractCodeText).join('')
  if (children && typeof children === 'object' && 'props' in (children as object)) {
    const el = children as React.ReactElement<{ children?: React.ReactNode }>
    return extractCodeText(el.props.children)
  }
  return ''
}
