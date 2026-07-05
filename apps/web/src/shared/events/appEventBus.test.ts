import { beforeEach, describe, expect, it, vi } from 'vitest'
import { subscribeAppEvents } from './appEventBus'

class MockEventSource {
  static last: MockEventSource | null = null
  url: string
  onmessage: ((msg: { data: string }) => void) | null = null
  closed = false

  constructor(url: string) {
    this.url = url
    MockEventSource.last = this
  }

  close() {
    this.closed = true
  }

  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

describe('subscribeAppEvents', () => {
  beforeEach(() => {
    MockEventSource.last = null
    ;(globalThis as Record<string, unknown>).__JOURNAL_RUNTIME = 'http'
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource
  })

  it('subscribes to exactly one app-event SSE channel', async () => {
    const subscription = subscribeAppEvents(vi.fn())
    await subscription.ready
    await subscription.unsubscribe()

    expect(MockEventSource.last?.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/events\/app-event$/)
    expect(MockEventSource.last?.closed).toBe(true)
  })

  it('forwards only valid app events', async () => {
    const onEvent = vi.fn()

    const subscription = subscribeAppEvents(onEvent)
    await subscription.ready

    MockEventSource.last?.emit({ type: 'bad' })
    MockEventSource.last?.emit({
      v: 1,
      type: 'workspace.changed',
      data: { reason: 'files_changed', paths: ['2606/08-note.md'] },
    })

    expect(onEvent).toHaveBeenCalledOnce()
    expect(onEvent).toHaveBeenCalledWith({
      v: 1,
      type: 'workspace.changed',
      data: { reason: 'files_changed', paths: ['2606/08-note.md'] },
    })

    await subscription.unsubscribe()
  })
})
