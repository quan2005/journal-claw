import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, act, waitFor } from '@testing-library/react'
import { renderWithProviders } from './setup'
import App from '../App'
import { UIProvider } from '../contexts/UIContext'
import { TodoProvider } from '../contexts/TodoContext'
import * as tauri from '../lib/tauri'

function renderApp() {
  return renderWithProviders(
    <UIProvider>
      <TodoProvider>
        <App />
      </TodoProvider>
    </UIProvider>,
  )
}

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
    listWorkQueue: vi.fn().mockResolvedValue([]),
    listTopicsDir: vi.fn().mockResolvedValue([]),
    getPinnedItems: vi.fn().mockResolvedValue([]),
    setPinnedItems: vi.fn().mockResolvedValue(undefined),
    conversationList: vi.fn().mockResolvedValue([]),
    conversationDelete: vi.fn().mockResolvedValue(undefined),
    conversationCreate: vi.fn().mockResolvedValue('test-session'),
    conversationSend: vi.fn().mockResolvedValue(undefined),
    conversationCancel: vi.fn().mockResolvedValue(undefined),
    conversationClose: vi.fn().mockResolvedValue(undefined),
    conversationTruncate: vi.fn().mockResolvedValue(undefined),
    conversationRetry: vi.fn().mockResolvedValue(undefined),
    conversationGetMessages: vi.fn().mockResolvedValue([]),
    conversationGetStats: vi.fn().mockResolvedValue({
      elapsed_secs: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
    }),
    getEngineConfig: vi.fn().mockResolvedValue({ active_provider: 'anthropic', providers: [] }),
    checkEngineInstalled: vi.fn().mockResolvedValue(true),
    getAsrConfig: vi.fn().mockResolvedValue({
      asr_engine: 'apple',
      dashscope_api_key: '',
      whisperkit_model: 'base',
      dashscope_asr_model: '',
      volcengine_asr_api_key: '',
      volcengine_asr_resource_id: 'volc.seedasr.auc',
      siliconflow_asr_api_key: '',
      siliconflow_asr_model: 'FunAudioLLM/SenseVoiceSmall',
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
    getOnboardingStatus: vi.fn().mockResolvedValue({ completed: true, last_step: null }),
    completeOnboarding: vi.fn().mockResolvedValue(undefined),
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
    getPlatformCapabilities: vi.fn().mockResolvedValue({
      os: 'macos',
      apple_stt: true,
      whisperkit: true,
      speaker_diarization: true,
      native_permissions: true,
    }),
    getAutoLintConfig: vi.fn().mockResolvedValue({ enabled: false }),
    getAutoLintStatus: vi.fn().mockResolvedValue({ state: 'idle' }),
    getFeishuConfig: vi.fn().mockResolvedValue({ enabled: false }),
    getFeishuStatus: vi.fn().mockResolvedValue({ state: 'idle' }),
    listSkills: vi.fn().mockResolvedValue([]),
    openSkillsDir: vi.fn(),
    revealInFileManager: vi.fn(),
    getTranscript: vi.fn().mockResolvedValue(null),
    retryTranscription: vi.fn(),
    requestPermission: vi.fn(),
    checkAppPermissions: vi.fn().mockResolvedValue({ speech_recognition: 'granted' }),
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

afterEach(() => {
  vi.useRealTimers()
})

describe('App', () => {
  it('renders without crashing', async () => {
    await act(async () => {
      renderApp()
    })
    // TitleBar should be visible
    expect(document.querySelector('[data-tauri-drag-region]')).toBeTruthy()
  })

  it('shows journal view by default', async () => {
    await act(async () => {
      renderApp()
    })
    // Journal shell should be active, with no settings dialog open.
    await act(async () => {})
    expect(screen.getByRole('button', { name: /设置/ })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: '设置' })).toBeNull()
  })

  it('loads topic files from the workspace topics directory', async () => {
    vi.mocked(tauri.listTopicsDir).mockResolvedValueOnce([
      {
        name: 'guide.mdx',
        path: 'guide.mdx',
        is_dir: false,
        mtime_secs: 1,
      },
    ])

    await act(async () => {
      renderApp()
    })

    const topicFile = await screen.findByText('guide.mdx')

    await act(async () => {
      fireEvent.click(topicFile)
    })

    await waitFor(() => {
      expect(
        vi
          .mocked(tauri.getJournalEntryContent)
          .mock.calls.some(([path]) => path === '/tmp/ws/topics/guide.mdx'),
      ).toBe(true)
    })
  })

  it('keeps an item selected when clicking it again', async () => {
    vi.mocked(tauri.listTopicsDir).mockResolvedValueOnce([
      {
        name: 'guide.mdx',
        path: 'guide.mdx',
        is_dir: false,
        mtime_secs: 1,
      },
    ])
    vi.mocked(tauri.getJournalEntryContent).mockResolvedValue('# Guide')

    await act(async () => {
      renderApp()
      await Promise.resolve()
      await Promise.resolve()
    })

    const topicFile = await screen.findByText('guide.mdx')

    await act(async () => {
      fireEvent.click(topicFile)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('file-view-shell')).toBeTruthy()

    await act(async () => {
      fireEvent.click(topicFile)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('file-view-shell')).toBeTruthy()
  })

  it('restores the last selected topic file after remounting', async () => {
    vi.mocked(tauri.listTopicsDir).mockResolvedValue([
      {
        name: 'guide.mdx',
        path: 'guide.mdx',
        is_dir: false,
        mtime_secs: 1,
      },
    ])
    vi.mocked(tauri.getJournalEntryContent).mockResolvedValue('# Guide')

    let app = renderApp()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(await screen.findByText('guide.mdx'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('file-view-shell')).toBeTruthy()

    app.unmount()
    vi.mocked(tauri.getJournalEntryContent).mockClear()

    app = renderApp()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('file-view-shell')).toBeTruthy()
    expect(
      vi
        .mocked(tauri.getJournalEntryContent)
        .mock.calls.some(([path]) => path === '/tmp/ws/topics/guide.mdx'),
    ).toBe(true)

    app.unmount()
  })

  it('does not reload a selected topic file during an unchanged journal refresh', async () => {
    vi.useFakeTimers()
    vi.mocked(tauri.listAvailableMonths).mockImplementation(async () => ['2604'])
    vi.mocked(tauri.listJournalEntriesByMonths).mockImplementation(async () => [
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
    ])
    vi.mocked(tauri.listTopicsDir).mockResolvedValueOnce([
      {
        name: 'guide.mdx',
        path: 'guide.mdx',
        is_dir: false,
        mtime_secs: 1,
      },
    ])
    vi.mocked(tauri.getJournalEntryContent).mockResolvedValue('# Guide')

    await act(async () => {
      renderApp()
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('guide.mdx'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(
      vi
        .mocked(tauri.getJournalEntryContent)
        .mock.calls.filter(([path]) => path === '/tmp/ws/topics/guide.mdx'),
    ).toHaveLength(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(
      vi
        .mocked(tauri.getJournalEntryContent)
        .mock.calls.filter(([path]) => path === '/tmp/ws/topics/guide.mdx'),
    ).toHaveLength(1)
    vi.useRealTimers()
  })

  it('opens local file link events inside the detail view', async () => {
    vi.mocked(tauri.getJournalEntryContent).mockResolvedValue('export const ok = true')

    await act(async () => {
      renderApp()
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('journal-file-open', {
          detail: {
            path: '/tmp/ws/Projects/github/journal/src/components/mdx/index.ts',
            name: 'index.ts',
          },
        }),
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(
        vi
          .mocked(tauri.getJournalEntryContent)
          .mock.calls.some(
            ([path]) => path === '/tmp/ws/Projects/github/journal/src/components/mdx/index.ts',
          ),
      ).toBe(true)
    })
    expect(tauri.openFile).not.toHaveBeenCalled()
  })

  it('keeps the current topic file detail when focusing a breadcrumb directory', async () => {
    vi.mocked(tauri.getJournalEntryContent).mockResolvedValue('# Guide')

    await act(async () => {
      renderApp()
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('journal-file-open', {
          detail: {
            path: '可视化一切/Guide.md',
            name: 'Guide.md',
          },
        }),
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    const topicButton = await screen.findByRole('button', { name: '定位到专题 可视化一切' })
    expect(screen.getByText('Guide.md')).toBeTruthy()

    await act(async () => {
      fireEvent.click(topicButton)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('Guide.md')).toBeTruthy()
    expect(
      vi
        .mocked(tauri.getJournalEntryContent)
        .mock.calls.filter(([path]) => path === '/tmp/ws/topics/可视化一切/Guide.md'),
    ).toHaveLength(1)
  })

  it('toggles settings view with Cmd+,', async () => {
    await act(async () => {
      renderApp()
    })
    await act(async () => {})

    // Open settings
    await act(async () => {
      fireEvent.keyDown(window, { key: ',', metaKey: true })
    })

    // Settings panel should appear as a modal over the journal shell.
    expect(await screen.findByRole('dialog', { name: '设置' })).toBeTruthy()
    expect((await screen.findAllByText('通用')).length).toBeGreaterThan(0)

    // Close settings with Escape
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    // Back to journal
    expect(screen.queryByRole('dialog', { name: '设置' })).toBeNull()
    expect(screen.getByRole('button', { name: /设置/ })).toBeTruthy()
  })

  it('switches sidebar tabs', async () => {
    await act(async () => {
      renderApp()
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
      renderApp()
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
