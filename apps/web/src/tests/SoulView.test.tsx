// src/tests/SoulView.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SoulView from '../components/SoulView'
import { renderWithProviders as render } from './setup'

const mockInvoke = vi.hoisted(() => vi.fn())

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => ({ invoke: mockInvoke }),
}))

describe('SoulView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_workspace_prompt') return Promise.resolve('# 谨迹')
      if (cmd === 'set_workspace_prompt') return Promise.resolve(undefined)
      return Promise.resolve(undefined)
    })
  })

  it('loads workspace prompt on mount', async () => {
    render(<SoulView />)
    const textarea = await screen.findByRole('textbox')
    expect(textarea).toBeTruthy()
    const getCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'get_workspace_prompt')
    expect(getCalls).toHaveLength(1)
    expect((textarea as HTMLTextAreaElement).value).toBe('# 谨迹')
  })

  it('calls setWorkspacePrompt when save button clicked', async () => {
    render(<SoulView />)
    const textarea = await screen.findByRole('textbox')
    fireEvent.change(textarea, { target: { value: '# 更新内容' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_workspace_prompt', { content: '# 更新内容' })
    })
  })

  it('shows save error when setWorkspacePrompt fails', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_workspace_prompt') return Promise.resolve('# 谨迹')
      if (cmd === 'set_workspace_prompt') return Promise.reject(new Error('write failed'))
      return Promise.resolve(undefined)
    })
    render(<SoulView />)
    const textarea = await screen.findByRole('textbox')
    fireEvent.change(textarea, { target: { value: '# 失败内容' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      const setCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'set_workspace_prompt')
      expect(setCalls.length).toBeGreaterThan(0)
    })
    expect(await screen.findByText('保存失败，请重试')).toBeTruthy()
  })
})
