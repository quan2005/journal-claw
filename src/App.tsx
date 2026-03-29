import { useState, useEffect, useRef, useCallback } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { LogicalSize } from '@tauri-apps/api/dpi'
import { TitleBar } from './components/TitleBar'
import { RecordButton } from './components/RecordButton'
import { JournalList } from './components/JournalList'
import { DetailPanel } from './components/DetailPanel'
import { DropOverlay } from './components/DropOverlay'
import { useRecorder } from './hooks/useRecorder'
import { useJournal } from './hooks/useJournal'
import { importFile, triggerAiProcessing } from './lib/tauri'
import type { JournalEntry } from './types'

const BASE_WIDTH = 320
const PANEL_WIDTH = 340
const DIVIDER_WIDTH = 7

export default function App() {
  const { status, start, stop } = useRecorder()
  const { entries, processingPaths, refresh } = useJournal()

  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [panelVisible, setPanelVisible] = useState(false)
  const [slideOpen, setSlideOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [baseWidth, setBaseWidth] = useState<number>(() => {
    const saved = localStorage.getItem('journal_base_width')
    return saved ? parseInt(saved) : BASE_WIDTH
  })

  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  // Window resize
  const setWindowWidth = useCallback(async (width: number) => {
    const win = getCurrentWindow()
    const inner = await win.innerSize()
    await win.setSize(new LogicalSize(width, inner.height / (window.devicePixelRatio || 1)))
  }, [])

  const openPanel = useCallback(async (entry: JournalEntry) => {
    setSelectedEntry(entry)
    if (!panelVisible) {
      setPanelVisible(true)
      await setWindowWidth(baseWidth + DIVIDER_WIDTH + PANEL_WIDTH)
      requestAnimationFrame(() => setSlideOpen(true))
    }
  }, [panelVisible, baseWidth, setWindowWidth])

  const closePanel = useCallback(async () => {
    setSlideOpen(false)
    setTimeout(async () => {
      setPanelVisible(false)
      setSelectedEntry(null)
      await setWindowWidth(baseWidth)
    }, 250)
  }, [baseWidth, setWindowWidth])

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
      if (panelVisible) {
        setWindowWidth(newWidth + DIVIDER_WIDTH + PANEL_WIDTH)
      }
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isDragging, panelVisible, setWindowWidth])

  // Drop handling via Tauri native file drop (browser DragEvent doesn't expose file paths)
  useEffect(() => {
    let unlisten: (() => void) | null = null
    getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === 'over') {
        setIsDragOver(true)
      } else if (event.payload.type === 'leave') {
        setIsDragOver(false)
      } else if (event.payload.type === 'drop') {
        setIsDragOver(false)
        const paths: string[] = event.payload.paths ?? []
        ;(async () => {
          for (const path of paths) {
            try {
              const result = await importFile(path)
              await triggerAiProcessing(result.path, result.year_month)
            } catch (err) {
              console.error('Import failed:', err)
            }
          }
          refresh()
        })()
      }
    }).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [refresh])

  // journal-entry-deleted event
  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('journal-entry-deleted', handler)
    return () => window.removeEventListener('journal-entry-deleted', handler)
  }, [refresh])

  const handleRecord = async () => {
    if (status === 'idle') {
      await start()
    } else {
      await stop()
      refresh()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>
      <TitleBar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Journal list */}
        <div style={{ width: baseWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <JournalList
            entries={entries}
            processingPaths={processingPaths}
            selectedPath={selectedEntry?.path ?? null}
            onSelect={openPanel}
          />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', paddingBottom: 24, pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto' }}>
              <RecordButton status={status} onClick={handleRecord} />
            </div>
          </div>
        </div>

        {/* Divider */}
        {panelVisible && (
          <div
            onMouseDown={onDividerMouseDown}
            style={{
              width: DIVIDER_WIDTH, flexShrink: 0, background: 'var(--divider)',
              cursor: 'col-resize',
            }}
          />
        )}

        {/* Right: Detail panel */}
        {panelVisible && selectedEntry && (
          <div style={{
            transform: slideOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
            flexShrink: 0,
          }}>
            <DetailPanel entry={selectedEntry} onClose={closePanel} />
          </div>
        )}
      </div>

      <DropOverlay visible={isDragOver} />
    </div>
  )
}
