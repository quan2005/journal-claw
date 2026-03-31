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
      active_ai_engine: 'claude',
      claude_code_api_key: 'sk-ant-test',
      claude_code_base_url: 'https://api.anthropic.com',
      claude_code_model: 'claude-sonnet-4-5',
      qwen_code_api_key: 'sk-qwen-test',
      qwen_code_base_url: 'https://dashscope.aliyuncs.com',
      qwen_code_model: 'qwen-max',
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
    }

    await setAsrConfig(cfg)

    expect(mockInvoke).toHaveBeenCalledWith('set_asr_config', {
      asrEngine: 'whisperkit',
      dashscopeApiKey: 'sk-dashscope-test',
      whisperkitModel: 'large-v3-turbo',
    })
  })
})
