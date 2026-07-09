import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SectionAiEngine from '../settings/components/SectionAiEngine'
import { renderWithProviders as render } from './setup'

const mockInvoke = vi.hoisted(() => vi.fn())

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => ({ invoke: mockInvoke }),
}))

describe('SectionAiEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_engine_config')
        return Promise.resolve({
          active_provider: 'anthropic',
          providers: [
            {
              protocol: 'anthropic',
              id: 'anthropic',
              label: 'Anthropic',
              api_key: 'sk-ant-test-key',
              base_url: '',
              models: [],
            },
          ],
        })
      if (cmd === 'set_engine_config') return Promise.resolve(undefined)
      if (cmd === 'list_models') return Promise.resolve([])
      return Promise.resolve(undefined)
    })
  })

  it('persists engine config only after save is clicked', async () => {
    render(<SectionAiEngine />)

    const apiKeyInput = await screen.findByPlaceholderText('sk-ant-…')
    const saveButton = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement

    expect(saveButton.disabled).toBe(true)

    fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-test' } })

    expect(screen.getByText('有未保存修改')).toBeTruthy()
    expect(saveButton.disabled).toBe(false)
    const setCallsBefore = mockInvoke.mock.calls.filter((c) => c[0] === 'set_engine_config')
    expect(setCallsBefore).toHaveLength(0)

    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_engine_config', {
        config: {
          active_provider: 'anthropic',
          providers: [
            {
              protocol: 'anthropic',
              id: 'anthropic',
              label: 'Anthropic',
              api_key: 'sk-ant-test',
              base_url: '',
              models: [],
            },
          ],
        },
      })
    })

    expect(await screen.findByText('已保存')).toBeTruthy()
  })

  it('lets the user add a custom model even when no suggestions are available', async () => {
    // Regression test: list_models resolves to [] here (as it always does in
    // production today, since the daemon has no matching route), so the
    // dropdown must still render the manual model-id input rather than
    // staying hidden with nothing to show.
    render(<SectionAiEngine />)

    await screen.findByPlaceholderText('sk-ant-…')

    const addModelButton = screen.getByRole('button', { name: '添加模型' })
    fireEvent.click(addModelButton)

    const modelInput = await screen.findByPlaceholderText(/model|模型/i)
    fireEvent.change(modelInput, { target: { value: 'claude-test-model' } })
    fireEvent.keyDown(modelInput, { key: 'Enter' })

    expect((await screen.findAllByText('claude-test-model')).length).toBeGreaterThan(0)

    const saveButton = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(false)
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'set_engine_config',
        expect.objectContaining({
          config: expect.objectContaining({
            providers: [expect.objectContaining({ models: ['claude-test-model'] })],
          }),
        }),
      )
    })
  })
})
