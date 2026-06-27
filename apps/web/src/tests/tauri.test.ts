import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addTodo,
  deleteJournalEntry,
  listAvailableMonths,
  listIdentities,
  listTopicsDir,
  setEngineConfig,
  conversationCreate,
  conversationSend,
  conversationRetry,
  type EngineConfig,
} from '../lib/tauri'

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

describe('tauri config commands', () => {
  beforeEach(() => {
    ;(globalThis as Record<string, unknown>).__JOURNAL_RUNTIME = 'tauri'
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

  it('routes local CRUD wrappers through the runtime client command boundary', async () => {
    mockInvoke
      .mockResolvedValueOnce(['2606'])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ text: 'todo' })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await listAvailableMonths()
    await deleteJournalEntry('/ws/2606/27-a.md')
    await addTodo('todo')
    await listTopicsDir('')
    await listIdentities()

    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'list_available_months')
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'delete_journal_entry', {
      path: '/ws/2606/27-a.md',
    })
    expect(mockInvoke).toHaveBeenNthCalledWith(3, 'add_todo', {
      text: 'todo',
      due: null,
      source: null,
      path: null,
    })
    expect(mockInvoke).toHaveBeenNthCalledWith(4, 'list_topics_dir', { relativePath: '' })
    expect(mockInvoke).toHaveBeenNthCalledWith(5, 'list_identities')
  })

  it('routes conversation wrappers through the runtime client command boundary', async () => {
    mockInvoke.mockResolvedValueOnce('s1').mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined)

    await conversationCreate('ctx', ['a.md'])
    await conversationSend('s1', 'hello', [{ media_type: 'image/png', data: 'base64' }])
    await conversationRetry('s1')

    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'conversation_create', {
      context: 'ctx',
      contextFiles: ['a.md'],
    })
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'conversation_send', {
      sessionId: 's1',
      message: 'hello',
      images: [{ media_type: 'image/png', data: 'base64' }],
    })
    expect(mockInvoke).toHaveBeenNthCalledWith(3, 'conversation_retry', { sessionId: 's1' })
  })
})
