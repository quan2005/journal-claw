import type { ConversationStreamPayload } from '../../types'
import type { AppError, ConversationEvent } from '../../shared/protocol/appEvent'

const CURRENT_TURN_ID = 'current'

function parseJsonObject(data: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(data)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function parseError(data: string): AppError {
  const parsed = parseJsonObject(data)
  return {
    code: typeof parsed.code === 'string' ? parsed.code : 'unknown',
    message: typeof parsed.message === 'string' ? parsed.message : data,
    retryable: typeof parsed.retryable === 'boolean' ? parsed.retryable : false,
  }
}

function legacyToolId(payload: ConversationStreamPayload, name: unknown): string {
  return payload.span_id ?? `legacy:${typeof name === 'string' ? name : 'tool'}`
}

export function mapCurrentConversationStreamPayload(
  payload: ConversationStreamPayload,
): ConversationEvent[] {
  const sessionId = payload.session_id

  switch (payload.event) {
    case 'turn_start':
      return [{ sessionId, kind: 'turn_started', turnId: CURRENT_TURN_ID }]
    case 'text_delta':
      return [{ sessionId, kind: 'text_delta', turnId: CURRENT_TURN_ID, delta: payload.data }]
    case 'thinking_delta':
      return [{ sessionId, kind: 'thinking_delta', turnId: CURRENT_TURN_ID, delta: payload.data }]
    case 'tool_start': {
      const info = parseJsonObject(payload.data)
      return [
        {
          sessionId,
          kind: 'tool_started',
          turnId: CURRENT_TURN_ID,
          toolCall: {
            id: legacyToolId(payload, info.name),
            name: typeof info.name === 'string' ? info.name : 'tool',
            label: typeof info.label === 'string' ? info.label : 'Tool',
            input:
              typeof info.input === 'object' && info.input !== null
                ? (info.input as Record<string, unknown>)
                : undefined,
          },
        },
      ]
    }
    case 'tool_end': {
      const info = parseJsonObject(payload.data)
      return [
        {
          sessionId,
          kind: 'tool_finished',
          turnId: CURRENT_TURN_ID,
          toolCallId: legacyToolId(payload, info.name),
          output: {
            content: typeof info.output === 'string' ? info.output : '',
            isError: Boolean(info.is_error),
          },
        },
      ]
    }
    case 'usage': {
      const info = parseJsonObject(payload.data)
      return [
        {
          sessionId,
          kind: 'usage',
          usage: {
            inputTokens: typeof info.input_tokens === 'number' ? info.input_tokens : 0,
            outputTokens: typeof info.output_tokens === 'number' ? info.output_tokens : 0,
          },
        },
      ]
    }
    case 'error':
      return [{ sessionId, kind: 'failed', error: parseError(payload.data) }]
    case 'done':
      return [
        {
          sessionId,
          kind: 'turn_finished',
          stats: { elapsedSecs: 0, totalInputTokens: 0, totalOutputTokens: 0 },
        },
      ]
    default:
      return []
  }
}
