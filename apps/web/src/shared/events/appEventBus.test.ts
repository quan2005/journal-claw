import { beforeEach, describe, expect, it, vi } from 'vitest'

const listenMock = vi.fn()

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}))

import { subscribeAppEvents } from './appEventBus'

describe('subscribeAppEvents', () => {
  beforeEach(() => {
    listenMock.mockReset()
  })

  it('subscribes to exactly one app-event channel', async () => {
    const unlisten = vi.fn()
    listenMock.mockResolvedValue(unlisten)

    const subscription = subscribeAppEvents(vi.fn())
    await subscription.ready
    await subscription.unsubscribe()

    expect(listenMock).toHaveBeenCalledWith('app-event', expect.any(Function))
    expect(unlisten).toHaveBeenCalledOnce()
  })

  it('forwards only valid app events', async () => {
    const unlisten = vi.fn()
    let handler: ((event: { payload: unknown }) => void) | null = null
    listenMock.mockImplementation((_channel, cb) => {
      handler = cb as typeof handler
      return Promise.resolve(unlisten)
    })
    const onEvent = vi.fn()

    const subscription = subscribeAppEvents(onEvent)
    await subscription.ready

    const dispatch = (payload: unknown) => {
      const currentHandler = handler as ((event: { payload: unknown }) => void) | null
      if (!currentHandler) throw new Error('expected app-event handler to be registered')
      currentHandler({ payload })
    }

    dispatch({ type: 'bad' })
    dispatch({
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
  })
})
