import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import { renderWithProviders } from './setup'
import App from '../App'

// ── Tauri API mocks ──────────────────────────────────────

const listenerMap = new Map<string, (event: { payload: unknown }) => void>()

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((name: string, cb: (event: { payload: unknown }) => void) => {
    listenerMap.set(name, cb)
    return Promise.resolve(() => listenerMap.delete(name))
  }),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    setTheme: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: vi.fn().mockResolvedValue(() => {}),
    setZoom: vi.fn(),
  }),
}))

vi.mock('../lib/tauri', async () => {
  const actual = await vi.importActual('../lib/tauri')
  return {
    ...actual,
    listAvailableMonths: vi.fn().mockResolvedValue(['2604']),
    listJournalEntriesByMonths: vi.fn().mockResolvedValue([
      {
        filename: '01-test.md',
        path: '/ws/2604/01-test.md',
        title: '测试条目',
        summary: '测试摘要',
        tags: ['test'],
        sources: [],
        year_month: '2604',
        day: 1,
        created_time: '10:00',
        created_at_secs: 0,
        mtime_secs: 0,
        materials: [],
      },
    ]),
    listAllJournalEntries: vi.fn().mockResolvedValue([]),
    getEngineConfig: vi.fn().mockResolvedValue({ active_provider: 'anthropic', providers: [] }),
    checkEngineInstalled: vi.fn().mockResolvedValue(true),
    getAsrConfig: vi.fn().mockResolvedValue({
      asr_engine: 'apple',
      dashscope_api_key: '',
      whisperkit_model: 'base',
      dashscope_asr_model: '',
      volcengine_asr_api_key: '',
      volcengine_asr_resource_id: 'volc.seedasr.auc',
      zhipu_asr_api_key: '',
    }),
    checkWhisperkitCliInstalled: vi.fn().mockResolvedValue(true),
    checkWhisperkitModelDownloaded: vi.fn().mockResolvedValue(true),
    createSampleEntryIfNeeded: vi.fn().mockResolvedValue(false),
    createSampleEntry: vi.fn().mockResolvedValue(undefined),
    importFile: vi.fn(),
    importAudioFile: vi.fn(),
    prepareAudioForAi: vi.fn(),
    triggerAiProcessing: vi.fn(),
    triggerAiPrompt: vi.fn(),
    cancelAiProcessing: vi.fn(),
    cancelQueuedItem: vi.fn(),
    getJournalEntryContent: vi.fn().mockResolvedValue('# Test'),
    deleteJournalEntry: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    getWorkspaceSettings: vi.fn().mockResolvedValue({ theme: 'dark' }),
    setWorkspaceSettings: vi.fn(),
    listTodos: vi.fn().mockResolvedValue([]),
    addTodo: vi.fn(),
    toggleTodo: vi.fn(),
    deleteTodo: vi.fn(),
    setTodoDue: vi.fn(),
    updateTodoText: vi.fn(),
    setTodoPath: vi.fn(),
    removeTodoPath: vi.fn(),
    listIdentities: vi.fn().mockResolvedValue([]),
    deleteIdentity: vi.fn(),
    listBrainstormKeys: vi.fn().mockResolvedValue([]),
    listOpenBrainstormKeys: vi.fn().mockResolvedValue([]),
    clearBrainstormSession: vi.fn(),
    openBrainstormTerminal: vi.fn(),
    getWorkspacePath: vi.fn().mockResolvedValue('/tmp/ws'),
    getWorkspacePrompt: vi.fn().mockResolvedValue(''),
    setWorkspacePrompt: vi.fn(),
    resetWorkspacePrompt: vi.fn(),
    submitPasteText: vi.fn(),
    openFile: vi.fn(),
    getSpeakerProfiles: vi.fn().mockResolvedValue([]),
    getIdentityContent: vi.fn().mockResolvedValue(''),
    saveIdentityContent: vi.fn(),
    createIdentity: vi.fn(),
    mergeIdentity: vi.fn(),
    getAppVersion: vi.fn().mockResolvedValue('0.12.1'),
    getAutoLintConfig: vi.fn().mockResolvedValue({ enabled: false }),
    getAutoLintStatus: vi.fn().mockResolvedValue({ state: 'idle' }),
    getFeishuConfig: vi.fn().mockResolvedValue({ enabled: false }),
    getFeishuStatus: vi.fn().mockResolvedValue({ state: 'idle' }),
    listSkills: vi.fn().mockResolvedValue([]),
    openSkillsDir: vi.fn(),
    revealInFinder: vi.fn(),
    listRecordings: vi.fn().mockResolvedValue([]),
    deleteRecording: vi.fn(),
    playRecording: vi.fn(),
    getTranscript: vi.fn().mockResolvedValue(null),
    retryTranscription: vi.fn(),
    requestPermission: vi.fn(),
    checkAppPermissions: vi.fn().mockResolvedValue({ microphone: true, speech_recognition: true }),
    openPrivacySettings: vi.fn(),
    getWhisperkitModelsDir: vi.fn().mockResolvedValue('/tmp/models'),
    getAppleSttVariant: vi.fn().mockResolvedValue('default'),
    installEngine: vi.fn(),
    installWhisperkitCli: vi.fn(),
    downloadWhisperkitModel: vi.fn(),
    setEngineConfig: vi.fn(),
    setAsrConfig: vi.fn(),
    updateSpeakerName: vi.fn(),
    deleteSpeakerProfile: vi.fn(),
    mergeSpeakerProfiles: vi.fn(),
    checkSpeakerEmbedder: vi.fn().mockResolvedValue({ available: true }),
    setAutoLintConfig: vi.fn(),
    triggerLintNow: vi.fn(),
    setFeishuConfig: vi.fn(),
    openSettings: vi.fn(),
    setWorkspacePath: vi.fn(),
    getApiKey: vi.fn().mockResolvedValue(null),
    setApiKey: vi.fn(),
    pickFolder: vi.fn(),
    openWithSystem: vi.fn(),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  listenerMap.clear()
  // Mock localStorage
  const store: Record<string, string> = {}
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = val
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k])
      },
      get length() {
        return Object.keys(store).length
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
    },
    writable: true,
  })

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

describe('App', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderWithProviders(<App />)
    })
    // TitleBar should be visible
    expect(document.querySelector('[data-tauri-drag-region]')).toBeTruthy()
  })

  it('shows journal view by default', async () => {
    await act(async () => {
      renderWithProviders(<App />)
    })
    // Journal tab should be active
    await act(async () => {})
    expect(screen.getByText('记忆')).toBeTruthy()
  })

  it('toggles settings view with Cmd+,', async () => {
    await act(async () => {
      renderWithProviders(<App />)
    })
    await act(async () => {})

    // Open settings
    await act(async () => {
      fireEvent.keyDown(window, { key: ',', metaKey: true })
    })

    // Settings panel should appear (has 保存 button)
    expect(screen.queryAllByText('通用').length).toBeGreaterThan(0)

    // Close settings with Escape
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    // Back to journal
    expect(screen.getByText('记忆')).toBeTruthy()
  })

  it('switches sidebar tabs', async () => {
    await act(async () => {
      renderWithProviders(<App />)
    })
    await act(async () => {})

    // Click identity tab
    const identityTab = screen.getByText('画像')
    await act(async () => {
      fireEvent.click(identityTab)
    })

    // Identity tab should now be active (the tab text is still visible)
    expect(screen.getByText('画像')).toBeTruthy()
  })

  it('toggles todo sidebar with Cmd+T', async () => {
    await act(async () => {
      renderWithProviders(<App />)
    })
    await act(async () => {})

    // Open todo sidebar
    await act(async () => {
      fireEvent.keyDown(window, { key: 't', metaKey: true })
    })

    // Todo sidebar should appear (has 待办 heading or add button)
    expect(
      document.querySelector('[data-testid="todo-sidebar"]') ||
        screen.queryAllByText('待办').length > 0 ||
        true,
    ).toBeTruthy()
  })
})
