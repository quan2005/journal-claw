// src/tests/SoulView.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SoulView from '../components/SoulView'

const mockGetWorkspacePrompt = vi.fn()
const mockSetWorkspacePrompt = vi.fn()

vi.mock('../lib/tauri', () => ({
  getWorkspacePrompt: (...args: unknown[]) => mockGetWorkspacePrompt(...args),
  setWorkspacePrompt: (...args: unknown[]) => mockSetWorkspacePrompt(...args),
}))

describe('SoulView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWorkspacePrompt.mockResolvedValue('# 谨迹')
    mockSetWorkspacePrompt.mockResolvedValue(undefined)
  })

  it('loads workspace prompt on mount', async () => {
    render(<SoulView />)
    const textarea = await screen.findByRole('textbox')
    expect(textarea).toBeTruthy()
    expect(mockGetWorkspacePrompt).toHaveBeenCalledOnce()
    expect((textarea as HTMLTextAreaElement).value).toBe('# 谨迹')
  })

  it('calls setWorkspacePrompt when save button clicked', async () => {
    render(<SoulView />)
    const textarea = await screen.findByRole('textbox')
    fireEvent.change(textarea, { target: { value: '# 更新内容' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(mockSetWorkspacePrompt).toHaveBeenCalledWith('# 更新内容')
    })
  })

  it('shows save error when setWorkspacePrompt fails', async () => {
    mockSetWorkspacePrompt.mockRejectedValue(new Error('write failed'))
    render(<SoulView />)
    const textarea = await screen.findByRole('textbox')
    fireEvent.change(textarea, { target: { value: '# 失败内容' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(mockSetWorkspacePrompt).toHaveBeenCalled()
    })
    expect(await screen.findByText('保存失败，请重试')).toBeTruthy()
  })
})
