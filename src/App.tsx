import { useState, useEffect, useRef } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { TitleBar } from './components/TitleBar'
import { JournalList } from './components/JournalList'
import { DetailPanel } from './components/DetailPanel'
import { CommandDock } from './components/CommandDock'
import { ProcessingQueue } from './components/ProcessingQueue'
import { useRecorder } from './hooks/useRecorder'
import { useJournal } from './hooks/useJournal'
import { useTheme } from './hooks/useTheme'
import { importFile, triggerAiProcessing, submitPasteText, importText } from './lib/tauri'
import type { JournalEntry } from './types'

const BASE_WIDTH = 320
const DIVIDER_WIDTH = 7

export default function App() {
  const { status, start, stop } = useRecorder()
  const { entries, loading, queueItems, isProcessing, dismissQueueItem, refresh } = useJournal()
  const { theme, setTheme } = useTheme()


  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [baseWidth, setBaseWidth] = useState<number>(() => {
    const saved = localStorage.getItem('journal_base_width')
    return saved ? parseInt(saved) : BASE_WIDTH
  })

  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

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
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isDragging])

  // Drop handling via Tauri native file drop
  useEffect(() => {
    let unlisten: (() => void) | null = null
    getCurrentWebview().onDragDropEvent((event) => {
      const type = event.payload.type
      if (type === 'enter' || type === 'over') {
        setIsDragOver(true)
      } else if (type === 'leave') {
        setIsDragOver(false)
      } else if (type === 'drop') {
        setIsDragOver(false)
        const paths: string[] = (event.payload as { paths: string[] }).paths ?? []
        if (paths.length > 0) {
          setPendingFiles(prev => {
            const existing = new Set(prev)
            const newPaths = paths.filter(p => !existing.has(p))
            return newPaths.length > 0 ? [...prev, ...newPaths] : prev
          })
        }
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
    const allPaths = [...paths]
    if (note) {
      try {
        const noteResult = await importText(note)
        allPaths.push(noteResult.path)
      } catch (err) {
        console.error('[note-import] error:', String(err))
      }
    }
    for (const path of allPaths) {
      try {
        const result = await importFile(path)
        await triggerAiProcessing(result.path, result.year_month)
      } catch (err) {
        console.error('[file-submit] error:', String(err), 'path:', path)
      }
    }
    refresh()
  }

  const handleFilesCancel = () => setPendingFiles([])

  const handleRemoveFile = (index: number) =>
    setPendingFiles(prev => prev.filter((_, i) => i !== index))

  const handleRecord = async () => {
    if (status === 'idle') {
      await start()
    } else {
      await stop()
      refresh()
    }
  }

  const handlePasteSubmit = async (text: string) => {
    await submitPasteText(text)
    refresh()
  }

  const handlePasteFiles = (paths: string[]) => {
    setPendingFiles(prev => {
      const existing = new Set(prev)
      const newPaths = paths.filter(p => !existing.has(p))
      return newPaths.length > 0 ? [...prev, ...newPaths] : prev
    })
  }

  const processingFilename = queueItems.find(i => i.status === 'processing')?.filename

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <TitleBar theme={theme} onThemeChange={setTheme} isProcessing={isProcessing} processingFilename={processingFilename} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Journal list */}
        <div style={{ width: baseWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '0.5px solid var(--divider)' }}>
          <JournalList
            entries={entries}
            loading={loading}
            selectedPath={selectedEntry?.path ?? null}
            onSelect={setSelectedEntry}
          />
        </div>

        {/* Divider */}
        <div
          onMouseDown={onDividerMouseDown}
          style={{
            width: DIVIDER_WIDTH, flexShrink: 0, background: 'transparent',
            cursor: 'col-resize',
          }}
        />

        {/* Right: Detail panel */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <DetailPanel entry={selectedEntry} onDeselect={() => setSelectedEntry(null)} />
        </div>
      </div>

      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          right: 0,
          zIndex: 10,
        }}>
          <ProcessingQueue items={queueItems} onDismiss={dismissQueueItem} />
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
        />
      </div>
    </div>
  )
}
