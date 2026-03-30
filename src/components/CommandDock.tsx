import { useState, useEffect, useRef } from 'react'
import type { RecorderStatus } from '../hooks/useRecorder'
import { FileChip } from './FileChip'
import { fileKindFromName } from '../lib/fileKind'
import clipboard from 'tauri-plugin-clipboard-api'
import { importText } from '../lib/tauri'

interface CommandDockProps {
  isDragOver: boolean
  pendingFiles: string[]
  onPasteSubmit: (text: string) => Promise<void>
  onFilesSubmit: (paths: string[]) => Promise<void>
  onFilesCancel: () => void
  onRemoveFile: (index: number) => void
  onPasteFiles: (paths: string[]) => void
  recorderStatus: RecorderStatus
  onRecord: () => void
}

export function CommandDock({
  isDragOver, pendingFiles, onPasteSubmit, onFilesSubmit,
  onFilesCancel, onRemoveFile, onPasteFiles, recorderStatus, onRecord,
}: CommandDockProps) {
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isRecording = recorderStatus === 'recording'
  const hasFiles = pendingFiles.length > 0

  // Exit paste mode when files arrive
  useEffect(() => {
    if (hasFiles && pasteMode) {
      setPasteMode(false)
      setPasteText('')
    }
  }, [hasFiles])

  // Auto-focus textarea when paste mode activates
  useEffect(() => {
    if (pasteMode) {
      setTimeout(() => textareaRef.current?.focus(), 40)
    }
  }, [pasteMode])

  function handleTextClipboard(text: string) {
    if (text.length > 100) {
      importText(text).then((result) => {
        onPasteFiles([result.path])
      }).catch((err) => {
        console.error('[import-text]', err)
        showToast('提交失败')
      })
    } else {
      setPasteMode(true)
      setPasteText(text)
    }
  }

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape: cancel files or paste
      if (e.key === 'Escape') {
        if (hasFiles) { onFilesCancel(); return }
        if (pasteMode) { exitPaste(); return }
      }
      // ⌘Enter: submit files
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && hasFiles) {
        e.preventDefault()
        handleFilesSubmitClick()
        return
      }
      // ⌘V: 全局剪贴板路由
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        if (pasteMode) return
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
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pasteMode, hasFiles, pendingFiles])

  function exitPaste() {
    setPasteMode(false)
    setPasteText('')
  }

  async function handleSubmit() {
    const text = pasteText.trim()
    if (!text) return
    exitPaste()
    showToast('已提交，Agent 整理中…')
    try {
      await onPasteSubmit(text)
    } catch (err) {
      console.error('[paste-submit]', err)
      showToast('提交失败')
    }
  }

  async function handleFilesSubmitClick() {
    const paths = [...pendingFiles]
    onFilesCancel()
    showToast('已提交，Agent 整理中…')
    try {
      await onFilesSubmit(paths)
    } catch (err) {
      console.error('[files-submit]', err)
      showToast('提交失败')
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Derived mode: files > paste > idle
  const activeMode = hasFiles ? 'files' : pasteMode ? 'paste' : 'idle'

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
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    padding: '3px 9px',
    borderRadius: 5,
    border: '0.5px solid var(--dock-dropzone-border)',
    background: 'var(--dock-kbd-bg)',
    color: 'var(--item-meta)',
    cursor: 'pointer',
  }

  const actionBtnSubmit: React.CSSProperties = {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    padding: '3px 9px',
    borderRadius: 5,
    border: '0.5px solid var(--dock-paste-border)',
    background: 'var(--dock-paste-bg)',
    color: 'var(--dock-paste-label)',
    cursor: 'pointer',
  }

  return (
    <div style={{
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
      {/* Divider (left of drop zone) */}
      <div style={{
        width: 0.5,
        height: 36,
        background: 'var(--dock-border)',
        flexShrink: 0,
      }} />

      {/* Drop Zone */}
      <div
        onClick={() => { if (activeMode === 'idle') setPasteMode(true) }}
        style={{
          flex: 1,
          borderRadius: 8,
          border: dropZoneBorder,
          background: dropZoneBg,
          cursor: activeMode === 'idle' ? 'pointer' : 'default',
          transition: 'border-color 0.2s, background 0.2s',
          overflow: 'hidden',
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
              width: 30, height: 30,
              background: 'var(--dock-paste-bg)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--dock-dropzone-hover-border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--dock-dropzone-text)' }}>粘贴文本或拖入文件</div>
              <div style={{ fontSize: 10, color: 'var(--dock-dropzone-hint)', marginTop: 2 }}>支持 txt · md · pdf · docx · 图片 · 音频</div>
            </div>
            <div style={{
              flexShrink: 0,
              fontSize: 10,
              color: 'var(--dock-kbd-text)',
              background: 'var(--dock-kbd-bg)',
              border: `0.5px solid var(--dock-kbd-border)`,
              borderRadius: 4,
              padding: '2px 6px',
              letterSpacing: '0.05em',
            }}>
              ⌘V
            </div>
          </div>
        )}

        {/* Files preview mode */}
        {activeMode === 'files' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '8px 12px',
            minHeight: 46,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <span style={{
                fontSize: 10,
                color: 'var(--dock-paste-label)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
              }}>
                待导入文件
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={(e) => { e.stopPropagation(); onFilesCancel() }} style={actionBtnCancel}>
                  取消
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleFilesSubmitClick() }} style={actionBtnSubmit}>
                  提交 Agent 整理 ↗
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {pendingFiles.map((path, i) => {
                const filename = path.split('/').pop() ?? path
                return (
                  <FileChip
                    key={`${path}-${i}`}
                    filename={filename}
                    kind={fileKindFromName(filename)}
                    onRemove={() => onRemoveFile(i)}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Paste text mode */}
        {activeMode === 'paste' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '8px 12px',
            minHeight: 46,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 5,
            }}>
              <span style={{
                fontSize: 10,
                color: 'var(--dock-paste-label)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
              }}>
                粘贴文本或文件
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={(e) => { e.stopPropagation(); exitPaste() }} style={actionBtnCancel}>
                  取消
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleSubmit() }} style={actionBtnSubmit}>
                  提交 Agent 整理 ↗
                </button>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="在此粘贴文本，或拖入文件（txt/md/pdf/docx 等）…"
              className="dock-textarea"
              style={{
                flex: 1,
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                color: 'var(--item-text)',
                lineHeight: 1.6,
                caretColor: 'var(--dock-paste-label)',
                minHeight: 20,
                userSelect: 'text',
                WebkitUserSelect: 'text',
              } as React.CSSProperties}
            />
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
      <button
        onClick={onRecord}
        title={isRecording ? "停止录音" : "点击录音"}
        style={{
          width: 46,
          height: 46,
          borderRadius: '50%',
          background: 'var(--record-btn)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          position: 'relative',
          outline: 'none',
          margin: '0 16px',
          WebkitAppRegion: 'no-drag',
          animation: isRecording ? 'rec-pulse 1.2s ease-in-out infinite' : 'pulse 2.4s ease-in-out infinite',
          transition: 'transform 0.15s ease',
        } as React.CSSProperties}
        onMouseEnter={(e) => {
          if (!isRecording) {
            e.currentTarget.style.background = '#d9a44b'
            e.currentTarget.style.transform = 'scale(1.06)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--record-btn)'
          e.currentTarget.style.transform = ''
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'scale(0.95)'
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = ''
        }}
      >
        {isRecording ? (
          <div style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            background: 'var(--record-btn-icon)',
          }} />
        ) : (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="var(--record-btn-icon)">
            <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
            <path d="M19 10a7 7 0 0 1-14 0M12 19v3M8 22h8" stroke="var(--record-btn-icon)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          </svg>
        )}
        {!isRecording && (
          <div style={{
            position: 'absolute',
            width: 58,
            height: 58,
            borderRadius: '50%',
            border: `1px solid rgba(200,147,58,0.18)`,
            animation: 'mic-ripple 2.5s ease-out infinite',
            pointerEvents: 'none',
          }} />
        )}
      </button>

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
          fontSize: 11,
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
