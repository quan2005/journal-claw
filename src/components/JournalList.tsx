import { useState } from 'react'
import type { JournalEntry } from '../types'
import { JournalItem } from './JournalItem'
import { InboxStrip } from './InboxStrip'
import { JournalContextMenu } from './JournalContextMenu'
import { deleteJournalEntry } from '../lib/tauri'
import { invoke } from '@tauri-apps/api/core'

interface JournalListProps {
  entries: JournalEntry[]
  processingPaths: string[]
  selectedPath: string | null
  onSelect: (entry: JournalEntry) => void
}

export function JournalList({ entries, processingPaths, selectedPath, onSelect }: JournalListProps) {
  const [contextMenu, setContextMenu] = useState<{ entry: JournalEntry; x: number; y: number } | null>(null)

  // Group by year_month, then by day
  const grouped: Record<string, Record<number, JournalEntry[]>> = {}
  for (const entry of entries) {
    if (!grouped[entry.year_month]) grouped[entry.year_month] = {}
    if (!grouped[entry.year_month][entry.day]) grouped[entry.year_month][entry.day] = []
    grouped[entry.year_month][entry.day].push(entry)
  }

  const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  function formatMonthLabel(ym: string): string {
    const year = 2000 + parseInt(ym.slice(0, 2))
    const month = parseInt(ym.slice(2, 4))
    return `${year}年${month}月`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <InboxStrip processingPaths={processingPaths} />

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 72 }}>
        {months.map(ym => {
          const days = Object.keys(grouped[ym]).map(Number).sort((a, b) => b - a)
          // Flatten all entries in this month for "last entry" detection
          const allInMonth = days.flatMap(d => grouped[ym][d])

          return (
            <div key={ym}>
              {/* Month divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px 6px' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#8e8e93', whiteSpace: 'nowrap' }}>
                  {formatMonthLabel(ym)}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
              </div>

              {days.map(day => {
                const dayEntries = grouped[ym][day]
                return dayEntries.map((entry, idx) => {
                  const isLastInMonth = entry === allInMonth[allInMonth.length - 1]
                  const isLastInDay = idx === dayEntries.length - 1

                  return (
                    <div key={entry.path}>
                      <JournalItem
                        entry={entry}
                        showDate={idx === 0}
                        isSelected={entry.path === selectedPath}
                        onClick={onSelect}
                        onContextMenu={(e, x, y) => setContextMenu({ entry: e, x, y })}
                      />
                      {/* Divider: between entries, but not after the last entry in a month */}
                      {!isLastInMonth && isLastInDay && (
                        <div style={{ height: 1, background: 'var(--divider)', margin: '0 16px' }} />
                      )}
                      {!isLastInDay && (
                        <div style={{ height: 1, background: 'var(--divider)', margin: '0 16px' }} />
                      )}
                    </div>
                  )
                })
              })}
            </div>
          )
        })}

        {entries.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--item-meta)', fontSize: 13 }}>
            还没有日志条目。点击录音按钮或拖入文件开始记录。
          </div>
        )}
      </div>

      {contextMenu && (
        <JournalContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entryPath={contextMenu.entry.path}
          onShowInFinder={async () => {
            await invoke('show_in_finder', { path: contextMenu.entry.path })
          }}
          onDelete={async () => {
            await deleteJournalEntry(contextMenu.entry.path)
            window.dispatchEvent(new CustomEvent('journal-entry-deleted'))
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
