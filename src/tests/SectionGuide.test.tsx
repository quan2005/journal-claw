import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SectionGuide from '../settings/components/SectionGuide'

const mockGetWorkspacePrompt = vi.fn()
const mockSetWorkspacePrompt = vi.fn()

vi.mock('../lib/tauri', () => ({
  getWorkspacePrompt: (...args: unknown[]) => mockGetWorkspacePrompt(...args),
  setWorkspacePrompt: (...args: unknown[]) => mockSetWorkspacePrompt(...args),
}))

describe('SectionGuide', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWorkspacePrompt.mockResolvedValue('# 初始内容')
    mockSetWorkspacePrompt.mockRejectedValue(new Error('write failed'))
  })

  it('shows a save error when workspace prompt persistence fails', async () => {
    render(<SectionGuide />)

    const textarea = await screen.findByRole('textbox')
    fireEvent.change(textarea, { target: { value: '# 更新后的内容' } })

    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(mockSetWorkspacePrompt).toHaveBeenCalledWith('# 更新后的内容')
    })

    expect(await screen.findByText('保存失败，请重试')).toBeTruthy()
  })
})
