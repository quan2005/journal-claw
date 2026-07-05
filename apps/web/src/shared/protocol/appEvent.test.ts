import { describe, expect, it } from 'vitest'
import { isAppEvent, type AppEvent } from './appEvent'

describe('app event protocol', () => {
  it('accepts a versioned conversation event', () => {
    const event: AppEvent = {
      v: 1,
      type: 'conversation.event',
      data: {
        sessionId: 'ses_1',
        kind: 'text_delta',
        turnId: 'turn_1',
        delta: 'hello',
      },
    }

    expect(isAppEvent(event)).toBe(true)
  })

  it('rejects unversioned event payloads', () => {
    expect(isAppEvent({ type: 'conversation.event', data: {} })).toBe(false)
  })

  it('rejects unknown event types', () => {
    expect(isAppEvent({ v: 1, type: 'unknown.event', data: {} })).toBe(false)
  })
})
