import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from './setup'
import { HistoryFloatingButton } from '../components/HistoryFloatingButton'

vi.mock('../lib/tauri', () => ({
  conversationList: vi.fn().mockResolvedValue([]),
  conversationDelete: vi.fn().mockResolvedValue(undefined),
}))

describe('HistoryFloatingButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders an embedded history button in the top bar', () => {
    const { container } = renderWithProviders(
      <HistoryFloatingButton activeSessionId={null} onSelect={vi.fn()} />,
    )

    const control = container.querySelector<HTMLElement>('.history-float-container')
    expect(control).toBeTruthy()
    expect(control?.style.position).toBe('relative')
    expect(screen.getByTitle('历史')).toBeTruthy()

    const iconButton = screen.getByRole('button', { name: '历史' })
    expect(iconButton.style.width).toBe('28px')
    expect(iconButton.style.height).toBe('28px')
    expect(iconButton.style.display).toBe('grid')
    expect(iconButton.style.placeItems).toBe('center')
    expect(iconButton.style.lineHeight).toBe('0')
  })
})
