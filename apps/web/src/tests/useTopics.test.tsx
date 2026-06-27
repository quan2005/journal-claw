import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
import { useTopics } from '../hooks/useTopics'
import { listTopicsDir } from '../lib/tauri'

type EventCallback = (payload: unknown) => void
const eventListeners = vi.hoisted(() => new Map<string, Set<EventCallback>>())

vi.mock('../lib/runtimeClient', () => ({
  selectRuntimeClient: () => ({
    invoke: vi.fn(),
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

vi.mock('../lib/tauri', () => ({
  listTopicsDir: vi.fn(),
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
    vi.mocked(listTopicsDir).mockReset()
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
    vi.mocked(listTopicsDir).mockResolvedValue([])

    render(<TopicsProbe />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(vi.mocked(listTopicsDir)).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(30_000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(vi.mocked(listTopicsDir)).toHaveBeenCalledTimes(1)
  })

  it('does not refresh when focus changes without a topic file event', async () => {
    vi.mocked(listTopicsDir).mockResolvedValue([])

    render(<TopicsProbe />)

    await act(async () => {
      await Promise.resolve()
    })

    window.dispatchEvent(new Event('focus'))

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(vi.mocked(listTopicsDir)).toHaveBeenCalledTimes(1)
  })

  it('refreshes the loaded topic list after a topic file event', async () => {
    vi.mocked(listTopicsDir)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { name: 'guide.mdx', path: 'guide.mdx', is_dir: false, mtime_secs: 1 },
      ])

    render(<TopicsProbe />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(vi.mocked(listTopicsDir)).toHaveBeenCalledWith('')

    emitEvent('topics-updated', null)

    await act(async () => {
      vi.advanceTimersByTime(250)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('guide.mdx')).toBeTruthy()
  })

  it('coalesces multiple topic file events into one refresh', async () => {
    vi.mocked(listTopicsDir)
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

    expect(vi.mocked(listTopicsDir)).toHaveBeenCalledTimes(2)
  })

  it('does not re-render the topic tree when a file event returns an unchanged snapshot', async () => {
    const unchangedEntry = { name: 'guide.mdx', path: 'guide.mdx', is_dir: false, mtime_secs: 1 }
    const onRender = vi.fn()
    vi.mocked(listTopicsDir).mockResolvedValue([unchangedEntry])

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
    vi.mocked(listTopicsDir).mockImplementation(async (path: string) => {
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

    expect(vi.mocked(listTopicsDir)).toHaveBeenCalledWith('manual')
    expect(screen.getByText('manual:manual/guide.mdx')).toBeTruthy()
  })
})
