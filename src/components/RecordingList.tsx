import { MonthDivider } from './MonthDivider'
import { RecordingItem } from './RecordingItem'
import type { RecordingItem as RecordingItemType } from '../types'
import type { RecorderStatus } from '../hooks/useRecorder'

interface RecordingListProps {
  recordings: RecordingItemType[]
  status: RecorderStatus
  activeItem: RecordingItemType | null
  elapsedSecs: number
  onContextMenu: (e: React.MouseEvent, item: RecordingItemType) => void
  onClick: (item: RecordingItemType) => void
  selectedPath: string | null
  transcriptionStates: Record<string, string>
}

type Group = { yearMonth: string; items: RecordingItemType[] }

export function RecordingList({
  recordings,
  status,
  activeItem,
  elapsedSecs,
  onContextMenu,
  onClick,
  selectedPath,
  transcriptionStates,
}: RecordingListProps) {
  const groups: Group[] = []

  if (status === 'recording' && activeItem) {
    groups.push({ yearMonth: activeItem.year_month, items: [activeItem] })
  }

  for (const item of recordings) {
    const existing = groups.find(g => g.yearMonth === item.year_month)
    if (existing) {
      existing.items.push(item)
    } else {
      groups.push({ yearMonth: item.year_month, items: [item] })
    }
  }

  groups.sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      {groups.map(group => (
        <div key={group.yearMonth}>
          <MonthDivider yearMonth={group.yearMonth} />
          {group.items.map(item => (
            <RecordingItem
              key={item.path}
              item={item}
              isActive={status === 'recording' && activeItem?.path === item.path}
              isSelected={item.path === selectedPath}
              elapsedSecs={elapsedSecs}
              onContextMenu={onContextMenu}
              onClick={onClick}
              transcriptionStatus={transcriptionStates[item.filename] || item.transcript_status}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
