import { useState, useEffect, useRef } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { listen } from '@tauri-apps/api/event'
import { TitleBar } from './components/TitleBar'
import { JournalList } from './components/JournalList'
import { DetailPanel } from './components/DetailPanel'
import { CommandDock } from './components/CommandDock'
import { ProcessingQueue } from './components/ProcessingQueue'
import { SettingsPanel } from './settings/SettingsPanel'
import { useRecorder } from './hooks/useRecorder'
import { useJournal, RECORDING_PLACEHOLDER } from './hooks/useJournal'
import { useTheme } from './hooks/useTheme'
import { importFile, importAudioFile, triggerAiProcessing, triggerAiPrompt, cancelAiProcessing } from './lib/tauri'
import { fileKindFromName } from './lib/fileKind'
import type { JournalEntry } from './types'

const BASE_WIDTH = 320
const DIVIDER_WIDTH = 7

export default function App() {
  const { status, elapsedSecs, audioLevel, start, stop } = useRecorder()
  const { entries, loading, queueItems, isProcessing, dismissQueueItem, addConvertingItem, addQueuedItem, refresh } = useJournal()
  const { theme, setTheme } = useTheme()

  const [view, setView] = useState<'journal' | 'settings'>('journal')
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [activeLogPath, setActiveLogPath] = useState<string | null>(null)
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

  // Open settings from Rust menu (Cmd+,) or keyboard shortcut
  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen('open-settings', () => setView('settings')).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [])

  // Esc closes settings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setView('journal')
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
    for (const path of paths) {
      try {
        const kind = fileKindFromName(path.split('/').pop() ?? path)
        if (kind === 'audio') {
          const result = await importAudioFile(path)
          addQueuedItem(result.path, result.filename)
        } else {
          const result = await importFile(path)
          await triggerAiProcessing(result.path, result.year_month, note)
        }
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
      addConvertingItem(RECORDING_PLACEHOLDER, '录音处理中')
    }
  }

  const handlePasteSubmit = async (text: string) => {
    await triggerAiPrompt(text)
    refresh()
  }

  const handlePasteFiles = (paths: string[]) => {
    setPendingFiles(prev => {
      const existing = new Set(prev)
      const newPaths = paths.filter(p => !existing.has(p))
      if (newPaths.length === 0) return prev
      return [...prev, ...newPaths].slice(0, 6)
    })
  }

  const processingFilename = queueItems.find(i => i.status === 'processing')?.filename
  const processingPath = queueItems.find(i => i.status === 'processing')?.path

  // Inject a virtual 'recording' item at the front of the queue when recording
  const visibleQueueItems = status === 'recording'
    ? [{ path: RECORDING_PLACEHOLDER, filename: '录音中', status: 'recording' as const, addedAt: Date.now(), logs: [], elapsedSecs, audioLevel }, ...queueItems]
    : queueItems

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <TitleBar
        theme={theme}
        onThemeChange={setTheme}
        isProcessing={isProcessing}
        processingFilename={processingFilename}
        onLogClick={processingPath ? () => setActiveLogPath(processingPath) : undefined}
        view={view}
        onToggleSettings={() => setView(v => v === 'settings' ? 'journal' : 'settings')}
      />

      {view === 'settings' ? (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <SettingsPanel />
        </div>
      ) : (
        <>
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
              <ProcessingQueue items={visibleQueueItems} onDismiss={dismissQueueItem} onCancel={cancelAiProcessing} activeLogPath={activeLogPath} onSetActiveLogPath={setActiveLogPath} />
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
        </>
      )}
    </div>
  )
}
