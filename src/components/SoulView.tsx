// src/components/SoulView.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { getWorkspacePrompt, setWorkspacePrompt } from '../lib/tauri'

function highlightMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    if (/^# /.test(line)) {
      return <div key={i} style={{ color: 'var(--item-text)' }}>{line}</div>
    }
    if (/^## /.test(line)) {
      return <div key={i} style={{ color: 'var(--item-meta)' }}>{line}</div>
    }
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

export default function SoulView() {
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getWorkspacePrompt().then(setContent)
    const onFocus = () => getWorkspacePrompt().then(setContent)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const save = useCallback(async (text: string) => {
    setSaveStatus('saving')
    try {
      await setWorkspacePrompt(text)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(current => current === 'saved' ? 'idle' : current), 2000)
    } catch (error) {
      console.error('[soul] save failed', error)
      setSaveStatus('error')
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setContent(text)
    setSaveStatus('idle')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(text), 800)
  }

  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  const editorFont = "'IBM Plex Mono', ui-monospace, monospace"
  const editorFontSize = 12
  const editorLineHeight = 1.7

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 28px 28px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'rgba(90,154,106,0.10)',
          border: '0.5px solid rgba(90,154,106,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--soul-color, #5a9a6a)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 2a7 7 0 0 1 7 7c0 4-3 6-4 8H9c-1-2-4-4-4-8a7 7 0 0 1 7-7z"/>
            <path d="M9 21h6M10 17h4"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--item-text)', lineHeight: 1.3 }}>Agent 灵魂</div>
          <div style={{ fontSize: 11, color: 'var(--item-meta)', marginTop: 1 }}>定义 Agent 的角色与工作偏好</div>
        </div>
      </div>

      {/* Editor */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div ref={backdropRef} aria-hidden style={{
          position: 'absolute', inset: 0,
          background: 'var(--detail-case-bg)', border: '1px solid var(--divider)', borderRadius: 6,
          padding: '12px 14px', fontFamily: editorFont,
          fontSize: editorFontSize, lineHeight: editorLineHeight, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          pointerEvents: 'none', overflowY: 'auto',
        }}>
          {highlightMarkdown(content)}
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onScroll={handleScroll}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            background: 'transparent', border: '1px solid transparent', borderRadius: 6,
            padding: '12px 14px', fontFamily: editorFont,
            fontSize: editorFontSize, lineHeight: editorLineHeight,
            color: 'transparent', caretColor: 'var(--item-text)', cursor: 'text',
            resize: 'none', outline: 'none', boxSizing: 'border-box',
            overflowY: 'auto',
          }}
          spellCheck={false}
        />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: 'var(--duration-text)' }}>
          {saveStatus === 'saving' ? '保存中…'
            : saveStatus === 'saved' ? '已自动保存'
            : saveStatus === 'error' ? '保存失败，请重试'
            : ''}
        </span>
        <button
          onClick={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            save(content)
          }}
          disabled={saveStatus === 'saving'}
          style={{
            background: saveStatus === 'saving' ? 'var(--divider)' : 'var(--record-btn)',
            border: 'none', borderRadius: 5, padding: '6px 18px',
            fontSize: 12, fontWeight: 600,
            color: saveStatus === 'saving' ? 'var(--duration-text)' : 'var(--bg)',
            cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
          }}
        >
          {saveStatus === 'saving' ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}
