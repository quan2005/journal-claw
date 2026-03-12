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
}

type Group = { yearMonth: string; items: RecordingItemType[] }

export function RecordingList({
  recordings,
  status,
  activeItem,
  elapsedSecs,
  onContextMenu,
}: RecordingListProps) {
  // Build month groups. The activeItem is merged into the correct month group
  // (not prepended as a separate group), matching the spec requirement:
  // "录制中的条目始终置顶，属于当前月份组".
  const groups: Group[] = []

  // Add active item to its month group first
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

  // Sort groups descending by yearMonth
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
              elapsedSecs={elapsedSecs}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
