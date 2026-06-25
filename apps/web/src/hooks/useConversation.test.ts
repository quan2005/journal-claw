import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Captured subscribe handler + spy unsubscribe.
let capturedHandler: ((payload: unknown) => void) | null = null
const offSpy = vi.fn()

const subscribeMock = vi.fn(
  (event: string, handler: (payload: unknown) => void) => {
    expect(event).toBe('conversation-stream')
    capturedHandler = handler
    return offSpy
  },
)

vi.mock('../lib/runtimeClient', () => ({
  defaultRuntimeClient: {
    invoke: vi.fn(),
    subscribe: (...args: unknown[]) => subscribeMock(args[0] as string, args[1] as (p: unknown) => void),
  },
  selectRuntimeClient: () => ({
    invoke: vi.fn(),
    subscribe: (...args: unknown[]) => subscribeMock(args[0] as string, args[1] as (p: unknown) => void),
  }),
  TauriRuntimeClient: class {},
}))

// Stash the tauri commands the hook calls into on mount/send paths.
vi.mock('../lib/tauri', () => ({
  conversationCreate: vi.fn().mockResolvedValue('s1'),
  conversationSend: vi.fn().mockResolvedValue(undefined),
  conversationCancel: vi.fn().mockResolvedValue(undefined),
  conversationClose: vi.fn().mockResolvedValue(undefined),
  conversationGetMessages: vi.fn().mockResolvedValue([]),
  conversationTruncate: vi.fn().mockResolvedValue(undefined),
  conversationRetry: vi.fn().mockResolvedValue(undefined),
  conversationGetStats: vi.fn().mockResolvedValue(null),
}))

const { useConversation } = await import('./useConversation')

describe('useConversation runtime client wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedHandler = null
  })
  afterEach(() => {
    capturedHandler = null
  })

  it('does not import @tauri-apps/api/event', () => {
    // AC-2a: static source assertion.
    const src = readFileSync(
      join(process.cwd(), 'src/hooks/useConversation.ts'),
      'utf8',
    )
    expect(src).not.toContain('@tauri-apps/api/event')
  })

  it('subscribes to conversation-stream via runtime client', async () => {
    const { unmount } = renderHook(() => useConversation())
    await waitFor(() => expect(subscribeMock).toHaveBeenCalled())
    expect(capturedHandler).not.toBeNull()
    unmount()
  })

  it('routes text_delta into assistant message blocks', async () => {
    const { result } = renderHook(() => useConversation())
    await waitFor(() => expect(capturedHandler).not.toBeNull())

    // Open a tab so the streaming events have a target session in React state.
    await act(async () => {
      await result.current.openTab('s1')
    })

    act(() => {
      capturedHandler!({ session_id: 's1', event: 'turn_start', data: '' })
      capturedHandler!({ session_id: 's1', event: 'text_delta', data: 'hi' })
    })

    await waitFor(() => {
      const msgs = result.current.messages
      const asst = msgs.find((m) => m.role === 'assistant')
      expect(asst?.content).toContain('hi')
    })
  })

  it('sets streaming false on done', async () => {
    const { result } = renderHook(() => useConversation())
    await waitFor(() => expect(capturedHandler).not.toBeNull())

    await act(async () => {
      await result.current.openTab('s1')
    })
    act(() => {
      capturedHandler!({ session_id: 's1', event: 'turn_start', data: '' })
    })
    act(() => {
      capturedHandler!({ session_id: 's1', event: 'done', data: '' })
    })

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false)
    })
  })

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useConversation())
    await waitFor(() => expect(subscribeMock).toHaveBeenCalled())
    unmount()
    expect(offSpy).toHaveBeenCalledTimes(1)
  })
})
