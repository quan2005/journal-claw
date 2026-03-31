import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SectionGeneral from '../settings/components/SectionGeneral'

const mockGetWorkspacePath = vi.fn()
const mockSetWorkspacePath = vi.fn()
const mockPickFolder = vi.fn()

vi.mock('../lib/tauri', () => ({
  getWorkspacePath: (...args: unknown[]) => mockGetWorkspacePath(...args),
  setWorkspacePath: (...args: unknown[]) => mockSetWorkspacePath(...args),
  pickFolder: (...args: unknown[]) => mockPickFolder(...args),
}))

describe('SectionGeneral', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWorkspacePath.mockResolvedValue('/Users/francis/Documents/journal')
    mockSetWorkspacePath.mockResolvedValue(undefined)
    mockPickFolder.mockResolvedValue(null)
  })

  it('persists workspace changes only after save is clicked', async () => {
    render(<SectionGeneral />)

    const input = await screen.findByDisplayValue('/Users/francis/Documents/journal')
    const saveButton = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement

    expect(saveButton.disabled).toBe(true)

    fireEvent.change(input, { target: { value: '/Users/francis/Documents/journal-next' } })

    expect(screen.getByText('有未保存修改')).toBeTruthy()
    expect(saveButton.disabled).toBe(false)
    expect(mockSetWorkspacePath).not.toHaveBeenCalled()

    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockSetWorkspacePath).toHaveBeenCalledWith('/Users/francis/Documents/journal-next')
    })

    expect(await screen.findByText('已保存')).toBeTruthy()
  })
})
