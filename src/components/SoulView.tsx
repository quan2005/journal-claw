// src/components/SoulView.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { getWorkspacePrompt, setWorkspacePrompt } from '../lib/tauri'
import { useTranslation } from '../contexts/I18nContext'

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
  const { t } = useTranslation()
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

  const editorFont = 'var(--font-mono)'
  const editorFontSize = 'var(--text-base)'
  const editorLineHeight = 1.7

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 28px 16px', flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'rgba(90,154,106,0.10)',
          border: '0.5px solid rgba(90,154,106,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--soul-color, #5a9a6a)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/>
            <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 12 0"/>
            <path d="M12 12a2 2 0 0 0-2 2c0 2 1 4 1 6"/>
            <path d="M8.5 16.5c-.3 2-.1 4 .5 6"/>
            <path d="M14 13.5c0 1.5-.5 3-1 5.5"/>
            <path d="M17.5 15c-.5 2-1 4-1.5 6"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-semibold)', color: 'var(--item-text)', lineHeight: 1.3 }}>{t('aiPersonality')}</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--item-meta)', marginTop: 1 }}>{t('aiPersonalityDesc')}</div>
        </div>
      </div>

      {/* Editor */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div ref={backdropRef} aria-hidden style={{
          position: 'absolute', inset: 0,
          background: 'var(--detail-case-bg)', borderTop: '1px solid var(--divider)', borderBottom: '1px solid var(--divider)', borderLeft: 'none', borderRight: 'none', borderRadius: 0,
          padding: '12px 28px', fontFamily: editorFont,
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
            background: 'transparent', borderTop: '1px solid transparent', borderBottom: '1px solid transparent', borderLeft: 'none', borderRight: 'none', borderRadius: 0,
            padding: '12px 28px', fontFamily: editorFont,
            fontSize: editorFontSize, lineHeight: editorLineHeight,
            color: 'transparent', caretColor: 'var(--item-text)', cursor: 'text',
            resize: 'none', outline: 'none', boxSizing: 'border-box',
            overflowY: 'auto',
          }}
          spellCheck={false}
        />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 28px 28px', flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--duration-text)' }}>
          {saveStatus === 'saving' ? t('saving')
            : saveStatus === 'saved' ? t('autoSaved')
            : saveStatus === 'error' ? t('saveFailed')
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
            fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)',
            color: saveStatus === 'saving' ? 'var(--duration-text)' : 'var(--bg)',
            cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
          }}
        >
          {saveStatus === 'saving' ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  )
}
