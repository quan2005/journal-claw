import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setAsrConfig, setEngineConfig, type AsrConfig, type EngineConfig } from '../lib/tauri'

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

  it('sends asr config with camelCase command args', async () => {
    const cfg: AsrConfig = {
      asr_engine: 'whisperkit',
      dashscope_api_key: 'sk-dashscope-test',
      whisperkit_model: 'large-v3-turbo',
      dashscope_asr_model: 'qwen3-asr-flash',
      volcengine_asr_api_key: '',
      volcengine_asr_resource_id: 'volc.seedasr.auc',
      zhipu_asr_api_key: '',
    }

    await setAsrConfig(cfg)

    expect(mockInvoke).toHaveBeenCalledWith('set_asr_config', {
      asrEngine: 'whisperkit',
      dashscopeApiKey: 'sk-dashscope-test',
      whisperkitModel: 'large-v3-turbo',
      dashscopeAsrModel: 'qwen3-asr-flash',
      volcengineAsrApiKey: '',
      volcengineAsrResourceId: 'volc.seedasr.auc',
      zhipuAsrApiKey: '',
    })
  })
})
