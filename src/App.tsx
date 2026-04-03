import { useState, useEffect, useRef, useCallback } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { listen } from '@tauri-apps/api/event'
import { TitleBar } from './components/TitleBar'
import { JournalList } from './components/JournalList'
import { DetailPanel } from './components/DetailPanel'
import { RightPanel } from './components/RightPanel'
import { SettingsPanel } from './settings/SettingsPanel'
import { IdentityList, SOUL_PATH } from './components/IdentityList'
import { IdentityDetail } from './components/IdentityDetail'
import { MergeIdentityDialog } from './components/MergeIdentityDialog'
import { SidebarTabs } from './components/SidebarTabs'
import type { SidebarTab } from './components/SidebarTabs'
import { useIdentity } from './hooks/useIdentity'
import { useRecorder } from './hooks/useRecorder'
import { useJournal, RECORDING_PLACEHOLDER } from './hooks/useJournal'
import { useTheme } from './hooks/useTheme'
import { useTodos } from './hooks/useTodos'
import { importFile, importAudioFile, prepareAudioForAi, triggerAiProcessing, triggerAiPrompt, cancelAiProcessing, cancelQueuedItem, getEngineConfig, checkEngineInstalled, getAsrConfig, checkWhisperkitCliInstalled, checkWhisperkitModelDownloaded, createSampleEntryIfNeeded, createSampleEntry, listAllJournalEntries, deleteIdentity } from './lib/tauri'
import { fileKindFromName } from './lib/fileKind'
import type { JournalEntry, QueueItem, IdentityEntry } from './types'

const BASE_WIDTH = 320
const DIVIDER_WIDTH = 7

export default function App() {
  const { status, elapsedSecs, audioLevel, start, stop } = useRecorder()
  const { entries, loading, queueItems, isProcessing, dismissQueueItem, addConvertingItem, addQueuedItem, markItemFailed, retryQueueItem, refresh } = useJournal()
  const { theme, setTheme } = useTheme()
  const { todos, addTodo, toggleTodo, deleteTodo, setTodoDue, updateTodoText } = useTodos()
  const { identities, loading: identityLoading, refresh: refreshIdentity } = useIdentity()

  const [aiReady, setAiReady] = useState<boolean | null>(null)
  const [asrReady, setAsrReady] = useState<boolean | null>(null)
  const [audioRejected, setAudioRejected] = useState(false)
  const [view, setView] = useState<'journal' | 'settings'>('journal')
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>(undefined)
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [activeLogPath, setActiveLogPath] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('journal')
  const sidebarAnimRef = useRef<HTMLDivElement>(null)
  const detailAnimRef = useRef<HTMLDivElement>(null)

  const handleTabChange = useCallback((tab: SidebarTab) => {
    const anim = 'tab-crossfade 0.12s ease-out'
    for (const ref of [sidebarAnimRef, detailAnimRef]) {
      if (ref.current) {
        ref.current.style.animation = 'none'
        void ref.current.offsetHeight
        ref.current.style.animation = anim
      }
    }
    setSidebarTab(tab)
  }, [])

  const [selectedIdentity, setSelectedIdentity] = useState<IdentityEntry | null>(null)
  const [mergeSource, setMergeSource] = useState<IdentityEntry | null>(null)

  const [rightWidth, setRightWidth] = useState<number>(() => {
    const saved = localStorage.getItem('journal_todo_width')
    return saved ? parseInt(saved) : BASE_WIDTH
  })
  const [isRightDragging, setIsRightDragging] = useState(false)
  const rightDragStartX = useRef(0)
  const rightDragStartWidth = useRef(0)

  const [baseWidth, setBaseWidth] = useState<number>(() => {
    const saved = localStorage.getItem('journal_base_width')
    return saved ? parseInt(saved) : BASE_WIDTH
  })

  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)
  const entriesRef = useRef(entries)

  // Check AI engine availability
  useEffect(() => {
    getEngineConfig().then(cfg =>
      checkEngineInstalled(cfg.active_ai_engine as 'claude' | 'qwen').then(setAiReady)
    ).catch(() => setAiReady(false))
  }, [view])

  // Check ASR readiness
  useEffect(() => {
    getAsrConfig().then(async cfg => {
      if (cfg.asr_engine === 'apple') { setAsrReady(true); return }
      if (cfg.asr_engine === 'dashscope') { setAsrReady(cfg.dashscope_api_key.trim().length > 0); return }
      const [cliOk, modelOk] = await Promise.all([
        checkWhisperkitCliInstalled(),
        checkWhisperkitModelDownloaded(cfg.whisperkit_model),
      ])
      setAsrReady(cliOk && modelOk)
    }).catch(() => setAsrReady(false))
  }, [view])

  // Clear overlay when engine finishes installing
  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen<{ engine: string; done: boolean; success: boolean }>('engine-install-log', ({ payload }) => {
      if (payload.done && payload.success) setAiReady(true)
    }).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [])

  // First launch: write sample entry and auto-select it
  useEffect(() => {
    createSampleEntryIfNeeded().then(async created => {
      if (!created) return
      await refresh()
      const all = await listAllJournalEntries()
      const sample = all.find(e => e.title === '产品评审示例')
      if (sample) setSelectedEntry(sample)
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Left panel divider drag
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
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isDragging])

  // Right panel divider drag
  const onRightDividerMouseDown = (e: React.MouseEvent) => {
    setIsRightDragging(true)
    rightDragStartX.current = e.clientX
    rightDragStartWidth.current = rightWidth
  }
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isRightDragging) return
      const delta = rightDragStartX.current - e.clientX
      const newWidth = Math.max(220, Math.min(560, rightDragStartWidth.current + delta))
      setRightWidth(newWidth)
      localStorage.setItem('journal_todo_width', String(newWidth))
    }
    const onUp = () => setIsRightDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isRightDragging])

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

  // Keep entriesRef in sync
  useEffect(() => {
    entriesRef.current = entries
    setSelectedEntry(prev => {
      if (!prev) return prev
      const updated = entries.find(e => e.path === prev.path)
      return updated && updated.mtime_secs !== prev.mtime_secs ? updated : prev
    })
  }, [entries])

  // Navigate to a journal entry via .md link click
  useEffect(() => {
    const handler = (e: Event) => {
      const { path: targetPath, filename: targetFilename } = (e as CustomEvent).detail ?? {}
      if (!targetPath && !targetFilename) return
      const current = entriesRef.current
      let match = targetPath ? current.find(entry => entry.path === targetPath) : undefined
      if (!match && targetFilename) match = current.find(entry => entry.filename === targetFilename)
      if (match) setSelectedEntry(match)
    }
    window.addEventListener('journal-entry-navigate', handler)
    return () => window.removeEventListener('journal-entry-navigate', handler)
  }, [])

  // Open settings from Rust menu (Cmd+,)
  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen('open-settings', () => { setSettingsInitialSection(undefined); setView('settings') }).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [])

  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen('open-settings-about', () => { setSettingsInitialSection('about'); setView('settings') }).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setView('journal'); return }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setView(v => v === 'settings' ? 'journal' : 'settings')
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
      if (e.key === '=' || e.key === '+') { e.preventDefault(); zoom = Math.min(2, zoom + 0.1); getCurrentWebview().setZoom(zoom) }
      else if (e.key === '-') { e.preventDefault(); zoom = Math.max(0.5, zoom - 0.1); getCurrentWebview().setZoom(zoom) }
      else if (e.key === '0') { e.preventDefault(); zoom = 1; getCurrentWebview().setZoom(1) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleFilesSubmit = async (paths: string[], note?: string) => {
    setPendingFiles([])
    for (const path of paths) {
      let materialPath = path
      try {
        const kind = fileKindFromName(path.split('/').pop() ?? path)
        if (kind === 'audio') {
          const result = await importAudioFile(path)
          materialPath = result.path
          addConvertingItem(result.path, result.filename)
          await prepareAudioForAi(result.path, result.year_month, note)
        } else {
          const result = await importFile(path)
          materialPath = result.path
          addQueuedItem(result.path, result.filename)
          await triggerAiProcessing(result.path, result.year_month, note)
        }
      } catch (err) {
        console.error('[file-submit] error:', String(err), 'path:', materialPath)
        markItemFailed(materialPath, String(err))
      }
    }
    refresh()
  }

  const handleFilesCancel = () => setPendingFiles([])
  const handleRemoveFile = (index: number) => setPendingFiles(prev => prev.filter((_, i) => i !== index))

  const handleRecord = async () => {
    if (status === 'idle') {
      await start()
    } else {
      await stop()
      addConvertingItem(RECORDING_PLACEHOLDER, '录音处理中')
    }
  }

  const handlePasteSubmit = async (text: string) => {
    await triggerAiPrompt(text)
    refresh()
  }

  const handleCancelQueueItem = async (item: QueueItem) => {
    if (item.status === 'processing') await cancelAiProcessing()
    else await cancelQueuedItem(item.path)
    dismissQueueItem(item.path)
  }

  const handleRetryQueueItem = async (item: QueueItem) => {
    const yearMonth = item.path.split('/').slice(-2, -1)[0] ?? ''
    const audioExts = ['.m4a', '.mp3', '.wav', '.aac', '.ogg', '.flac', '.mp4']
    const isAudioSourceFile = audioExts.some(ext => item.path.toLowerCase().endsWith(ext))
    retryQueueItem(item.path)
    try {
      if (isAudioSourceFile) await prepareAudioForAi(item.path, yearMonth)
      else await triggerAiProcessing(item.path, yearMonth)
    } catch (err) {
      markItemFailed(item.path, String(err))
    }
  }

  const handlePasteFiles = useCallback((paths: string[]) => {
    const audioExts = ['.m4a', '.mp3', '.wav', '.aac', '.ogg', '.flac', '.mp4']
    const isAudio = (p: string) => audioExts.some(ext => p.toLowerCase().endsWith(ext))
    let filteredPaths = paths
    if (asrReady === false) {
      const audioCount = paths.filter(isAudio).length
      if (audioCount > 0) {
        filteredPaths = paths.filter(p => !isAudio(p))
        setAudioRejected(true)
        setTimeout(() => setAudioRejected(false), 2500)
      }
    }
    setPendingFiles(prev => {
      const existing = new Set(prev)
      const newPaths = filteredPaths.filter(p => !existing.has(p))
      if (newPaths.length === 0) return prev
      return [...prev, ...newPaths].slice(0, 6)
    })
  }, [asrReady])

  // Drop handling via Tauri native file drop
  useEffect(() => {
    let unlisten: (() => void) | null = null
    getCurrentWebview().onDragDropEvent((event) => {
      const type = event.payload.type
      if (type === 'enter' || type === 'over') setIsDragOver(true)
      else if (type === 'leave') setIsDragOver(false)
      else if (type === 'drop') {
        setIsDragOver(false)
        const paths: string[] = (event.payload as { paths: string[] }).paths ?? []
        if (paths.length > 0) handlePasteFiles(paths)
      }
    }).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [refresh, handlePasteFiles])

  const processingItem = queueItems.find(i => i.status === 'processing')
  const processingFilename = processingItem?.filename
  const processingPath = processingItem?.path

  const visibleQueueItems = status === 'recording'
    ? [{ path: RECORDING_PLACEHOLDER, filename: '录音中', status: 'recording' as const, addedAt: Date.now(), logs: [], elapsedSecs, audioLevel }, ...queueItems]
    : queueItems

  const SOUL_ENTRY: IdentityEntry = {
    filename: '__soul__',
    path: SOUL_PATH,
    name: '助理',
    region: '',
    summary: '定义谨迹的角色与工作偏好',
    tags: [],
    speaker_id: '',
    mtime_secs: 0,
  }
  const allIdentities: IdentityEntry[] = [SOUL_ENTRY, ...identities]

  const handleDeleteIdentity = async (identity: IdentityEntry) => {
    if (!window.confirm(`确认删除「${identity.name}」的档案？`)) return
    try {
      await deleteIdentity(identity.path)
      if (selectedIdentity?.path === identity.path) setSelectedIdentity(null)
      refreshIdentity()
    } catch (e) {
      console.error('[App] identity delete failed', e)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <TitleBar
        theme={theme}
        onThemeChange={setTheme}
        isProcessing={isProcessing}
        processingFilename={processingFilename}
        onLogClick={processingPath ? () => setActiveLogPath(processingPath) : undefined}
        view={view}
      />

      {view === 'settings' && (
        <div style={{ position: 'absolute', inset: 0, top: 38, zIndex: 10, overflow: 'hidden', animation: 'view-enter 0.2s ease-out', background: 'var(--bg)' }}>
          <SettingsPanel initialSection={settingsInitialSection} onSectionConsumed={() => setSettingsInitialSection(undefined)} onClose={() => setView('journal')} />
        </div>
      )}

      <div style={{ display: view === 'settings' ? 'none' : 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Journal list / Identity list */}
        <div style={{ width: baseWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '0.5px solid var(--divider)' }}>
          <SidebarTabs active={sidebarTab} onChange={handleTabChange} />
          <div ref={sidebarAnimRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, display: sidebarTab === 'journal' ? 'flex' : 'none', flexDirection: 'column' }}>
              <JournalList
                entries={entries}
                loading={loading}
                selectedPath={selectedEntry?.path ?? null}
                onSelect={setSelectedEntry}
              />
            </div>
            <div style={{ flex: 1, minHeight: 0, display: sidebarTab === 'identity' ? 'flex' : 'none', flexDirection: 'column' }}>
              <IdentityList
                identities={allIdentities}
                loading={identityLoading}
                selectedPath={selectedIdentity?.path ?? null}
                onSelect={identity => setSelectedIdentity(identity)}
                onMerge={identity => setMergeSource(identity)}
                onDelete={handleDeleteIdentity}
              />
            </div>
          </div>

          {/* Settings footer — fixed at bottom of left sidebar */}
          <div style={{ flexShrink: 0, borderTop: '0.5px solid var(--divider)' }}>
            <button
              onClick={() => setView(v => v === 'settings' ? 'journal' : 'settings')}
              title="设置 (⌘,)"
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--item-hover-bg)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', background: 'transparent', border: 'none',
                color: 'var(--item-meta)', cursor: 'pointer', fontSize: 13,
                textAlign: 'left',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              设置
            </button>
          </div>
        </div>

        {/* Divider */}
        <div onMouseDown={onDividerMouseDown} style={{ width: DIVIDER_WIDTH, flexShrink: 0, background: 'transparent', cursor: 'col-resize' }} />

        {/* Middle: Detail panel / Identity detail */}
        <div ref={detailAnimRef} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {sidebarTab === 'journal' ? (
            <DetailPanel
              entry={selectedEntry}
              entries={entries}
              onDeselect={() => setSelectedEntry(null)}
              onRecord={handleRecord}
              onOpenDock={() => {/* dock removed – focus RightPanel input */}}
              onSelectSample={() => {
                createSampleEntry().then(async () => {
                  await refresh()
                  const all = await listAllJournalEntries()
                  const sample = all.find(e => e.title === '产品评审示例')
                  if (sample) setSelectedEntry(sample)
                }).catch(() => {})
              }}
              onAddToTodo={(text: string, source: string) => addTodo(text, undefined, source)}
            />
          ) : (
            <IdentityDetail identity={selectedIdentity} />
          )}
        </div>

        {/* Right panel divider */}
        <div onMouseDown={onRightDividerMouseDown} style={{ width: DIVIDER_WIDTH, flexShrink: 0, background: 'transparent', cursor: 'col-resize' }} />

        {/* Right panel — always visible */}
        <RightPanel
          width={rightWidth}
          todos={todos}
          onToggleTodo={toggleTodo}
          onAddTodo={addTodo}
          onDeleteTodo={deleteTodo}
          onSetTodoDue={setTodoDue}
          onUpdateTodoText={updateTodoText}
          onNavigateToSource={(filename: string) => {
            const match = entries.find(e => e.filename === filename)
            if (match) { setSidebarTab('journal'); setSelectedEntry(match) }
          }}
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
          isDragOver={isDragOver}
          queueItems={visibleQueueItems}
          onDismissQueueItem={dismissQueueItem}
          onCancelQueueItem={handleCancelQueueItem}
          onRetryQueueItem={handleRetryQueueItem}
          activeLogPath={activeLogPath}
          onSetActiveLogPath={setActiveLogPath}
          selectedEntry={selectedEntry}
          aiReady={aiReady}
          onOpenSettings={() => setView(v => v === 'settings' ? 'journal' : 'settings')}
        />
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
