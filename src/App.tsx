import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { listen } from '@tauri-apps/api/event'
import { TitleBar } from './components/TitleBar'
import { TreeSidebar } from './components/TreeSidebar'
const DetailView = lazy(() =>
  import('./components/DetailView').then((m) => ({ default: m.DetailView })),
)
import { AutomationWorkbench } from './components/AutomationWorkbench'
import type { IdeaConversationRequest } from './components/IdeasWorkbench'
const SettingsPanel = lazy(() =>
  import('./settings/SettingsPanel').then((m) => ({ default: m.SettingsPanel })),
)
const SkillsWorkbench = lazy(() => import('./components/SkillsWorkbench'))
const MergeIdentityDialog = lazy(() =>
  import('./components/MergeIdentityDialog').then((m) => ({ default: m.MergeIdentityDialog })),
)
import { useIdentity } from './hooks/useIdentity'
import { useJournal } from './hooks/useJournal'
import { useTheme } from './hooks/useTheme'
import { useUI, useLayout } from './contexts/UIContext'
import type { Category } from './contexts/UIContext'
import { NavRail } from './components/NavRail'
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
import { fileBasename, type JournalFileOpenDetail } from './lib/fileNavigation'
import type { JournalEntry, QueueItem, IdentityEntry, TreeSelection } from './types'
import { useTranslation } from './contexts/I18nContext'
const RightPanel = lazy(() =>
  import('./components/RightPanel').then((m) => ({ default: m.RightPanel })),
)
const ChatPanel = lazy(() =>
  import('./components/ChatPanel').then((m) => ({ default: m.ChatPanel })),
)
import { HistoryFloatingButton } from './components/HistoryFloatingButton'
import { useConversation } from './hooks/useConversation'
const OnboardingView = lazy(() => import('./components/OnboardingView'))

const SOUL_PATH = '__soul__'
const DIVIDER_WIDTH = 7
const HIDE_RIGHT_PANEL_BELOW = 960
const HIDE_LEFT_SIDEBAR_BELOW = 720
const SIDEBAR_PANEL_TRANSITION =
  'width 220ms var(--ease-out), opacity 160ms var(--ease-out), border-color 160ms var(--ease-out)'

interface DetailReturnTarget {
  selection: TreeSelection
  entry?: JournalEntry
}

function journalEntryMtime(entry: JournalEntry): number {
  return entry.mtime_ms ?? entry.mtime_secs
}

function journalEntryTreeSelection(entry: JournalEntry): TreeSelection {
  return {
    type: 'journal',
    path: `${entry.year_month}/${entry.filename}`,
    name: entry.title,
  }
}

function treeSelectionLabel(selection: TreeSelection, entry?: JournalEntry): string {
  return entry?.title || selection.name || fileBasename(selection.path)
}

function sameTreeSelection(a: TreeSelection | null | undefined, b: TreeSelection): boolean {
  return a?.type === b.type && a.path === b.path
}

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
  const { addTodo } = useTodoContext()
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
    chatInitialText,
    setChatInitialText,
    activeCategory,
    setActiveCategory,
    deselect,
  } = useUI()
  const {
    sidebarWidth,
    setSidebarWidthView,
    persistSidebarWidth,
    rightPanelOpen,
    setRightPanelOpen,
    rightPanelWidth,
    setRightPanelWidthView,
    persistRightPanelWidth,
    rightPanelPinned,
    setRightPanelPinned,
  } = useLayout()

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingLoading, setOnboardingLoading] = useState(true)
  const [defaultWsPath, setDefaultWsPath] = useState('')
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)

  useEffect(() => {
    let rafId = 0
    const handleResize = () => {
      if (rafId) return // already scheduled this frame
      rafId = requestAnimationFrame(() => {
        rafId = 0
        setViewportWidth(window.innerWidth)
      })
    }
    window.addEventListener('resize', handleResize)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (viewportWidth < HIDE_RIGHT_PANEL_BELOW && rightPanelOpen) {
      setRightPanelOpen(false)
    }
    if (viewportWidth < HIDE_LEFT_SIDEBAR_BELOW && leftSidebarOpen) {
      setLeftSidebarOpen(false)
    }
  }, [leftSidebarOpen, rightPanelOpen, setRightPanelOpen, viewportWidth])

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
  const [detailReturnTarget, setDetailReturnTarget] = useState<DetailReturnTarget | null>(null)

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

  // Divider drag (left sidebar) — rAF-batched view updates, persist on mouseup (AC-1,3)
  const onDividerMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    dragStartX.current = e.clientX
    dragStartWidth.current = sidebarWidth
  }
  useEffect(() => {
    if (!isDragging) return
    let rafId = 0
    let pendingWidth: number | null = null
    const flush = () => {
      rafId = 0
      if (pendingWidth !== null) {
        setSidebarWidthView(pendingWidth)
        pendingWidth = null
      }
    }
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current
      pendingWidth = Math.max(220, Math.min(560, dragStartWidth.current + delta))
      if (!rafId) rafId = requestAnimationFrame(flush)
    }
    const onUp = () => {
      if (rafId) cancelAnimationFrame(rafId)
      // Flush final value synchronously so mouseup reflects the last move
      if (pendingWidth !== null) {
        const finalWidth = pendingWidth
        pendingWidth = null
        setSidebarWidthView(finalWidth)
        persistSidebarWidth(finalWidth)
      } else {
        persistSidebarWidth(sidebarWidth)
      }
      setIsDragging(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging, setIsDragging, setSidebarWidthView, persistSidebarWidth, sidebarWidth])

  // Right panel divider drag — rAF-batched view updates, persist on mouseup (AC-1,2,3)
  const [isRightPanelDragging, setIsRightPanelDragging] = useState(false)
  const rightPanelDragStartX = useRef(0)
  const rightPanelDragStartWidth = useRef(0)
  const [topicFocusSelection, setTopicFocusSelection] = useState<TreeSelection | null>(null)

  const onRightPanelDividerMouseDown = (e: React.MouseEvent) => {
    setIsRightPanelDragging(true)
    rightPanelDragStartX.current = e.clientX
    rightPanelDragStartWidth.current = rightPanelWidth
  }

  useEffect(() => {
    if (!isRightPanelDragging) return
    let rafId = 0
    let pendingWidth: number | null = null
    const flush = () => {
      rafId = 0
      if (pendingWidth !== null) {
        setRightPanelWidthView(pendingWidth)
        pendingWidth = null
      }
    }
    const onMove = (e: MouseEvent) => {
      const delta = rightPanelDragStartX.current - e.clientX
      pendingWidth = Math.max(200, Math.min(480, rightPanelDragStartWidth.current + delta))
      if (!rafId) rafId = requestAnimationFrame(flush)
    }
    const onUp = () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (pendingWidth !== null) {
        const finalWidth = pendingWidth
        pendingWidth = null
        setRightPanelWidthView(finalWidth)
        persistRightPanelWidth(finalWidth)
      } else {
        persistRightPanelWidth(rightPanelWidth)
      }
      setIsRightPanelDragging(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isRightPanelDragging, setRightPanelWidthView, persistRightPanelWidth, rightPanelWidth])

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
      return updated && journalEntryMtime(updated) !== journalEntryMtime(prev) ? updated : prev
    })
  }, [entries, setSelectedEntry])

  // Navigate to a journal entry via .md link click
  const currentDetailReturnTarget = useCallback((): DetailReturnTarget | null => {
    if (view !== 'journal' || showIdeas) return null

    if (treeSelection?.type === 'topic-file' || treeSelection?.type === 'identity') {
      return { selection: treeSelection }
    }

    const journalEntry =
      treeSelection?.type === 'journal'
        ? entriesRef.current.find(
            (entry) => `${entry.year_month}/${entry.filename}` === treeSelection.path,
          ) || selectedEntry
        : selectedEntry

    return journalEntry
      ? {
          selection: journalEntryTreeSelection(journalEntry),
          entry: journalEntry,
        }
      : null
  }, [selectedEntry, showIdeas, treeSelection, view])

  const rememberReturnTarget = useCallback(
    (nextSelection: TreeSelection) => {
      const currentTarget = currentDetailReturnTarget()
      if (sameTreeSelection(currentTarget?.selection, nextSelection)) return
      setDetailReturnTarget((prev) => prev ?? currentTarget)
    },
    [currentDetailReturnTarget],
  )

  useEffect(() => {
    const handler = (e: Event) => {
      const { path: targetPath, filename: targetFilename } = (e as CustomEvent).detail ?? {}
      if (!targetPath && !targetFilename) return
      const current = entriesRef.current
      let match = targetPath ? current.find((entry) => entry.path === targetPath) : undefined
      if (!match && targetFilename) {
        match = current.find((entry) => entry.filename === targetFilename)
      }
      if (match) {
        const nextSelection = journalEntryTreeSelection(match)
        rememberReturnTarget(nextSelection)
        setView('journal')
        setShowIdeas(false)
        setTopicFocusSelection(null)
        setSelectedEntry(match)
        setTreeSelection(nextSelection)
      }
    }
    window.addEventListener('journal-entry-navigate', handler)
    return () => window.removeEventListener('journal-entry-navigate', handler)
  }, [rememberReturnTarget, setSelectedEntry, setShowIdeas, setTreeSelection, setView])

  useEffect(() => {
    const handler = (e: Event) => {
      const { path, name } = (e as CustomEvent<JournalFileOpenDetail>).detail ?? {}
      if (!path) return

      const nextSelection: TreeSelection = {
        type: 'topic-file',
        path,
        name: name || fileBasename(path),
      }

      rememberReturnTarget(nextSelection)
      setView('journal')
      setShowIdeas(false)
      setSelectedEntry(null)
      setTopicFocusSelection(null)
      setTreeSelection(nextSelection)
    }
    window.addEventListener('journal-file-open', handler)
    return () => window.removeEventListener('journal-file-open', handler)
  }, [rememberReturnTarget, setSelectedEntry, setShowIdeas, setTreeSelection, setView])

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
    setDetailReturnTarget(null)
    deselect()
  }, [deselect])

  const handleTreeSelect = useCallback(
    (sel: TreeSelection) => {
      setDetailReturnTarget(null)
      setView('journal')
      setShowIdeas(false)
      setTopicFocusSelection(null)
      setTreeSelection(sel)
    },
    [setShowIdeas, setTreeSelection, setView],
  )

  const handleCategoryChange = useCallback(
    (cat: Category) => {
      const needsSidebar = cat === 'journal' || cat === 'identity' || cat === 'topics'

      // 重复点击当前类别：切换侧栏展开/收起
      if (cat === activeCategory && needsSidebar) {
        setLeftSidebarOpen((prev) => !prev)
        return
      }

      setDetailReturnTarget(null)
      setTopicFocusSelection(null)

      if (cat === 'automation') {
        setShowIdeas(false)
        setSelectedEntry(null)
        setTreeSelection({ type: 'automation', path: '__automation__' })
        setView('automation')
      } else {
        setView('journal')
        setShowIdeas(cat === 'ideas')
      }

      // Auto-hide sidebar for categories that don't need a list
      setLeftSidebarOpen(needsSidebar)

      setActiveCategory(cat)
    },
    [activeCategory, setActiveCategory, setSelectedEntry, setShowIdeas, setTreeSelection, setView],
  )

  useEffect(() => {
    const handler = () => handleCategoryChange('automation')
    window.addEventListener('open-automation-workbench', handler)
    return () => window.removeEventListener('open-automation-workbench', handler)
  }, [handleCategoryChange])

  // Auto-collapse right panel on content switch (AC-3/4/5/8).
  // Fires ONLY at the instant of a content-key change. If a task is in flight
  // (streaming or queued) the panel stays open for this switch; it will be
  // re-evaluated on the next switch. Pinned panels never collapse here.
  // Note: clicking "@" opens the panel but does NOT change the content key,
  // so it cannot self-collapse (AC-8).
  const prevContentKeyRef = useRef<string>('')
  useEffect(() => {
    const contentKey = `${activeCategory}:${selectedEntry?.path ?? treeSelection?.path ?? ''}`
    if (prevContentKeyRef.current === '') {
      prevContentKeyRef.current = contentKey
      return
    }
    if (contentKey === prevContentKeyRef.current) return
    prevContentKeyRef.current = contentKey
    if (!rightPanelPinned && !isStreaming && pendingQueue.length === 0) {
      setRightPanelOpen(false)
    }
  }, [
    activeCategory,
    selectedEntry,
    treeSelection,
    rightPanelPinned,
    isStreaming,
    pendingQueue,
    setRightPanelOpen,
  ])

  const handleOpenChat = useCallback(() => {
    setRightPanelOpen(true)
  }, [setRightPanelOpen])
  const handleSelectSample = useCallback(() => {
    setDetailReturnTarget(null)
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

  const handleReturnToPreviousDetail = useCallback(() => {
    if (!detailReturnTarget) return

    setView('journal')
    setShowIdeas(false)
    setTopicFocusSelection(null)
    setTreeSelection(detailReturnTarget.selection)

    if (detailReturnTarget.selection.type === 'journal') {
      const entry =
        detailReturnTarget.entry ??
        entriesRef.current.find(
          (candidate) =>
            `${candidate.year_month}/${candidate.filename}` === detailReturnTarget.selection.path,
        )
      setSelectedEntry(entry ?? null)
    } else {
      setSelectedEntry(null)
    }

    setDetailReturnTarget(null)
  }, [detailReturnTarget, setSelectedEntry, setShowIdeas, setTreeSelection, setView])

  const handleOpenIdeaConversation = useCallback(
    (opts: IdeaConversationRequest) => {
      if (opts.sessionId) {
        openChatPanel(opts.sessionId)
      } else {
        openChatPanel(undefined, opts.context)
      }
    },
    [openChatPanel],
  )

  const handleNavigateToIdeaSource = useCallback(
    (source: string) => {
      setDetailReturnTarget(null)
      const filename = source.split('/').pop() ?? source
      const match = entriesRef.current.find(
        (entry) =>
          source === `${entry.year_month}/${entry.filename}` ||
          source === entry.path ||
          filename === entry.filename,
      )

      setView('journal')
      setShowIdeas(false)

      if (match) {
        setSelectedEntry(match)
        setTreeSelection({ type: 'journal', path: `${match.year_month}/${match.filename}` })
        return
      }

      window.dispatchEvent(
        new CustomEvent('journal-entry-navigate', {
          detail: { filename },
        }),
      )
    },
    [setSelectedEntry, setShowIdeas, setTreeSelection, setView],
  )

  // Stabilized callback previously inlined in JSX (AC-6)
  const handleNavigateToTopicPath = useCallback(
    (path: string, isFile: boolean) => {
      const nextSelection: TreeSelection = {
        type: isFile ? 'topic-file' : 'topic',
        path,
        name: path.split('/').pop() ?? path,
        created_secs: treeSelection?.path === path ? treeSelection.created_secs : undefined,
        mtime_secs: treeSelection?.path === path ? treeSelection.mtime_secs : undefined,
      }
      setView('journal')
      setShowIdeas(false)
      if (isFile) {
        setDetailReturnTarget(null)
        setTopicFocusSelection(null)
        setTreeSelection(nextSelection)
      } else {
        setTopicFocusSelection(nextSelection)
      }
    },
    [treeSelection, setView, setShowIdeas, setTreeSelection],
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
    archived: false,
  }
  const allIdentities: IdentityEntry[] = useMemo(() => [SOUL_ENTRY, ...identities], [identities])

  // Memoized DetailView props — stable references unless selection/data actually changes (AC-6).
  // Previously `entries.find(...)` + inline object literals ran every render, breaking React.memo.
  const detailEntry = useMemo<JournalEntry | undefined>(() => {
    if (treeSelection?.type === 'journal') {
      return (
        entries.find((e) => `${e.year_month}/${e.filename}` === treeSelection.path) ||
        selectedEntry ||
        undefined
      )
    }
    return selectedEntry || undefined
  }, [treeSelection, entries, selectedEntry])

  const detailIdentity = useMemo(() => {
    if (treeSelection?.type === 'identity') {
      return allIdentities.find((i) => i.path === treeSelection.path) ?? undefined
    }
    return undefined
  }, [treeSelection, allIdentities])

  const detailFile = useMemo(() => {
    if (treeSelection?.type === 'topic-file') {
      return {
        name: treeSelection.name ?? treeSelection.path.split('/').pop() ?? '',
        path: treeSelection.path,
        is_dir: false,
        created_secs: treeSelection.created_secs,
        mtime_secs: treeSelection.mtime_secs ?? 0,
      }
    }
    return undefined
  }, [treeSelection])

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
        <Suspense fallback={null}>
          <OnboardingView
            defaultWorkspacePath={defaultWsPath}
            onComplete={handleOnboardingComplete}
          />
        </Suspense>
      )}

      <TitleBar
        theme={theme}
        onThemeChange={setTheme}
        isProcessing={isProcessing}
        processingFilename={processingFilename}
        view="journal"
        onOpenChat={() => {
          setRightPanelOpen((prev) => !prev)
        }}
        rightPanelOpen={rightPanelOpen}
        onToggleRightPanel={() => setRightPanelOpen((prev) => !prev)}
        rightPanelPinned={rightPanelPinned}
        onToggleRightPanelPin={() => setRightPanelPinned(!rightPanelPinned)}
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
            ref={(node) => {
              if (!node) return
              // Focus trap: keep Tab cycling within the dialog
              const focusableSelector =
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
              const handler = (e: KeyboardEvent) => {
                if (e.key !== 'Tab') return
                const focusable = node.querySelectorAll<HTMLElement>(focusableSelector)
                if (focusable.length === 0) return
                const first = focusable[0]
                const last = focusable[focusable.length - 1]
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault()
                  last.focus()
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault()
                  first.focus()
                }
              }
              node.addEventListener('keydown', handler)
              // Auto-focus the close button
              const firstFocusable = node.querySelector<HTMLElement>(focusableSelector)
              firstFocusable?.focus()
              return () => node.removeEventListener('keydown', handler)
            }}
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
        <NavRail
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          onSettingsClick={() => setView('settings')}
        />

        {/* Left: Tree Sidebar */}
        <div
          className="app-sidebar-panel"
          data-sidebar-panel="left"
          aria-hidden={!leftSidebarOpen}
          style={{
            width: leftSidebarOpen ? sidebarWidth : 0,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--sidebar-bg)',
            borderRight: leftSidebarOpen ? '0.5px solid var(--divider)' : '0.5px solid transparent',
            opacity: leftSidebarOpen ? 1 : 0,
            pointerEvents: leftSidebarOpen ? 'auto' : 'none',
            transition: SIDEBAR_PANEL_TRANSITION,
            willChange: 'width, opacity',
          }}
        >
          <TreeSidebar
            selected={topicFocusSelection ?? treeSelection}
            onSelect={handleTreeSelect}
            onDeselect={() => {
              setDetailReturnTarget(null)
              setTopicFocusSelection(null)
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
            category={activeCategory}
          />
        </div>

        {/* Divider */}
        <div
          data-sidebar-divider="left"
          onMouseDown={leftSidebarOpen ? onDividerMouseDown : undefined}
          style={{
            width: DIVIDER_WIDTH,
            flexShrink: 0,
            position: 'relative',
            background: 'transparent',
            userSelect: 'none' as const,
            cursor: leftSidebarOpen ? 'col-resize' : 'default',
          }}
        ></div>

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
          {activeCategory === 'automation' ? (
            <AutomationWorkbench onOpenConversation={(sessionId) => openChatPanel(sessionId)} />
          ) : activeCategory === 'skills' ? (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <Suspense fallback={null}>
                <SkillsWorkbench />
              </Suspense>
            </div>
          ) : (
            <Suspense fallback={null}>
              <DetailView
                type={
                  activeCategory === 'ideas'
                    ? 'ideas'
                    : !treeSelection || treeSelection.type === 'journal'
                      ? 'journal'
                      : treeSelection.type === 'identity'
                        ? 'identity'
                        : treeSelection.type === 'topic-file'
                          ? 'topic-file'
                          : 'journal'
                }
                category={activeCategory}
                entry={detailEntry}
                entries={entries}
                identity={detailIdentity}
                file={detailFile}
                onDeselect={handleDeselect}
                onOpenDock={handleOpenChat}
                onSelectSample={handleSelectSample}
                onAddToTodo={handleAddToTodo}
                onProcess={handleProcessEntry}
                onVisualDesign={handleVisualDesign}
                onOpenIdeaConversation={handleOpenIdeaConversation}
                onNavigateToIdeaSource={handleNavigateToIdeaSource}
                returnTargetLabel={
                  detailReturnTarget
                    ? treeSelectionLabel(detailReturnTarget.selection, detailReturnTarget.entry)
                    : undefined
                }
                onReturnToPrevious={detailReturnTarget ? handleReturnToPreviousDetail : undefined}
                onNavigateToTopicPath={handleNavigateToTopicPath}
              />
            </Suspense>
          )}
        </div>

        {/* Right Panel */}
        <div
          data-sidebar-divider="right"
          onMouseDown={rightPanelOpen ? onRightPanelDividerMouseDown : undefined}
          style={{
            width: DIVIDER_WIDTH,
            flexShrink: 0,
            position: 'relative',
            background: isRightPanelDragging ? 'var(--divider-active)' : 'transparent',
            userSelect: 'none' as const,
            cursor: rightPanelOpen ? 'col-resize' : 'default',
            transition: 'background-color 0.15s var(--ease-out)',
          }}
        ></div>
        <div
          className="app-sidebar-panel"
          data-sidebar-panel="right"
          aria-hidden={!rightPanelOpen}
          style={{
            width: rightPanelOpen ? rightPanelWidth : 0,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--sidebar-bg)',
            borderLeft: rightPanelOpen ? '0.5px solid var(--divider)' : '0.5px solid transparent',
            opacity: rightPanelOpen ? 1 : 0,
            pointerEvents: rightPanelOpen ? 'auto' : 'none',
            transition: SIDEBAR_PANEL_TRANSITION,
            willChange: 'width, opacity',
          }}
        >
          <Suspense fallback={null}>
            <RightPanel
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
                  historyControl={
                    <HistoryFloatingButton
                      activeSessionId={sessionId}
                      onSelect={(id: string) => openChatPanel(id)}
                    />
                  }
                />
              }
            />
          </Suspense>
        </div>
      </div>

      {mergeSource && (
        <Suspense fallback={null}>
          <MergeIdentityDialog
            source={mergeSource}
            onClose={() => setMergeSource(null)}
            onMerged={() => {
              setMergeSource(null)
              if (selectedIdentity?.path === mergeSource.path) setSelectedIdentity(null)
              refreshIdentity()
            }}
          />
        </Suspense>
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
