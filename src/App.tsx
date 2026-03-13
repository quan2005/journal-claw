import { useState, useEffect, useCallback } from 'react'
import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu'
import { TitleBar } from './components/TitleBar'
import { RecordingList } from './components/RecordingList'
import { RecordButton } from './components/RecordButton'
import { useRecorder } from './hooks/useRecorder'
import { listRecordings, deleteRecording, revealInFinder, playRecording } from './lib/tauri'
import { formatYearMonth } from './lib/format'
import type { RecordingItem } from './types'

export default function App() {
  const [recordings, setRecordings] = useState<RecordingItem[]>([])
  const [activeItem, setActiveItem] = useState<RecordingItem | null>(null)

  const loadRecordings = useCallback(async () => {
    const items = await listRecordings()
    setRecordings(items)
  }, [])

  useEffect(() => { loadRecordings() }, [loadRecordings])

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

  const handleContextMenu = useCallback(async (e: React.MouseEvent, item: RecordingItem) => {
    e.preventDefault()
    if (item.path === '__active__') return

    const playItem = await MenuItem.new({
      id: 'play',
      text: '播放',
      action: async () => {
        await playRecording(item.path).catch(() => {})
      },
    })

    const revealItem = await MenuItem.new({
      id: 'reveal',
      text: '在 Finder 中显示',
      action: async () => {
        await revealInFinder(item.path).catch(() => {})
      },
    })

    const separator = await PredefinedMenuItem.new({ item: 'Separator' })

    const deleteItem = await MenuItem.new({
      id: 'delete',
      text: '删除',
      action: async () => {
        await deleteRecording(item.path).catch(() => {})
        setRecordings(prev => prev.filter(r => r.path !== item.path))
      },
    })

    const menu = await Menu.new({ items: [playItem, revealItem, separator, deleteItem] })
    await menu.popup()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TitleBar status={status} elapsedSecs={elapsedSecs} />
      <RecordingList
        recordings={recordings}
        status={status}
        activeItem={activeItem}
        elapsedSecs={elapsedSecs}
        onContextMenu={handleContextMenu}
      />
      <RecordButton status={status} onClick={handleRecordButton} />
    </div>
  )
}
