import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileCard } from '../components/FileCard'

describe('FileCard', () => {
  const baseProps = {
    filename: 'meeting.pdf',
    kind: 'pdf' as const,
    onRemove: vi.fn(),
    onOpen: vi.fn(),
  }

  it('renders filename', () => {
    render(<FileCard {...baseProps} />)
    expect(screen.getByText('meeting.pdf')).toBeTruthy()
  })

  it('calls onOpen when icon is clicked', () => {
    const onOpen = vi.fn()
    render(<FileCard {...baseProps} onOpen={onOpen} />)
    fireEvent.click(screen.getByTestId('file-card-icon'))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = vi.fn()
    render(<FileCard {...baseProps} onRemove={onRemove} />)
    fireEvent.click(screen.getByTestId('file-card-remove'))
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('does not call onOpen when remove is clicked', () => {
    const onOpen = vi.fn()
    render(<FileCard {...baseProps} onOpen={onOpen} />)
    fireEvent.click(screen.getByTestId('file-card-remove'))
    expect(onOpen).not.toHaveBeenCalled()
  })
})
