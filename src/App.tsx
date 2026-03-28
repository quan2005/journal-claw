import { useState, useEffect, useCallback, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu'
import { TitleBar } from './components/TitleBar'
import { RecordingList } from './components/RecordingList'
import { DetailSheet } from './components/DetailSheet'
import { RecordButton } from './components/RecordButton'
import { useRecorder } from './hooks/useRecorder'
import { listRecordings, deleteRecording, revealInFinder, playRecording } from './lib/tauri'
import { formatYearMonth } from './lib/format'
import type { RecordingItem, TranscriptionProgress } from './types'

export default function App() {
  const [recordings, setRecordings] = useState<RecordingItem[]>([])
  const [activeItem, setActiveItem] = useState<RecordingItem | null>(null)
  const [selectedItem, setSelectedItem] = useState<RecordingItem | null>(null)
  const [displayedItem, setDisplayedItem] = useState<RecordingItem | null>(null)
  const [transcriptionStates, setTranscriptionStates] = useState<Record<string, TranscriptionProgress>>({})
  const [processingStates, setProcessingStates] = useState<Record<string, boolean>>({})
  const [newFilename, setNewFilename] = useState<string | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        if (status === 'completed' || status === 'failed') {
          loadRecordings()
        }
      }
    )
    return () => { unlistenPromise.then(u => u()) }
  }, [loadRecordings])

  useEffect(() => {
    const processingUnlisten = listen<string>('recording-processing', (event) => {
      setProcessingStates(prev => ({ ...prev, [event.payload]: true }))
    })
    const processedUnlisten = listen<RecordingItem>('recording-processed', (event) => {
      const newItem = event.payload
      setNewFilename(newItem.filename)
      setTimeout(() => setNewFilename(null), 400)
      setProcessingStates(prev => {
        const next = { ...prev }
        delete next[newItem.filename]
        return next
      })
      setRecordings(prev => {
        const idx = prev.findIndex(r => r.filename === newItem.filename)
        if (idx >= 0) return prev.map((r, i) => i === idx ? newItem : r)
        return [newItem, ...prev]
      })
    })
    return () => {
      processingUnlisten.then(u => u())
      processedUnlisten.then(u => u())
    }
  }, [])

  const { status, elapsedSecs, start, stop } = useRecorder()

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
      if (activeItem) {
        setProcessingStates(prev => ({ ...prev, [activeItem.filename]: true }))
        setRecordings(prev => [activeItem, ...prev])
      }
      setActiveItem(null)
    }
  }, [status, start, stop, activeItem])

  const handleCloseSheet = useCallback(() => {
    setSelectedItem(null)
    if (closeTimeoutRef.current !== null) clearTimeout(closeTimeoutRef.current)
    closeTimeoutRef.current = setTimeout(() => {
      setDisplayedItem(null)
      closeTimeoutRef.current = null
    }, 300)
  }, [])

  const handleItemClick = useCallback((item: RecordingItem) => {
    if (item.path === '__active__') return
    if (selectedItem?.path === item.path) {
      handleCloseSheet()
    } else {
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
      setSelectedItem(item)
      setDisplayedItem(item)
    }
  }, [selectedItem, handleCloseSheet])

  const handleContextMenu = useCallback(async (e: React.MouseEvent, item: RecordingItem) => {
    e.preventDefault()
    if (item.path === '__active__') return

    const [playItem, revealItem, separator, deleteItem] = await Promise.all([
      MenuItem.new({ id: 'play', text: '播放', action: async () => { await playRecording(item.path).catch(() => {}) } }),
      MenuItem.new({ id: 'reveal', text: '在 Finder 中显示', action: async () => { await revealInFinder(item.path).catch(() => {}) } }),
      PredefinedMenuItem.new({ item: 'Separator' }),
      MenuItem.new({
        id: 'delete', text: '删除',
        action: async () => {
          await deleteRecording(item.path).catch(() => {})
          setRecordings(prev => prev.filter(r => r.path !== item.path))
          setTranscriptionStates(prev => { const next = { ...prev }; delete next[item.filename]; return next })
          if (selectedItem?.path === item.path) handleCloseSheet()
        },
      }),
    ])

    const menu = await Menu.new({ items: [playItem, revealItem, separator, deleteItem] })
    await menu.popup()
  }, [selectedItem, handleCloseSheet])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <TitleBar />
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <RecordingList
          recordings={recordings}
          status={status}
          activeItem={activeItem}
          elapsedSecs={elapsedSecs}
          onContextMenu={handleContextMenu}
          onClick={handleItemClick}
          selectedPath={selectedItem?.path ?? null}
          transcriptionStates={transcriptionStates}
          processingStates={processingStates}
          newFilename={newFilename}
        />
        <RecordButton status={status} onClick={handleRecordButton} />
        {displayedItem && (
          <DetailSheet
            item={displayedItem}
            transcriptionState={transcriptionStates[displayedItem.filename]}
            onClose={handleCloseSheet}
          />
        )}
      </div>
    </div>
  )
}
