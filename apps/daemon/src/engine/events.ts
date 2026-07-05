import type { AgentEvent } from '@earendil-works/pi-agent-core'
import type { AgentRunEvent } from '@journal/contracts'

export interface PiEventMappingMeta {
  runId: string
  sessionId: string
}

export function mapPiAgentEvent(
  event: AgentEvent,
  meta: PiEventMappingMeta,
  now = new Date(),
): AgentRunEvent[] {
  const base = {
    runId: meta.runId,
    sessionId: meta.sessionId,
    timestamp: now.toISOString(),
  }

  switch (event.type) {
    case 'agent_start':
      return [{ ...base, type: 'run_started', data: JSON.stringify({ engine: 'builtin' }) }]
    case 'turn_start':
      return [{ ...base, type: 'step_started', data: JSON.stringify({ engine: 'builtin' }) }]
    case 'message_update':
      return mapAssistantMessageEvent(event.assistantMessageEvent, base)
    case 'tool_execution_start':
      return [
        {
          ...base,
          type: 'tool_call',
          spanId: event.toolCallId,
          data: JSON.stringify({
            id: event.toolCallId,
            name: event.toolName,
            args: event.args,
          }),
        },
      ]
    case 'tool_execution_end':
      return [
        {
          ...base,
          type: 'tool_result',
          spanId: event.toolCallId,
          data: JSON.stringify({
            id: event.toolCallId,
            name: event.toolName,
            result: event.result,
            isError: event.isError,
          }),
        },
        ...mapChangeSet(event.result, base, event.toolCallId),
      ]
    case 'agent_end':
      return [
        {
          ...base,
          type: 'run_finished',
          data: JSON.stringify({ messageCount: event.messages.length }),
        },
      ]
    default:
      return []
  }
}

function mapChangeSet(
  result: unknown,
  base: Pick<AgentRunEvent, 'runId' | 'sessionId' | 'timestamp'>,
  parentSpanId: string,
): AgentRunEvent[] {
  const details =
    result && typeof result === 'object' && !Array.isArray(result)
      ? (result as { details?: unknown }).details
      : undefined
  const changeSet =
    details && typeof details === 'object' && !Array.isArray(details)
      ? (details as { changeSet?: unknown }).changeSet
      : undefined
  if (!changeSet) return []
  return [
    {
      ...base,
      type: 'change_proposed',
      parentSpanId,
      data: JSON.stringify({ changeSet }),
    },
  ]
}

function mapAssistantMessageEvent(
  event: AgentEventOf<'message_update'>['assistantMessageEvent'],
  base: Pick<AgentRunEvent, 'runId' | 'sessionId' | 'timestamp'>,
): AgentRunEvent[] {
  if (event.type === 'text_delta') {
    return [
      {
        ...base,
        type: 'text_delta',
        data: JSON.stringify({ text: event.delta }),
      },
    ]
  }
  if (event.type === 'thinking_delta') {
    return [
      {
        ...base,
        type: 'thinking_delta',
        data: JSON.stringify({ text: event.delta }),
      },
    ]
  }
  return []
}

type AgentEventOf<TType extends AgentEvent['type']> = Extract<AgentEvent, { type: TType }>
