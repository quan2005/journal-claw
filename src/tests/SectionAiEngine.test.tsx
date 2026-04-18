import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SectionAiEngine from '../settings/components/SectionAiEngine'
import { renderWithProviders as render } from './setup'

const mockGetEngineConfig = vi.fn()
const mockSetEngineConfig = vi.fn()

vi.mock('../lib/tauri', async () => {
  const actual = await vi.importActual('../lib/tauri')
  return {
    ...actual,
    getEngineConfig: (...args: unknown[]) => mockGetEngineConfig(...args),
    setEngineConfig: (...args: unknown[]) => mockSetEngineConfig(...args),
    listModels: vi.fn().mockResolvedValue([]),
  }
})

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}))

describe('SectionAiEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEngineConfig.mockResolvedValue({
      active_provider: 'anthropic',
      providers: [
        {
          id: 'anthropic',
          label: 'Anthropic',
          api_key: 'sk-ant-test-key',
          base_url: '',
          model: '',
        },
      ],
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
        active_provider: 'anthropic',
        providers: [
          { id: 'anthropic', label: 'Anthropic', api_key: 'sk-ant-test', base_url: '', model: '' },
        ],
      })
    })

    expect(await screen.findByText('已保存')).toBeTruthy()
  })
})
