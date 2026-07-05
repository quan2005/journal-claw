import { describe, expect, it } from 'vitest'
import { createConversationStreamState, conversationStreamReducer } from './streamReducer'

describe('conversationStreamReducer', () => {
  it('appends text deltas to the active assistant turn', () => {
    let state = createConversationStreamState('ses_1')
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'turn_started',
      turnId: 'turn_1',
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'text_delta',
      turnId: 'turn_1',
      delta: 'hello',
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'text_delta',
      turnId: 'turn_1',
      delta: ' world',
    })

    expect(state.turns[0].blocks).toEqual([{ type: 'text', content: 'hello world' }])
  })

  it('tracks tool lifecycle by toolCallId', () => {
    let state = createConversationStreamState('ses_1')
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'turn_started',
      turnId: 'turn_1',
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'tool_started',
      turnId: 'turn_1',
      toolCall: { id: 'tool_1', name: 'read', label: 'Read file' },
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'tool_finished',
      turnId: 'turn_1',
      toolCallId: 'tool_1',
      output: { content: 'done', isError: false },
    })

    expect(state.turns[0].blocks).toEqual([
      {
        type: 'tool',
        toolCallId: 'tool_1',
        name: 'read',
        label: 'Read file',
        output: 'done',
        isError: false,
      },
    ])
  })

  it('keeps artifact blocks addressable by artifactId', () => {
    let state = createConversationStreamState('ses_1')
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'turn_started',
      turnId: 'turn_1',
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'artifact_delta',
      turnId: 'turn_1',
      artifactId: 'art_1',
      delta: '<Section',
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'artifact_delta',
      turnId: 'turn_1',
      artifactId: 'art_1',
      delta: ' />',
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'artifact_finished',
      turnId: 'turn_1',
      artifactId: 'art_1',
    })

    expect(state.turns[0].blocks).toEqual([
      { type: 'artifact', artifactId: 'art_1', content: '<Section />', isStreaming: false },
    ])
  })

  it('ignores events for other sessions', () => {
    const state = createConversationStreamState('ses_1')
    const next = conversationStreamReducer(state, {
      sessionId: 'ses_2',
      kind: 'turn_started',
      turnId: 'turn_1',
    })

    expect(next).toBe(state)
  })

  it('tracks usage and turn completion stats', () => {
    let state = createConversationStreamState('ses_1')
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'turn_started',
      turnId: 'turn_1',
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'usage',
      usage: { inputTokens: 12, outputTokens: 3 },
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'turn_finished',
      stats: { elapsedSecs: 1.5, totalInputTokens: 12, totalOutputTokens: 3 },
    })

    expect(state.usage).toEqual({ inputTokens: 12, outputTokens: 3 })
    expect(state.turns[0].status).toBe('finished')
    expect(state.turns[0].stats?.elapsedSecs).toBe(1.5)
  })

  it('records structured errors on the active turn', () => {
    let state = createConversationStreamState('ses_1')
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'turn_started',
      turnId: 'turn_1',
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'failed',
      error: { code: 'provider_unavailable', message: 'down', retryable: true },
    })

    expect(state.turns[0].status).toBe('failed')
    expect(state.turns[0].blocks).toEqual([
      {
        type: 'error',
        error: { code: 'provider_unavailable', message: 'down', retryable: true },
      },
    ])
  })
})
