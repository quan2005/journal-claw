import React, { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check } from 'lucide-react'
import type { IdentityEntry } from '../types'
import { getIdentityContent, saveIdentityContent, getWorkspacePrompt, setWorkspacePrompt } from '../lib/tauri'
import { pickDisplayTags } from '../lib/tags'
import { Spinner } from './Spinner'
import { SOUL_PATH } from './IdentityList'

// ── Helpers ───────────────────────────────────────────────────────────────────
function stripFrontmatter(md: string): string {
  return md.replace(/^---[\s\S]*?---\n?/, '').trim()
}

function extractCodeText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(extractCodeText).join('')
  if (children && typeof children === 'object' && 'props' in (children as object)) {
    const el = children as React.ReactElement<{ children?: React.ReactNode }>
    return extractCodeText(el.props.children)
  }
  return ''
}

// ── Context menu ──────────────────────────────────────────────────────────────
function DetailContextMenu({ menuRef, onCopySelection, onCopyRaw, onClose }: {
  menuRef: React.RefObject<HTMLDivElement | null>
  onCopySelection: () => void
  onCopyRaw: () => void
  onClose: () => void
}) {
  const iconColor = 'var(--item-meta)'
  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 12px', fontSize: 13, cursor: 'pointer',
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
      <div data-role="copy-selection" style={itemStyle}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
        onMouseDown={e => e.preventDefault()}
        onClick={() => { onCopySelection(); onClose() }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        <span>复制选中文本</span>
      </div>
      <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />
      <div style={itemStyle}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--item-hover-bg)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
        onMouseDown={e => e.preventDefault()}
        onClick={() => { onCopyRaw(); onClose() }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/>
        </svg>
        <span>复制全文 (Markdown)</span>
      </div>
    </div>
  )
}

// ── Code block ────────────────────────────────────────────────────────────────
function CodeBlock({ children, rawText }: { className?: string; children?: React.ReactNode; rawText?: string }) {
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(false)
  return (
    <div style={{ position: 'relative', margin: '12px 0' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {(hovered || copied) && (
        <button onClick={() => {
          navigator.clipboard.writeText(rawText ?? '').then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }} style={{
          position: 'absolute', top: 8, right: 8, zIndex: 1,
          background: copied ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: copied ? '#34c759' : 'var(--item-meta)',
          fontSize: 11, padding: '2px 8px', borderRadius: 5, cursor: 'pointer',
          fontFamily: "'IBM Plex Mono', monospace",
          transition: 'color 0.15s, background 0.15s',
          userSelect: 'none',
        }}>
          {copied ? <><Check size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />已复制</> : '复制'}
        </button>
      )}
      <pre style={{
        margin: 0, background: 'var(--md-pre-bg)', borderRadius: 8,
        padding: '10px 14px', overflowX: 'auto', fontSize: 12, lineHeight: 1.7,
        color: 'var(--md-pre-text)', fontFamily: "'IBM Plex Mono', ui-monospace, Menlo, monospace",
      }}>
        {children}
      </pre>
    </div>
  )
}

// ── Syntax-highlight editor (from SoulView) ───────────────────────────────────
function highlightMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    if (/^# /.test(line)) return <div key={i} style={{ color: 'var(--item-text)' }}>{line}</div>
    if (/^## /.test(line)) return <div key={i} style={{ color: 'var(--item-meta)' }}>{line}</div>
    const bulletMatch = line.match(/^(\s*)(- )(.*)/)
    if (bulletMatch) {
      return (
        <div key={i}>
          {bulletMatch[1]}
          <span style={{ color: 'var(--record-btn)' }}>{bulletMatch[2]}</span>
          <span style={{ color: 'var(--md-text, var(--item-meta))' }}>{bulletMatch[3]}</span>
        </div>
      )
    }
    return <div key={i} style={{ color: 'var(--md-text, var(--item-meta))' }}>{line || '\u00A0'}</div>
  })
}

// ── Markdown components (same as DetailPanel) ─────────────────────────────────
const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ children }) => (
    <h1 style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 20, fontWeight: 600, color: 'var(--md-h1)', margin: '0 0 16px', lineHeight: 1.4 }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 15, fontWeight: 600, color: 'var(--md-h2)', margin: '28px 0 10px', lineHeight: 1.5 }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 13, fontWeight: 600, color: 'var(--md-h3)', margin: '20px 0 6px', lineHeight: 1.5 }}>{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--md-h3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '14px 0 5px' }}>{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 style={{ fontSize: 12, fontWeight: 600, color: 'var(--md-h3)', margin: '12px 0 4px' }}>{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 style={{ fontSize: 11, fontWeight: 500, color: 'var(--md-h3)', margin: '10px 0 4px' }}>{children}</h6>
  ),
  p: ({ children }) => (
    <p style={{ fontSize: 13, color: 'var(--md-text)', lineHeight: 1.9, margin: '0 0 10px' }}>{children}</p>
  ),
  ul: ({ children }) => (
    <ul style={{ paddingLeft: 0, margin: '6px 0 10px', display: 'flex', flexDirection: 'column', gap: 3, listStyle: 'none' }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ paddingLeft: 20, margin: '6px 0 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</ol>
  ),
  li: ({ children, ...liProps }) => {
    const ordered = (liProps as { ordered?: boolean }).ordered
    if (ordered) return <li style={{ fontSize: 13, color: 'var(--md-text)', lineHeight: 1.75 }}>{children}</li>
    const isTask = (liProps as { className?: string }).className?.includes('task-list-item')
    if (isTask) {
      const childArray = React.Children.toArray(children)
      return (
        <li style={{ fontSize: 13, color: 'var(--md-text)', lineHeight: 1.75, display: 'flex', alignItems: 'flex-start', listStyle: 'none' }}>
          <span style={{ flexShrink: 0, width: 20, display: 'inline-flex', justifyContent: 'center', marginTop: 5 }}>{childArray[0]}</span>
          <span style={{ flex: 1 }}>{childArray.slice(1)}</span>
        </li>
      )
    }
    return (
      <li style={{ fontSize: 13, color: 'var(--md-text)', lineHeight: 1.75, display: 'flex', alignItems: 'flex-start' }}>
        <span style={{ flexShrink: 0, width: 20, display: 'inline-flex', justifyContent: 'center', marginTop: 8 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: 'var(--md-bullet)' }} />
        </span>
        <span>{children}</span>
      </li>
    )
  },
  strong: ({ children }) => <strong style={{ fontWeight: 600, color: 'var(--md-strong)' }}>{children}</strong>,
  em: ({ children }) => <em style={{ fontStyle: 'italic', color: 'var(--md-em)' }}>{children}</em>,
  code: ({ className, children }) => <code className={className}>{children}</code>,
  pre: ({ children }) => {
    const codeEl = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>
    const rawText = extractCodeText(codeEl?.props?.children)
    return <CodeBlock className={codeEl?.props?.className} rawText={rawText}>{children}</CodeBlock>
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="md-link" style={{ cursor: 'pointer' }}>{children}</a>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{ borderLeft: '3px solid var(--md-quote-bar)', paddingLeft: 12, margin: '8px 0', color: 'var(--md-quote-text)' }}>{children}</blockquote>
  ),
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--divider)', margin: '16px 0' }} />,
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '10px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--md-h3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--divider)', whiteSpace: 'nowrap', minWidth: 72 }}>{children}</th>
  ),
  td: ({ children }) => (
    <td style={{ padding: '5px 10px', color: 'var(--md-text)', lineHeight: 1.6, verticalAlign: 'top', borderBottom: '1px solid var(--divider)', minWidth: 72 }}>{children}</td>
  ),
}

// ── Main component ────────────────────────────────────────────────────────────
interface IdentityDetailProps {
  identity: IdentityEntry | null
}

export function IdentityDetail({ identity }: IdentityDetailProps) {
  const [content, setContent] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)

  const isSoul = identity?.path === SOUL_PATH

  // Load content
  useEffect(() => {
    if (!identity) { setContent(null); setEditing(false); return }
    setContent(null)
    setEditing(false)
    if (isSoul) {
      getWorkspacePrompt().then(setContent)
    } else {
      getIdentityContent(identity.path).then(setContent)
    }
  }, [identity?.path, (identity as IdentityEntry | null)?.mtime_secs])

  // Save
  const save = useCallback(async (text: string) => {
    if (!identity) return
    setSaveStatus('saving')
    try {
      if (isSoul) {
        await setWorkspacePrompt(text)
      } else {
        await saveIdentityContent(identity.path, text)
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2000)
    } catch (e) {
      console.error('[IdentityDetail] save failed', e)
      setSaveStatus('error')
    }
  }, [identity, isSoul])

  const handleEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setEditText(text)
    setSaveStatus('idle')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(text), 800)
  }

  const handleEditorScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  const enterEdit = () => {
    setEditText(content ?? '')
    setSaveStatus('idle')
    setEditing(true)
  }

  const exitEdit = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    save(editText).then(() => {
      setContent(editText)
      setEditing(false)
    })
  }

  // Context menu (read mode)
  const showContextMenu = (x: number, y: number) => {
    const el = ctxMenuRef.current
    if (!el) return
    const hasSelection = !!window.getSelection()?.toString()
    const copySelItem = el.querySelector('[data-role="copy-selection"]') as HTMLDivElement | null
    if (copySelItem) {
      copySelItem.style.opacity = hasSelection ? '1' : '0.35'
      copySelItem.style.cursor = hasSelection ? 'pointer' : 'default'
      copySelItem.style.pointerEvents = hasSelection ? 'auto' : 'none'
    }
    el.style.display = 'block'
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    const rect = el.getBoundingClientRect()
    if (rect.right > window.innerWidth) el.style.left = `${Math.max(4, window.innerWidth - rect.width - 8)}px`
    if (rect.bottom > window.innerHeight) el.style.top = `${Math.max(4, window.innerHeight - rect.height - 8)}px`
  }

  const hideContextMenu = () => {
    const el = ctxMenuRef.current
    if (el) el.style.display = 'none'
  }

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) hideContextMenu()
    }
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') hideContextMenu() }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  // Empty state
  if (!identity) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--detail-bg)', color: 'var(--item-meta)', fontSize: 13, userSelect: 'none',
      }}>
        选择一个身份档案
      </div>
    )
  }

  const displayTags = pickDisplayTags(identity.tags, Infinity)
  const bodyContent = content ? stripFrontmatter(content) : null

  const editorFont = "'IBM Plex Mono', ui-monospace, monospace"
  const editorFontSize = 12
  const editorLineHeight = 1.7

  const btnStyle: React.CSSProperties = {
    position: 'absolute', top: 16, right: 20, zIndex: 10,
    padding: '4px 14px', borderRadius: 6,
    border: '1px solid var(--divider)',
    background: 'transparent', color: 'var(--item-meta)',
    fontSize: 11, cursor: 'pointer',
    minWidth: 48, textAlign: 'center',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--detail-bg)', overflow: 'hidden', position: 'relative' }}>

      {/* Fixed top-right button — same position for both modes */}
      {editing ? (
        <button
          onClick={exitEdit}
          disabled={saveStatus === 'saving'}
          style={{
            ...btnStyle,
            background: saveStatus === 'saving' ? 'var(--divider)' : 'transparent',
            cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
          }}
        >
          {saveStatus === 'saving' ? '保存中…' : '保存'}
        </button>
      ) : (
        <button
          onClick={enterEdit}
          style={btnStyle}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--item-text)'}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--item-meta)'}
        >
          编辑
        </button>
      )}

      {/* Edit mode */}
      {editing ? (
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <div ref={backdropRef} aria-hidden style={{
            position: 'absolute', inset: 0,
            background: 'var(--detail-case-bg)',
            padding: '16px 28px',
            fontFamily: editorFont, fontSize: editorFontSize, lineHeight: editorLineHeight,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            pointerEvents: 'none', overflowY: 'auto',
          }}>
            {highlightMarkdown(editText)}
          </div>
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={handleEditChange}
            onScroll={handleEditorScroll}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              background: 'transparent', border: 'none', borderRadius: 0,
              padding: '16px 28px',
              fontFamily: editorFont, fontSize: editorFontSize, lineHeight: editorLineHeight,
              color: 'transparent', caretColor: 'var(--item-text)', cursor: 'text',
              resize: 'none', outline: 'none', boxSizing: 'border-box', overflowY: 'auto',
            }}
            spellCheck={false}
            autoFocus
          />
        </div>
      ) : (
        /* Read mode */
        <div
          ref={bodyRef}
          style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}
          onContextMenu={e => { e.preventDefault(); showContextMenu(e.clientX, e.clientY) }}
        >
          {/* Header: summary + tags */}
          <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '0.5px solid var(--divider)', paddingRight: 70 }}>
            {identity.summary && (
              <div style={{
                fontSize: 12, color: 'var(--detail-summary)', lineHeight: 1.8,
                marginBottom: displayTags.length > 0 ? 10 : 0,
              }}>
                {identity.summary}
              </div>
            )}
            {displayTags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {displayTags.map((cfg, i) => (
                  <span key={i} style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4,
                    fontWeight: 500, color: cfg.color, background: cfg.bg,
                    fontFamily: "'IBM Plex Mono', monospace", whiteSpace: 'nowrap',
                  }}>
                    {cfg.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Body */}
          {content === null ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
              <Spinner size={20} />
            </div>
          ) : bodyContent ? (
            <div className="md-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[[rehypeHighlight, { detect: false }]]}
                components={mdComponents}
              >
                {bodyContent}
              </ReactMarkdown>
            </div>
          ) : (
            <div style={{ color: 'var(--item-meta)', fontSize: 12 }}>暂无内容</div>
          )}
        </div>
      )}

      <DetailContextMenu
        menuRef={ctxMenuRef}
        onCopySelection={() => {
          const sel = window.getSelection()?.toString()
          if (sel) navigator.clipboard.writeText(sel)
        }}
        onCopyRaw={() => {
          if (content) navigator.clipboard.writeText(content)
        }}
        onClose={hideContextMenu}
      />
    </div>
  )
}
