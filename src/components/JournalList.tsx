import { useState } from 'react'
import type { JournalEntry } from '../types'
import { JournalItem } from './JournalItem'
import { JournalContextMenu } from './JournalContextMenu'
import { deleteJournalEntry } from '../lib/tauri'
import { useTranslation } from '../contexts/I18nContext'

interface JournalListProps {
  entries: JournalEntry[]
  loading?: boolean
  selectedPath: string | null
  onSelect: (entry: JournalEntry) => void
  onProcess?: (entry: JournalEntry) => void
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}

function SkeletonItem({ width, delay }: { width: number; delay: number }) {
  const shimmer: React.CSSProperties = {
    background:
      'linear-gradient(90deg, var(--skeleton-base, rgba(128,128,128,0.10)) 25%, var(--skeleton-shine, rgba(128,128,128,0.20)) 50%, var(--skeleton-base, rgba(128,128,128,0.10)) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.6s ease-in-out infinite',
    animationDelay: `${delay}ms`,
    borderRadius: 3,
  }
  return (
    <div style={{ padding: '7px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ height: 13, width: `${width}%`, ...shimmer }} />
      <div
        style={{ height: 11, width: `${Math.round(width * 0.65)}%`, ...shimmer, opacity: 0.7 }}
      />
    </div>
  )
}

function ListSkeleton() {
  return (
    <div style={{ paddingBottom: 12 }}>
      {[80, 60, 75, 55, 70].map((w, i) => (
        <SkeletonItem key={i} width={w} delay={i * 80} />
      ))}
    </div>
  )
}

// Day of week from year_month + day — caller provides locale weekdays array
function getDayOfWeek(yearMonth: string, day: number, weekdays: readonly string[]): string {
  const year = 2000 + parseInt(yearMonth.slice(0, 2))
  const month = parseInt(yearMonth.slice(2, 4)) - 1
  const d = new Date(year, month, day)
  return weekdays[d.getDay()] ?? ''
}

// Check if an entry's date is today
function isToday(yearMonth: string, day: number): boolean {
  const now = new Date()
  const year = 2000 + parseInt(yearMonth.slice(0, 2))
  const month = parseInt(yearMonth.slice(2, 4))
  return year === now.getFullYear() && month === now.getMonth() + 1 && day === now.getDate()
}

export function JournalList({
  entries,
  loading,
  selectedPath,
  onSelect,
  onProcess,
  hasMore,
  loadingMore,
  onLoadMore,
}: JournalListProps) {
  const { t, s, lang } = useTranslation()
  const [contextMenu, setContextMenu] = useState<{
    entry: JournalEntry
    x: number
    y: number
  } | null>(null)

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          background: 'var(--sidebar-bg)',
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ListSkeleton />
        </div>
      </div>
    )
  }

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
    const monthName = s.monthNames[month - 1] ?? String(month)
    return lang === 'zh' ? `${year}年${month}月` : `${monthName} ${year}`
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--sidebar-bg)',
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
        {months.map((ym) => {
          const days = Object.keys(grouped[ym])
            .map(Number)
            .sort((a, b) => b - a)

          return (
            <div key={ym}>
              {/* Month label */}
              <div style={{ padding: '14px 16px 6px' }}>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--sidebar-month)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  {formatMonthLabel(ym)}
                </span>
              </div>

              {days.map((day) => {
                const dayEntries = grouped[ym][day]
                const today = isToday(ym, day)

                return (
                  <div key={day} style={{ marginBottom: 2 }}>
                    {/* Date header — separate row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 6,
                        padding: '10px 14px 4px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 'var(--text-xl)',
                          fontWeight: 'var(--font-medium)',
                          lineHeight: 1,
                          color: today ? 'var(--date-today-number)' : 'var(--item-meta)',
                        }}
                      >
                        {day}
                      </span>
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          letterSpacing: '0.08em',
                          color: today ? 'var(--date-today-weekday)' : 'var(--item-meta)',
                        }}
                      >
                        {getDayOfWeek(ym, day, s.weekdays)}
                      </span>
                    </div>

                    {/* Entries for this day */}
                    {dayEntries.map((entry) => (
                      <JournalItem
                        key={entry.path}
                        entry={entry}
                        isSelected={entry.path === selectedPath}
                        onClick={onSelect}
                        onContextMenu={(e, x, y) => setContextMenu({ entry: e, x, y })}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })}

        {entries.length === 0 && (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: 'var(--item-meta)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {t('noEntries')}
          </div>
        )}

        {hasMore && (
          <div style={{ padding: '8px 14px 16px', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              style={{
                background: 'none',
                border: '0.5px solid var(--divider)',
                borderRadius: 6,
                padding: '5px 14px',
                fontSize: 'var(--text-xs)',
                color: loadingMore ? 'var(--item-meta)' : 'var(--item-title)',
                cursor: loadingMore ? 'default' : 'pointer',
                letterSpacing: '0.04em',
                opacity: loadingMore ? 0.5 : 1,
                transition: 'opacity 0.15s ease-out',
              }}
            >
              {loadingMore ? t('loadingMore') : t('loadMore')}
            </button>
          </div>
        )}
      </div>

      {contextMenu && (
        <JournalContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          onProcess={() => {
            onProcess?.(contextMenu.entry)
            setContextMenu(null)
          }}
          onDelete={async () => {
            await deleteJournalEntry(contextMenu.entry.path)
            window.dispatchEvent(
              new CustomEvent('journal-entry-deleted', {
                detail: { path: contextMenu.entry.path },
              }),
            )
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
