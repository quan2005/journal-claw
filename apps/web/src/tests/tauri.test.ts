import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setEngineConfig, type EngineConfig } from '../lib/tauri'

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

describe('tauri config commands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue(undefined)
  })

  it('sends engine config as a structured payload', async () => {
    const cfg: EngineConfig = {
      active_provider: 'anthropic',
      providers: [
        {
          protocol: 'anthropic',
          id: 'anthropic',
          label: 'Anthropic',
          api_key: 'sk-ant-test',
          base_url: 'https://api.anthropic.com',
          model: 'claude-sonnet-4-5',
        },
      ],
    }

    await setEngineConfig(cfg)

    expect(mockInvoke).toHaveBeenCalledWith('set_engine_config', {
      config: cfg,
    })
  })

})
