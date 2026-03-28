import { MonthDivider } from './MonthDivider'
import { RecordingItem } from './RecordingItem'
import { Spinner } from './Spinner'
import type { RecordingItem as RecordingItemType, TranscriptionProgress } from '../types'
import type { RecorderStatus } from '../hooks/useRecorder'

interface RecordingListProps {
  recordings: RecordingItemType[]
  status: RecorderStatus
  activeItem: RecordingItemType | null
  elapsedSecs: number
  onContextMenu: (e: React.MouseEvent, item: RecordingItemType) => void
  onClick: (item: RecordingItemType) => void
  selectedPath: string | null
  transcriptionStates: Record<string, TranscriptionProgress>
  processingStates: Record<string, boolean>
  newFilename: string | null
}

type MonthGroup = { yearMonth: string; dayGroups: DayGroup[] }
type DayGroup = { day: string; items: RecordingItemType[] }

function extractDay(displayName: string): string {
  const match = displayName.match(/(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

function buildGroups(recordings: RecordingItemType[]): MonthGroup[] {
  const monthMap = new Map<string, Map<string, RecordingItemType[]>>()

  for (const item of recordings) {
    const day = extractDay(item.display_name)
    if (!monthMap.has(item.year_month)) {
      monthMap.set(item.year_month, new Map())
    }
    const dayMap = monthMap.get(item.year_month)!
    if (!dayMap.has(day)) {
      dayMap.set(day, [])
    }
    dayMap.get(day)!.push(item)
  }

  const monthGroups: MonthGroup[] = []
  for (const [yearMonth, dayMap] of monthMap) {
    const dayGroups: DayGroup[] = []
    for (const [day, items] of dayMap) {
      dayGroups.push({ day, items })
    }
    dayGroups.sort((a, b) => b.day.localeCompare(a.day))
    monthGroups.push({ yearMonth, dayGroups })
  }

  monthGroups.sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))
  return monthGroups
}

export function RecordingList({
  recordings,
  status,
  activeItem,
  elapsedSecs,
  onContextMenu,
  onClick,
  selectedPath,
  transcriptionStates,
  processingStates,
  newFilename,
}: RecordingListProps) {
  const groups = buildGroups(recordings)

  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 88 }}>

      {status === 'recording' && activeItem && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: 'var(--record-highlight)',
          borderLeft: '3px solid var(--record-btn)',
          borderBottom: '1px solid var(--divider)',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--record-btn)',
            animation: 'pulse 2.4s ease-in-out infinite',
            flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--record-btn)' }}>
              录制中
            </div>
            <div style={{ fontSize: 12, color: 'var(--item-meta)', marginTop: 2 }}>
              今天 {currentTime}
            </div>
          </div>
          <div style={{
            fontSize: 13,
            color: 'var(--record-btn)',
            fontVariantNumeric: 'tabular-nums',
            animation: 'blink 1s ease-in-out infinite',
          }}>
            {String(Math.floor(elapsedSecs / 60)).padStart(2, '0')}:
            {String(elapsedSecs % 60).padStart(2, '0')}
          </div>
        </div>
      )}

      {groups.map(group => (
        <div key={group.yearMonth} style={{ marginBottom: 8 }}>
          <MonthDivider yearMonth={group.yearMonth} />
          {group.dayGroups.map(dayGroup =>
            dayGroup.items.map((item, idx) => {
              const isProcessingOnly = processingStates[item.filename] && !transcriptionStates[item.filename]
              if (isProcessingOnly && item.path === '__active__') {
                return (
                  <div key={item.path} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--divider)',
                  }}>
                    <div style={{ width: 52, flexShrink: 0 }} />
                    <Spinner size={12} borderWidth={1.5} />
                    <span style={{ fontSize: 13, color: 'var(--item-meta)' }}>处理中…</span>
                  </div>
                )
              }
              return (
                <RecordingItem
                  key={item.path}
                  item={item}
                  showDate={idx === 0}
                  isSelected={item.path === selectedPath}
                  elapsedSecs={elapsedSecs}
                  onContextMenu={onContextMenu}
                  onClick={onClick}
                  transcriptionStatus={transcriptionStates[item.filename] || item.transcript_status}
                  isProcessing={!!processingStates[item.filename]}
                  isNew={item.filename === newFilename}
                />
              )
            })
          )}
        </div>
      ))}
    </div>
  )
}
