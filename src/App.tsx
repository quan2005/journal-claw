import { useState, useEffect, useRef, useCallback } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { listen } from '@tauri-apps/api/event'
import { TitleBar } from './components/TitleBar'
import { JournalList } from './components/JournalList'
import { DetailPanel } from './components/DetailPanel'
import { CommandDock } from './components/CommandDock'
import { ProcessingQueue } from './components/ProcessingQueue'
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
import { ConversationDialog } from './components/ConversationDialog'
import { useRecorder } from './hooks/useRecorder'
import { useJournal, RECORDING_PLACEHOLDER } from './hooks/useJournal'
import { useTheme } from './hooks/useTheme'
import { useTodos } from './hooks/useTodos'
import {
  importFile,
  importAudioFile,
  prepareAudioForAi,
  conversationGetMessages,
  getEngineConfig,
  getAsrConfig,
  checkWhisperkitCliInstalled,
  checkWhisperkitModelDownloaded,
  createSampleEntryIfNeeded,
  createSampleEntry,
  listAllJournalEntries,
  deleteIdentity,
  enqueueWork as invokeEnqueueWork,
  cancelWorkItem,
  retryWorkItem,
} from './lib/tauri'
import { fileKindFromName } from './lib/fileKind'
import type { JournalEntry, QueueItem, IdentityEntry, SessionMode } from './types'
import type { WorkspaceDirEntry } from './lib/tauri'
import { useTranslation } from './contexts/I18nContext'

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
    markItemFailed,
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
    setTodoSessionId,
  } = useTodos()
  const { identities, loading: identityLoading, refresh: refreshIdentity } = useIdentity()

  const [aiReady, setAiReady] = useState<boolean | null>(null)
  const [asrReady, setAsrReady] = useState<boolean | null>(null)
  const [audioRejected, setAudioRejected] = useState(false)
  const [view, setView] = useState<'journal' | 'settings'>('journal')
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>(
    undefined,
  )
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [dockOpen, setDockOpen] = useState(false)
  const [dockAppendText, setDockAppendText] = useState('')
  const [todoOpen, setTodoOpen] = useState(false)
  const [conversationState, setConversationState] = useState<{
    mode: SessionMode
    context?: string
    contextFiles?: string[]
    initialInput?: string
    initialSessionId?: string
    initialStreaming?: boolean
    initialUserMessage?: string
    key?: number
    _todoCallback?: { lineIndex: number; doneFile: boolean }
    visible: boolean
  } | null>(null)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('journal')
  const [selectedFile, setSelectedFile] = useState<WorkspaceDirEntry | null>(null)

  const handleTabChange = useCallback((tab: SidebarTab) => {
    setSidebarTab(tab)
  }, [])
  const [selectedIdentity, setSelectedIdentity] = useState<IdentityEntry | null>(null)
  const [mergeSource, setMergeSource] = useState<IdentityEntry | null>(null)
  const [todoWidth, setTodoWidth] = useState<number>(() => {
    const saved = localStorage.getItem('journal_todo_width')
    return saved ? parseInt(saved) : BASE_WIDTH
  })
  const [isTodoDragging, setIsTodoDragging] = useState(false)
  const todoDragStartX = useRef(0)
  const todoDragStartWidth = useRef(0)
  const [baseWidth, setBaseWidth] = useState<number>(() => {
    const saved = localStorage.getItem('journal_base_width')
    return saved ? parseInt(saved) : BASE_WIDTH
  })

  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)
  const entriesRef = useRef(entries)

  // Check AI engine availability on mount
  useEffect(() => {
    getEngineConfig()
      .then((cfg) => {
        const active = cfg.providers.find((p) => p.id === cfg.active_provider)
        const hasKey = (active?.api_key?.trim().length ?? 0) > 0
        setAiReady(hasKey)
      })
      .catch(() => setAiReady(false))
  }, [view]) // re-check after user closes settings

  // Check ASR readiness on mount and after settings are closed
  useEffect(() => {
    getAsrConfig()
      .then(async (cfg) => {
        if (cfg.asr_engine === 'apple') {
          setAsrReady(true)
          return
        }
        if (cfg.asr_engine === 'dashscope') {
          setAsrReady(cfg.dashscope_api_key.trim().length > 0)
          return
        }
        // whisperkit: need both CLI installed and model downloaded
        const [cliOk, modelOk] = await Promise.all([
          checkWhisperkitCliInstalled(),
          checkWhisperkitModelDownloaded(cfg.whisperkit_model),
        ])
        setAsrReady(cliOk && modelOk)
      })
      .catch(() => setAsrReady(false))
  }, [view]) // re-check after settings closed

  // Immediately clear overlay when an engine finishes installing successfully
  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen<{ engine: string; done: boolean; success: boolean }>(
      'engine-install-log',
      ({ payload }) => {
        if (payload.done && payload.success) setAiReady(true)
      },
    ).then((fn) => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  }, [])

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

  // Divider drag
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

  // Todo sidebar divider drag
  const onTodoDividerMouseDown = (e: React.MouseEvent) => {
    setIsTodoDragging(true)
    todoDragStartX.current = e.clientX
    todoDragStartWidth.current = todoWidth
  }
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isTodoDragging) return
      // Dragging left increases width, right decreases
      const delta = todoDragStartX.current - e.clientX
      const newWidth = Math.max(180, Math.min(560, todoDragStartWidth.current + delta))
      setTodoWidth(newWidth)
      localStorage.setItem('journal_todo_width', String(newWidth))
    }
    const onUp = () => setIsTodoDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isTodoDragging])

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

  // Open settings → about section from Rust menu
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

  // Track conversation session when work queue creates one (don't auto-open dialog)
  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen<{ item_id: string; session_id: string; prompt?: string }>(
      'work-item-session-created',
      (event) => {
        const { session_id, prompt } = event.payload
        setConversationState((prev) =>
          prev?.visible
            ? prev
            : {
                mode: 'agent',
                initialSessionId: session_id,
                initialStreaming: true,
                initialUserMessage: prompt,
                key: Date.now(),
                visible: false,
              },
        )
      },
    ).then((fn) => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  }, [])

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
        setTodoOpen((prev) => !prev)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setConversationState((prev) => {
          if (prev) return { ...prev, visible: !prev.visible }
          return {
            mode: 'agent',
            contextFiles: selectedEntry ? [selectedEntry.path] : undefined,
            visible: true,
          }
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

  const handleFilesSubmit = async (paths: string[], note?: string) => {
    setPendingFiles([])
    const importedPaths: string[] = []
    for (const path of paths) {
      try {
        const kind = fileKindFromName(path.split('/').pop() ?? path)
        if (kind === 'audio') {
          const result = await importAudioFile(path)
          importedPaths.push(result.path)
          addConvertingItem(result.path, result.filename)
          try {
            await prepareAudioForAi(result.path, result.year_month, note)
          } catch (audioErr) {
            console.error('[file-submit] audio prepare error:', String(audioErr))
            markItemFailed(result.path, String(audioErr))
          }
        } else {
          const result = await importFile(path)
          importedPaths.push(result.path)
        }
      } catch (err) {
        console.error('[file-submit] error:', String(err))
      }
    }
    // Non-audio files: enqueue in Rust work queue
    const nonAudioPaths = importedPaths.filter((p) => {
      const ext = p.split('.').pop()?.toLowerCase() ?? ''
      return !['m4a', 'wav', 'mp3', 'aac', 'ogg', 'flac'].includes(ext)
    })
    if (nonAudioPaths.length > 0) {
      const prompt = note ? `分析并处理这些文件。备注：${note}` : '分析并处理这些文件'
      const displayName = nonAudioPaths.map((p) => p.split('/').pop()).join(', ')
      try {
        await invokeEnqueueWork({ files: nonAudioPaths, prompt, displayName })
      } catch (err) {
        console.error('[file-submit] enqueue error:', String(err))
      }
    }
    refresh()
  }

  const handleFilesCancel = () => setPendingFiles([])

  const handleRemoveFile = (index: number) =>
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))

  const handleRecord = useCallback(async () => {
    if (status === 'idle') {
      await start()
    } else {
      await stop()
      addConvertingItem(RECORDING_PLACEHOLDER, t('recordingConverting'))
    }
  }, [status, start, stop, addConvertingItem, t])

  const handleDeselect = useCallback(() => setSelectedEntry(null), [])
  const handleOpenDock = useCallback(() => setDockOpen(true), [])
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
      setTodoOpen(true)
    },
    [addTodo],
  )
  const handleProcessEntry = useCallback((entry: JournalEntry) => {
    const rel = `${entry.year_month}/${entry.filename}`
    setDockAppendText(`@${rel}`)
  }, [])
  const handleVisualDesign = useCallback((entry: JournalEntry) => {
    const rel = `${entry.year_month}/${entry.filename}`
    setDockAppendText(`/visual-design-book @${rel}`)
  }, [])

  const handlePasteSubmit = async (text: string) => {
    const preview = text.slice(0, 30) + (text.length > 30 ? '…' : '')
    try {
      await invokeEnqueueWork({ text, displayName: preview })
    } catch (err) {
      console.error('[paste-submit] enqueue error:', String(err))
    }
  }

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

  const handlePasteFiles = useCallback(
    (paths: string[]) => {
      const audioExts = ['.m4a', '.mp3', '.wav', '.aac', '.ogg', '.flac', '.mp4']
      const isAudio = (p: string) => audioExts.some((ext) => p.toLowerCase().endsWith(ext))

      let filteredPaths = paths
      if (asrReady === false) {
        const audioCount = paths.filter(isAudio).length
        if (audioCount > 0) {
          filteredPaths = paths.filter((p) => !isAudio(p))
          setAudioRejected(true)
          setTimeout(() => setAudioRejected(false), 2500)
        }
      }

      setPendingFiles((prev) => {
        const existing = new Set(prev)
        const newPaths = filteredPaths.filter((p) => !existing.has(p))
        if (newPaths.length === 0) return prev
        return [...prev, ...newPaths].slice(0, 6)
      })
    },
    [asrReady],
  )

  // Drop handling via Tauri native file drop
  useEffect(() => {
    let unlisten: (() => void) | null = null
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const type = event.payload.type
        if (type === 'enter' || type === 'over') {
          setIsDragOver(true)
        } else if (type === 'leave') {
          setIsDragOver(false)
        } else if (type === 'drop') {
          setIsDragOver(false)
          const paths: string[] = (event.payload as { paths: string[] }).paths ?? []
          if (paths.length > 0) {
            handlePasteFiles(paths)
          }
        }
      })
      .then((fn) => {
        unlisten = fn
      })
    return () => {
      unlisten?.()
    }
  }, [refresh, handlePasteFiles])

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
        todoOpen={todoOpen}
        todoCount={todos.filter((t) => !t.done).length}
        onToggleTodo={() => setTodoOpen((prev) => !prev)}
        onOpenConversation={() => {
          setConversationState((prev) => {
            if (prev) return { ...prev, visible: !prev.visible }
            return {
              mode: 'agent',
              contextFiles: selectedEntry ? [selectedEntry.path] : undefined,
              visible: true,
            }
          })
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
                  setDockAppendText(`@${rel}`)
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
                  setDockAppendText(`@${rel}`)
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
              <FileTree
                selectedPath={selectedFile?.path ?? null}
                onSelectFile={setSelectedFile}
              />
            </div>
          </div>
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

        {/* Right: Detail panel / Identity detail */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: sidebarTab === 'journal' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <DetailPanel
              entry={selectedEntry}
              entries={entries}
              onDeselect={handleDeselect}
              onRecord={handleRecord}
              onOpenDock={handleOpenDock}
              onSelectSample={handleSelectSample}
              onAddToTodo={handleAddToTodo}
              onProcess={handleProcessEntry}
              onVisualDesign={handleVisualDesign}
            />
          </div>
          <div style={{ display: sidebarTab === 'identity' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <IdentityDetail
              identity={selectedIdentity}
              onRecord={handleRecord}
              onOpenDock={handleOpenDock}
            />
          </div>
          <div style={{ display: sidebarTab === 'files' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <FilePreviewPanel file={selectedFile} />
          </div>
        </div>

        {/* Todo sidebar */}
        {todoOpen && (
          <>
            <div
              onMouseDown={onTodoDividerMouseDown}
              style={{
                width: DIVIDER_WIDTH,
                flexShrink: 0,
                background: 'transparent',
                userSelect: 'none' as const,
                cursor: 'col-resize',
              }}
            />
            <TodoSidebar
              width={todoWidth}
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
                  // Check if session actually has messages (may fail for legacy brainstorm IDs)
                  let msgs: unknown[] = []
                  try {
                    msgs = await conversationGetMessages(opts.sessionId)
                  } catch {
                    // Session not found — treat as new
                  }
                  if (msgs.length > 0) {
                    // Has history — resume it; carry over streaming state if tracked
                    const wasStreaming =
                      conversationState?.initialSessionId === opts.sessionId &&
                      conversationState?.initialStreaming
                    setConversationState({
                      mode: 'agent',
                      initialSessionId: opts.sessionId,
                      initialStreaming: wasStreaming || false,
                      key: Date.now(),
                      visible: true,
                    })
                    return
                  }
                }
                // First time or empty session — open dialog immediately, let it create session
                setConversationState({
                  mode: 'agent',
                  initialInput: `/ideate ${opts.context}`,
                  key: Date.now(),
                  visible: true,
                  _todoCallback: { lineIndex: opts.lineIndex, doneFile: opts.doneFile },
                })
              }}
              onNavigateToSource={(filename: string) => {
                const match = entries.find((e) => e.filename === filename)
                if (match) {
                  setSidebarTab('journal')
                  setSelectedEntry(match)
                }
              }}
            />
          </>
        )}
      </div>

      {conversationState && (
        <ConversationDialog
          key={conversationState.key ?? 0}
          mode={conversationState.mode}
          context={conversationState.context}
          contextFiles={conversationState.contextFiles}
          initialInput={conversationState.initialInput}
          initialSessionId={conversationState.initialSessionId}
          initialStreaming={conversationState.initialStreaming}
          initialUserMessage={conversationState.initialUserMessage}
          visible={conversationState.visible}
          onClose={() =>
            setConversationState((prev) =>
              prev
                ? {
                    ...prev,
                    visible: false,
                    initialInput: undefined,
                    initialSessionId: undefined,
                    initialUserMessage: undefined,
                    initialStreaming: undefined,
                    _todoCallback: undefined,
                  }
                : null,
            )
          }
          onSessionCreated={(sid) => {
            const cb = conversationState?._todoCallback
            if (cb) {
              setTodoSessionId(cb.lineIndex, sid, cb.doneFile)
            }
          }}
        />
      )}

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
      <div
        style={{
          position: 'relative',
          flexShrink: 0,
          display: view === 'settings' ? 'none' : undefined,
        }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
          }}
        >
          <ProcessingQueue
            items={visibleQueueItems}
            onDismiss={dismissQueueItem}
            onCancel={handleCancelQueueItem}
            onRetry={handleRetryQueueItem}
            onOpenConversation={(queueItem) => {
              if (queueItem.sessionId) {
                setConversationState({
                  mode: 'agent',
                  initialSessionId: queueItem.sessionId,
                  initialStreaming: queueItem.status === 'processing',
                  key: Date.now(),
                  visible: true,
                })
              }
            }}
          />
        </div>
        <CommandDock
          isDragOver={isDragOver}
          pendingFiles={pendingFiles}
          onPasteSubmit={handlePasteSubmit}
          onFilesSubmit={handleFilesSubmit}
          onFilesCancel={handleFilesCancel}
          onRemoveFile={handleRemoveFile}
          onPasteFiles={handlePasteFiles}
          recorderStatus={status}
          onRecord={handleRecord}
          asrReady={asrReady}
          audioRejected={audioRejected}
          onOpenSettings={() => setView((v) => (v === 'settings' ? 'journal' : 'settings'))}
          externalOpen={dockOpen}
          onExternalOpenConsumed={() => setDockOpen(false)}
          appendText={dockAppendText}
          onAppendTextConsumed={() => setDockAppendText('')}
        />
        {aiReady === false && (
          <div
            onClick={() => setView('settings')}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--bg)',
              opacity: 0.93,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              cursor: 'pointer',
              zIndex: 20,
              borderTop: '0.5px solid var(--divider)',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--item-meta)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--item-meta)',
                letterSpacing: '0.03em',
              }}
            >
              {t('aiNotConfigured')}
            </span>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--dock-paste-label)',
                background: 'var(--dock-paste-bg)',
                border: '0.5px solid var(--dock-paste-border)',
                borderRadius: 5,
                padding: '2px 8px',
                letterSpacing: '0.04em',
              }}
            >
              {t('goToSettings')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
