import { useState, useEffect, useRef } from 'react'
import type { RecorderStatus } from '../hooks/useRecorder'
import { FileCard } from './FileCard'
import { fileKindFromName } from '../lib/fileKind'
import clipboard from 'tauri-plugin-clipboard-api'
import { importTextTemp, openFile } from '../lib/tauri'
import { useTranslation } from '../contexts/I18nContext'

interface CommandDockProps {
  isDragOver: boolean
  pendingFiles: string[]
  onPasteSubmit: (text: string) => Promise<void>
  onFilesSubmit: (paths: string[], note?: string) => Promise<void>
  onFilesCancel: () => void
  onRemoveFile: (index: number) => void
  onPasteFiles: (paths: string[]) => void
  recorderStatus: RecorderStatus
  onRecord: () => void
  asrReady: boolean | null
  audioRejected?: boolean
  onOpenSettings: () => void
  externalOpen?: boolean
  onExternalOpenConsumed?: () => void
  appendText?: string
  onAppendTextConsumed?: () => void
}

export function CommandDock({
  isDragOver, pendingFiles, onPasteSubmit, onFilesSubmit,
  onFilesCancel, onRemoveFile, onPasteFiles, recorderStatus, onRecord,
  asrReady, audioRejected, onOpenSettings, externalOpen, onExternalOpenConsumed,
  appendText, onAppendTextConsumed,
}: CommandDockProps) {
  const { t } = useTranslation()
  const [inputOpen, setInputOpen] = useState(false)
  const [inputText, setInputText] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const importedTexts = useRef<Set<string>>(new Set())
  const hasFiles = pendingFiles.length > 0

  // Auto-open input when files arrive; keep open while there are files
  useEffect(() => {
    if (hasFiles) setInputOpen(true)
  }, [hasFiles])

  // Auto-focus textarea when input area opens
  useEffect(() => {
    if (inputOpen) {
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [inputOpen])

  useEffect(() => {
    if (audioRejected) showToast(t('audioRejected'))
  }, [audioRejected])

  // 外部触发打开 dock
  useEffect(() => {
    if (externalOpen) {
      setInputOpen(true)
      onExternalOpenConsumed?.()
    }
  }, [externalOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // 外部追加文本到输入框
  useEffect(() => {
    if (appendText) {
      setInputOpen(true)
      setInputText(prev => prev ? prev + ' ' + appendText : appendText)
      onAppendTextConsumed?.()
      // Focus textarea and place cursor after appended text
      setTimeout(() => {
        const el = inputRef.current
        if (el) {
          el.focus()
          const len = el.value.length
          el.setSelectionRange(len, len)
        }
      }, 40)
    }
  }, [appendText]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTextClipboard(text: string) {
    if (text.length > 300) {
      if (importedTexts.current.has(text)) return  // 同内容不重复 import
      importedTexts.current.add(text)
      importTextTemp(text).then((result) => {
        onPasteFiles([result.path])
      }).catch((err) => {
        importedTexts.current.delete(text)
        console.error('[import-text-temp]', err)
        showToast(t('submitFailed'))
      })
    } else {
      setInputOpen(true)
      setInputText(text)
      setTimeout(() => {
        const el = inputRef.current
        if (el) {
          el.focus()
          const len = el.value.length
          el.setSelectionRange(len, len)
        }
      }, 40)
    }
  }

  function handleCancel() {
    if (hasFiles) onFilesCancel()
    setInputOpen(false)
    setInputText('')
    importedTexts.current.clear()
  }

  async function handleSubmit() {
    if (hasFiles) {
      const paths = [...pendingFiles]
      const note = inputText.trim() || undefined
      onFilesCancel()
      setInputOpen(false)
      setInputText('')
      importedTexts.current.clear()
      showToast(t('submitted'))
      try {
        await onFilesSubmit(paths, note)
      } catch (err) {
        console.error('[files-submit]', err)
        showToast(t('submitFailed'))
      }
    } else {
      const text = inputText.trim()
      if (!text) return
      setInputOpen(false)
      setInputText('')
      importedTexts.current.clear()
      showToast(t('submitted'))
      try {
        await onPasteSubmit(text)
      } catch (err) {
        console.error('[paste-submit]', err)
        showToast(t('submitFailed'))
      }
    }
  }

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inputOpen) { e.stopImmediatePropagation(); handleCancel(); return }
      }
      if (inputOpen && e.key === 'Enter' && !e.shiftKey) {
        if (inputRef.current && document.activeElement === inputRef.current) return
        e.preventDefault()
        handleSubmit()
        return
      }
      // ⌘V: 全局剪贴板路由 — 仅在焦点位于 dock 内部或无特定焦点时拦截
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        const active = document.activeElement
        const inDock = dockRef.current?.contains(active as Node)
        // 焦点不在 dock 内：放行原生粘贴（待办输入框、搜索框、contentEditable 等）
        if (!inDock && active && active !== document.body) return
        if (inputOpen && !hasFiles) return  // 纯文本模式：焦点在 dock textarea，放行原生粘贴
        e.preventDefault()
        clipboard.readFiles().then((files) => {
          if (files && files.length > 0) {
            onPasteFiles(files)
            return
          }
          clipboard.readText().then((text) => {
            if (text) handleTextClipboard(text)
          }).catch(() => {})
        }).catch(() => {
          clipboard.readText().then((text) => {
            if (text) handleTextClipboard(text)
          }).catch(() => {})
        })
        return
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [inputOpen, hasFiles, pendingFiles])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  // Derived mode
  const activeMode = inputOpen ? 'active' : 'idle'

  const dropZoneBorder = activeMode !== 'idle'
    ? `0.5px solid var(--dock-paste-border)`
    : isDragOver
      ? `0.5px solid var(--dock-dropzone-hover-border)`
      : `0.5px dashed var(--dock-dropzone-border)`

  const dropZoneBg = activeMode !== 'idle'
    ? 'var(--dock-paste-bg)'
    : isDragOver
      ? 'var(--dock-dropzone-hover-bg)'
      : 'transparent'

  const actionBtnCancel: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-xs)',
    padding: '3px 9px',
    borderRadius: 5,
    border: '0.5px solid var(--dock-dropzone-border)',
    background: 'var(--dock-kbd-bg)',
    color: 'var(--item-meta)',
    cursor: 'pointer',
  }

  const actionBtnSubmit: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-xs)',
    padding: '3px 9px',
    borderRadius: 5,
    border: '0.5px solid var(--dock-paste-border)',
    background: 'var(--dock-paste-bg)',
    color: 'var(--dock-paste-label)',
    cursor: 'pointer',
  }

  return (
    <div ref={dockRef} style={{
      background: 'var(--dock-bg)',
      borderTop: `1px solid var(--dock-border)`,
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexShrink: 0,
      minHeight: 68,
      position: 'relative',
    }}>
      {/* Settings button */}
      <button
        onClick={onOpenSettings}
        title={t('settingsTooltip')}
        style={{
          width: 34, height: 34, borderRadius: 8,
          border: '0.5px solid var(--divider)',
          background: 'var(--item-hover-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: 'var(--item-meta)', cursor: 'pointer',
          padding: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="6" x2="20" y2="6"/>
          <line x1="4" y1="12" x2="20" y2="12"/>
          <line x1="4" y1="18" x2="20" y2="18"/>
          <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/>
          <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/>
          <circle cx="9" cy="18" r="2" fill="currentColor" stroke="none"/>
        </svg>
      </button>

      {/* Divider (left of drop zone) */}
      <div style={{
        width: 0.5,
        height: 36,
        background: 'var(--dock-border)',
        flexShrink: 0,
      }} />

      {/* Drop Zone */}
      <div
        onClick={() => { if (activeMode === 'idle') setInputOpen(true) }}
        style={{
          flex: 1,
          borderRadius: 8,
          border: dropZoneBorder,
          background: dropZoneBg,
          cursor: activeMode === 'idle' ? 'pointer' : 'default',
          transition: 'background 0.2s, opacity 0.2s',
          overflow: 'visible',
        }}
      >
        {/* Idle state */}
        {activeMode === 'idle' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
          }}>
            <div style={{
              width: 32, height: 32,
              background: 'var(--item-icon-bg)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--dock-dropzone-hover-border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-base)', color: 'var(--dock-dropzone-text)' }}>{t('pastePrompt')}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--dock-dropzone-hint)', marginTop: 2 }}>{t('aiArchiveHint')}</div>
            </div>
            <div
              className="dock-kbd-pulse"
              style={{
              flexShrink: 0,
              fontSize: 'var(--text-xs)',
              color: 'var(--dock-kbd-text)',
              background: 'var(--dock-kbd-bg)',
              border: `0.5px solid var(--dock-kbd-border)`,
              borderRadius: 5,
              padding: '3px 8px',
              letterSpacing: '0.05em',
            }}>
              ⌘V
            </div>
          </div>
        )}

        {/* Active mode: unified container for files + note, or plain text input */}
        {activeMode === 'active' && (
          <div style={{
            display: 'flex',
            alignItems: 'stretch',
            minHeight: 100,
          }}>
            {/* Left: attachment cards (only when files present) */}
            {hasFiles && (
              <div style={{
                padding: '6px 8px 6px 12px',
                display: 'flex',
                flexDirection: 'row',
                gap: 6,
                flexWrap: 'wrap',
                alignContent: 'center',
                alignItems: 'center',
                alignSelf: 'center',
                flexShrink: 0,
              }}>
                {pendingFiles.slice(0, 6).map((path, i) => {
                  const filename = path.split('/').pop() ?? path
                  return (
                    <FileCard
                      key={`${path}-${i}`}
                      filename={filename}
                      kind={fileKindFromName(filename)}
                      onRemove={() => onRemoveFile(i)}
                      onOpen={() => openFile(path).catch(err => console.error('[open-file]', err))}
                    />
                  )
                })}
              </div>
            )}

            {/* Vertical divider (only when files present) */}
            {hasFiles && (
              <div style={{ width: 1, background: 'var(--dock-border)', flexShrink: 0, alignSelf: 'stretch' }} />
            )}

            {/* Right: label + buttons + textarea */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '10px 12px',
              minWidth: 0,
              minHeight: 100,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--dock-paste-label)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const,
                }}>
                  {hasFiles ? t('noteOptional') : t('pasteOrDrop')}
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={(e) => { e.stopPropagation(); handleCancel() }} style={actionBtnCancel}>
                    <span style={{ opacity: 0.5, marginRight: 5, fontSize: '0.9em' }}>Esc</span>{t('cancel')}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleSubmit() }} style={actionBtnSubmit}>
                    <span style={{ opacity: 0.6, marginRight: 5, fontSize: '0.9em' }}>↵</span>{t('submit')}
                  </button>
                </div>
              </div>

              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault()
                  const rawText = e.clipboardData.getData('text')
                  // 短文本：在光标位置插入（正确处理选区）
                  if (rawText && rawText.length <= 300) {
                    const el = e.currentTarget
                    const start = el.selectionStart ?? inputText.length
                    const end = el.selectionEnd ?? inputText.length
                    setInputText(prev => prev.slice(0, start) + rawText + prev.slice(end))
                    // 恢复光标到插入点末尾
                    requestAnimationFrame(() => {
                      el.selectionStart = el.selectionEnd = start + rawText.length
                    })
                    return
                  }
                  // 无文本或长文本：尝试读文件，否则写入 temp
                  clipboard.readFiles().then((files) => {
                    if (files && files.length > 0) {
                      onPasteFiles(files)
                    } else if (rawText) {
                      importTextTemp(rawText).then((result) => {
                        onPasteFiles([result.path])
                      }).catch((err) => {
                        console.error('[paste-import]', err)
                        showToast(t('submitFailed'))
                      })
                    }
                  }).catch(() => {
                    if (rawText) {
                      importTextTemp(rawText).then((result) => {
                        onPasteFiles([result.path])
                      }).catch((err) => {
                        console.error('[paste-import]', err)
                        showToast(t('submitFailed'))
                      })
                    }
                  })
                }}
                placeholder={hasFiles ? t('textareaPlaceholderFiles') : t('textareaPlaceholderText')}
                className="dock-textarea"
                style={{
                  flex: 1,
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--item-text)',
                  lineHeight: 1.6,
                  caretColor: 'var(--dock-paste-label)',
                  minHeight: 20,
                  marginTop: 7,
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                } as React.CSSProperties}
              />
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{
        width: 0.5,
        height: 36,
        background: 'var(--dock-border)',
        flexShrink: 0,
      }} />

      {/* Mic Button */}
      <div style={{ flexShrink: 0 }}>
        <button
          onClick={onRecord}
          disabled={recorderStatus !== 'recording' && asrReady === false}
          title={
            recorderStatus !== 'recording' && asrReady === false
              ? t('voiceNotReady')
              : recorderStatus === 'recording' ? t('stopRecording') : t('startRecording')
          }
          aria-label={recorderStatus === 'recording' ? t('stopRecording') : t('startRecording')}
          className="mic-btn"
          data-recording={recorderStatus === 'recording' ? 'true' : 'false'}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: recorderStatus === 'recording' ? 'var(--accent)' : 'var(--record-btn)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: recorderStatus !== 'recording' && asrReady === false ? 'not-allowed' : 'pointer',
            opacity: recorderStatus !== 'recording' && asrReady === false ? 0.4 : 1,
            flexShrink: 0,
            position: 'relative',
            outline: 'none',
            margin: '0 16px',
            WebkitAppRegion: 'no-drag',
            boxShadow: recorderStatus === 'recording'
              ? '0 6px 18px rgba(255,59,48,0.24)'
              : '0 6px 18px rgba(200,147,59,0.22)',
            animation: recorderStatus === 'recording'
              ? 'rec-pulse 1.2s ease-in-out infinite'
              : 'pulse 3.2s ease-in-out infinite',
            transition: 'background 0.18s ease, transform 0.18s ease, opacity 0.18s ease',
          } as React.CSSProperties}
        >
          {recorderStatus === 'recording' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--record-btn-icon)">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="var(--record-btn-icon)"
            >
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
              <path d="M19 10a7 7 0 0 1-14 0M12 19v3M8 22h8" stroke="var(--record-btn-icon)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            </svg>
          )}
        </button>
      </div>

      {/* Divider (right of mic) */}
      <div style={{
        width: 0.5,
        height: 36,
        background: 'var(--dock-border)',
        flexShrink: 0,
      }} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute',
          bottom: 76,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--ai-pill-bg)',
          border: '0.5px solid var(--ai-pill-border)',
          borderRadius: 8,
          padding: '7px 18px',
          fontSize: 'var(--text-sm)',
          color: 'var(--ai-pill-active-text)',
          whiteSpace: 'nowrap',
          letterSpacing: '0.05em',
          animation: 'card-enter 0.2s ease-out',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
