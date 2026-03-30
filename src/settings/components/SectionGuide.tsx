import { useState, useEffect, useRef, useCallback } from 'react'
import { getWorkspacePrompt, setWorkspacePrompt } from '../../lib/tauri'

const sectionStyle: React.CSSProperties = {
  padding: '32px 28px', borderBottom: '1px solid var(--divider)',
  display: 'flex', flexDirection: 'column', minHeight: 320,
}

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

export default function SectionGuide() {
  const [content, setContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getWorkspacePrompt().then(setContent)
  }, [])

  const save = useCallback(async (text: string) => {
    setSaveStatus('saving')
    await setWorkspacePrompt(text)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setContent(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(text), 800)
  }

  const editorFont = "'IBM Plex Mono', ui-monospace, monospace"

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 11, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 500 }}>工作引导</div>
      <div style={{ fontSize: 11, color: 'var(--duration-text)', marginBottom: 12, lineHeight: 1.6 }}>
        告诉 AI 你的工作习惯和偏好，它会在处理日志时参考这些引导。
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 200 }}>
        {/* Syntax-highlighted backdrop */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0,
          background: 'var(--detail-case-bg)', border: '1px solid var(--divider)', borderRadius: 6,
          padding: '12px 14px', fontFamily: editorFont,
          fontSize: 11.5, lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          pointerEvents: 'none', overflow: 'hidden',
        }}>
          {highlightMarkdown(content)}
        </div>
        {/* Transparent textarea */}
        <textarea
          value={content}
          onChange={handleChange}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            background: 'transparent', border: '1px solid transparent', borderRadius: 6,
            padding: '12px 14px', fontFamily: editorFont,
            fontSize: 11.5, lineHeight: 1.75,
            color: 'transparent', caretColor: 'var(--item-text)',
            resize: 'none', outline: 'none', boxSizing: 'border-box',
          }}
          spellCheck={false}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--duration-text)' }}>
          {saveStatus === 'saving' ? '保存中…' : saveStatus === 'saved' ? '已自动保存' : ''}
        </span>
        <button onClick={() => save(content)} style={{
          background: 'var(--record-btn)', border: 'none', borderRadius: 5,
          padding: '6px 18px', fontSize: 12, fontWeight: 600,
          color: 'var(--bg)', cursor: 'pointer',
        }}>保存</button>
      </div>
    </div>
  )
}
