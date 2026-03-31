import { describe, it, expect } from 'vitest'
import type { JournalEntry } from '../types'

describe('JournalEntry type', () => {
  it('accepts valid entry', () => {
    const entry: JournalEntry = {
      filename: '28-AI平台产品会议纪要.md',
      path: '/nb/2603/28-AI平台产品会议纪要.md',
      title: 'AI平台产品会议纪要',
      summary: '探索可继续，需同步做场景化表达',
      tags: ['journal', 'meeting'],
      year_month: '2603',
      day: 28,
      created_time: '10:15',
      mtime_secs: 1743120000,
      materials: [],
    }
    expect(entry.day).toBe(28)
    expect(entry.tags).toContain('meeting')
  })
})
