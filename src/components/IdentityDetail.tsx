import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check } from 'lucide-react'
import type { IdentityEntry } from '../types'
import { getIdentityContent, deleteIdentity } from '../lib/tauri'
import { MergeIdentityDialog } from './MergeIdentityDialog'

interface IdentityDetailProps {
  identity: IdentityEntry | null
  onDeleted: () => void
  onMerged: () => void
}

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

export function IdentityDetail({ identity, onDeleted, onMerged }: IdentityDetailProps) {
  const [content, setContent] = useState<string | null>(null)
  const [showMerge, setShowMerge] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!identity) { setContent(null); return }
    setContent(null)
    getIdentityContent(identity.path).then(setContent)
  }, [identity?.path, identity?.mtime_secs])

  if (!identity) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--detail-bg)', color: 'var(--item-meta)', fontSize: 13,
        userSelect: 'none',
      }}>
        选择一个身份档案
      </div>
    )
  }

  const handleDelete = async () => {
    if (!window.confirm(`确认删除「${identity.name}」的档案？`)) return
    setDeleting(true)
    try {
      await deleteIdentity(identity.path)
      onDeleted()
    } catch (e) {
      console.error('[IdentityDetail] delete failed', e)
      setDeleting(false)
    }
  }

  // Strip frontmatter for display
  const bodyContent = content
    ? content.replace(/^---[\s\S]*?---\n?/, '').trim()
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--detail-bg)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 28px 12px', flexShrink: 0, borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 18, fontWeight: 700, color: 'var(--item-text)',
              fontFamily: "'Noto Serif SC', serif", lineHeight: 1.3, marginBottom: 4,
            }}>
              {identity.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--item-meta)' }}>
              {identity.region}
              {identity.tags.length > 0 && ` · ${identity.tags.join(', ')}`}
            </div>
            {identity.summary && (
              <div style={{ fontSize: 12, color: 'var(--item-meta)', marginTop: 4, lineHeight: 1.5 }}>
                {identity.summary}
              </div>
            )}
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => setShowMerge(true)}
              style={{
                padding: '5px 12px', borderRadius: 6,
                border: '1px solid var(--divider)',
                background: 'transparent', color: 'var(--item-text)',
                fontSize: 11, cursor: 'pointer',
              }}
            >
              合并
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: '5px 12px', borderRadius: 6,
                border: '1px solid var(--divider)',
                background: 'transparent', color: 'var(--record-btn)',
                fontSize: 11, cursor: deleting ? 'not-allowed' : 'pointer',
                opacity: deleting ? 0.5 : 1,
              }}
            >
              删除
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
        {content === null ? (
          <div style={{ color: 'var(--item-meta)', fontSize: 12 }}>加载中…</div>
        ) : bodyContent ? (
          <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--md-text, var(--item-text))' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code({ className, children }) {
                  const raw = String(children).replace(/\n$/, '')
                  return <CodeBlock className={className} rawText={raw}>{children}</CodeBlock>
                },
              }}
            >
              {bodyContent}
            </ReactMarkdown>
          </div>
        ) : (
          <div style={{ color: 'var(--item-meta)', fontSize: 12 }}>暂无内容</div>
        )}
      </div>

      {showMerge && (
        <MergeIdentityDialog
          source={identity}
          onClose={() => setShowMerge(false)}
          onMerged={() => { setShowMerge(false); onMerged() }}
        />
      )}
    </div>
  )
}
