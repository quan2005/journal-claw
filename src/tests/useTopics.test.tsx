import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
import { useTopics } from '../hooks/useTopics'
import { listTopicsDir } from '../lib/tauri'

vi.mock('../lib/tauri', () => ({
  listTopicsDir: vi.fn(),
}))

function TopicsProbe() {
  const { dirs, load } = useTopics()

  useEffect(() => {
    void load()
  }, [load])

  const entries = dirs.get('')?.entries ?? []

  return (
    <div>
      {entries.map((entry) => (
        <span key={entry.path}>{entry.name}</span>
      ))}
    </div>
  )
}

describe('useTopics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(listTopicsDir).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes the loaded topic list automatically', async () => {
    vi.mocked(listTopicsDir)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ name: 'guide.mdx', path: 'guide.mdx', is_dir: false, mtime_secs: 1 }])

    render(<TopicsProbe />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(vi.mocked(listTopicsDir)).toHaveBeenCalledWith('')

    await act(async () => {
      vi.advanceTimersByTime(3000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('guide.mdx')).toBeTruthy()
  })
})
