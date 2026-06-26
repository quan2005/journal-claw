/**
 * opencode JSON event stream -> AgentRunEvent parser.
 *
 * OpenCode's `run --format json` emits one JSON object per line. The event
 * types are adapted from open-design runtimes/json-event-stream.ts.
 */
import type { AgentRunEvent, AgentRunEventType } from '@journal/contracts'
import type { RunMeta } from './claudeStream.js'
import { makeEvent } from './claudeStream.js'

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

function stringifyContent(v: unknown): string {
  if (typeof v === 'string') return v
  if (v === undefined || v === null) return ''
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }
  return String(v)
}

function safeParseJson(v: unknown): unknown {
  if (typeof v !== 'string') return v
  try {
    return JSON.parse(v)
  } catch {
    return v
  }
}

function extractErrorMessage(candidate: unknown, fallback: string): string {
  if (typeof candidate === 'string' && candidate.trim()) return candidate
  if (isRecord(candidate)) {
    const msg = candidate.message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return fallback
}

export function createOpenCodeStreamParser(meta: RunMeta) {
  let started = false
  const toolCallsSeen = new Set<string>()

  function emit(events: AgentRunEvent[], ev: AgentRunEvent): void {
    events.push(ev)
  }

  return {
    hasStarted(): boolean {
      return started
    },
    parseLine(line: string): AgentRunEvent[] {
      const trimmed = line.trim()
      if (!trimmed) return []
      let obj: unknown
      try {
        obj = JSON.parse(trimmed)
      } catch {
        return []
      }
      if (!isRecord(obj)) return []
      const type = typeof obj.type === 'string' ? obj.type : ''
      const part = isRecord(obj.part) ? obj.part : {}
      const events: AgentRunEvent[] = []

      if (type === 'step_start') {
        if (!started) {
          started = true
          emit(
            events,
            makeEvent('run_started', meta, JSON.stringify({ message: 'opencode run started' })),
          )
        }
        emit(
          events,
          makeEvent('step_started', meta, JSON.stringify({ message: 'opencode step started' })),
        )
        return events
      }

      if (type === 'text' && typeof part.text === 'string' && part.text.length > 0) {
        emit(events, makeEvent('text_delta', meta, JSON.stringify({ text: part.text })))
        return events
      }

      if (type === 'tool_use' && typeof part.tool === 'string' && typeof part.callID === 'string') {
        const callID = part.callID
        const statePart = isRecord(part.state) ? part.state : null
        const key = `${typeof obj.sessionID === 'string' ? obj.sessionID : 'session'}:${callID}`
        if (!toolCallsSeen.has(key)) {
          toolCallsSeen.add(key)
          emit(
            events,
            makeEvent(
              'tool_call',
              meta,
              JSON.stringify({
                id: callID,
                name: part.tool,
                input: safeParseJson(statePart?.input) ?? statePart?.input ?? null,
              }),
              { spanId: callID },
            ),
          )
        }
        if (statePart && statePart.status === 'completed') {
          emit(
            events,
            makeEvent(
              'tool_result',
              meta,
              JSON.stringify({
                id: callID,
                content: stringifyContent(statePart.output),
                isError: false,
              }),
              { spanId: callID },
            ),
          )
        }
        return events
      }

      if (type === 'step_finish') {
        const data: Record<string, unknown> = { message: 'opencode step finished' }
        if (isRecord(part.tokens)) data.tokens = part.tokens
        if (typeof part.cost === 'number') data.cost = part.cost
        emit(events, makeEvent('step_finished', meta, JSON.stringify(data)))
        return events
      }

      if (type === 'finish') {
        emit(
          events,
          makeEvent('run_finished', meta, JSON.stringify({ message: 'opencode run finished' })),
        )
        return events
      }

      if (type === 'error') {
        const message = extractErrorMessage(obj.error ?? obj.message, 'opencode error')
        emit(
          events,
          makeEvent(
            'run_failed',
            meta,
            JSON.stringify({ error: message, raw: stringifyContent(obj) }),
          ),
        )
        return events
      }

      return events
    },
  }
}

export type OpenCodeStreamParser = ReturnType<typeof createOpenCodeStreamParser>

export { makeEvent }
export type { RunMeta, AgentRunEvent, AgentRunEventType }
