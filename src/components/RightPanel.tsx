import { useState, useRef, useEffect } from 'react'
import clipboard from 'tauri-plugin-clipboard-api'
import type { RecorderStatus } from '../hooks/useRecorder'
import type { QueueItem, JournalEntry, TodoItem } from '../types'
import { importTextTemp } from '../lib/tauri'
import { fileKindFromName } from '../lib/fileKind'
import { TodoContent } from './TodoSidebar'
import { AiChatPanel } from './AiChatPanel'
import type { ChatMessage } from './AiChatPanel'
import { ProcessingQueue } from './ProcessingQueue'
import { FileCard } from './FileCard'
import { openFile } from '../lib/tauri'

type PanelTab = 'todo' | 'chat'
type ChatScope = 'current' | 'global'

interface RightPanelProps {
  width: number
  // Todo
  todos: TodoItem[]
  onToggleTodo: (lineIndex: number, checked: boolean, doneFile: boolean) => void
  onAddTodo: (text: string, due?: string, source?: string) => void
  onDeleteTodo: (lineIndex: number, doneFile: boolean) => void
  onSetTodoDue: (lineIndex: number, due: string | null, doneFile: boolean) => void
  onUpdateTodoText: (lineIndex: number, text: string, doneFile: boolean) => void
  onNavigateToSource: (filename: string) => void
  // Input / files
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
  isDragOver: boolean
  // Queue
  queueItems: QueueItem[]
  onDismissQueueItem: (path: string) => void
  onCancelQueueItem: (item: QueueItem) => void
  onRetryQueueItem: (item: QueueItem) => void
  activeLogPath: string | null
  onSetActiveLogPath: (path: string | null) => void
  // Context
  selectedEntry: JournalEntry | null
  // AI engine
  aiReady: boolean | null
  onOpenSettings: () => void
}

export function RightPanel({
  width,
  todos, onToggleTodo, onAddTodo, onDeleteTodo, onSetTodoDue, onUpdateTodoText, onNavigateToSource,
  pendingFiles, onPasteSubmit, onFilesSubmit, onFilesCancel, onRemoveFile, onPasteFiles,
  recorderStatus, onRecord, asrReady, audioRejected,
  queueItems, onDismissQueueItem, onCancelQueueItem, onRetryQueueItem,
  activeLogPath, onSetActiveLogPath,
  selectedEntry, aiReady, onOpenSettings,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('todo')
  const [inputText, setInputText] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatScope, setChatScope] = useState<ChatScope>('current')
  const [toast, setToast] = useState<string | null>(null)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const importedTexts = useRef<Set<string>>(new Set())

  const hasFiles = pendingFiles.length > 0
  const hasInput = inputText.trim().length > 0 || hasFiles
  const uncheckedCount = todos.filter(t => !t.done).length

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 80) + 'px'
  }, [inputText])

  // Show toast on audio rejected
  useEffect(() => {
    if (audioRejected) showToast('语音转写未配置，音频文件已忽略')
  }, [audioRejected])

  // Global ⌘V handler (only when focus is NOT in a text input)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'v') return
      const active = document.activeElement
      const inPanel = panelRef.current?.contains(active as Node)
      // Let native paste happen if focus is in the textarea or any other input
      if (active && active !== document.body && !inPanel) return
      // If focus is in our textarea, let native paste handle it
      if (inPanel && active === inputRef.current) return
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
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onPasteFiles]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTextClipboard(text: string) {
    if (text.length > 300) {
      if (importedTexts.current.has(text)) return
      importedTexts.current.add(text)
      importTextTemp(text).then((result) => {
        onPasteFiles([result.path])
      }).catch((err) => {
        importedTexts.current.delete(text)
        console.error('[import-text-temp]', err)
        showToast('提交失败')
      })
    } else {
      setInputText(text)
      inputRef.current?.focus()
    }
  }

  const handleUpload = () => {
    import('@tauri-apps/plugin-dialog').then(({ open }) =>
      open({ multiple: true, directory: false }) as Promise<string[] | null>
    ).then((files) => {
      if (files && files.length > 0) onPasteFiles(files)
    }).catch(console.error)
  }

  const handleSubmit = async () => {
    const text = inputText.trim()
    if (!text && !hasFiles) return

    if (activeTab === 'todo') {
      if (text) {
        onAddTodo(text)
        setInputText('')
      }
      return
    }

    // AI chat tab
    if (hasFiles) {
      const paths = [...pendingFiles]
      setInputText('')
      importedTexts.current.clear()
      onFilesCancel()
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text || `[已上传 ${paths.length} 个文件]`,
        timestamp: Date.now(),
      }
      setChatMessages(prev => [...prev, userMsg])
      setChatLoading(true)
      showToast('已提交，谨迹整理中…')
      try {
        await onFilesSubmit(paths, text || undefined)
      } catch (err) {
        console.error('[files-submit]', err)
        showToast('提交失败')
      } finally {
        setChatLoading(false)
      }
    } else {
      setInputText('')
      importedTexts.current.clear()
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      }
      setChatMessages(prev => [...prev, userMsg])
      setChatLoading(true)
      showToast('已提交，谨迹整理中…')
      try {
        await onPasteSubmit(text)
      } catch (err) {
        console.error('[paste-submit]', err)
        showToast('提交失败')
      } finally {
        setChatLoading(false)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setInputText('')
      if (hasFiles) { onFilesCancel(); importedTexts.current.clear() }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const rawText = e.clipboardData.getData('text')
    if (rawText && rawText.length <= 300) {
      const el = e.currentTarget
      const start = el.selectionStart ?? inputText.length
      const end = el.selectionEnd ?? inputText.length
      const next = inputText.slice(0, start) + rawText + inputText.slice(end)
      setInputText(next)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + rawText.length
      })
      return
    }
    clipboard.readFiles().then((files) => {
      if (files && files.length > 0) {
        onPasteFiles(files)
      } else if (rawText) {
        importTextTemp(rawText).then((result) => {
          onPasteFiles([result.path])
        }).catch((err) => {
          console.error('[paste-import]', err)
          showToast('提交失败')
        })
      }
    }).catch(() => {
      if (rawText) {
        importTextTemp(rawText).then((result) => {
          onPasteFiles([result.path])
        }).catch((err) => {
          console.error('[paste-import]', err)
          showToast('提交失败')
        })
      }
    })
  }

  const activeQueueItems = queueItems.filter(i => i.status !== 'done')

  const tabStyle = (tab: PanelTab): React.CSSProperties => ({
    flex: 1,
    padding: '8px 0',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    color: activeTab === tab ? 'var(--item-text)' : 'var(--item-meta)',
    fontWeight: activeTab === tab ? 500 : 400,
    position: 'relative',
    letterSpacing: '0.02em',
  })

  return (
    <div
      ref={panelRef}
      style={{
        width,
        flexShrink: 0,
        borderLeft: '0.5px solid var(--divider)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--sidebar-bg)',
        position: 'relative',
      }}
    >
      {/* Tab header */}
      <div style={{
        display: 'flex',
        borderBottom: '0.5px solid var(--divider)',
        flexShrink: 0,
        paddingInline: 4,
      }}>
        {(['todo', 'chat'] as PanelTab[]).map(tab => (
          <button key={tab} style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>
            {tab === 'todo'
              ? `待办${uncheckedCount > 0 ? ` · ${uncheckedCount}` : ''}`
              : 'AI 对话'}
            {activeTab === tab && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: '20%',
                right: '20%',
                height: 2,
                borderRadius: 1,
                background: 'var(--panel-tab-active-bar)',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeTab === 'todo' ? (
          <TodoContent
            todos={todos}
            onToggle={onToggleTodo}
            onAdd={onAddTodo}
            onDelete={onDeleteTodo}
            onSetDue={onSetTodoDue}
            onUpdateText={onUpdateTodoText}
            onNavigateToSource={onNavigateToSource}
          />
        ) : (
          <AiChatPanel messages={chatMessages} loading={chatLoading} />
        )}
      </div>

      {/* Processing queue strip (above input, only when items active) */}
      {activeQueueItems.length > 0 && (
        <div style={{ flexShrink: 0, borderTop: '0.5px solid var(--divider)' }}>
          <ProcessingQueue
            items={queueItems}
            onDismiss={onDismissQueueItem}
            onCancel={onCancelQueueItem}
            onRetry={onRetryQueueItem}
            activeLogPath={activeLogPath}
            onSetActiveLogPath={onSetActiveLogPath}
          />
        </div>
      )}

      {/* Scope switcher (only in chat tab) */}
      {activeTab === 'chat' && (
        <div style={{
          flexShrink: 0,
          padding: '6px 12px 0',
          display: 'flex',
          gap: 4,
        }}>
          {(['current', 'global'] as ChatScope[]).map(scope => (
            <button
              key={scope}
              onClick={() => setChatScope(scope)}
              style={{
                fontSize: 10,
                padding: '3px 8px',
                borderRadius: 12,
                border: '0.5px solid var(--divider)',
                background: chatScope === scope ? 'var(--segment-active-bg)' : 'transparent',
                color: chatScope === scope ? 'var(--segment-active-text)' : 'var(--segment-text)',
                cursor: 'pointer',
                letterSpacing: '0.03em',
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              {scope === 'current' ? '当前文件' : '全局'}
            </button>
          ))}
          {chatScope === 'current' && !selectedEntry && (
            <span style={{ fontSize: 10, color: 'var(--duration-text)', alignSelf: 'center', marginLeft: 4 }}>
              （未选中文件）
            </span>
          )}
        </div>
      )}

      {/* Pending file chips */}
      {hasFiles && (
        <div style={{
          flexShrink: 0,
          padding: '6px 12px 0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
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

      {/* Input bar */}
      <div style={{
        flexShrink: 0,
        padding: '8px 10px 10px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 6,
        borderTop: hasFiles || activeTab === 'chat' ? '0.5px solid var(--divider)' : 'none',
        marginTop: 6,
        position: 'relative',
      }}>
        {/* Upload button */}
        <button
          onClick={handleUpload}
          title="上传文件"
          style={{
            width: 30, height: 30, borderRadius: 7,
            border: '0.5px solid var(--divider)',
            background: 'var(--item-hover-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: 'var(--item-meta)', cursor: 'pointer',
            padding: 0, marginBottom: 1,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
        </button>

        {/* Textarea */}
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handleTextareaPaste}
          placeholder={activeTab === 'todo' ? '添加待办…' : '发送指令、提问或粘贴文本…'}
          rows={1}
          style={{
            flex: 1,
            background: 'var(--dock-paste-bg)',
            border: '0.5px solid var(--divider)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
            fontFamily: 'inherit',
            color: 'var(--item-text)',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.5,
            minHeight: 30,
            maxHeight: 80,
            overflow: 'hidden',
            caretColor: 'var(--record-btn)',
          } as React.CSSProperties}
        />

        {/* Mic / Send button (shared position) */}
        <div style={{ position: 'relative', width: 30, height: 30, flexShrink: 0, marginBottom: 1 }}>
          {/* Mic button */}
          <button
            onClick={onRecord}
            disabled={recorderStatus !== 'recording' && asrReady === false}
            title={
              recorderStatus !== 'recording' && asrReady === false
                ? '语音转写未就绪'
                : recorderStatus === 'recording' ? '停止录音' : '开始录音'
            }
            style={{
              position: 'absolute', inset: 0,
              width: 30, height: 30, borderRadius: 7,
              background: recorderStatus === 'recording' ? 'var(--accent)' : 'var(--record-btn)',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: recorderStatus !== 'recording' && asrReady === false ? 'not-allowed' : 'pointer',
              padding: 0,
              opacity: hasInput ? 0 : (recorderStatus !== 'recording' && asrReady === false ? 0.4 : 1),
              transform: hasInput ? 'scale(0.7)' : 'scale(1)',
              transition: 'opacity 0.15s ease, transform 0.15s ease',
              pointerEvents: hasInput ? 'none' : 'auto',
              animation: recorderStatus === 'recording' ? 'rec-pulse 1.2s ease-in-out infinite' : 'none',
            } as React.CSSProperties}
          >
            {recorderStatus === 'recording' ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--record-btn-icon)">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--record-btn-icon)">
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                <path d="M19 10a7 7 0 0 1-14 0M12 19v3M8 22h8" stroke="var(--record-btn-icon)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              </svg>
            )}
          </button>

          {/* Send button */}
          <button
            onClick={handleSubmit}
            title="发送"
            style={{
              position: 'absolute', inset: 0,
              width: 30, height: 30, borderRadius: 7,
              background: 'var(--record-btn)',
              border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0,
              opacity: hasInput ? 1 : 0,
              transform: hasInput ? 'scale(1)' : 'scale(0.7)',
              transition: 'opacity 0.15s ease, transform 0.15s ease',
              pointerEvents: hasInput ? 'auto' : 'none',
            } as React.CSSProperties}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--record-btn-icon)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* AI engine not ready overlay (over input area) */}
      {aiReady === false && (
        <div
          onClick={onOpenSettings}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 60,
            background: 'var(--sidebar-bg)',
            opacity: 0.96,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            zIndex: 5,
            borderTop: '0.5px solid var(--divider)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--item-meta)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: 12, color: 'var(--item-meta)', letterSpacing: '0.03em' }}>AI 引擎未配置</span>
          <span style={{
            fontSize: 11, color: 'var(--dock-paste-label)',
            background: 'var(--dock-paste-bg)',
            border: '0.5px solid var(--dock-paste-border)',
            borderRadius: 5, padding: '2px 8px', letterSpacing: '0.04em',
          }}>前往设置 →</span>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute',
          bottom: 68,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--ai-pill-bg)',
          border: '0.5px solid var(--ai-pill-border)',
          borderRadius: 8,
          padding: '6px 14px',
          fontSize: 12,
          color: 'var(--ai-pill-active-text)',
          whiteSpace: 'nowrap',
          letterSpacing: '0.04em',
          zIndex: 10,
          animation: 'card-enter 0.2s ease-out',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
