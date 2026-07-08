import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
import { useTopics } from '../hooks/useTopics'

type EventCallback = (payload: unknown) => void
const eventListeners = vi.hoisted(() => new Map<string, Set<EventCallback>>())

const { listTopicsDirMock, invokeMock } = vi.hoisted(() => {
  const listTopicsDirMock = vi.fn()
  const invokeMock = vi.fn((cmd: string, args?: Record<string, unknown>) => {
    if (cmd === 'list_workspace_dir') {
      return listTopicsDirMock(args?.relativePath ?? '')
    }
    return undefined
  })
  return { listTopicsDirMock, invokeMock }
})

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => ({
    invoke: invokeMock,
    subscribe: (name: string, cb: EventCallback) => {
      const listeners = eventListeners.get(name) ?? new Set<EventCallback>()
      listeners.add(cb)
      eventListeners.set(name, listeners)
      return () => {
        listeners.delete(cb)
        if (listeners.size === 0) eventListeners.delete(name)
      }
    },
  }),
}))

function TopicsProbe({ onRender }: { onRender?: (entries: string[]) => void }) {
  const { dirs, load } = useTopics()

  useEffect(() => {
    void load()
  }, [load])

  const entries = dirs.get('')?.entries ?? []
  onRender?.(entries.map((entry) => entry.name))

  return (
    <div>
      {entries.map((entry) => (
        <span key={entry.path}>{entry.name}</span>
      ))}
    </div>
  )
}

function TopicDirsProbe() {
  const { dirs, load } = useTopics()

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      {[...dirs.entries()].flatMap(([path, state]) =>
        state.entries.map((entry) => (
          <span key={`${path}:${entry.path}`}>{`${path || 'root'}:${entry.path}`}</span>
        )),
      )}
    </div>
  )
}

function emitEvent(name: string, payload: unknown) {
  eventListeners.get(name)?.forEach((listener) => listener(payload))
}

describe('useTopics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    eventListeners.clear()
    listTopicsDirMock.mockReset()
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
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not poll topic directories while mounted', async () => {
    listTopicsDirMock.mockResolvedValue([])

    render(<TopicsProbe />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(listTopicsDirMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(30_000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(listTopicsDirMock).toHaveBeenCalledTimes(1)
  })

  it('does not refresh when focus changes without a topic file event', async () => {
    listTopicsDirMock.mockResolvedValue([])

    render(<TopicsProbe />)

    await act(async () => {
      await Promise.resolve()
    })

    window.dispatchEvent(new Event('focus'))

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(listTopicsDirMock).toHaveBeenCalledTimes(1)
  })

  it('refreshes the loaded topic list after a topic file event', async () => {
    listTopicsDirMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { name: 'guide.mdx', path: 'guide.mdx', is_dir: false, mtime_secs: 1 },
      ])

    render(<TopicsProbe />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(listTopicsDirMock).toHaveBeenCalledWith('')

    emitEvent('topics-updated', null)

    await act(async () => {
      vi.advanceTimersByTime(250)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('guide.mdx')).toBeTruthy()
  })

  it('coalesces multiple topic file events into one refresh', async () => {
    listTopicsDirMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { name: 'guide.mdx', path: 'guide.mdx', is_dir: false, mtime_secs: 1 },
      ])

    render(<TopicsProbe />)

    await act(async () => {
      await Promise.resolve()
    })

    const listener = eventListeners.get('topics-updated')
    listener?.forEach((cb) => cb(null))
    listener?.forEach((cb) => cb(null))
    listener?.forEach((cb) => cb(null))

    await act(async () => {
      vi.advanceTimersByTime(250)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(listTopicsDirMock).toHaveBeenCalledTimes(2)
  })

  it('does not re-render the topic tree when a file event returns an unchanged snapshot', async () => {
    const unchangedEntry = { name: 'guide.mdx', path: 'guide.mdx', is_dir: false, mtime_secs: 1 }
    const onRender = vi.fn()
    listTopicsDirMock.mockResolvedValue([unchangedEntry])

    render(<TopicsProbe onRender={onRender} />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText('guide.mdx')).toBeTruthy()

    const rendersAfterInitialLoad = onRender.mock.calls.length

    emitEvent('topics-updated', null)

    await act(async () => {
      vi.advanceTimersByTime(250)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onRender).toHaveBeenCalledTimes(rendersAfterInitialLoad)
  })

  it('loads topic directories that were expanded in the previous session', async () => {
    window.localStorage.setItem('journal_topics_expanded_dirs_v1', JSON.stringify(['manual']))
    listTopicsDirMock.mockImplementation(async (path: string) => {
      if (path === '') {
        return [{ name: 'manual', path: 'manual', is_dir: true, mtime_secs: 1 }]
      }
      if (path === 'manual') {
        return [{ name: 'guide.mdx', path: 'manual/guide.mdx', is_dir: false, mtime_secs: 2 }]
      }
      return []
    })

    render(<TopicDirsProbe />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(listTopicsDirMock).toHaveBeenCalledWith('manual')
    expect(screen.getByText('manual:manual/guide.mdx')).toBeTruthy()
  })

  // AC-3 · 根展示非 topics 内容、dot 条目不显示
  it('lists the workspace root (not just topics/) and surfaces non-topics entries', async () => {
    listTopicsDirMock.mockResolvedValue([
      { name: 'topics', path: 'topics', is_dir: true, mtime_secs: 1 },
      { name: 'research', path: 'research', is_dir: true, mtime_secs: 2 },
      { name: 'README.md', path: 'README.md', is_dir: false, mtime_secs: 3 },
    ])

    render(<TopicsProbe />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // 根列举走 list_workspace_dir，且 topics 之外的内容也可见
    expect(listTopicsDirMock).toHaveBeenCalledWith('')
    expect(screen.getByText('topics')).toBeTruthy()
    expect(screen.getByText('research')).toBeTruthy()
    expect(screen.getByText('README.md')).toBeTruthy()
  })

  // AC-3 · 防御性过滤 dot 条目（daemon 已过滤，web 侧再兜一层）
  it('hides dot entries (e.g. .journal, .gitignore) from the tree', async () => {
    listTopicsDirMock.mockResolvedValue([
      { name: '.journal', path: '.journal', is_dir: true, mtime_secs: 1 },
      { name: '.gitignore', path: '.gitignore', is_dir: false, mtime_secs: 1 },
      { name: 'notes.md', path: 'notes.md', is_dir: false, mtime_secs: 2 },
    ])

    render(<TopicsProbe />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('notes.md')).toBeTruthy()
    expect(screen.queryByText('.journal')).toBeNull()
    expect(screen.queryByText('.gitignore')).toBeNull()
  })
})
