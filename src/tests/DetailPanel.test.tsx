import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DetailPanel } from '../components/DetailPanel'
import type { JournalEntry } from '../types'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

vi.mock('../lib/tauri', () => ({
  getJournalEntryContent: vi.fn().mockResolvedValue('# Test'),
  createSampleEntryIfNeeded: vi.fn().mockResolvedValue(false),
}))

describe('empty state guidance cards', () => {
  const baseProps = {
    entry: null as JournalEntry | null,
    onDeselect: vi.fn(),
    onRecord: vi.fn(),
    onOpenDock: vi.fn(),
    onSelectSample: vi.fn(),
  }

  const fakeEntry: JournalEntry = {
    filename: '01-test.md', path: '/ws/2604/01-test.md',
    title: 'test', summary: '', tags: [], year_month: '2604',
    day: 1, created_time: '10:00', mtime_secs: 0, materials: [],
  }

  it('shows recording and paste cards when entries is empty', () => {
    render(<DetailPanel {...baseProps} entries={[]} />)
    expect(screen.getByText('录音记录')).toBeTruthy()
    expect(screen.getByText('粘贴 / 拖文件')).toBeTruthy()
  })

  it('shows 创建示例条目 card when entries is empty', () => {
    render(<DetailPanel {...baseProps} entries={[]} />)
    expect(screen.getByText('创建示例条目')).toBeTruthy()
  })

  it('does not show 创建示例条目 card when entries exist', () => {
    render(<DetailPanel {...baseProps} entries={[fakeEntry]} />)
    expect(screen.queryByText('创建示例条目')).toBeNull()
  })

  it('shows recording and paste cards whenever no entry is selected', () => {
    render(<DetailPanel {...baseProps} entries={[fakeEntry]} />)
    expect(screen.getByText('录音记录')).toBeTruthy()
    expect(screen.getByText('粘贴 / 拖文件')).toBeTruthy()
  })

  it('calls onRecord when 录音记录 card is clicked', () => {
    const onRecord = vi.fn()
    render(<DetailPanel {...baseProps} entries={[]} onRecord={onRecord} />)
    fireEvent.click(screen.getByText('录音记录').closest('button')!)
    expect(onRecord).toHaveBeenCalledOnce()
  })

  it('calls onOpenDock when paste card is clicked', () => {
    const onOpenDock = vi.fn()
    render(<DetailPanel {...baseProps} entries={[]} onOpenDock={onOpenDock} />)
    fireEvent.click(screen.getByText('粘贴 / 拖文件').closest('button')!)
    expect(onOpenDock).toHaveBeenCalledOnce()
  })

  it('calls onSelectSample when 创建示例条目 card is clicked', () => {
    const onSelectSample = vi.fn()
    render(<DetailPanel {...baseProps} entries={[]} onSelectSample={onSelectSample} />)
    fireEvent.click(screen.getByText('创建示例条目').closest('button')!)
    expect(onSelectSample).toHaveBeenCalledOnce()
  })
})
