import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SectionAiEngine from '../settings/components/SectionAiEngine'
import { renderWithProviders as render } from './setup'

const mockCheckEngineInstalled = vi.fn()
const mockInstallEngine = vi.fn()
const mockGetEngineConfig = vi.fn()
const mockSetEngineConfig = vi.fn()

vi.mock('../lib/tauri', () => ({
  checkEngineInstalled: (...args: unknown[]) => mockCheckEngineInstalled(...args),
  installEngine: (...args: unknown[]) => mockInstallEngine(...args),
  getEngineConfig: (...args: unknown[]) => mockGetEngineConfig(...args),
  setEngineConfig: (...args: unknown[]) => mockSetEngineConfig(...args),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}))

describe('SectionAiEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckEngineInstalled.mockImplementation(
      async (engine: 'claude' | 'qwen') => engine === 'claude',
    )
    mockInstallEngine.mockResolvedValue(undefined)
    mockGetEngineConfig.mockResolvedValue({
      active_ai_engine: 'claude',
      claude_code_api_key: '',
      claude_code_base_url: '',
      claude_code_model: '',
      qwen_code_api_key: '',
      qwen_code_base_url: '',
      qwen_code_model: '',
    })
    mockSetEngineConfig.mockResolvedValue(undefined)
  })

  it('persists engine config only after save is clicked', async () => {
    render(<SectionAiEngine />)

    const apiKeyInput = await screen.findByPlaceholderText('sk-ant-…')
    const saveButton = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement

    expect(saveButton.disabled).toBe(true)

    fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-test' } })

    expect(screen.getByText('有未保存修改')).toBeTruthy()
    expect(saveButton.disabled).toBe(false)
    expect(mockSetEngineConfig).not.toHaveBeenCalled()

    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockSetEngineConfig).toHaveBeenCalledWith({
        active_ai_engine: 'claude',
        claude_code_api_key: 'sk-ant-test',
        claude_code_base_url: '',
        claude_code_model: '',
        qwen_code_api_key: '',
        qwen_code_base_url: '',
        qwen_code_model: '',
      })
    })

    expect(await screen.findByText('已保存')).toBeTruthy()
  })
})
