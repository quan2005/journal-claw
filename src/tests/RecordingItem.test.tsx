import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecordingItem } from '../components/RecordingItem'
import type { RecordingItem as RecordingItemType } from '../types'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
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
    render(<RecordingItem item={baseItem} showDate={true} onContextMenu={noop} onClick={noop} />)
    expect(screen.getByText('28')).toBeTruthy()
  })

  it('hides date number when showDate=false', () => {
    render(<RecordingItem item={baseItem} showDate={false} onContextMenu={noop} onClick={noop} />)
    expect(screen.queryByText('28')).toBeNull()
  })

  it('shows display_name', () => {
    render(<RecordingItem item={baseItem} showDate={true} onContextMenu={noop} onClick={noop} />)
    expect(screen.getByText('录音 2026-03-28 19:54')).toBeTruthy()
  })
})
