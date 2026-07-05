import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { ProcessingQueue } from '../components/ProcessingQueue'
import { renderWithProviders as render } from './setup'
import type { QueueItem } from '../types'

const failedItem: QueueItem = {
  id: 'test-failed-1',
  path: '/nb/2603/raw/meeting.txt',
  filename: 'meeting.txt',
  status: 'failed',
  error: 'AI processing failed',
  addedAt: Date.now(),
  logs: [],
}

const baseProps = {
  items: [failedItem],
  onDismiss: vi.fn(),
  onCancel: vi.fn(),
  onRetry: vi.fn(),
  activeLogPath: null,
  onSetActiveLogPath: vi.fn(),
}

describe('ProcessingQueue retry', () => {
  it('shows retry button for failed items', () => {
    render(<ProcessingQueue {...baseProps} />)
    expect(screen.getByTitle('重试')).toBeTruthy()
  })

  it('calls onRetry with the queue item when retry is clicked', () => {
    const onRetry = vi.fn()
    render(<ProcessingQueue {...baseProps} onRetry={onRetry} />)
    fireEvent.click(screen.getByTitle('重试'))
    expect(onRetry).toHaveBeenCalledWith(failedItem)
  })

  it('does not show retry button for non-failed items', () => {
    const processingItem: QueueItem = { ...failedItem, status: 'processing' }
    render(<ProcessingQueue {...baseProps} items={[processingItem]} />)
    expect(screen.queryByTitle('重试')).toBeNull()
  })
})
