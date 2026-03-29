import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DetailSheet } from '../components/DetailSheet'
import type { RecordingItem } from '../types'

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

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <DetailSheet item={item} transcriptionState={undefined} onClose={onClose} />
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
