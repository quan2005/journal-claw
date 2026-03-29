import { useState, useEffect, useRef } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { TitleBar } from './components/TitleBar'
import { RecordButton } from './components/RecordButton'
import { JournalList } from './components/JournalList'
import { DetailPanel } from './components/DetailPanel'
import { DropOverlay } from './components/DropOverlay'
import { useRecorder } from './hooks/useRecorder'
import { useJournal } from './hooks/useJournal'
import { useTheme } from './hooks/useTheme'
import { importFile, triggerAiProcessing } from './lib/tauri'
import type { JournalEntry } from './types'

const BASE_WIDTH = 320
const DIVIDER_WIDTH = 7

export default function App() {
  const { status, start, stop } = useRecorder()
  const { entries, processingPaths, refresh } = useJournal()
  const { theme, setTheme } = useTheme()

  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
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
        ;(async () => {
          for (const path of paths) {
            try {
              const result = await importFile(path)
              await triggerAiProcessing(result.path, result.year_month)
            } catch (err) {
              console.error('[drop] error:', String(err), 'path:', path)
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
      <TitleBar theme={theme} onThemeChange={setTheme} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Journal list */}
        <div style={{ width: baseWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <JournalList
            entries={entries}
            processingPaths={processingPaths}
            selectedPath={selectedEntry?.path ?? null}
            onSelect={setSelectedEntry}
          />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', paddingBottom: 24, pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto' }}>
              <RecordButton status={status} onClick={handleRecord} />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div
          onMouseDown={onDividerMouseDown}
          style={{
            width: DIVIDER_WIDTH, flexShrink: 0, background: 'var(--divider)',
            cursor: 'col-resize',
          }}
        />

        {/* Right: Detail panel — always visible, fills remaining space */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <DetailPanel entry={selectedEntry} onDeselect={() => setSelectedEntry(null)} />
        </div>
      </div>

      <DropOverlay visible={isDragOver} />
    </div>
  )
}
