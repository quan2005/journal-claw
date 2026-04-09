import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JournalItem } from '../components/JournalItem'
import type { JournalEntry } from '../types'

const entry: JournalEntry = {
  filename: '28-AI平台产品会议纪要.md',
  path: '/nb/2603/28-AI平台产品会议纪要.md',
  title: 'AI平台产品会议纪要',
  summary: '探索可继续，需同步做场景化表达',
  tags: ['meeting'],
  year_month: '2603',
  day: 28,
  created_time: '10:15',
  created_at_secs: 1743120000,
  mtime_secs: 1743120000,
  materials: [{ filename: '录音.m4a', path: '/nb/2603/raw/录音.m4a', kind: 'audio', size_bytes: 1024 }],
}

describe('JournalItem', () => {
  it('renders title', () => {
    render(<JournalItem entry={entry} isSelected={false} onClick={vi.fn()} />)
    expect(screen.getByText('AI平台产品会议纪要')).toBeTruthy()
  })

  it('renders summary', () => {
    render(<JournalItem entry={entry} isSelected={false} onClick={vi.fn()} />)
    expect(screen.getByText('探索可继续，需同步做场景化表达')).toBeTruthy()
  })

  it('renders tag badge', () => {
    render(<JournalItem entry={entry} isSelected={false} onClick={vi.fn()} />)
    expect(screen.getByText('meeting')).toBeTruthy()
  })

  it('renders time', () => {
    render(<JournalItem entry={entry} isSelected={false} onClick={vi.fn()} />)
    expect(screen.getByText('10:15')).toBeTruthy()
  })
})
