import { useState, useEffect } from 'react'
import type { JournalEntry } from '../types'
import { getJournalEntryContent } from '../lib/tauri'
import { invoke } from '@tauri-apps/api/core'
import { Spinner } from './Spinner'

interface DetailPanelProps {
  entry: JournalEntry
  onClose: () => void
}

function kindIcon(kind: string): string {
  return kind === 'audio' ? '🎙' : kind === 'pdf' ? '📋' : kind === 'docx' ? '📝' : '📄'
}

function kindAction(kind: string): string {
  return kind === 'audio' ? '▶ 播放' : '打开'
}

// Minimal markdown renderer — headings + paragraphs + lists
function renderMarkdown(md: string): React.ReactNode[] {
  // Strip frontmatter
  const body = md.replace(/^---[\s\S]*?---\n?/, '').trim()
  const lines = body.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('## ')) {
      nodes.push(
        <h2 key={i} style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e', margin: '12px 0 4px' }}>
          {line.slice(3)}
        </h2>
      )
      i++
    } else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
      const checked = line.startsWith('- [x] ')
      nodes.push(
        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
          <span style={{ width: 12, height: 12, border: '1.5px solid #c7c7cc', borderRadius: 3, flexShrink: 0, display: 'inline-block', background: checked ? '#c7c7cc' : 'none' }} />
          <span style={{ fontSize: 13, color: '#3a3a3c' }}>{line.slice(6)}</span>
        </div>
      )
      i++
    } else if (line.startsWith('- ')) {
      nodes.push(
        <div key={i} style={{ fontSize: 13, color: '#3a3a3c', marginBottom: 2, paddingLeft: 12 }}>
          · {line.slice(2)}
        </div>
      )
      i++
    } else if (line.trim() === '') {
      i++
    } else {
      nodes.push(
        <p key={i} style={{ fontSize: 13, color: '#3a3a3c', marginBottom: 4, lineHeight: 1.75 }}>
          {line}
        </p>
      )
      i++
    }
  }
  return nodes
}

const TAG_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  meeting: { label: '会议', color: '#5856d6', bg: 'rgba(88,86,214,0.10)' },
  reading: { label: '阅读', color: '#ff9500', bg: 'rgba(255,149,0,0.10)' },
  design:  { label: '设计', color: '#30b0c7', bg: 'rgba(48,176,199,0.10)' },
  report:  { label: '报告', color: '#34c759', bg: 'rgba(52,199,89,0.10)' },
  goal:    { label: '目标', color: '#ff3b30', bg: 'rgba(255,59,48,0.10)' },
  plan:    { label: '计划', color: '#007aff', bg: 'rgba(0,122,255,0.10)' },
}

export function DetailPanel({ entry, onClose }: DetailPanelProps) {
  const [content, setContent] = useState<string | null>(null)

  useEffect(() => {
    setContent(null)
    getJournalEntryContent(entry.path).then(setContent)
  }, [entry.path])

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const displayTags = entry.tags.filter(t => t !== 'journal' && TAG_DISPLAY[t])

  return (
    <div style={{
      width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid var(--divider)', background: 'var(--sheet-bg)', height: '100%',
    }}>
      {/* Header */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 16px',
        borderBottom: '1px solid var(--divider)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--item-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.title}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#c7c7cc', padding: '4px 8px' }}>✕</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Meta block — B3 style */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#aeaeb2' }}>{entry.created_time}</span>
            {displayTags.map(t => {
              const cfg = TAG_DISPLAY[t]
              return (
                <span key={t} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 500, color: cfg.color, background: cfg.bg }}>
                  {cfg.label}
                </span>
              )
            })}
          </div>
          {entry.summary && (
            <div style={{ fontSize: 12, color: '#aeaeb2', fontStyle: 'italic', lineHeight: 1.5 }}>
              {entry.summary}
            </div>
          )}
        </div>

        {/* Thin divider */}
        <div style={{ height: 1, background: '#f0f0f0' }} />

        {/* Read-only markdown */}
        {content === null ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
            <Spinner size={20} />
          </div>
        ) : (
          <div style={{ lineHeight: 1.8 }}>
            {renderMarkdown(content)}
          </div>
        )}

        {/* Raw materials */}
        {entry.materials.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#c7c7cc', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              原始素材
            </div>
            {entry.materials.map(m => (
              <div
                key={m.path}
                onClick={() => invoke('open_with_system', { path: m.path })}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: '#f5f5f7', marginBottom: 4, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#efefef'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = '#f5f5f7'}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{kindIcon(m.kind)}</span>
                <span style={{ fontSize: 12, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1c1c1e' }}>
                  {m.filename}
                </span>
                <span style={{ fontSize: 11, color: '#aeaeb2', flexShrink: 0 }}>{kindAction(m.kind)}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
