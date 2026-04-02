import type { Theme } from '../types'
import { ThemeToggle } from './ThemeToggle'
import { AiStatusPill } from './AiStatusPill'

interface TitleBarProps {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  isProcessing: boolean
  processingFilename?: string
  onLogClick?: () => void
  view: 'journal' | 'settings' | 'identity'
  onToggleIdentity: () => void
  todoOpen: boolean
  todoCount: number
  onToggleTodo: () => void
}

export function TitleBar({ theme, onThemeChange, isProcessing, processingFilename, onLogClick, view, onToggleIdentity, todoOpen, todoCount, onToggleTodo }: TitleBarProps) {
  const identityActive = view === 'identity'

  return (
    <div
      data-tauri-drag-region
      style={{
        height: 38,
        background: 'var(--titlebar-bg)',
        flexShrink: 0,
        paddingLeft: 70,
        paddingRight: 16,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        borderBottom: '0.5px solid var(--divider)',
      }}
    >
      {/* Left: empty */}
      <div />

      {/* Center: title or AI status */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {view === 'settings' ? (
          <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--item-text)' }}>设置</span>
        ) : (
          <AiStatusPill isProcessing={isProcessing} processingFilename={processingFilename} onLogClick={onLogClick} />
        )}
      </div>

      {/* Right: theme toggle (journal only) + soul button */}
      <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 8 }}>
        {view === 'journal' && <ThemeToggle theme={theme} onChange={onThemeChange} />}
        <button
          onClick={onToggleIdentity}
          title={identityActive ? '返回 (Esc)' : '身份档案 (⌘P)'}
          style={{
            background: identityActive ? 'rgba(90,154,106,0.12)' : 'none',
            border: 'none', cursor: 'pointer',
            color: identityActive ? 'var(--soul-color, #5a9a6a)' : 'var(--item-meta)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, padding: 0, borderRadius: 4, lineHeight: 1,
            opacity: identityActive ? 1 : 0.6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </button>
        {view === 'journal' && (
          <button
            onClick={onToggleTodo}
            title={todoOpen ? '收起待办 (⌘T)' : '待办 (⌘T)'}
            style={{
              background: todoOpen ? 'rgba(200,147,58,0.12)' : 'none',
              border: 'none', cursor: 'pointer',
              color: todoOpen ? 'var(--record-btn)' : 'var(--item-meta)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, padding: 0, borderRadius: 4, lineHeight: 1,
              opacity: todoOpen ? 1 : 0.6,
              position: 'relative' as const,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            {!todoOpen && todoCount > 0 && (
              <span style={{
                position: 'absolute' as const, top: -2, right: -4,
                background: 'var(--record-btn)', color: 'var(--bg)',
                fontSize: 8, fontWeight: 700,
                width: 14, height: 14, borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{todoCount > 9 ? '9+' : todoCount}</span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
