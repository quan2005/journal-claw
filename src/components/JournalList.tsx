import { useState, useRef } from 'react'
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
  const [filterQuery, setFilterQuery] = useState('')
  const filterRef = useRef<HTMLInputElement>(null)

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

  // Filter entries by query
  const lowerFilter = filterQuery.toLowerCase()
  const filtered = filterQuery
    ? entries.filter(e => e.title.toLowerCase().includes(lowerFilter) || (e.summary ?? '').toLowerCase().includes(lowerFilter) || e.tags.some(t => t.toLowerCase().includes(lowerFilter)))
    : entries

  // Group by year_month, then by day
  const grouped: Record<string, Record<number, JournalEntry[]>> = {}
  for (const entry of filtered) {
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
      {/* Filter input */}
      <div
        style={{
          padding: '8px 12px',
          flexShrink: 0,
          borderBottom: '0.5px solid var(--divider)',
          background: 'var(--sidebar-bg-translucent, rgba(30,30,30,0.72))',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 8px',
            background: 'var(--filter-input-bg, rgba(128,128,128,0.08))',
            borderRadius: 6,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--item-meta)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, opacity: 0.45 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={filterRef}
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setFilterQuery('')
                filterRef.current?.blur()
              }
            }}
            placeholder={t('search')}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 'var(--text-xs)',
              color: 'var(--item-text)',
              fontFamily: 'var(--font-body)',
              padding: '2px 0',
            }}
          />
          {filterQuery && (
            <button
              onClick={() => {
                setFilterQuery('')
                filterRef.current?.focus()
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                opacity: 0.35,
              }}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--item-meta)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>
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

        {filtered.length === 0 && (
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
