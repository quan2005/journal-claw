import { useState, useEffect, useRef, useCallback } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { listen } from '@tauri-apps/api/event'
import { TitleBar } from './components/TitleBar'
import { JournalList } from './components/JournalList'
import { DetailPanel } from './components/DetailPanel'
import { SettingsPanel } from './settings/SettingsPanel'
import { IdentityList, SOUL_PATH } from './components/IdentityList'
import { IdentityDetail } from './components/IdentityDetail'
import { MergeIdentityDialog } from './components/MergeIdentityDialog'
import { SidebarTabs } from './components/SidebarTabs'
import type { SidebarTab } from './components/SidebarTabs'
import { FileTree } from './components/FileTree'
import { FilePreviewPanel } from './components/FilePreviewPanel'
import { useIdentity } from './hooks/useIdentity'
import { TodoSidebar } from './components/TodoSidebar'
import { useRecorder } from './hooks/useRecorder'
import { useJournal, RECORDING_PLACEHOLDER } from './hooks/useJournal'
import { useTheme } from './hooks/useTheme'
import { useTodos } from './hooks/useTodos'
import {
  getEngineConfig,
  getAsrConfig,
  checkWhisperkitCliInstalled,
  checkWhisperkitModelDownloaded,
  createSampleEntryIfNeeded,
  createSampleEntry,
  listAllJournalEntries,
  deleteIdentity,
  cancelWorkItem,
  retryWorkItem,
  prepareAudioForAi,
} from './lib/tauri'
import type { JournalEntry, QueueItem, IdentityEntry } from './types'
import type { WorkspaceDirEntry } from './lib/tauri'
import { useTranslation } from './contexts/I18nContext'
import { RightPanel } from './components/RightPanel'
import type { RightPanelTab } from './components/RightPanel'
import { ChatPanel } from './components/ChatPanel'
import { SessionList } from './components/SessionList'
import { useConversation } from './hooks/useConversation'

const BASE_WIDTH = 320
const DIVIDER_WIDTH = 7

export default function App() {
  const { t } = useTranslation()
  const { status, start, stop } = useRecorder()
  const {
    entries,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    queueItems,
    isProcessing,
    dismissQueueItem,
    addConvertingItem,
    retryQueueItem,
    refresh,
  } = useJournal()
  const { theme, setTheme } = useTheme()
  const {
    todos,
    addTodo,
    toggleTodo,
    deleteTodo,
    setTodoDue,
    updateTodoText,
    setTodoPath,
    removeTodoPath,
  } = useTodos()
  const { identities, loading: identityLoading, refresh: refreshIdentity } = useIdentity()

  const [view, setView] = useState<'journal' | 'settings'>('journal')
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>(
    undefined,
  )
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('journal')
  const [selectedFile, setSelectedFile] = useState<WorkspaceDirEntry | null>(null)

  const handleTabChange = useCallback((tab: SidebarTab) => {
    setSidebarTab(tab)
  }, [])
  const [selectedIdentity, setSelectedIdentity] = useState<IdentityEntry | null>(null)
  const [mergeSource, setMergeSource] = useState<IdentityEntry | null>(null)
  const [baseWidth, setBaseWidth] = useState<number>(() => {
    const saved = localStorage.getItem('journal_base_width')
    return saved ? parseInt(saved) : BASE_WIDTH
  })

  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)
  const entriesRef = useRef(entries)

  // Right panel state
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('ideas')
  const rightPanelTabRef = useRef<RightPanelTab>('ideas')
  useEffect(() => {
    rightPanelTabRef.current = rightPanelTab
  }, [rightPanelTab])
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('journal_right_panel_width')
    return saved ? parseInt(saved) : 320
  })

  // Check AI engine availability on mount
  useEffect(() => {
    getEngineConfig()
      .then((cfg) => {
        const active = cfg.providers.find((p) => p.id === cfg.active_provider)
        const hasKey = (active?.api_key?.trim().length ?? 0) > 0
        if (!hasKey) {
          console.warn('[App] AI engine not configured')
        }
      })
      .catch(() => {})
  }, [view]) // re-check after user closes settings

  // Check ASR readiness on mount and after settings are closed
  useEffect(() => {
    getAsrConfig()
      .then(async (cfg) => {
        if (cfg.asr_engine === 'apple') {
          return
        }
        if (cfg.asr_engine === 'dashscope') {
          if (cfg.dashscope_api_key.trim().length === 0) {
            console.warn('[App] ASR not configured')
          }
          return
        }
        // whisperkit: need both CLI installed and model downloaded
        const [cliOk, modelOk] = await Promise.all([
          checkWhisperkitCliInstalled(),
          checkWhisperkitModelDownloaded(cfg.whisperkit_model),
        ])
        if (!cliOk || !modelOk) {
          console.warn('[App] WhisperKit not ready')
        }
      })
      .catch(() => {})
  }, [view]) // re-check after settings closed

  // 首次启动：写入示例条目并自动选中
  useEffect(() => {
    createSampleEntryIfNeeded()
      .then(async (created) => {
        if (!created) return
        await refresh()
        const all = await listAllJournalEntries()
        const sample = all.find((e) => e.title === '产品评审示例')
        if (sample) setSelectedEntry(sample)
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Divider drag (left sidebar)
  const onDividerMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    dragStartX.current = e.clientX
    dragStartWidth.current = baseWidth
  }
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging) return
      const delta = e.clientX - dragStartX.current
      const newWidth = Math.max(220, Math.min(560, dragStartWidth.current + delta))
      setBaseWidth(newWidth)
      localStorage.setItem('journal_base_width', String(newWidth))
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging])

  // Right panel divider drag
  const [isRightPanelDragging, setIsRightPanelDragging] = useState(false)
  const rightPanelDragStartX = useRef(0)
  const rightPanelDragStartWidth = useRef(0)

  const onRightPanelDividerMouseDown = (e: React.MouseEvent) => {
    setIsRightPanelDragging(true)
    rightPanelDragStartX.current = e.clientX
    rightPanelDragStartWidth.current = rightPanelWidth
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isRightPanelDragging) return
      const delta = rightPanelDragStartX.current - e.clientX
      const newWidth = Math.max(200, Math.min(480, rightPanelDragStartWidth.current + delta))
      setRightPanelWidth(newWidth)
      localStorage.setItem('journal_right_panel_width', String(newWidth))
    }
    const onUp = () => setIsRightPanelDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isRightPanelDragging])

  // journal-entry-deleted event
  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent<{ path?: string }>).detail?.path
      if (path && selectedEntry?.path === path) setSelectedEntry(null)
      refresh()
    }
    window.addEventListener('journal-entry-deleted', handler)
    return () => window.removeEventListener('journal-entry-deleted', handler)
  }, [refresh, selectedEntry])

  // Keep entriesRef in sync so navigate handler always sees latest entries
  // Also sync selectedEntry so DetailPanel sees updated mtime_secs after file changes
  useEffect(() => {
    entriesRef.current = entries
    setSelectedEntry((prev) => {
      if (!prev) return prev
      const updated = entries.find((e) => e.path === prev.path)
      return updated && updated.mtime_secs !== prev.mtime_secs ? updated : prev
    })
  }, [entries])

  // Navigate to a journal entry via .md link click
  useEffect(() => {
    const handler = (e: Event) => {
      const { path: targetPath, filename: targetFilename } = (e as CustomEvent).detail ?? {}
      if (!targetPath && !targetFilename) return
      const current = entriesRef.current
      let match = targetPath ? current.find((entry) => entry.path === targetPath) : undefined
      if (!match && targetFilename) {
        match = current.find((entry) => entry.filename === targetFilename)
      }
      if (match) setSelectedEntry(match)
    }
    window.addEventListener('journal-entry-navigate', handler)
    return () => window.removeEventListener('journal-entry-navigate', handler)
  }, [])

  // Open settings from Rust menu (Cmd+,) or keyboard shortcut
  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen('open-settings', () => {
      setSettingsInitialSection(undefined)
      setView('settings')
    }).then((fn) => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  }, [])

  // Open settings -> about section from Rust menu
  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen('open-settings-about', () => {
      setSettingsInitialSection('about')
      setView('settings')
    }).then((fn) => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  }, [])

  // useConversation hook
  const {
    sessionId,
    messages,
    isStreaming,
    usage,
    stats,
    create,
    send,
    retry,
    cancel,
    load,
    editAndResend,
    pendingQueue,
    removePendingItem,
  } = useConversation()

  // Helper to open chat panel
  const openChatPanel = useCallback(
    (sid?: string, context?: string, contextFiles?: string[]) => {
      setRightPanelOpen(true)
      setRightPanelTab('chat')
      if (sid) load(sid)
      if (context || contextFiles) create('agent', context, contextFiles)
    },
    [load, create],
  )

  // Track conversation session when work queue creates one
  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen<{ item_id: string; session_id: string; prompt?: string }>(
      'work-item-session-created',
      (event) => {
        const { session_id } = event.payload
        openChatPanel(session_id)
      },
    ).then((fn) => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  }, [openChatPanel])

  // Esc closes settings; Cmd+, toggles settings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setView('journal')
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setView((v) => (v === 'settings' ? 'journal' : 'settings'))
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault()
        setRightPanelOpen((prev) => {
          if (!prev) {
            setRightPanelTab('ideas')
            return true
          }
          if (rightPanelTabRef.current === 'ideas') return false
          setRightPanelTab('ideas')
          return true
        })
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setRightPanelOpen((prev) => {
          if (!prev) {
            setRightPanelTab('chat')
            return true
          }
          setRightPanelTab('chat')
          return true
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Zoom: Cmd+Plus / Cmd+Minus / Cmd+0
  useEffect(() => {
    let zoom = 1
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoom = Math.min(2, zoom + 0.1)
        getCurrentWebview().setZoom(zoom)
      } else if (e.key === '-') {
        e.preventDefault()
        zoom = Math.max(0.5, zoom - 0.1)
        getCurrentWebview().setZoom(zoom)
      } else if (e.key === '0') {
        e.preventDefault()
        zoom = 1
        getCurrentWebview().setZoom(1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleRecord = useCallback(async () => {
    if (status === 'idle') {
      await start()
    } else {
      await stop()
      addConvertingItem(RECORDING_PLACEHOLDER, t('recordingConverting'))
    }
  }, [status, start, stop, addConvertingItem, t])

  const handleDeselect = useCallback(() => setSelectedEntry(null), [])
  const handleOpenChat = useCallback(() => {
    setRightPanelOpen(true)
    setRightPanelTab('chat')
  }, [])
  const handleSelectSample = useCallback(() => {
    createSampleEntry()
      .then(async () => {
        await refresh()
        const all = await listAllJournalEntries()
        const sample = all.find((e) => e.title === '产品评审示例')
        if (sample) setSelectedEntry(sample)
      })
      .catch(() => {})
  }, [refresh])
  const handleAddToTodo = useCallback(
    (text: string, source: string) => {
      addTodo(text, undefined, source)
      setRightPanelOpen(true)
      setRightPanelTab('ideas')
    },
    [addTodo],
  )
  const handleProcessEntry = useCallback(
    (entry: JournalEntry) => {
      const rel = `${entry.year_month}/${entry.filename}`
      openChatPanel(undefined, `分析并处理日志 @${rel}`)
    },
    [openChatPanel],
  )
  const handleVisualDesign = useCallback(
    (entry: JournalEntry) => {
      const rel = `${entry.year_month}/${entry.filename}`
      openChatPanel(undefined, `/visual-design-book @${rel}`)
    },
    [openChatPanel],
  )

  const handleCancelQueueItem = async (item: QueueItem) => {
    try {
      await cancelWorkItem(item.id)
    } catch {
      // Fallback for local items (recording/converting)
      dismissQueueItem(item.id)
    }
  }

  const handleRetryQueueItem = async (item: QueueItem) => {
    // Rust work queue items: retry via Rust
    if (item.id.startsWith('wq-')) {
      try {
        await retryWorkItem(item.id)
      } catch (err) {
        console.error('[retry] error:', String(err))
      }
      return
    }
    // Local items (audio pipeline)
    const parts = item.path.split('/')
    const rawIdx = parts.lastIndexOf('raw')
    const yearMonth = rawIdx > 0 ? parts[rawIdx - 1] : (parts.slice(-2, -1)[0] ?? '')
    retryQueueItem(item.path, 'converting')
    try {
      await prepareAudioForAi(item.path, yearMonth)
    } catch (err) {
      console.error('[retry] audio error:', String(err))
    }
  }

  const processingItem = queueItems.find((i) => i.status === 'processing')
  const processingFilename = processingItem?.filename

  // Inject a virtual 'recording' item at the front of the queue when recording
  const visibleQueueItems =
    status === 'recording'
      ? [
          {
            id: RECORDING_PLACEHOLDER,
            path: RECORDING_PLACEHOLDER,
            filename: t('recordingStatus'),
            status: 'recording' as const,
            addedAt: Date.now(),
            logs: [],
          },
          ...queueItems,
        ]
      : queueItems

  // Preserved for future work queue UI integration in RightPanel
  const _preserved = { handleCancelQueueItem, handleRetryQueueItem, visibleQueueItems }
  void _preserved

  const SOUL_ENTRY: IdentityEntry = {
    filename: '__soul__',
    path: SOUL_PATH,
    name: t('assistantName'),
    region: '',
    summary: t('assistantDesc'),
    tags: [],
    speaker_id: '',
    mtime_secs: 0,
  }
  const allIdentities: IdentityEntry[] = [SOUL_ENTRY, ...identities]

  const handleDeleteIdentity = async (identity: IdentityEntry) => {
    if (!window.confirm(t('confirmDeleteIdentity', { name: identity.name }))) return
    try {
      await deleteIdentity(identity.path)
      if (selectedIdentity?.path === identity.path) setSelectedIdentity(null)
      refreshIdentity()
    } catch (e) {
      console.error('[App] identity delete failed', e)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      <TitleBar
        theme={theme}
        onThemeChange={setTheme}
        isProcessing={isProcessing}
        processingFilename={processingFilename}
        view={view}
        rightPanelOpen={rightPanelOpen}
        todoCount={todos.filter((t) => !t.done).length}
        onToggleRightPanel={() =>
          setRightPanelOpen((prev) => {
            if (!prev) {
              setRightPanelTab('ideas')
              return true
            }
            if (rightPanelTabRef.current === 'ideas') return false
            setRightPanelTab('ideas')
            return true
          })
        }
        onOpenChat={() => {
          setRightPanelOpen(true)
          setRightPanelTab('chat')
        }}
      />

      {view === 'settings' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            top: 38,
            zIndex: 10,
            overflow: 'hidden',
            animation: 'view-enter 0.2s ease-out',
            background: 'var(--bg)',
          }}
        >
          <SettingsPanel
            initialSection={settingsInitialSection}
            onSectionConsumed={() => setSettingsInitialSection(undefined)}
            onClose={() => setView('journal')}
          />
        </div>
      )}

      <div style={{ display: view === 'settings' ? 'none' : 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Journal list / Identity list */}
        <div
          style={{
            width: baseWidth,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRight: '0.5px solid var(--divider)',
          }}
        >
          <SidebarTabs active={sidebarTab} onChange={handleTabChange} />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: sidebarTab === 'journal' ? 'flex' : 'none',
                flexDirection: 'column',
              }}
            >
              <JournalList
                entries={entries}
                loading={loading}
                selectedPath={selectedEntry?.path ?? null}
                onSelect={setSelectedEntry}
                onProcess={(entry) => {
                  const rel = `${entry.year_month}/${entry.filename}`
                  openChatPanel(undefined, `分析并处理日志 @${rel}`)
                }}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={loadMore}
              />
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: sidebarTab === 'identity' ? 'flex' : 'none',
                flexDirection: 'column',
              }}
            >
              <IdentityList
                identities={allIdentities}
                loading={identityLoading}
                selectedPath={selectedIdentity?.path ?? null}
                onSelect={(identity) => setSelectedIdentity(identity)}
                onProcess={(identity) => {
                  const rel = `identity/${identity.filename}`
                  openChatPanel(undefined, `分析并处理画像 @${rel}`)
                }}
                onMerge={(identity) => setMergeSource(identity)}
                onDelete={handleDeleteIdentity}
              />
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: sidebarTab === 'files' ? 'flex' : 'none',
                flexDirection: 'column',
              }}
            >
              <FileTree selectedPath={selectedFile?.path ?? null} onSelectFile={setSelectedFile} />
            </div>
          </div>

          {/* Settings button fixed at bottom */}
          {view !== 'settings' && (
            <div
              style={{
                borderTop: '0.5px solid var(--divider)',
                flexShrink: 0,
                padding: '6px 10px',
              }}
            >
              <button
                onClick={() => setView('settings')}
                title="Settings (⌘,)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--item-meta)',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  transition: 'background 0.15s ease-out',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--item-hover-bg)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span style={{ flex: 1, textAlign: 'left' }}>设置</span>
                <kbd
                  style={{
                    fontSize: '0.5625rem',
                    color: 'var(--item-meta)',
                    opacity: 0.4,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  ⌘,
                </kbd>
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div
          onMouseDown={onDividerMouseDown}
          style={{
            width: DIVIDER_WIDTH,
            flexShrink: 0,
            background: 'transparent',
            userSelect: 'none' as const,
            cursor: 'col-resize',
          }}
        />

        {/* Center: Detail panel / Identity detail */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: sidebarTab === 'journal' ? 'flex' : 'none',
              flexDirection: 'column',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <DetailPanel
              entry={selectedEntry}
              entries={entries}
              onDeselect={handleDeselect}
              onRecord={handleRecord}
              onOpenDock={handleOpenChat}
              onSelectSample={handleSelectSample}
              onAddToTodo={handleAddToTodo}
              onProcess={handleProcessEntry}
              onVisualDesign={handleVisualDesign}
            />
          </div>
          <div
            style={{
              display: sidebarTab === 'identity' ? 'flex' : 'none',
              flexDirection: 'column',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <IdentityDetail
              identity={selectedIdentity}
              onRecord={handleRecord}
              onOpenDock={handleOpenChat}
            />
          </div>
          <div
            style={{
              display: sidebarTab === 'files' ? 'flex' : 'none',
              flexDirection: 'column',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <FilePreviewPanel file={selectedFile} />
          </div>
        </div>

        {/* Right Panel */}
        {rightPanelOpen && (
          <>
            <div
              onMouseDown={onRightPanelDividerMouseDown}
              style={{
                width: DIVIDER_WIDTH,
                flexShrink: 0,
                background: 'transparent',
                userSelect: 'none' as const,
                cursor: 'col-resize',
              }}
            />
            <div
              style={{
                width: rightPanelWidth,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <RightPanel
                activeTab={rightPanelTab}
                onTabChange={setRightPanelTab}
                ideasContent={
                  <TodoSidebar
                    todos={todos}
                    onToggle={toggleTodo}
                    onAdd={addTodo}
                    onDelete={deleteTodo}
                    onSetDue={setTodoDue}
                    onUpdateText={updateTodoText}
                    onSetPath={setTodoPath}
                    onRemovePath={removeTodoPath}
                    onOpenConversation={async (opts) => {
                      if (opts.sessionId) {
                        openChatPanel(opts.sessionId)
                      } else {
                        openChatPanel(undefined, opts.context)
                      }
                    }}
                    onNavigateToSource={(filename: string) => {
                      const match = entries.find((e) => e.filename === filename)
                      if (match) {
                        setSidebarTab('journal')
                        setSelectedEntry(match)
                      }
                    }}
                  />
                }
                chatContent={
                  <ChatPanel
                    sessionId={sessionId}
                    mode="agent"
                    messages={messages}
                    isStreaming={isStreaming}
                    usage={usage}
                    stats={stats}
                    pendingQueue={pendingQueue}
                    onSend={send}
                    onCancel={cancel}
                    onRetry={retry}
                    onEditAndResend={editAndResend}
                    onRemovePendingItem={removePendingItem}
                    onContinue={() => send('请继续')}
                  />
                }
                historyContent={
                  <SessionList
                    activeSessionId={sessionId}
                    onSelect={(id: string) => openChatPanel(id)}
                    fullWidth
                  />
                }
              />
            </div>
          </>
        )}
      </div>

      {mergeSource && (
        <MergeIdentityDialog
          source={mergeSource}
          onClose={() => setMergeSource(null)}
          onMerged={() => {
            setMergeSource(null)
            if (selectedIdentity?.path === mergeSource.path) setSelectedIdentity(null)
            refreshIdentity()
          }}
        />
      )}
    </div>
  )
}
