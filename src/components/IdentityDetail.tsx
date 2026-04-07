import React, { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check, ChevronUp, ChevronDown, X } from 'lucide-react'
import type { IdentityEntry } from '../types'
import { getIdentityContent, saveIdentityContent, getWorkspacePrompt, setWorkspacePrompt, resetWorkspacePrompt } from '../lib/tauri'
import { ask } from '@tauri-apps/plugin-dialog'
import { pickDisplayTags } from '../lib/tags'
import { Spinner } from './Spinner'
import { SOUL_PATH } from './IdentityList'
import { createTranslator, detectLang } from '../lib/i18n'
import { useTranslation } from '../contexts/I18nContext'

// Module-level translator for sub-components that can't use hooks
const getT = () => createTranslator(detectLang())

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
          fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 5, cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          transition: 'color 0.15s, background 0.15s',
          userSelect: 'none',
        }}>
          {copied ? <><Check size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{getT()('copied')}</> : getT()('copy')}
        </button>
      )}
      <pre style={{
        margin: 0, background: 'var(--md-pre-bg)', borderRadius: 8,
        padding: '10px 14px', overflowX: 'auto', fontSize: 'var(--text-base)', lineHeight: 1.7,
        color: 'var(--md-pre-text)', fontFamily: 'var(--font-mono)',
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

// ── Search / Replace bar ─────────────────────────────────────────────────────
interface SearchBarProps {
  text: string
  showReplace: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onReplace: (newText: string) => void
  onClose: () => void
  onToggleReplace: () => void
}

function SearchBar({ text, showReplace, textareaRef, onReplace, onClose, onToggleReplace }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [replaceVal, setReplaceVal] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Find all match positions
  const matches: number[] = React.useMemo(() => {
    if (!query) return []
    const positions: number[] = []
    const lower = text.toLowerCase()
    const q = query.toLowerCase()
    let idx = 0
    while ((idx = lower.indexOf(q, idx)) !== -1) {
      positions.push(idx)
      idx += 1
    }
    return positions
  }, [text, query])

  // Clamp matchIndex
  useEffect(() => {
    if (matches.length > 0 && matchIndex >= matches.length) setMatchIndex(0)
  }, [matches.length, matchIndex])

  // Select current match in textarea
  useEffect(() => {
    if (!query || matches.length === 0 || !textareaRef.current) return
    const pos = matches[matchIndex]
    if (pos === undefined) return
    textareaRef.current.focus()
    textareaRef.current.setSelectionRange(pos, pos + query.length)
  }, [matches, matchIndex, query, textareaRef])

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  const goNext = () => setMatchIndex(i => matches.length ? (i + 1) % matches.length : 0)
  const goPrev = () => setMatchIndex(i => matches.length ? (i - 1 + matches.length) % matches.length : 0)

  const replaceCurrent = () => {
    if (!query || matches.length === 0) return
    const pos = matches[matchIndex]
    if (pos === undefined) return
    const newText = text.slice(0, pos) + replaceVal + text.slice(pos + query.length)
    onReplace(newText)
  }

  const replaceAll = () => {
    if (!query || matches.length === 0) return
    const newText = text.split(query).join(replaceVal)
    onReplace(newText)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); goNext() }
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); goPrev() }
  }

  const smallBtn: React.CSSProperties = {
    background: 'transparent', border: 'none', color: 'var(--item-meta)',
    cursor: 'pointer', padding: '2px 4px', borderRadius: 4, display: 'flex', alignItems: 'center',
  }
  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--divider)',
    borderRadius: 4, padding: '3px 8px', fontSize: 'var(--text-xs)', color: 'var(--item-text)',
    outline: 'none', fontFamily: 'var(--font-mono)', flex: 1, minWidth: 0,
  }
  const actionBtn: React.CSSProperties = {
    background: 'transparent', border: '1px solid var(--divider)',
    borderRadius: 4, padding: '2px 8px', fontSize: 'var(--text-xs)', color: 'var(--item-meta)',
    cursor: 'pointer', whiteSpace: 'nowrap',
  }

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, zIndex: 20,
      background: 'var(--detail-bg)', border: '1px solid var(--divider)',
      borderTop: 'none', borderRight: 'none',
      borderRadius: '0 0 0 8px',
      padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      minWidth: 300,
    }}>
      {/* Search row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setMatchIndex(0) }}
          onKeyDown={handleKeyDown}
          placeholder={getT()('search')}
          style={inputStyle}
        />
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--item-meta)', whiteSpace: 'nowrap', minWidth: 36, textAlign: 'center' }}>
          {query ? `${matches.length ? matchIndex + 1 : 0}/${matches.length}` : ''}
        </span>
        <button onClick={goPrev} style={smallBtn} title={getT()('findPrev')}>
          <ChevronUp size={14} />
        </button>
        <button onClick={goNext} style={smallBtn} title={getT()('findNext')}>
          <ChevronDown size={14} />
        </button>
        {!showReplace && (
          <button onClick={onToggleReplace} style={{ ...smallBtn, fontSize: 'var(--text-xs)' }} title={getT()('replaceBtn')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
            </svg>
          </button>
        )}
        <button onClick={onClose} style={smallBtn} title={getT()('closeFindBar')}>
          <X size={14} />
        </button>
      </div>
      {/* Replace row */}
      {showReplace && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            value={replaceVal}
            onChange={e => setReplaceVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getT()('replacePlaceholder')}
            style={inputStyle}
          />
          <button onClick={replaceCurrent} style={actionBtn}>{getT()('replaceBtn')}</button>
          <button onClick={replaceAll} style={actionBtn}>{getT()('replaceAll')}</button>
        </div>
      )}
    </div>
  )
}

// ── Markdown components (same as DetailPanel) ─────────────────────────────────
const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ children }) => (
    <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--md-h1)', margin: '0 0 16px', lineHeight: 1.4 }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--md-h2)', margin: '28px 0 10px', lineHeight: 1.5 }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--md-h3)', margin: '20px 0 6px', lineHeight: 1.5 }}>{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--md-h3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '14px 0 5px' }}>{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--md-h3)', margin: '12px 0 4px' }}>{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--md-h3)', margin: '10px 0 4px' }}>{children}</h6>
  ),
  p: ({ children }) => (
    <p style={{ fontSize: 'var(--text-md)', color: 'var(--md-text)', lineHeight: 1.9, margin: '0 0 10px' }}>{children}</p>
  ),
  ul: ({ children }) => (
    <ul style={{ paddingLeft: 0, margin: '6px 0 10px', display: 'flex', flexDirection: 'column', gap: 3, listStyle: 'none' }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ paddingLeft: 20, margin: '6px 0 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</ol>
  ),
  li: ({ children, ...liProps }) => {
    const ordered = (liProps as { ordered?: boolean }).ordered
    if (ordered) return <li style={{ fontSize: 'var(--text-md)', color: 'var(--md-text)', lineHeight: 1.75 }}>{children}</li>
    const isTask = (liProps as { className?: string }).className?.includes('task-list-item')
    if (isTask) {
      const childArray = React.Children.toArray(children)
      return (
        <li style={{ fontSize: 'var(--text-md)', color: 'var(--md-text)', lineHeight: 1.75, display: 'flex', alignItems: 'flex-start', listStyle: 'none' }}>
          <span style={{ flexShrink: 0, width: 20, display: 'inline-flex', justifyContent: 'center', marginTop: 5 }}>{childArray[0]}</span>
          <span style={{ flex: 1 }}>{childArray.slice(1)}</span>
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
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-base)' }}>{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--md-h3)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--divider)', whiteSpace: 'nowrap', minWidth: 72 }}>{children}</th>
  ),
  td: ({ children }) => (
    <td style={{ padding: '5px 10px', color: 'var(--md-text)', lineHeight: 1.6, verticalAlign: 'top', borderBottom: '1px solid var(--divider)', minWidth: 72 }}>{children}</td>
  ),
}

// ── Main component ────────────────────────────────────────────────────────────
interface IdentityDetailProps {
  identity: IdentityEntry | null
  onRecord?: () => void
  onOpenDock?: () => void
}

export function IdentityDetail({ identity, onRecord, onOpenDock }: IdentityDetailProps) {
  const { t } = useTranslation()
  const [content, setContent] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [btnCooldown, setBtnCooldown] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)

  const isSoul = identity?.path === SOUL_PATH

  // Load content (skip when editing — mtime changes from our own saves)
  useEffect(() => {
    if (!identity) { setContent(null); setEditing(false); return }
    if (editing) return
    setContent(null)
    if (isSoul) {
      getWorkspacePrompt().then(setContent)
    } else {
      getIdentityContent(identity.path).then(setContent)
    }
  }, [identity?.path, identity?.mtime_secs])

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
    setShowSearch(false)
    setShowReplace(false)
    save(editText).then(() => {
      setContent(editText)
      setEditing(false)
    })
  }

  // Cmd+E to enter edit mode (read mode)
  useEffect(() => {
    if (editing || !identity) return
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        enterEdit()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [editing, identity, content])

  // Cmd+F / Cmd+R / Cmd+S in edit mode; Escape cancels edit (no save)
  useEffect(() => {
    if (!editing) return
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault()
        setShowSearch(true)
        setShowReplace(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        exitEdit()
      }
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        e.preventDefault()
        if (showSearch) {
          setShowSearch(false)
          setShowReplace(false)
          textareaRef.current?.focus()
        } else {
          // Cancel: discard changes, no save
          if (debounceRef.current) clearTimeout(debounceRef.current)
          setShowSearch(false)
          setShowReplace(false)
          setEditing(false)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [editing, showSearch, editText])

  const handleSearchReplace = (newText: string) => {
    setEditText(newText)
    setSaveStatus('idle')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(newText), 800)
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
          {(onRecord || onOpenDock) && (
            <div style={{ display: 'flex', gap: 12, width: '100%' }}>
              {onRecord && (
                <button
                  onClick={onRecord}
                  style={{
                    flex: 1, background: 'var(--detail-bg)', border: '1px solid var(--divider)',
                    borderRadius: 10, padding: '16px 12px', textAlign: 'center', cursor: 'pointer',
                    transition: 'border-color 0.15s, background 0.15s',
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
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--item-text)', fontWeight: 600, marginBottom: 4 }}>录音记录</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--item-meta)', lineHeight: 1.6 }}>说出你的想法<br/>AI 自动整理成日志</div>
                </button>
              )}
              {onOpenDock && (
                <button
                  onClick={onOpenDock}
                  style={{
                    flex: 1, background: 'var(--detail-bg)', border: '1px solid var(--divider)',
                    borderRadius: 10, padding: '16px 12px', textAlign: 'center', cursor: 'pointer',
                    transition: 'border-color 0.15s, background 0.15s',
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
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--item-text)', fontWeight: 600, marginBottom: 4 }}>粘贴 / 拖文件</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--item-meta)', lineHeight: 1.6 }}>会议记录、日记<br/>AI 自动提炼关键信息</div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const displayTags = pickDisplayTags(identity.tags, Infinity)
  const bodyContent = content ? stripFrontmatter(content) : null

  const editorFont = 'var(--font-mono)'
  const editorFontSize = 'var(--text-md)'
  const editorLineHeight = 1.3

  const btnStyle: React.CSSProperties = {
    padding: '4px 14px', borderRadius: 6,
    border: '1px solid var(--divider)',
    background: 'transparent', color: 'var(--item-meta)',
    fontSize: 'var(--text-xs)', cursor: 'pointer',
    minWidth: 48, textAlign: 'center',
    transition: 'color 0.15s, background 0.15s, border-color 0.15s',
  }

  const handleBtnClick = (action: () => void) => {
    if (btnCooldown) return
    setBtnCooldown(true)
    action()
    setTimeout(() => setBtnCooldown(false), 600)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--detail-bg)', overflow: 'hidden', position: 'relative' }}>

      {/* Toolbar with title + button */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 20px', flexShrink: 0,
        borderBottom: '0.5px solid var(--divider)',
      }}>
        <span style={{
          fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--item-text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          minWidth: 0, marginRight: 12,
        }}>
          {identity.name}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {editing ? (
            <>
              <button
                onClick={() => handleBtnClick(() => {
                  if (debounceRef.current) clearTimeout(debounceRef.current)
                  setShowSearch(false)
                  setShowReplace(false)
                  setEditing(false)
                })}
                disabled={btnCooldown}
                style={{ ...btnStyle, opacity: btnCooldown ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 5 }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--item-text)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--item-meta)'}
              >
                <span style={{ fontSize: 'var(--text-xs)', opacity: 0.5 }}>ESC</span>
                取消
              </button>
              <button
                onClick={() => handleBtnClick(exitEdit)}
                disabled={saveStatus === 'saving' || btnCooldown}
                style={{
                  ...btnStyle,
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: saveStatus === 'saving' ? 'var(--divider)' : 'transparent',
                  cursor: (saveStatus === 'saving' || btnCooldown) ? 'not-allowed' : 'pointer',
                  opacity: btnCooldown ? 0.5 : 1,
                }}
                onMouseDown={e => {
                  if (!btnCooldown) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'
                }}
                onMouseUp={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
              >
                <span style={{ fontSize: 'var(--text-xs)', opacity: 0.5 }}>⌘S</span>
                {saveStatus === 'saving' ? t('saving') : t('save')}
              </button>
            </>
          ) : (
            <>
              {isSoul && (
                <button
                  onClick={() => {
                    ask(t('confirmResetAssistant'), { title: t('resetAssistantTitle'), kind: 'warning', okLabel: t('reset'), cancelLabel: t('cancel') }).then(yes => {
                      if (!yes) return
                      handleBtnClick(async () => {
                        const defaultContent = await resetWorkspacePrompt()
                        setContent(defaultContent)
                      })
                    })
                  }}
                  disabled={btnCooldown}
                  style={{ ...btnStyle, opacity: btnCooldown ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 4 }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--item-text)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--item-meta)'}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                  </svg>
                  {t('reset')}
                </button>
              )}
              <button
                onClick={() => handleBtnClick(enterEdit)}
                disabled={btnCooldown}
                style={{ ...btnStyle, opacity: btnCooldown ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 5 }}
                onMouseDown={e => {
                  if (!btnCooldown) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'
                }}
                onMouseUp={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--item-text)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--item-meta)'}
              >
                <span style={{ fontSize: 'var(--text-xs)', opacity: 0.5 }}>⌘E</span>
                {t('edit')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit mode */}
      {editing ? (
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          {showSearch && (
            <SearchBar
              text={editText}
              showReplace={showReplace}
              textareaRef={textareaRef}
              onReplace={handleSearchReplace}
              onClose={() => { setShowSearch(false); setShowReplace(false) }}
              onToggleReplace={() => setShowReplace(true)}
            />
          )}
          <div ref={backdropRef} aria-hidden style={{
            position: 'absolute', inset: 0,
            background: 'var(--detail-bg)',
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
              wordBreak: 'break-word',
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
          <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '0.5px solid var(--divider)' }}>
            {identity.summary && (
              <div style={{
                fontSize: 'var(--text-base)', color: 'var(--detail-summary)', lineHeight: 1.8,
                marginBottom: displayTags.length > 0 ? 10 : 0,
              }}>
                {identity.summary}
              </div>
            )}
            {(identity.speaker_id || displayTags.length > 0) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {identity.speaker_id && (
                  <span style={{
                    fontSize: 'var(--text-xs)', padding: '2px 9px', borderRadius: 4,
                    fontWeight: 500, color: 'var(--item-meta)', background: 'rgba(255,255,255,0.10)',
                    fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                    {identity.speaker_id}
                  </span>
                )}
                {displayTags.map((cfg, i) => (
                  <span key={i} style={{
                    fontSize: 'var(--text-xs)', padding: '2px 9px', borderRadius: 4,
                    fontWeight: 500, color: cfg.color, background: cfg.bg,
                    fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
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
            <div style={{ color: 'var(--item-meta)', fontSize: 'var(--text-base)' }}>暂无内容</div>
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
