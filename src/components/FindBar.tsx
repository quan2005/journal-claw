import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createTranslator, detectLang } from '../lib/i18n'

const getT = () => createTranslator(detectLang())

interface FindBarProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
}

function getTextNodes(root: Node): Text[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    if (node.textContent && node.textContent.length > 0) nodes.push(node)
  }
  return nodes
}

export function FindBar({ containerRef, onClose }: FindBarProps) {
  const t = getT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<Range[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const updateHighlights = useCallback(() => {
    CSS.highlights?.delete('search-result')
    CSS.highlights?.delete('search-current')

    if (!query || !containerRef.current) {
      setMatches([])
      setCurrentIdx(0)
      return
    }

    const textNodes = getTextNodes(containerRef.current)
    const lowerQuery = query.toLowerCase()
    const ranges: Range[] = []

    for (const node of textNodes) {
      const text = node.textContent!.toLowerCase()
      let start = 0
      while (true) {
        const idx = text.indexOf(lowerQuery, start)
        if (idx === -1) break
        const range = new Range()
        range.setStart(node, idx)
        range.setEnd(node, idx + query.length)
        ranges.push(range)
        start = idx + 1
      }
    }

    setMatches(ranges)
    const newIdx = 0
    setCurrentIdx(newIdx)

    if (ranges.length > 0) {
      CSS.highlights?.set('search-result', new Highlight(...ranges))
      CSS.highlights?.set('search-current', new Highlight(ranges[newIdx]))
      scrollToRange(ranges[newIdx], containerRef.current)
    }
  }, [query, containerRef])

  useEffect(() => {
    updateHighlights()
  }, [updateHighlights])

  useEffect(() => {
    if (matches.length === 0) return
    CSS.highlights?.set('search-current', new Highlight(matches[currentIdx]))
    scrollToRange(matches[currentIdx], containerRef.current)
  }, [currentIdx, matches, containerRef])

  useEffect(() => {
    return () => {
      CSS.highlights?.delete('search-result')
      CSS.highlights?.delete('search-current')
    }
  }, [])

  // Global Escape listener — works even when input isn't focused
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose])

  const goNext = useCallback(() => {
    if (matches.length === 0) return
    setCurrentIdx((i) => (i + 1) % matches.length)
  }, [matches.length])

  const goPrev = useCallback(() => {
    if (matches.length === 0) return
    setCurrentIdx((i) => (i - 1 + matches.length) % matches.length)
  }, [matches.length])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      goPrev()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      goNext()
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 20,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 8px 5px 10px',
        background: 'var(--dock-bg)',
        border: '1px solid var(--divider)',
        borderRadius: 8,
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        animation: 'find-bar-enter 0.15s ease-out',
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--item-meta)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, opacity: 0.45 }}
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('search')}
        style={{
          width: 180,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontSize: 'var(--text-sm)',
          color: 'var(--item-text)',
          fontFamily: 'var(--font-body)',
        }}
      />
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--item-meta)',
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          minWidth: 32,
          textAlign: 'right',
          visibility: query ? 'visible' : 'hidden',
        }}
      >
        {matches.length > 0 ? `${currentIdx + 1}/${matches.length}` : '0/0'}
      </span>
      <div style={{ width: 1, height: 14, background: 'var(--divider)', flexShrink: 0 }} />
      <NavBtn
        onClick={goPrev}
        disabled={matches.length === 0}
        title={t('findPrev')}
        direction="up"
      />
      <NavBtn
        onClick={goNext}
        disabled={matches.length === 0}
        title={t('findNext')}
        direction="down"
      />
      <button
        onClick={onClose}
        title={t('closeFindBar')}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          opacity: 0.35,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.8')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.35')}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--item-meta)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

function NavBtn({
  onClick,
  disabled,
  title,
  direction,
}: {
  onClick: () => void
  disabled: boolean
  title: string
  direction: 'up' | 'down'
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        padding: 2,
        display: 'flex',
        alignItems: 'center',
        opacity: disabled ? 0.2 : 0.5,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = '1'
      }}
      onMouseLeave={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = '0.5'
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--item-meta)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {direction === 'up' ? (
          <polyline points="18 15 12 9 6 15" />
        ) : (
          <polyline points="6 9 12 15 18 9" />
        )}
      </svg>
    </button>
  )
}

function scrollToRange(range: Range, container: HTMLElement | null) {
  if (!container) return
  const rect = range.getBoundingClientRect()
  const parentRect = container.getBoundingClientRect()
  if (rect.top < parentRect.top || rect.bottom > parentRect.bottom) {
    const targetScroll = container.scrollTop + (rect.top - parentRect.top) - parentRect.height / 3
    container.scrollTo({ top: targetScroll, behavior: 'smooth' })
  }
}
