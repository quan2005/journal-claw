import { describe, expect, it } from 'vitest'
import type { ConversationStreamPayload } from '../../types'
import { mapCurrentConversationStreamPayload } from './currentStreamMapper'

describe('mapCurrentConversationStreamPayload', () => {
  it('maps text_delta to a typed conversation event', () => {
    const payload: ConversationStreamPayload = {
      session_id: 'ses_1',
      event: 'text_delta',
      data: 'hello',
    }

    expect(mapCurrentConversationStreamPayload(payload)).toEqual([
      { sessionId: 'ses_1', kind: 'text_delta', turnId: 'current', delta: 'hello' },
    ])
  })

  it('maps tool_start with stable fallback id', () => {
    const payload: ConversationStreamPayload = {
      session_id: 'ses_1',
      event: 'tool_start',
      data: JSON.stringify({ name: 'read', label: 'Read file', input: { path: '2606/a.md' } }),
      span_id: 'tool_span_1',
    }

    expect(mapCurrentConversationStreamPayload(payload)).toEqual([
      {
        sessionId: 'ses_1',
        kind: 'tool_started',
        turnId: 'current',
        toolCall: {
          id: 'tool_span_1',
          name: 'read',
          label: 'Read file',
          input: { path: '2606/a.md' },
        },
      },
    ])
  })

  it('maps structured error JSON', () => {
    const payload: ConversationStreamPayload = {
      session_id: 'ses_1',
      event: 'error',
      data: JSON.stringify({ code: 'provider_unavailable', message: 'down', retryable: true }),
    }

    expect(mapCurrentConversationStreamPayload(payload)).toEqual([
      {
        sessionId: 'ses_1',
        kind: 'failed',
        error: { code: 'provider_unavailable', message: 'down', retryable: true },
      },
    ])
  })
})
