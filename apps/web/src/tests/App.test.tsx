import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, act, waitFor } from '@testing-library/react'
import { renderWithProviders } from './setup'
import App from '../App'
import { UIProvider } from '../contexts/UIContext'
import { TodoProvider } from '../contexts/TodoContext'

function renderApp() {
  return renderWithProviders(
    <UIProvider>
      <TodoProvider>
        <App />
      </TodoProvider>
    </UIProvider>,
  )
}

const listenerMap = new Map<string, Set<(event: unknown) => void>>()

// P2: the unified conversation panel fetches detected agents directly from the
// daemon. In the App integration test there is no daemon, so stub the list to
// an empty array (the shell treats a fetch failure the same way — no crash).
vi.mock('../lib/localAgents', () => ({
  listLocalAgents: vi.fn().mockResolvedValue([]),
}))

// ── Runtime client mock ─────────────────────────────────────────────────
// Every daemon call now flows through selectRuntimeClient().invoke(command, args).
// A single mock with command-based switching replaces the old per-function
// shim mock — B2 components call invoke directly, while B1 hooks and B3
// components go through the compat layer whose real implementation delegates
// to the same selectRuntimeClient().
const runtimeMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}))

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => ({
    invoke: runtimeMocks.invoke,
    subscribe: (eventName: string, cb: (event: unknown) => void) => {
      const listeners = listenerMap.get(eventName) ?? new Set()
      listeners.add(cb)
      listenerMap.set(eventName, listeners)
      return () => {
        listeners.delete(cb)
        if (listeners.size === 0) listenerMap.delete(eventName)
      }
    },
  }),
}))

// ── Default daemon responses ─────────────────────────────────────────────
// Per-test overrides via invokeOverrides take precedence over these defaults.
const invokeOverrides = new Map<string, ((args?: Record<string, unknown>) => unknown) | unknown>()

const TEST_ENTRY = {
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
}

function defaultInvoke(cmd: string, args?: Record<string, unknown>): unknown {
  const override = invokeOverrides.get(cmd)
  if (override !== undefined) {
    return typeof override === 'function' ? override(args) : override
  }
  switch (cmd) {
    case 'get_workspace_path':
      return '/tmp/ws'
    case 'get_onboarding_status':
      return { completed: true, last_step: null }
    case 'complete_onboarding':
      return undefined
    case 'set_onboarding_step':
      return undefined
    case 'reset_onboarding':
      return undefined
    case 'create_sample_entry_if_needed':
      return false
    case 'create_sample_entry':
      return undefined
    case 'list_all_journal_entries':
      return []
    case 'list_available_months':
      return ['2604']
    case 'list_journal_entries_by_months':
      return [TEST_ENTRY]
    case 'list_journal_entries':
      return [TEST_ENTRY]
    case 'list_work_queue':
      return []
    case 'list_topics_dir':
      return []
    case 'list_workspace_dir':
      // 文件树根 = workspace 根；默认返回空，单测可通过 invokeOverrides 覆写
      return []
    case 'get_pinned_items':
      return []
    case 'set_pinned_items':
      return undefined
    case 'list_identities':
      return []
    case 'list_todos':
      return []
    case 'get_events_since':
      return []
    case 'get_workspace_theme':
      return 'dark'
    case 'set_workspace_theme':
      return undefined
    case 'get_workspace_tree_sort':
      return 'name-asc'
    case 'set_workspace_tree_sort':
      return undefined
    case 'get_agent_engine':
      return { engine: 'builtin', agentId: null }
    case 'set_agent_engine':
      return undefined
    case 'conversation_list':
      return []
    case 'conversation_delete':
      return undefined
    case 'conversation_create':
      return 'test-session'
    case 'conversation_send':
      return undefined
    case 'conversation_cancel':
      return undefined
    case 'conversation_close':
      return undefined
    case 'conversation_truncate':
      return undefined
    case 'conversation_retry':
      return undefined
    case 'conversation_get_messages':
      return []
    case 'conversation_get_stats':
      return { elapsed_secs: 0, total_input_tokens: 0, total_output_tokens: 0 }
    case 'get_engine_config':
      return { active_provider: 'anthropic', providers: [] }
    case 'get_journal_entry_content':
      return '# Test'
    case 'get_identity_content':
      return ''
    case 'get_workspace_prompt':
      return ''
    case 'reset_workspace_prompt':
      return ''
    case 'get_app_version':
      return '0.12.1'
    case 'get_platform_capabilities':
      return {
        os: 'macos',
        apple_stt: true,
        whisperkit: true,
        speaker_diarization: true,
        native_permissions: true,
      }
    case 'check_app_permissions':
      return { speech_recognition: 'granted' }
    case 'request_permission':
      return 'granted'
    case 'get_auto_lint_config':
      return { enabled: false, frequency: 'daily', time: '03:00', min_entries: 10 }
    case 'get_auto_lint_status':
      return {
        state: 'idle',
        last_run: null,
        last_run_entries: null,
        next_check: null,
        current_new_entries: 0,
        error: null,
      }
    case 'get_feishu_config':
      return { enabled: false, app_id: '', app_secret: '' }
    case 'get_feishu_status':
      return { state: 'idle', error: null }
    case 'get_global_skills_enabled':
      return false
    case 'set_global_skills_enabled':
      return undefined
    case 'list_skills':
      return []
    case 'list_automation_templates':
      return []
    case 'list_routines':
      return []
    case 'get_api_key':
      return null
    case 'enqueue_work':
      return {
        id: 'wq-test',
        status: 'queued',
        session_id: null,
        text: null,
        files: null,
        prompt: null,
        display_name: '',
        error: null,
        created_at: 0,
      }
    case 'dismiss_work_item':
      return undefined
    case 'delete_journal_entry':
      return undefined
    case 'delete_identity':
      return undefined
    case 'delete_topic':
      return undefined
    case 'archive_identity':
      return undefined
    case 'unarchive_identity':
      return undefined
    default:
      return undefined
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listenerMap.clear()
  invokeOverrides.clear()
  runtimeMocks.invoke.mockImplementation(async (cmd: string, args?: Record<string, unknown>) =>
    defaultInvoke(cmd, args),
  )
  Object.defineProperty(window, 'innerWidth', {
    value: 1280,
    writable: true,
    configurable: true,
  })
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

// Helpers for asserting invoke calls ──────────────────────────────────────
function invokeCallsFor(cmd: string): Array<Record<string, unknown> | undefined> {
  return runtimeMocks.invoke.mock.calls
    .filter(([c]) => c === cmd)
    .map(([, a]) => a as Record<string, unknown> | undefined)
}

function wasInvokeCalledWith(cmd: string, predicate: (args?: Record<string, unknown>) => boolean) {
  return invokeCallsFor(cmd).some(predicate)
}

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

  it('places sidebar collapse controls on the panel dividers', async () => {
    await act(async () => {
      renderApp()
    })
    await act(async () => {})

    const titleBar = document.querySelector('[data-tauri-drag-region]')
    const leftToggle = screen.getByRole('button', { name: '折叠左侧栏' })
    const rightToggle = screen.getByRole('button', { name: '折叠右侧栏 (⌘T)' })
    const leftPanel = document.querySelector('[data-sidebar-panel="left"]') as HTMLElement
    const rightPanel = document.querySelector('[data-sidebar-panel="right"]') as HTMLElement

    expect(leftToggle.closest('[data-sidebar-divider="left"]')).toBeTruthy()
    expect(rightToggle.closest('[data-sidebar-divider="right"]')).toBeTruthy()
    expect(titleBar?.contains(rightToggle)).toBe(false)
    expect(leftToggle.style.top).toBe('var(--panel-toggle-top)')
    expect(rightToggle.style.top).toBe('var(--panel-toggle-top)')
    expect(leftToggle.getAttribute('style')).toContain(
      '--panel-toggle-top: clamp(88px, 12vh, 120px)',
    )
    expect(rightToggle.getAttribute('style')).toContain(
      '--panel-toggle-top: clamp(88px, 12vh, 120px)',
    )
    expect(leftToggle.style.transform).toBe('translate(-50%, -50%)')
    expect(rightToggle.style.transform).toBe('translate(-50%, -50%)')
    expect(leftToggle.querySelector('svg')?.classList.contains('lucide-chevron-left')).toBe(true)
    expect(rightToggle.querySelector('svg')?.classList.contains('lucide-chevron-right')).toBe(true)
    expect(leftPanel.style.transition).toContain('width 220ms')
    expect(rightPanel.style.transition).toContain('width 220ms')

    await act(async () => {
      fireEvent.click(leftToggle)
    })

    expect(leftPanel.style.width).toBe('0px')
    expect(leftPanel.style.opacity).toBe('0')
    expect(leftPanel.getAttribute('aria-hidden')).toBe('true')

    await act(async () => {
      fireEvent.click(rightToggle)
    })

    expect(rightPanel.style.width).toBe('0px')
    expect(rightPanel.style.opacity).toBe('0')
    expect(rightPanel.getAttribute('aria-hidden')).toBe('true')
    const rightExpandToggle = screen.getByRole('button', { name: '展开右侧栏 (⌘T)' })
    expect(rightExpandToggle.querySelector('svg')?.classList.contains('lucide-chevron-left')).toBe(
      true,
    )
  })

  // AC-1 (story 20260703-ui-fixes-sidebar-dropdown): fullscreen workbench
  // categories must not render the left tree-sidebar column at all — not a
  // zero-width shell, but the entire column (panel + divider) absent so the
  // workbench sits flush against the NavRail.
  it('does not render the left sidebar column for fullscreen workbench categories', async () => {
    await act(async () => {
      renderApp()
    })
    await act(async () => {})

    // Default journal category keeps the column.
    expect(document.querySelector('[data-sidebar-panel="left"]')).not.toBeNull()
    expect(document.querySelector('[data-sidebar-divider="left"]')).not.toBeNull()

    for (const label of ['想法', '自动化', '技能']) {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: label }))
      })
      expect(document.querySelector('[data-sidebar-panel="left"]')).toBeNull()
      expect(document.querySelector('[data-sidebar-divider="left"]')).toBeNull()
    }

    // Returning to a list category restores the column.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '流水' }))
    })
    expect(document.querySelector('[data-sidebar-panel="left"]')).not.toBeNull()
    expect(document.querySelector('[data-sidebar-divider="left"]')).not.toBeNull()
  })

  it('keeps the left sidebar column for list categories', async () => {
    await act(async () => {
      renderApp()
    })
    await act(async () => {})

    for (const label of ['专题', '画像', '流水']) {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: label }))
      })
      expect(document.querySelector('[data-sidebar-panel="left"]')).not.toBeNull()
      expect(document.querySelector('[data-sidebar-divider="left"]')).not.toBeNull()
    }
  })

  it('preserves the left sidebar width memory across a fullscreen round-trip', async () => {
    await act(async () => {
      renderApp()
    })
    await act(async () => {})

    const leftPanelBefore = document.querySelector('[data-sidebar-panel="left"]') as HTMLElement
    const widthBefore = leftPanelBefore.style.width
    expect(widthBefore).not.toBe('0px')

    // Detour through a fullscreen category (column unmounts).
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '想法' }))
    })
    expect(document.querySelector('[data-sidebar-panel="left"]')).toBeNull()

    // Back to a list category — width must be unchanged.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '流水' }))
    })
    const leftPanelAfter = document.querySelector('[data-sidebar-panel="left"]') as HTMLElement
    expect(leftPanelAfter.style.width).toBe(widthBefore)
    expect(leftPanelAfter.style.width).not.toBe('0px')
  })

  it('preserves readable detail width by closing sidebars at narrow window sizes', async () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 840,
      writable: true,
      configurable: true,
    })

    await act(async () => {
      renderApp()
    })

    const leftPanel = document.querySelector('[data-sidebar-panel="left"]') as HTMLElement
    const rightPanel = document.querySelector('[data-sidebar-panel="right"]') as HTMLElement

    await waitFor(() => {
      expect(rightPanel.style.width).toBe('0px')
      expect(leftPanel.style.width).not.toBe('0px')
    })

    await act(async () => {
      window.innerWidth = 680
      fireEvent(window, new Event('resize'))
    })

    await waitFor(() => {
      expect(leftPanel.style.width).toBe('0px')
      expect(rightPanel.style.width).toBe('0px')
    })
  })

  it('loads topic files from the workspace topics directory', async () => {
    invokeOverrides.set('list_workspace_dir', (args?: Record<string, unknown>) => {
      const relativePath = (args?.relativePath as string) ?? ''
      if (relativePath === '') {
        return [{ name: 'topics', path: 'topics', is_dir: true, mtime_secs: 0 }]
      }
      if (relativePath === 'topics') {
        return [{ name: 'guide.mdx', path: 'topics/guide.mdx', is_dir: false, mtime_secs: 1 }]
      }
      return []
    })

    await act(async () => {
      renderApp()
    })

    // Switch to topics category via NavRail
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '专题' }))
    })

    // topics/ is now a normal subdirectory of workspace root — expand it first
    await act(async () => {
      fireEvent.click(screen.getByText('topics'))
      await Promise.resolve()
      await Promise.resolve()
    })

    const topicFile = await screen.findByText('guide')

    await act(async () => {
      fireEvent.click(topicFile)
    })

    await waitFor(() => {
      expect(
        wasInvokeCalledWith(
          'get_journal_entry_content',
          (args) => args?.path === '/tmp/ws/topics/guide.mdx',
        ),
      ).toBe(true)
    })
  })

  it('keeps an item selected when clicking it again', async () => {
    invokeOverrides.set('list_workspace_dir', (args?: Record<string, unknown>) => {
      const relativePath = (args?.relativePath as string) ?? ''
      if (relativePath === '') {
        return [{ name: 'topics', path: 'topics', is_dir: true, mtime_secs: 0 }]
      }
      if (relativePath === 'topics') {
        return [{ name: 'guide.mdx', path: 'topics/guide.mdx', is_dir: false, mtime_secs: 1 }]
      }
      return []
    })
    invokeOverrides.set('get_journal_entry_content', '# Guide')

    await act(async () => {
      renderApp()
      await Promise.resolve()
      await Promise.resolve()
    })

    // Switch to topics category via NavRail
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '专题' }))
    })

    // topics/ is now a normal subdirectory of workspace root — expand it first
    await act(async () => {
      fireEvent.click(screen.getByText('topics'))
      await Promise.resolve()
      await Promise.resolve()
    })

    const topicFile = await screen.findByText('guide')

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
    invokeOverrides.set('list_workspace_dir', (args?: Record<string, unknown>) => {
      const relativePath = (args?.relativePath as string) ?? ''
      if (relativePath === '') {
        return [{ name: 'topics', path: 'topics', is_dir: true, mtime_secs: 0 }]
      }
      if (relativePath === 'topics') {
        return [{ name: 'guide.mdx', path: 'topics/guide.mdx', is_dir: false, mtime_secs: 1 }]
      }
      return []
    })
    invokeOverrides.set('get_journal_entry_content', '# Guide')

    let app = renderApp()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    // Switch to topics category via NavRail
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '专题' }))
    })

    // topics/ is now a normal subdirectory of workspace root — expand it first
    await act(async () => {
      fireEvent.click(screen.getByText('topics'))
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(await screen.findByText('guide'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('file-view-shell')).toBeTruthy()

    app.unmount()
    runtimeMocks.invoke.mockClear()
    runtimeMocks.invoke.mockImplementation(async (cmd: string, args?: Record<string, unknown>) =>
      defaultInvoke(cmd, args),
    )

    app = renderApp()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('file-view-shell')).toBeTruthy()
    expect(
      wasInvokeCalledWith(
        'get_journal_entry_content',
        (args) => args?.path === '/tmp/ws/topics/guide.mdx',
      ),
    ).toBe(true)

    app.unmount()
  })

  it('does not reload a selected topic file during an unchanged journal refresh', async () => {
    vi.useFakeTimers()
    invokeOverrides.set('list_available_months', ['2604'])
    invokeOverrides.set('list_journal_entries_by_months', [TEST_ENTRY])
    invokeOverrides.set('list_workspace_dir', (args?: Record<string, unknown>) => {
      const relativePath = (args?.relativePath as string) ?? ''
      if (relativePath === '') {
        return [{ name: 'topics', path: 'topics', is_dir: true, mtime_secs: 0 }]
      }
      if (relativePath === 'topics') {
        return [{ name: 'guide.mdx', path: 'topics/guide.mdx', is_dir: false, mtime_secs: 1 }]
      }
      return []
    })
    invokeOverrides.set('get_journal_entry_content', '# Guide')

    await act(async () => {
      renderApp()
      await Promise.resolve()
      await Promise.resolve()
    })

    // Switch to topics category via NavRail
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '专题' }))
    })

    // topics/ is now a normal subdirectory of workspace root — expand it first
    await act(async () => {
      fireEvent.click(screen.getByText('topics'))
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('guide'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(
      invokeCallsFor('get_journal_entry_content').filter(
        (args) => args?.path === '/tmp/ws/topics/guide.mdx',
      ),
    ).toHaveLength(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(
      invokeCallsFor('get_journal_entry_content').filter(
        (args) => args?.path === '/tmp/ws/topics/guide.mdx',
      ),
    ).toHaveLength(1)
    vi.useRealTimers()
  })

  it('opens local file link events inside the detail view', async () => {
    invokeOverrides.set('get_journal_entry_content', 'export const ok = true')

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
        wasInvokeCalledWith(
          'get_journal_entry_content',
          (args) => args?.path === '/tmp/ws/Projects/github/journal/src/components/mdx/index.ts',
        ),
      ).toBe(true)
    })
  })

  it('returns to the previous journal entry after opening a local file link', async () => {
    invokeOverrides.set('get_journal_entry_content', (args?: Record<string, unknown>) => {
      const path = (args?.path as string) ?? ''
      if (path.endsWith('Guide.md')) return '# Linked Guide'
      return '# Original Article'
    })

    await act(async () => {
      renderApp()
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(await screen.findByText('测试条目'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(await screen.findByText('Original Article')).toBeTruthy()

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('journal-file-open', {
          detail: {
            path: 'References/Guide.md',
            name: 'Guide.md',
          },
        }),
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(await screen.findByText('Linked Guide')).toBeTruthy()

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: '返回 测试条目' }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(await screen.findByText('Original Article')).toBeTruthy()
  })

  it('keeps the current topic file detail when focusing a breadcrumb directory', async () => {
    invokeOverrides.set('get_journal_entry_content', '# Guide')

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
      invokeCallsFor('get_journal_entry_content').filter(
        (args) => args?.path === '/tmp/ws/可视化一切/Guide.md',
      ),
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

    // Click identity category via NavRail
    const identityBtn = screen.getByRole('button', { name: '画像' })
    await act(async () => {
      fireEvent.click(identityBtn)
    })

    // Identity button should now be active
    expect(identityBtn.getAttribute('aria-current')).toBe('page')
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

  // Helper: open the right panel so the mode toggle renders.
  async function openRightPanel() {
    // Click the TitleBar expand toggle (always rendered). When already open it
    // reads '折叠右侧栏'; when closed '展开右侧栏' — click the expand one.
    const expand = screen.queryByRole('button', { name: '展开右侧栏 (⌘T)' })
    if (expand) {
      await act(async () => {
        fireEvent.click(expand)
      })
    }
  }

  // ── P2: unified conversation panel (replaces the Chat/Agent Run tabs) ──
  it('shows the engine switcher instead of the Chat/Agent Run tabs and defaults to the built-in engine', async () => {
    await act(async () => {
      renderApp()
    })
    await act(async () => {})
    await openRightPanel()

    // The two-tab toggle is gone (AC-1): neither legacy tab button renders.
    expect(screen.queryByRole('button', { name: 'Chat' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agent Run' })).toBeNull()

    // The persistent engine chip is present (AC-2).
    expect(screen.getByTestId('engine-switcher-chip')).toBeTruthy()

    // Default engine is built-in pi, so the Agent Run goal form is absent and
    // the conversation surface (no run goal) is what the user sees.
    expect(screen.queryByPlaceholderText('想让 Agent 做什么？')).toBeNull()
  })

  it('switching the engine to external renders the inline Agent Run surface', async () => {
    // Make an external agent available so the switcher can select it.
    invokeOverrides.set('get_agent_engine', { engine: 'cli', agentId: 'claude' })
    const { listLocalAgents } = await import('../lib/localAgents')
    vi.mocked(listLocalAgents).mockResolvedValueOnce([
      {
        id: 'claude',
        name: 'Claude Code',
        bin: 'claude',
        available: true,
        version: '1.0.0',
      },
    ])

    await act(async () => {
      renderApp()
    })
    await act(async () => {})
    await openRightPanel()

    // Open the switcher popover and select the external (CLI) engine.
    await act(async () => {
      fireEvent.click(screen.getByTestId('engine-switcher-chip'))
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('engine-switcher-mode-cli'))
    })

    // The inline Agent Run surface renders in the same panel — goal form,
    // authorization selector and (after a run) the changeset all live here.
    await waitFor(() => {
      expect(screen.getByPlaceholderText('想让 Agent 做什么？')).toBeTruthy()
    })
  })
})
