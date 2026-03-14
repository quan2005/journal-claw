import { useState, useEffect, useCallback, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow, PhysicalSize } from '@tauri-apps/api/window'
import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu'
import { TitleBar } from './components/TitleBar'
import { RecordingList } from './components/RecordingList'
import { DetailPanel } from './components/DetailPanel'
import { RecordButton } from './components/RecordButton'
import { useRecorder } from './hooks/useRecorder'
import { listRecordings, deleteRecording, revealInFinder, playRecording } from './lib/tauri'
import { formatYearMonth } from './lib/format'
import type { RecordingItem, TranscriptionProgress } from './types'

const LEFT_WIDTH = 320
const RIGHT_WIDTH = 320

export default function App() {
  const [recordings, setRecordings] = useState<RecordingItem[]>([])
  const [activeItem, setActiveItem] = useState<RecordingItem | null>(null)
  const [selectedItem, setSelectedItem] = useState<RecordingItem | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [transcriptionStates, setTranscriptionStates] = useState<Record<string, TranscriptionProgress>>({})
  const [displayedItem, setDisplayedItem] = useState<RecordingItem | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const panelHasResized = useRef(false)
  const prevPanelOpen = useRef(false)


  const loadRecordings = useCallback(async () => {
    const items = await listRecordings()
    setRecordings(items)
  }, [])

  useEffect(() => { loadRecordings() }, [loadRecordings])

  useEffect(() => {
    const unlistenPromise = listen<{ filename: string; status: TranscriptionProgress }>(
      'transcription-progress',
      (event) => {
        const { filename, status } = event.payload
        setTranscriptionStates(prev => ({ ...prev, [filename]: status }))
        loadRecordings()
      }
    )
    return () => { unlistenPromise.then(u => u()) }
  }, [loadRecordings])

  // Auto-expand window once on first panel open; never shrink automatically
  useEffect(() => {
    const justOpened = panelOpen && !prevPanelOpen.current
    const justClosed = !panelOpen && prevPanelOpen.current
    prevPanelOpen.current = panelOpen

    if (justOpened && !panelHasResized.current) {
      if (window.innerWidth < LEFT_WIDTH + 280) {
        getCurrentWindow()
          .setSize(new PhysicalSize(
            Math.round((LEFT_WIDTH + RIGHT_WIDTH) * window.devicePixelRatio),
            Math.round(window.innerHeight * window.devicePixelRatio),
          ))
          .catch(() => {})
      }
      panelHasResized.current = true
    }

    if (justClosed) {
      panelHasResized.current = false
    }
  }, [panelOpen])

  const handleStopped = useCallback((item: RecordingItem) => {
    setActiveItem(null)
    setRecordings(prev => [item, ...prev])
  }, [])

  const { status, elapsedSecs, start, stop } = useRecorder(handleStopped)

  const handleRecordButton = useCallback(async () => {
    if (status === 'idle') {
      try {
        await start()
        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        const displayName = `录音 ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
        setActiveItem({
          filename: displayName + '.m4a',
          path: '__active__',
          display_name: displayName,
          duration_secs: 0,
          year_month: formatYearMonth(displayName),
          transcript_status: null,
        })
      } catch (err: unknown) {
        if (typeof err === 'string' && err === 'permission_denied') {
          alert('Journal 需要麦克风权限。请前往「系统设置 → 隐私与安全性 → 麦克风」开启。')
        }
      }
    } else {
      await stop()
    }
  }, [status, start, stop])

  const TRANSITION_MS = 250

  const handleClosePanel = useCallback(() => {
    setSelectedItem(null)
    setPanelOpen(false)
    // Cancel any pending close timeout (handles rapid open/close)
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current)
    }
    closeTimeoutRef.current = setTimeout(() => {
      setDisplayedItem(null)
      closeTimeoutRef.current = null
    }, TRANSITION_MS)
  }, [])

  // Close panel on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && panelOpen) handleClosePanel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [panelOpen, handleClosePanel])

  const handleContextMenu = useCallback(async (e: React.MouseEvent, item: RecordingItem) => {
    e.preventDefault()
    if (item.path === '__active__') return

    const playItem = await MenuItem.new({
      id: 'play', text: '播放',
      action: async () => { await playRecording(item.path).catch(() => {}) },
    })
    const revealItem = await MenuItem.new({
      id: 'reveal', text: '在 Finder 中显示',
      action: async () => { await revealInFinder(item.path).catch(() => {}) },
    })
    const separator = await PredefinedMenuItem.new({ item: 'Separator' })
    const deleteItem = await MenuItem.new({
      id: 'delete', text: '删除',
      action: async () => {
        await deleteRecording(item.path).catch(() => {})
        setRecordings(prev => prev.filter(r => r.path !== item.path))
        if (selectedItem?.path === item.path) {
          handleClosePanel()
        }
      },
    })

    const menu = await Menu.new({ items: [playItem, revealItem, separator, deleteItem] })
    await menu.popup()
  }, [selectedItem, handleClosePanel])

  const handleItemClick = useCallback((item: RecordingItem) => {
    if (item.path === '__active__') return
    if (selectedItem?.path === item.path) {
      handleClosePanel()
    } else {
      // Cancel any pending delayed unmount
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
      setSelectedItem(item)
      setDisplayedItem(item)
      setPanelOpen(true)
    }
  }, [selectedItem, handleClosePanel])

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left sidebar — fixed LEFT_WIDTH, never grows/shrinks */}
      <div style={{
        flex: '0 0 auto',
        width: LEFT_WIDTH,
        minWidth: LEFT_WIDTH,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}>
        <TitleBar />
        <RecordingList
          recordings={recordings}
          status={status}
          activeItem={activeItem}
          elapsedSecs={elapsedSecs}
          onContextMenu={handleContextMenu}
          onClick={handleItemClick}
          selectedPath={selectedItem?.path ?? null}
          transcriptionStates={transcriptionStates}
        />
        <RecordButton status={status} onClick={handleRecordButton} />
      </div>

      {/* Right panel — slides in via max-width transition (WebKit-compatible) */}
      <div style={{
        flex: 1,
        minWidth: 0,
        maxWidth: panelOpen ? 2000 : 0,
        overflow: 'hidden',
        transition: 'max-width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        height: '100%',
        borderLeft: panelOpen ? '1px solid var(--divider)' : 'none',
      }}>
        {displayedItem && (
          <DetailPanel
            item={displayedItem}
            transcriptionState={transcriptionStates[displayedItem.filename]}
            onClose={handleClosePanel}
          />
        )}
      </div>
    </div>
  )
}
