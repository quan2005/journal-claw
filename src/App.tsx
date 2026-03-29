import { useState, useEffect, useCallback, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { LogicalSize } from '@tauri-apps/api/dpi'
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
  const [panelVisible, setPanelVisible] = useState(false)
  const [slideOpen, setSlideOpen] = useState(false)
  const [displayedItem, setDisplayedItem] = useState<RecordingItem | null>(null)
  const [transcriptionStates, setTranscriptionStates] = useState<Record<string, TranscriptionProgress>>({})
  const [processingStates, setProcessingStates] = useState<Record<string, boolean>>({})
  const [newFilename, setNewFilename] = useState<string | null>(null)
  const isClosingRef = useRef(false)
  const resizeAnimRef = useRef<number | null>(null)
  const [baseWidth, setBaseWidth] = useState(() => {
    const saved = localStorage.getItem('daynote_base_width')
    return saved ? parseInt(saved, 10) : window.innerWidth
  })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  const animateResize = useCallback((target: number, onDone?: () => void) => {
    if (resizeAnimRef.current !== null) cancelAnimationFrame(resizeAnimRef.current)
    const startW = window.innerWidth
    const startH = window.innerHeight
    const delta = target - startW
    if (Math.abs(delta) < 2) { onDone?.(); return }
    const duration = 250
    const appWindow = getCurrentWindow()
    let t0: number | null = null
    const step = (ts: number) => {
      if (t0 === null) t0 = ts
      const p = Math.min((ts - t0) / duration, 1)
      const e = p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2
      appWindow.setSize(new LogicalSize(Math.round(startW + delta * e), startH)).catch(() => {})
      if (p < 1) resizeAnimRef.current = requestAnimationFrame(step)
      else {
        resizeAnimRef.current = null
        onDone?.()
      }
    }
    resizeAnimRef.current = requestAnimationFrame(step)
  }, [])

  const loadRecordings = useCallback(async () => {
    const items = await listRecordings()
    setRecordings(items)
  }, [])

  useEffect(() => { loadRecordings() }, [loadRecordings])

  useEffect(() => {
    const onResize = () => {
      if (!panelVisible) setBaseWidth(window.innerWidth)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [panelVisible])

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

  const handleDividerDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartX.current = e.clientX
    dragStartWidth.current = baseWidth
  }, [baseWidth])

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current
      const newW = Math.max(280, Math.min(dragStartWidth.current + delta, window.innerWidth - 200))
      setBaseWidth(newW)
    }
    const onUp = () => {
      setIsDragging(false)
      setBaseWidth(w => {
        localStorage.setItem('daynote_base_width', String(w))
        return w
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging])

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
    setSlideOpen(false)
    isClosingRef.current = true
    animateResize(baseWidth, () => {
      if (isClosingRef.current) {
        isClosingRef.current = false
        setPanelVisible(false)
        setDisplayedItem(null)
      }
    })
  }, [animateResize, baseWidth])

  const handleItemClick = useCallback((item: RecordingItem) => {
    if (item.path === '__active__') return
    if (selectedItem?.path === item.path) {
      handleCloseSheet()
    } else {
      if (isClosingRef.current) {
        isClosingRef.current = false
        setSlideOpen(true)
        animateResize(baseWidth + 360)
      }
      setSelectedItem(item)
      setDisplayedItem(item)
      if (!panelVisible) {
        const w = window.innerWidth
        const saved = localStorage.getItem('daynote_base_width')
        const bw = saved ? parseInt(saved, 10) : w
        setBaseWidth(bw)
        setPanelVisible(true)
        animateResize(bw + 360)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setSlideOpen(true))
        })
      }
    }
  }, [selectedItem, panelVisible, handleCloseSheet, animateResize])

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <TitleBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={panelVisible
          ? { width: baseWidth, flexShrink: 0, position: 'relative', overflow: 'hidden' }
          : { flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }
        }>
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
        </div>
        {panelVisible && (
          <>
            <div
              onMouseDown={handleDividerDown}
              style={{
                width: 7,
                cursor: 'col-resize',
                flexShrink: 0,
                position: 'relative',
                zIndex: 10,
              }}
            >
              <div style={{
                position: 'absolute',
                left: 3,
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: 'var(--divider)',
              }} />
            </div>
            <div style={{
              flex: 1,
              height: '100%',
              overflow: 'hidden',
              minWidth: 200,
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                transform: slideOpen ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              }}>
                {displayedItem && (
                  <DetailSheet
                    item={displayedItem}
                    transcriptionState={transcriptionStates[displayedItem.filename]}
                    onClose={handleCloseSheet}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
