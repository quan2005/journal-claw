# DayNote UI Redesign — 时间流·日志优先 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 DayNote 的视觉语言从"文件管理器"转向"日志型记录工具"，采用时间流卡片列表、底部滑入 DetailSheet、悬浮 FAB 录音按钮，参考 Day One 的日记气质。

**Architecture:** 整个布局改为单栏（固定宽度，用户可调），用 `position: absolute` 的 DetailSheet 覆盖列表，不再触发窗口 resize。RecordButton 改为 absolute FAB，不再占用底部固定区域。RecordingItem 改为左日期大字 + 右内容的双列卡片布局。

**Tech Stack:** React 19, TypeScript, Tauri v2, Vitest + @testing-library/react, CSS variables (inline styles pattern)

---

## File Map

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/styles/globals.css` | Modify | Design tokens：新增 `--sheet-overlay`、`--card-selected-bar`、`--date-number`、`--date-secondary`；调整 `--titlebar-bg`、`--item-hover-bg` |
| `src/styles/animations.css` | Modify | 新增 `@keyframes jolt`、`@keyframes card-enter`；更新注释 |
| `src/components/TitleBar.tsx` | Modify | 去掉 background 引用，纯透明拖拽区 |
| `src/components/MonthDivider.tsx` | Modify | 升级为 16px 600 章节标题 + 下方分割线 |
| `src/components/RecordingItem.tsx` | Rewrite | 左侧日期大字（同天去重），右侧标题+时间+时长+状态，选中左竖线，入场动画 |
| `src/components/RecordingList.tsx` | Modify | 按天分组（同天去重逻辑），底部 88px padding，录制中卡片渲染 |
| `src/components/RecordButton.tsx` | Rewrite | absolute FAB，56px，jolt 动画，按压反馈 |
| `src/components/DetailSheet.tsx` | Create | 新建，遮罩+底部 sheet，拖拽关闭，Escape 关闭，转写内容展示 |
| `src/components/DetailPanel.tsx` | Delete | 被 DetailSheet 替代，删除 |
| `src/App.tsx` | Modify | 移除 resize 逻辑，改用 DetailSheet，FAB 改为 absolute，布局简化 |
| `src/tests/RecordingItem.test.tsx` | Create | 日期去重逻辑单元测试 |
| `src/tests/DetailSheet.test.tsx` | Create | sheet 开关、Escape 关闭测试 |

---

## Task 1: 更新 Design Tokens 与动画

**Files:**
- Modify: `src/styles/globals.css`
- Modify: `src/styles/animations.css`

- [ ] **Step 1: 更新 globals.css**

将 `src/styles/globals.css` 全部替换为：

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: #ffffff;
  --titlebar-bg: var(--bg);
  --divider: #e5e5ea;
  --month-label: #8e8e93;
  --item-text: #1c1c1e;
  --item-meta: #aeaeb2;
  --duration-text: #c7c7cc;
  --record-btn: #ff3b30;
  --record-highlight: rgba(255, 59, 48, 0.06);
  --record-highlight-bar: rgba(255, 59, 48, 1);
  --item-icon-bg: #f2f2f7;
  --item-hover-bg: rgba(0, 0, 0, 0.04);
  --item-selected-bg: rgba(0, 0, 0, 0.06);
  --item-selected-text: #1c1c1e;
  --item-selected-meta: #aeaeb2;
  --card-selected-bar: var(--record-btn);
  --date-number: var(--item-text);
  --date-secondary: var(--item-meta);
  --sheet-overlay: rgba(0, 0, 0, 0.30);
  --sheet-bg: #ffffff;
  --sheet-handle: #d1d1d6;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1c1c1e;
    --titlebar-bg: var(--bg);
    --divider: #3a3a3c;
    --month-label: #636366;
    --item-text: #e8e8e8;
    --item-meta: #636366;
    --duration-text: #48484a;
    --record-btn: #ff375f;
    --record-highlight: rgba(255, 55, 95, 0.06);
    --record-highlight-bar: rgba(255, 55, 95, 1);
    --item-icon-bg: #2c2c2e;
    --item-hover-bg: rgba(255, 255, 255, 0.05);
    --item-selected-bg: rgba(255, 255, 255, 0.08);
    --item-selected-text: #e8e8e8;
    --item-selected-meta: #636366;
    --sheet-bg: #2c2c2e;
    --sheet-handle: #48484a;
  }
}

html, body, #root {
  height: 100%;
  width: 100%;
  background: var(--bg);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  overflow: hidden;
}

#root {
  display: flex;
  flex-direction: column;
}

[data-tauri-drag-region] {
  -webkit-app-region: drag;
}

[data-tauri-drag-region] * {
  -webkit-app-region: no-drag;
}
```

- [ ] **Step 2: 更新 animations.css**

将 `src/styles/animations.css` 全部替换为：

```css
/* Breathing glow on idle FAB: 2.4s ease-in-out */
@keyframes pulse {
  0%, 100% { box-shadow: 0 4px 16px rgba(0,0,0,0.18); }
  50%       { box-shadow: 0 4px 16px rgba(0,0,0,0.18), 0 0 0 10px rgba(255, 59, 48, 0.18); }
}

@media (prefers-color-scheme: dark) {
  @keyframes pulse {
    0%, 100% { box-shadow: 0 4px 16px rgba(0,0,0,0.30); }
    50%       { box-shadow: 0 4px 16px rgba(0,0,0,0.30), 0 0 0 10px rgba(255, 55, 95, 0.22); }
  }
}

/* FAB press release jolt — tactile "recorded" feedback */
@keyframes jolt {
  0%   { transform: scale(1); }
  30%  { transform: scale(0.88); }
  60%  { transform: scale(1.06); }
  100% { transform: scale(1); }
}

/* New recording card enter from above */
@keyframes card-enter {
  from { transform: translateY(-12px); opacity: 0; }
  to   { transform: translateY(0);     opacity: 1; }
}

/* Title bar recording dot blink: 1s ease-in-out */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.25; }
}

/* Spinner */
@keyframes spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css src/styles/animations.css
git commit -m "style: update design tokens and animations for timeline redesign"
```

---

## Task 2: TitleBar 与 MonthDivider 升级

**Files:**
- Modify: `src/components/TitleBar.tsx`
- Modify: `src/components/MonthDivider.tsx`

- [ ] **Step 1: 更新 TitleBar.tsx**

```tsx
export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      style={{
        height: 36,
        background: 'var(--bg)',
        flexShrink: 0,
        paddingLeft: 70,
      }}
    />
  )
}
```

- [ ] **Step 2: 更新 MonthDivider.tsx**

```tsx
interface MonthDividerProps {
  yearMonth: string  // "202603"
}

export function MonthDivider({ yearMonth }: MonthDividerProps) {
  const year = yearMonth.slice(0, 4)
  const month = Number(yearMonth.slice(4, 6))
  return (
    <div style={{ paddingTop: 24, paddingBottom: 0 }}>
      <div style={{
        padding: '0 20px 10px',
        fontSize: 16,
        fontWeight: 600,
        color: 'var(--item-text)',
      }}>
        {year}年{month}月
      </div>
      <div style={{ height: 1, background: 'var(--divider)', margin: '0 0' }} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TitleBar.tsx src/components/MonthDivider.tsx
git commit -m "style: simplify TitleBar and upgrade MonthDivider to chapter heading"
```

---

## Task 3: RecordingItem 重写为日期卡片

**Files:**
- Rewrite: `src/components/RecordingItem.tsx`
- Create: `src/tests/RecordingItem.test.tsx`

`★ Insight ─────────────────────────────────────`
- `showDate` prop 控制同天去重：第一条显示大字日期，后续同天条目左侧空白对齐
- 星期用 `Intl.DateTimeFormat` 获取，避免手写映射表
- 选中态用左边 2px 竖线代替全蓝背景，视觉更轻
`─────────────────────────────────────────────────`

- [ ] **Step 1: 写失败测试**

创建 `src/tests/RecordingItem.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecordingItem } from '../components/RecordingItem'
import type { RecordingItem as RecordingItemType } from '../types'

const baseItem: RecordingItemType = {
  filename: '录音 2026-03-28 19:54.m4a',
  path: '/tmp/录音 2026-03-28 19:54.m4a',
  display_name: '录音 2026-03-28 19:54',
  duration_secs: 707,
  year_month: '202603',
  transcript_status: null,
}

const noop = vi.fn()

describe('RecordingItem', () => {
  it('shows date number when showDate=true', () => {
    render(
      <RecordingItem
        item={baseItem}
        showDate={true}
        onContextMenu={noop}
        onClick={noop}
      />
    )
    expect(screen.getByText('28')).toBeTruthy()
  })

  it('hides date number when showDate=false', () => {
    render(
      <RecordingItem
        item={baseItem}
        showDate={false}
        onContextMenu={noop}
        onClick={noop}
      />
    )
    expect(screen.queryByText('28')).toBeNull()
  })

  it('shows display_name', () => {
    render(
      <RecordingItem
        item={baseItem}
        showDate={true}
        onContextMenu={noop}
        onClick={noop}
      />
    )
    expect(screen.getByText('录音 2026-03-28 19:54')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npm test -- --reporter=verbose src/tests/RecordingItem.test.tsx
```

期望输出：`FAIL` — `RecordingItem` 没有 `showDate` prop。

- [ ] **Step 3: 重写 RecordingItem.tsx**

```tsx
import { useState } from 'react'
import { formatDuration } from '../lib/format'
import type { RecordingItem as RecordingItemType, TranscriptionProgress } from '../types'
import { Spinner } from './Spinner'

interface RecordingItemProps {
  item: RecordingItemType
  showDate: boolean
  isActive?: boolean
  isSelected?: boolean
  isProcessing?: boolean
  elapsedSecs?: number
  onContextMenu: (e: React.MouseEvent, item: RecordingItemType) => void
  onClick: (item: RecordingItemType) => void
  transcriptionStatus?: TranscriptionProgress | null
  isNew?: boolean
}

function getWeekday(displayName: string): string {
  // displayName: "录音 2026-03-28 19:54"
  const match = displayName.match(/(\d{4}-\d{2}-\d{2})/)
  if (!match) return ''
  const date = new Date(match[1])
  return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(date)
}

function getTimeStr(displayName: string): string {
  // Extract "19:54" from "录音 2026-03-28 19:54"
  const match = displayName.match(/(\d{2}:\d{2})$/)
  return match ? match[1] : ''
}

function StatusIcon({ status }: { status: TranscriptionProgress | null | undefined }) {
  if (!status) return null
  if (status === 'completed') {
    return (
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 8.5 6.5 12 13 4" />
      </svg>
    )
  }
  if (status === 'failed') {
    return (
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none"
        stroke="var(--record-btn)" strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="4" x2="12" y2="12" />
        <line x1="12" y1="4" x2="4" y2="12" />
      </svg>
    )
  }
  return <Spinner size={9} borderWidth={1.5} />
}

export function RecordingItem({
  item, showDate, isActive, isSelected, isProcessing, elapsedSecs,
  onContextMenu, onClick, transcriptionStatus, isNew,
}: RecordingItemProps) {
  const [hovered, setHovered] = useState(false)

  const duration = isActive && elapsedSecs !== undefined
    ? formatDuration(elapsedSecs)
    : formatDuration(item.duration_secs)

  const timeStr = getTimeStr(item.display_name)
  const weekday = showDate ? getWeekday(item.display_name) : ''
  const dayNum = showDate ? item.display_name.match(/\d{4}-\d{2}-(\d{2})/)?.[1] ?? '' : ''

  const bg = isSelected
    ? 'var(--item-selected-bg)'
    : hovered ? 'var(--item-hover-bg)' : 'transparent'

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div
      onClick={() => onClick(item)}
      onContextMenu={e => onContextMenu(e, item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        cursor: 'default',
        background: bg,
        position: 'relative',
        borderBottom: '1px solid var(--divider)',
        animation: isNew
          ? reducedMotion
            ? 'card-enter 150ms ease forwards'
            : 'card-enter 280ms ease-out forwards'
          : undefined,
      }}
    >
      {/* Selected bar */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 2,
          background: 'var(--card-selected-bar)',
          borderRadius: '0 1px 1px 0',
        }} />
      )}

      {/* Left: date column */}
      <div style={{
        width: 52,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 0 12px 8px',
        gap: 2,
      }}>
        {showDate && dayNum ? (
          <>
            <span style={{
              fontSize: 26,
              fontWeight: 300,
              color: 'var(--date-number)',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {dayNum}
            </span>
            <span style={{ fontSize: 10, color: 'var(--date-secondary)', lineHeight: 1 }}>
              {weekday}
            </span>
          </>
        ) : null}
      </div>

      {/* Right: content */}
      <div style={{
        flex: 1,
        minWidth: 0,
        padding: '12px 16px 12px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 4,
      }}>
        <div style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--item-text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {item.display_name}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          color: 'var(--item-meta)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {isActive ? (
            <span style={{ color: 'var(--record-btn)', animation: 'blink 1s ease-in-out infinite' }}>
              {duration}
            </span>
          ) : (
            <>
              {timeStr && <span>{timeStr}</span>}
              {timeStr && <span>·</span>}
              <span>{duration}</span>
              {(transcriptionStatus || isProcessing) && (
                <span style={{ display: 'flex', alignItems: 'center', color: 'var(--item-meta)' }}>
                  <StatusIcon status={isProcessing ? 'uploading' : transcriptionStatus} />
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npm test -- --reporter=verbose src/tests/RecordingItem.test.tsx
```

期望输出：3 tests passed。

- [ ] **Step 5: Commit**

```bash
git add src/components/RecordingItem.tsx src/tests/RecordingItem.test.tsx
git commit -m "feat: rewrite RecordingItem as date-card layout with showDate prop"
```

---

## Task 4: RecordingList 按天分组 + 录制中卡片

**Files:**
- Modify: `src/components/RecordingList.tsx`

- [ ] **Step 1: 重写 RecordingList.tsx**

```tsx
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
  // "录音 2026-03-28 19:54" → "2026-03-28"
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
    // Sort days descending within month
    dayGroups.sort((a, b) => b.day.localeCompare(a.day))
    monthGroups.push({ yearMonth, dayGroups })
  }

  // Sort months descending
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
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 88 }}>

      {/* Active recording card */}
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
            {/* elapsedSecs formatted via activeItem rendering */}
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
                // Processing placeholder card
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
```

- [ ] **Step 2: 运行已有测试，确认不回归**

```bash
npm test -- --reporter=verbose
```

期望：全部 pass（useRecorder 测试 + RecordingItem 测试）。

- [ ] **Step 3: Commit**

```bash
git add src/components/RecordingList.tsx
git commit -m "feat: rebuild RecordingList with day-grouping and active recording card"
```

---

## Task 5: RecordButton 改为 absolute FAB

**Files:**
- Rewrite: `src/components/RecordButton.tsx`

- [ ] **Step 1: 重写 RecordButton.tsx**

```tsx
import { useState, useEffect } from 'react'
import type { RecorderStatus } from '../hooks/useRecorder'

interface RecordButtonProps {
  status: RecorderStatus
  onClick: () => void
}

export function RecordButton({ status, onClick }: RecordButtonProps) {
  const isRecording = status === 'recording'
  const [jolting, setJolting] = useState(false)

  // Trigger jolt on transition from recording → idle
  const [prevStatus, setPrevStatus] = useState(status)
  useEffect(() => {
    if (prevStatus === 'recording' && status === 'idle') {
      setJolting(true)
      const t = setTimeout(() => setJolting(false), 240)
      return () => clearTimeout(t)
    }
    setPrevStatus(status)
  }, [status, prevStatus])

  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'var(--record-btn)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: jolting
          ? 'jolt 240ms ease-out forwards'
          : isRecording
            ? 'none'
            : 'pulse 2.4s ease-in-out infinite',
        outline: 'none',
        WebkitAppRegion: 'no-drag',
        zIndex: 10,
      } as React.CSSProperties}
      onMouseDown={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)'
      }}
      onMouseUp={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = ''
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = ''
      }}
    >
      {isRecording ? (
        <div style={{ width: 20, height: 20, borderRadius: 5, background: '#fff' }} />
      ) : (
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff' }} />
      )}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RecordButton.tsx
git commit -m "feat: convert RecordButton to absolute FAB with jolt animation"
```

---

## Task 6: 新建 DetailSheet 组件

**Files:**
- Create: `src/components/DetailSheet.tsx`
- Create: `src/tests/DetailSheet.test.tsx`

`★ Insight ─────────────────────────────────────`
- 拖拽关闭用 `onMouseDown` + `window` 的 `mousemove`/`mouseup` 监听，不用 pointer events API，macOS 兼容性更好
- sheet 的 `translateY` 用 `useRef` 跟踪拖拽偏移，避免每帧触发 React re-render
- 动画通过直接操作 DOM style（`sheetRef.current.style.transform`）实现跟手效果
`─────────────────────────────────────────────────`

- [ ] **Step 1: 写失败测试**

创建 `src/tests/DetailSheet.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DetailSheet } from '../components/DetailSheet'
import type { RecordingItem } from '../types'

vi.mock('../lib/tauri', () => ({
  getTranscript: vi.fn().mockResolvedValue(null),
  retryTranscription: vi.fn().mockResolvedValue(undefined),
}))

const item: RecordingItem = {
  filename: '录音 2026-03-28 19:54.m4a',
  path: '/tmp/录音 2026-03-28 19:54.m4a',
  display_name: '录音 2026-03-28 19:54',
  duration_secs: 707,
  year_month: '202603',
  transcript_status: 'completed',
}

describe('DetailSheet', () => {
  it('renders item display_name', () => {
    render(
      <DetailSheet item={item} transcriptionState={undefined} onClose={vi.fn()} />
    )
    expect(screen.getAllByText('录音 2026-03-28 19:54').length).toBeGreaterThan(0)
  })

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn()
    render(
      <DetailSheet item={item} transcriptionState={undefined} onClose={onClose} />
    )
    fireEvent.click(screen.getByTestId('sheet-overlay'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <DetailSheet item={item} transcriptionState={undefined} onClose={onClose} />
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npm test -- --reporter=verbose src/tests/DetailSheet.test.tsx
```

期望：FAIL — `DetailSheet` 不存在。

- [ ] **Step 3: 创建 DetailSheet.tsx**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import type { RecordingItem, TranscriptionProgress } from '../types'
import { getTranscript, retryTranscription } from '../lib/tauri'
import { Spinner } from './Spinner'
import { formatDuration } from '../lib/format'

interface DetailSheetProps {
  item: RecordingItem
  transcriptionState: TranscriptionProgress | undefined
  onClose: () => void
}

function getDateParts(displayName: string) {
  const dayMatch = displayName.match(/\d{4}-\d{2}-(\d{2})/)
  const timeMatch = displayName.match(/(\d{2}:\d{2})$/)
  return {
    day: dayMatch?.[1] ?? '',
    time: timeMatch?.[1] ?? '',
  }
}

export function DetailSheet({ item, transcriptionState, onClose }: DetailSheetProps) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const prevCompletedRef = useRef(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef<number | null>(null)
  const dragCurrentOffset = useRef(0)

  useEffect(() => {
    setText(null)
    setLoading(true)
    prevCompletedRef.current = false
    getTranscript(item.filename).then(t => {
      setText(t?.text ?? null)
      setLoading(false)
    })
  }, [item.filename])

  useEffect(() => {
    if (transcriptionState === 'completed' && !prevCompletedRef.current) {
      prevCompletedRef.current = true
      getTranscript(item.filename).then(t => setText(t?.text ?? null))
    }
    if (transcriptionState !== 'completed') {
      prevCompletedRef.current = false
    }
  }, [transcriptionState, item.filename])

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Drag-to-dismiss
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    dragStartY.current = e.clientY
    dragCurrentOffset.current = 0

    const onMove = (ev: MouseEvent) => {
      if (dragStartY.current === null) return
      const offset = Math.max(0, ev.clientY - dragStartY.current)
      dragCurrentOffset.current = offset
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${offset}px)`
        sheetRef.current.style.transition = 'none'
      }
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (dragCurrentOffset.current > 80) {
        onClose()
      } else {
        if (sheetRef.current) {
          sheetRef.current.style.transition = 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)'
          sheetRef.current.style.transform = 'translateY(0)'
        }
      }
      dragStartY.current = null
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [onClose])

  const status = transcriptionState || item.transcript_status || undefined
  const { day, time } = getDateParts(item.display_name)
  const duration = formatDuration(item.duration_secs)

  return (
    <div
      data-testid="sheet-overlay"
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--sheet-overlay)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        zIndex: 100,
      }}
    >
      <div
        ref={sheetRef}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--sheet-bg)',
          borderRadius: '16px 16px 0 0',
          maxHeight: 'min(85vh, 600px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: 'translateY(0)',
          transition: 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Drag handle */}
        <div
          onMouseDown={handleDragStart}
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 0 8px',
            cursor: 'grab',
            flexShrink: 0,
          }}
        >
          <div style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'var(--sheet-handle)',
          }} />
        </div>

        {/* Header info */}
        <div style={{
          padding: '4px 20px 16px',
          borderBottom: '1px solid var(--divider)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
        }}>
          <span style={{
            fontSize: 32,
            fontWeight: 300,
            color: 'var(--date-number)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}>
            {day}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--item-text)' }}>
              {item.display_name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--item-meta)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {time} · {duration}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
          {(status === 'uploading' || status === 'transcribing') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--item-meta)' }}>
              <Spinner size={14} />
              <span style={{ fontSize: 13 }}>
                {status === 'uploading' ? '上传中...' : '转写中...'}
              </span>
            </div>
          )}

          {status === 'failed' && text === null && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--item-meta)', marginBottom: 10 }}>转写失败</p>
              <button
                onClick={() => retryTranscription(item.filename)}
                style={{
                  fontSize: 12,
                  color: 'var(--record-btn)',
                  background: 'none',
                  border: '1px solid var(--record-btn)',
                  borderRadius: 5,
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                重试
              </button>
            </div>
          )}

          {text && (
            <p style={{
              fontSize: 14,
              color: 'var(--item-text)',
              lineHeight: 1.75,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
            }}>
              {text}
            </p>
          )}

          {!status && loading && (
            <span style={{ fontSize: 13, color: 'var(--item-meta)' }}>加载中...</span>
          )}

          {!status && !loading && text === null && (
            <span style={{ fontSize: 13, color: 'var(--item-meta)' }}>暂无转写内容</span>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npm test -- --reporter=verbose src/tests/DetailSheet.test.tsx
```

期望：3 tests passed。

- [ ] **Step 5: Commit**

```bash
git add src/components/DetailSheet.tsx src/tests/DetailSheet.test.tsx
git commit -m "feat: create DetailSheet with drag-to-dismiss and Escape support"
```

---

## Task 7: 更新 App.tsx，串联所有组件

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/DetailPanel.tsx`

- [ ] **Step 1: 重写 App.tsx**

```tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu'
import { TitleBar } from './components/TitleBar'
import { RecordingList } from './components/RecordingList'
import { DetailSheet } from './components/DetailSheet'
import { RecordButton } from './components/RecordButton'
import { useRecorder } from './hooks/useRecorder'
import { listRecordings, deleteRecording, revealInFinder, playRecording } from './lib/tauri'
import { formatYearMonth } from './lib/format'
import type { RecordingItem, TranscriptionProgress } from './types'

export default function App() {
  const [recordings, setRecordings] = useState<RecordingItem[]>([])
  const [activeItem, setActiveItem] = useState<RecordingItem | null>(null)
  const [selectedItem, setSelectedItem] = useState<RecordingItem | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [displayedItem, setDisplayedItem] = useState<RecordingItem | null>(null)
  const [transcriptionStates, setTranscriptionStates] = useState<Record<string, TranscriptionProgress>>({})
  const [processingStates, setProcessingStates] = useState<Record<string, boolean>>({})
  const [newFilename, setNewFilename] = useState<string | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadRecordings = useCallback(async () => {
    const items = await listRecordings()
    setRecordings(items)
  }, [])

  useEffect(() => { loadRecordings() }, [loadRecordings])

  useEffect(() => {
    const unlistenPromise = listen<{ filename: string; status: TranscriptionProgress }>(
      'transcription-progress',
      (event) => {
        const { filename, status } = event.payload
        setTranscriptionStates(prev => ({ ...prev, [filename]: status }))
        if (status === 'completed' || status === 'failed') {
          loadRecordings()
        }
      }
    )
    return () => { unlistenPromise.then(u => u()) }
  }, [loadRecordings])

  useEffect(() => {
    const processingUnlisten = listen<string>('recording-processing', (event) => {
      setProcessingStates(prev => ({ ...prev, [event.payload]: true }))
    })
    const processedUnlisten = listen<RecordingItem>('recording-processed', (event) => {
      const newItem = event.payload
      setNewFilename(newItem.filename)
      setTimeout(() => setNewFilename(null), 400)
      setProcessingStates(prev => {
        const next = { ...prev }
        delete next[newItem.filename]
        return next
      })
      setRecordings(prev => {
        const idx = prev.findIndex(r => r.filename === newItem.filename)
        if (idx >= 0) return prev.map((r, i) => i === idx ? newItem : r)
        return [newItem, ...prev]
      })
    })
    return () => {
      processingUnlisten.then(u => u())
      processedUnlisten.then(u => u())
    }
  }, [])

  const { status, elapsedSecs, start, stop } = useRecorder()

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
          transcript_status: null,
        })
      } catch (err: unknown) {
        if (typeof err === 'string' && err === 'permission_denied') {
          alert('Journal 需要麦克风权限。请前往「系统设置 → 隐私与安全性 → 麦克风」开启。')
        }
      }
    } else {
      await stop()
      if (activeItem) {
        setProcessingStates(prev => ({ ...prev, [activeItem.filename]: true }))
        setRecordings(prev => [activeItem, ...prev])
      }
      setActiveItem(null)
    }
  }, [status, start, stop, activeItem])

  const handleCloseSheet = useCallback(() => {
    setSelectedItem(null)
    setSheetOpen(false)
    if (closeTimeoutRef.current !== null) clearTimeout(closeTimeoutRef.current)
    closeTimeoutRef.current = setTimeout(() => {
      setDisplayedItem(null)
      closeTimeoutRef.current = null
    }, 300)
  }, [])

  const handleItemClick = useCallback((item: RecordingItem) => {
    if (item.path === '__active__') return
    if (selectedItem?.path === item.path) {
      handleCloseSheet()
    } else {
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
      setSelectedItem(item)
      setDisplayedItem(item)
      setSheetOpen(true)
    }
  }, [selectedItem, handleCloseSheet])

  const handleContextMenu = useCallback(async (e: React.MouseEvent, item: RecordingItem) => {
    e.preventDefault()
    if (item.path === '__active__') return

    const [playItem, revealItem, separator, deleteItem] = await Promise.all([
      MenuItem.new({ id: 'play', text: '播放', action: async () => { await playRecording(item.path).catch(() => {}) } }),
      MenuItem.new({ id: 'reveal', text: '在 Finder 中显示', action: async () => { await revealInFinder(item.path).catch(() => {}) } }),
      PredefinedMenuItem.new({ item: 'Separator' }),
      MenuItem.new({
        id: 'delete', text: '删除',
        action: async () => {
          await deleteRecording(item.path).catch(() => {})
          setRecordings(prev => prev.filter(r => r.path !== item.path))
          setTranscriptionStates(prev => { const next = { ...prev }; delete next[item.filename]; return next })
          if (selectedItem?.path === item.path) handleCloseSheet()
        },
      }),
    ])

    const menu = await Menu.new({ items: [playItem, revealItem, separator, deleteItem] })
    await menu.popup()
  }, [selectedItem, handleCloseSheet])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <TitleBar />
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <RecordingList
          recordings={recordings}
          status={status}
          activeItem={activeItem}
          elapsedSecs={elapsedSecs}
          onContextMenu={handleContextMenu}
          onClick={handleItemClick}
          selectedPath={selectedItem?.path ?? null}
          transcriptionStates={transcriptionStates}
          processingStates={processingStates}
          newFilename={newFilename}
        />
        <RecordButton status={status} onClick={handleRecordButton} />
        {displayedItem && (
          <DetailSheet
            item={displayedItem}
            transcriptionState={transcriptionStates[displayedItem.filename]}
            onClose={handleCloseSheet}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 删除 DetailPanel.tsx**

```bash
rm src/components/DetailPanel.tsx
```

- [ ] **Step 3: 运行全部测试**

```bash
npm test -- --reporter=verbose
```

期望：全部 pass（useRecorder 4 tests + RecordingItem 3 tests + DetailSheet 3 tests）。

- [ ] **Step 4: 确认编译无报错**

```bash
npm run build 2>&1 | tail -20
```

期望：无 TypeScript 错误，输出 `✓ built in ...`

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git rm src/components/DetailPanel.tsx
git commit -m "feat: wire up App with DetailSheet, absolute FAB, remove window resize logic"
```

---

## Task 8: 设置最小窗口宽度

**Files:**
- Modify: `src-tauri/tauri.conf.json` 或 `src-tauri/src/main.rs`

- [ ] **Step 1: 查找窗口配置**

```bash
grep -r "minWidth\|min_width\|innerSize\|inner_size" src-tauri/
```

- [ ] **Step 2: 在 tauri.conf.json 中设置最小宽度**

在 `src-tauri/tauri.conf.json` 的 `windows[0]` 对象里添加（如果已有则修改）：

```json
"minWidth": 280,
"minHeight": 400
```

如果配置用的是 Rust builder（`main.rs`），则找到 `WebviewWindowBuilder` 链式调用处添加：
```rust
.min_inner_size(280.0, 400.0)
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "feat: set minimum window size to 280x400"
```

---

## Self-Review

### Spec Coverage

| Spec 要求 | 实现 Task |
|-----------|-----------|
| 窗口最小宽度 280px | Task 8 |
| TitleBar 同色，去掉色差 | Task 2 |
| 月份章节标题 16px 600 | Task 2 |
| 日期卡片，左大字，右内容 | Task 3 |
| 同天日期去重 showDate | Task 3, 4 |
| 入场动画 card-enter | Task 1, 3 |
| 录制中实时卡片 | Task 4 |
| FAB absolute 56px | Task 5 |
| FAB jolt 动画 | Task 5 |
| FAB pulse 更新 | Task 1 |
| DetailSheet 底部滑入 | Task 6 |
| 遮罩点击关闭 | Task 6 |
| 拖拽把手关闭 | Task 6 |
| Escape 关闭 | Task 6 |
| 移除窗口 resize 逻辑 | Task 7 |
| prefers-reduced-motion | Task 1, 3 |
| 新增 design tokens | Task 1 |
| 删除 DetailPanel | Task 7 |

所有 spec 要求均有对应 task。

### Placeholder 检查

无 TBD、TODO、"类似 Task N"等。

### Type 一致性

- `RecordingItem` props 新增 `showDate: boolean`，在 Task 3 定义，Task 4 正确传入
- `RecordingList` 新增 `newFilename: string | null` prop，Task 4 定义，Task 7 传入
- `DetailSheet` 接口与 `DetailPanel` 相同（`item`, `transcriptionState`, `onClose`），App.tsx 无缝替换
- `formatDuration` 从 `../lib/format` 引入，已在现有代码中存在
- `formatYearMonth` 从 `../lib/format` 引入，已在现有代码中存在
