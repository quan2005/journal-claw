import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { listen } from '@tauri-apps/api/event'
import { TitleBar } from './components/TitleBar'
import { TreeSidebar } from './components/TreeSidebar'
import { DetailView } from './components/DetailView'
import { AutomationWorkbench } from './components/AutomationWorkbench'
const SettingsPanel = lazy(() =>
  import('./settings/SettingsPanel').then((m) => ({ default: m.SettingsPanel })),
)
import { MergeIdentityDialog } from './components/MergeIdentityDialog'
import { useIdentity } from './hooks/useIdentity'
import { useJournal } from './hooks/useJournal'
import { useTheme } from './hooks/useTheme'
import { useUI } from './contexts/UIContext'
import { useTodoContext } from './contexts/TodoContext'
import {
  importFile,
  importAudioFile,
  getEngineConfig,
  getAsrConfig,
  checkWhisperkitCliInstalled,
  checkWhisperkitModelDownloaded,
  createSampleEntryIfNeeded,
  createSampleEntry,
  listAllJournalEntries,
  enqueueWork as invokeEnqueueWork,
  cancelWorkItem,
  retryWorkItem,
  prepareAudioForAi,
  getWorkspacePath,
  getOnboardingStatus,
  completeOnboarding,
} from './lib/tauri'
import { fileKindFromName } from './lib/fileKind'
import type { JournalEntry, QueueItem, IdentityEntry, TreeSelection } from './types'
import { useTranslation } from './contexts/I18nContext'
import { RightPanel } from './components/RightPanel'
import { ChatPanel } from './components/ChatPanel'
import { useConversation } from './hooks/useConversation'
import OnboardingView from './components/OnboardingView'

const SOUL_PATH = '__soul__'
const DIVIDER_WIDTH = 7

export default function App() {
  const { t } = useTranslation()
  const {
    entries,
    loading: _loading,
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
  const { todos, addTodo } = useTodoContext()
  const { identities, loading: identityLoading, refresh: refreshIdentity } = useIdentity()

  const {
    view,
    setView,
    settingsInitialSection,
    setSettingsInitialSection,
    selectedEntry,
    setSelectedEntry,
    isDragging,
    setIsDragging,
    isDragOver,
    setIsDragOver,
    treeSelection,
    setTreeSelection,
    showIdeas,
    setShowIdeas,
    sidebarWidth,
    setSidebarWidth,
    rightPanelOpen,
    setRightPanelOpen,
    rightPanelWidth,
    setRightPanelWidth,
    chatInitialText,
    setChatInitialText,
    deselect,
  } = useUI()

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingLoading, setOnboardingLoading] = useState(true)
  const [defaultWsPath, setDefaultWsPath] = useState('')

  useEffect(() => {
    Promise.all([getOnboardingStatus(), getWorkspacePath()])
      .then(([status, wsPath]) => {
        setDefaultWsPath(wsPath || '')
        if (!status.completed) {
          setShowOnboarding(true)
        }
        setOnboardingLoading(false)
      })
      .catch(() => setOnboardingLoading(false))
  }, [])

  const [selectedIdentity, setSelectedIdentity] = useState<IdentityEntry | null>(null)
  const [mergeSource, setMergeSource] = useState<IdentityEntry | null>(null)

  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)
  const entriesRef = useRef(entries)

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
        switch (cfg.asr_engine) {
          case 'apple':
            return
          case 'whisperkit': {
            const [cliOk, modelOk] = await Promise.all([
              checkWhisperkitCliInstalled(),
              checkWhisperkitModelDownloaded(cfg.whisperkit_model),
            ])
            if (!cliOk || !modelOk) {
              console.warn('[App] WhisperKit not ready')
            }
            return
          }
          case 'dashscope':
            if (cfg.dashscope_api_key.trim().length === 0) {
              console.warn('[App] ASR not configured')
            }
            return
          case 'siliconflow':
            if (cfg.siliconflow_asr_api_key.trim().length === 0) {
              console.warn('[App] ASR not configured')
            }
            return
          case 'zhipu':
            if (cfg.zhipu_asr_api_key.trim().length === 0) {
              console.warn('[App] ASR not configured')
            }
        }
      })
      .catch(() => {})
  }, [view]) // re-check after settings closed

  // Divider drag (left sidebar)
  const onDividerMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    dragStartX.current = e.clientX
    dragStartWidth.current = sidebarWidth
  }
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging) return
      const delta = e.clientX - dragStartX.current
      const newWidth = Math.max(220, Math.min(560, dragStartWidth.current + delta))
      setSidebarWidth(newWidth)
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging, setIsDragging, setSidebarWidth])

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
  }, [isRightPanelDragging, setRightPanelWidth])

  // journal-entry-deleted event
  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent<{ path?: string }>).detail?.path
      if (path && selectedEntry?.path === path) setSelectedEntry(null)
      refresh()
    }
    window.addEventListener('journal-entry-deleted', handler)
    return () => window.removeEventListener('journal-entry-deleted', handler)
  }, [refresh, selectedEntry, setSelectedEntry])

  // Keep entriesRef in sync so navigate handler always sees latest entries
  // Also sync selectedEntry so DetailView sees updated mtime_secs after file changes
  useEffect(() => {
    entriesRef.current = entries
    setSelectedEntry((prev) => {
      if (!prev) return prev
      const updated = entries.find((e) => e.path === prev.path)
      return updated && updated.mtime_secs !== prev.mtime_secs ? updated : prev
    })
  }, [entries, setSelectedEntry])

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
  }, [setSelectedEntry])

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
  }, [setSettingsInitialSection, setView])

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
  }, [setSettingsInitialSection, setView])

  // useConversation hook (multi-session)
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
    newTab,
  } = useConversation()

  // Helper to open chat panel (creates new tab per interaction)
  const openChatPanel = useCallback(
    (sid?: string, initialText?: string, contextFiles?: string[]) => {
      setRightPanelOpen(true)
      if (sid) {
        // Open existing session as a tab
        load(sid, undefined, initialText)
      } else if (contextFiles) {
        // Create new tab with context files
        create(undefined, contextFiles)
        if (initialText) setChatInitialText(initialText)
      } else {
        // Plain new tab
        newTab()
        if (initialText) setChatInitialText(initialText)
      }
    },
    [create, load, newTab, setChatInitialText, setRightPanelOpen],
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
        setRightPanelOpen((prev) => !prev)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setRightPanelOpen((prev) => !prev)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        newTab()
        setRightPanelOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [newTab, setRightPanelOpen, setView])

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

  // ── Global file drop handling ──────────────────────────────

  const handleFilesSubmit = useCallback(
    async (paths: string[]) => {
      const importedPaths: string[] = []
      for (const path of paths) {
        try {
          const kind = fileKindFromName(path.split(/[\\/]/).pop() ?? path)
          if (kind === 'audio') {
            const result = await importAudioFile(path)
            importedPaths.push(result.path)
            addConvertingItem(result.path, result.filename)
            try {
              await prepareAudioForAi(result.path, result.year_month)
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
        const prompt = '分析并处理这些文件'
        const displayName = nonAudioPaths.map((p) => p.split(/[\\/]/).pop()).join(', ')
        try {
          await invokeEnqueueWork({ files: nonAudioPaths, prompt, displayName })
        } catch (err) {
          console.error('[file-submit] enqueue error:', String(err))
        }
      }
      refresh()
    },
    [addConvertingItem, markItemFailed, refresh],
  )

  const handleDropFiles = useCallback(
    (paths: string[]) => {
      if (paths.length > 0) {
        handleFilesSubmit(paths)
      }
    },
    [handleFilesSubmit],
  )

  // Tauri native file drop listener
  useEffect(() => {
    let unlisten: (() => void) | null = null
    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === 'drop') {
          setIsDragOver(false)
          const paths: string[] = (event.payload as { paths: string[] }).paths ?? []
          if (paths.length > 0) {
            handleDropFiles(paths)
          }
        } else if (event.payload.type === 'enter' || event.payload.type === 'over') {
          setIsDragOver(true)
        } else if (event.payload.type === 'leave') {
          setIsDragOver(false)
        }
      })
      .then((fn) => {
        unlisten = fn
      })
    return () => {
      unlisten?.()
    }
  }, [handleDropFiles, setIsDragOver])

  const handleDeselect = useCallback(() => {
    deselect()
  }, [deselect])

  const handleTreeSelect = useCallback(
    (sel: TreeSelection) => {
      setView('journal')
      setShowIdeas(false)
      setTreeSelection(sel)
    },
    [setShowIdeas, setTreeSelection, setView],
  )

  const handleSelectIdeas = useCallback(() => {
    setView('journal')
    setShowIdeas((prev) => !prev)
  }, [setShowIdeas, setView])

  const handleSelectAutomation = useCallback(() => {
    setShowIdeas(false)
    setSelectedEntry(null)
    setTreeSelection({ type: 'automation', path: '__automation__' })
    setView('automation')
  }, [setSelectedEntry, setShowIdeas, setTreeSelection, setView])

  const handleOpenChat = useCallback(() => {
    setRightPanelOpen(true)
  }, [setRightPanelOpen])
  const handleSelectSample = useCallback(() => {
    createSampleEntry()
      .then(async () => {
        await refresh()
        const all = await listAllJournalEntries()
        const sample = all.find((e) => e.title === '产品评审示例')
        if (sample) setSelectedEntry(sample)
      })
      .catch(() => {})
  }, [refresh, setSelectedEntry])
  const handleAddToTodo = useCallback(
    (text: string, source: string) => {
      addTodo(text, undefined, source)
      setShowIdeas(true)
    },
    [addTodo, setShowIdeas],
  )
  const handleProcessEntry = useCallback(
    (entry: JournalEntry) => {
      const rel = `${entry.year_month}/${entry.filename}`
      setRightPanelOpen(true)
      window.dispatchEvent(new CustomEvent('chat-append-text', { detail: `@${rel}` }))
    },
    [setRightPanelOpen],
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
      // Fallback for local audio conversion items
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
    const parts = item.path.split(/[\\/]/)
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

  // Preserved for future work queue UI integration in RightPanel
  const _preserved = { handleCancelQueueItem, handleRetryQueueItem, queueItems }
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

  const handleOnboardingComplete = useCallback(async () => {
    await completeOnboarding()
    setShowOnboarding(false)
    // Trigger sample entry creation after onboarding completes (original first-run logic)
    createSampleEntryIfNeeded()
      .then(async (created) => {
        if (!created) return
        await refresh()
        const all = await listAllJournalEntries()
        const sample = all.find((e) => e.title === '产品评审示例')
        if (sample) setSelectedEntry(sample)
      })
      .catch(() => {})
  }, [refresh, setSelectedEntry])

  const todayDate = new Date()
  const todayYearMonth = `${String(todayDate.getFullYear()).slice(2)}${String(todayDate.getMonth() + 1).padStart(2, '0')}`
  const todayDay = todayDate.getDate()

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
      {showOnboarding && !onboardingLoading && (
        <OnboardingView
          defaultWorkspacePath={defaultWsPath}
          onComplete={handleOnboardingComplete}
        />
      )}

      <TitleBar
        theme={theme}
        onThemeChange={setTheme}
        isProcessing={isProcessing}
        processingFilename={processingFilename}
        view="journal"
        sidebarOpen={rightPanelOpen}
        onToggleSidebar={() => setRightPanelOpen((prev) => !prev)}
        onOpenChat={() => {
          setRightPanelOpen(true)
        }}
      />

      {view === 'settings' && (
        <div
          className="settings-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setView('journal')
            }
          }}
        >
          <div
            className="settings-modal-shell"
            role="dialog"
            aria-modal="true"
            aria-label={t('settings')}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="settings-modal-close"
              aria-label={t('close')}
              title={t('close')}
              onClick={() => setView('journal')}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
            <Suspense fallback={null}>
              <SettingsPanel
                initialSection={settingsInitialSection}
                onSectionConsumed={() => setSettingsInitialSection(undefined)}
                onClose={() => setView('journal')}
              />
            </Suspense>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          filter: view === 'settings' ? 'saturate(0.9)' : undefined,
        }}
      >
        {/* Left: Tree Sidebar */}
        <div
          style={{
            width: sidebarWidth,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--sidebar-bg)',
            borderRight: '0.5px solid var(--divider)',
          }}
        >
          <TreeSidebar
            selected={treeSelection}
            onSelect={handleTreeSelect}
            onDeselect={() => {
              setTreeSelection(null)
              setSelectedEntry(null)
            }}
            entries={entries}
            identities={allIdentities}
            identityLoading={identityLoading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onAtRef={(path: string) => {
              setRightPanelOpen(true)
              window.dispatchEvent(new CustomEvent('chat-append-text', { detail: `@${path}` }))
            }}
            todayYearMonth={todayYearMonth}
            todayDay={todayDay}
            ideasCount={todos.filter((t) => !t.done).length}
            ideasSelected={showIdeas}
            onSelectIdeas={handleSelectIdeas}
            automationSelected={view === 'automation'}
            onSelectAutomation={handleSelectAutomation}
          />
          {/* Settings button fixed at bottom */}
          <div
            style={{
              borderTop: '0.5px solid var(--divider)',
              flexShrink: 0,
              padding: '6px 10px',
              background: 'var(--sidebar-bg)',
            }}
          >
            <button
              onClick={() => setView('settings')}
              title="Settings (⌘,)"
              aria-pressed={view === 'settings'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 8px',
                borderRadius: 6,
                border: 'none',
                background:
                  view === 'settings'
                    ? 'color-mix(in srgb, var(--record-btn) 12%, transparent)'
                    : 'transparent',
                color: view === 'settings' ? 'var(--record-btn)' : 'var(--item-meta)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'background-color 0.15s var(--ease-out), color 0.15s var(--ease-out)',
              }}
              onMouseEnter={(e) => {
                if (view !== 'settings') e.currentTarget.style.background = 'var(--item-hover-bg)'
              }}
              onMouseLeave={(e) => {
                if (view !== 'settings') e.currentTarget.style.background = 'transparent'
              }}
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
                  color: view === 'settings' ? 'var(--record-btn)' : 'var(--item-meta)',
                  opacity: view === 'settings' ? 0.7 : 0.4,
                  fontFamily: 'var(--font-body)',
                }}
              >
                ⌘,
              </kbd>
            </button>
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

        {/* Center: Detail panel */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {view === 'automation' ? (
            <AutomationWorkbench onOpenConversation={(sessionId) => openChatPanel(sessionId)} />
          ) : (
            <DetailView
              type={
                showIdeas
                  ? 'ideas'
                  : !treeSelection || treeSelection.type === 'journal'
                    ? 'journal'
                    : treeSelection.type === 'identity'
                      ? 'identity'
                      : 'topic-file'
              }
              entry={
                treeSelection?.type === 'journal'
                  ? entries.find((e) => `${e.year_month}/${e.filename}` === treeSelection.path) ||
                    selectedEntry ||
                    undefined
                  : selectedEntry || undefined
              }
              entries={entries}
              identity={
                treeSelection?.type === 'identity'
                  ? (allIdentities.find((i) => i.path === treeSelection.path) ?? undefined)
                  : undefined
              }
              file={
                treeSelection?.type === 'topic-file'
                  ? {
                      name: treeSelection.path.split('/').pop() ?? '',
                      path: treeSelection.path,
                      is_dir: false,
                      mtime_secs: 0,
                    }
                  : undefined
              }
              onDeselect={handleDeselect}
              onOpenDock={handleOpenChat}
              onSelectSample={handleSelectSample}
              onAddToTodo={handleAddToTodo}
              onProcess={handleProcessEntry}
              onVisualDesign={handleVisualDesign}
            />
          )}
        </div>

        {/* Right Panel */}
        {rightPanelOpen && (
          <>
            <div
              onMouseDown={onRightPanelDividerMouseDown}
              style={{
                width: DIVIDER_WIDTH,
                flexShrink: 0,
                background: isRightPanelDragging ? 'var(--divider-active)' : 'transparent',
                userSelect: 'none' as const,
                cursor: 'col-resize',
                transition: 'background-color 0.15s var(--ease-out)',
              }}
              onMouseEnter={(e) => {
                if (!isRightPanelDragging) {
                  ;(e.target as HTMLElement).style.background = 'var(--divider-hover)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isRightPanelDragging) {
                  ;(e.target as HTMLElement).style.background = 'transparent'
                }
              }}
            />
            <div
              style={{
                width: rightPanelWidth,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                background: 'var(--sidebar-bg)',
                borderLeft: '0.5px solid var(--divider)',
              }}
            >
              <RightPanel
                activeSessionId={sessionId}
                chatContent={
                  <ChatPanel
                    sessionId={sessionId}
                    messages={messages}
                    isStreaming={isStreaming}
                    usage={usage}
                    stats={stats}
                    pendingQueue={pendingQueue}
                    initialInput={chatInitialText}
                    onSend={send}
                    onCancel={cancel}
                    onRetry={retry}
                    onEditAndResend={editAndResend}
                    onRemovePendingItem={removePendingItem}
                    onContinue={() => send('请继续')}
                  />
                }
                onHistorySelect={(id: string) => openChatPanel(id)}
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

      {/* Drag-over overlay */}
      {isDragOver && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'color-mix(in srgb, var(--record-btn) 7%, var(--bg))',
            border: '2px dashed var(--record-btn)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              padding: '22px 36px',
              borderRadius: 10,
              background: 'var(--detail-case-bg)',
              border: '1px solid var(--detail-case-border)',
              textAlign: 'center',
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--record-btn)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: 12, opacity: 0.8 }}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <div
              style={{
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-semibold)',
                color: 'var(--item-text)',
                marginBottom: 4,
              }}
            >
              {t('dropToAddFiles')}
            </div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--item-meta)',
                opacity: 0.6,
              }}
            >
              PDF · Word · Markdown · 音频 · 图片 · 代码
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
