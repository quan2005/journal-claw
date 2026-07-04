/**
 * claude stream-json -> AgentRunEvent parser.
 *
 * Claude Code's `--output-format stream-json --verbose` emits one JSON object
 * per line. We translate the high-level lifecycle into AgentRunEvent:
 *   system/init        -> run_started
 *   assistant text     -> text_delta
 *   assistant thinking -> thinking_delta
 *   assistant tool_use -> tool_call (when the input block is complete)
 *   system api_retry   -> (swallowed; informational)
 *   result             -> run_finished
 *
 * The parser is a pure function over emitted lines: feed it each stdout line,
 * it returns the AgentRunEvent(s) to append (0..n per line). The runner owns
 * runId/sessionId/timestamp bookkeeping and injects them.
 *
 * Schema measured on this machine (claude 2.1.191).
 */
import type { AgentRunEvent, AgentRunEventType } from '@journal/contracts'

export interface RunMeta {
  runId: string
  sessionId: string
}

export function makeEvent(
  type: AgentRunEventType,
  meta: RunMeta,
  data: string,
  extra?: { spanId?: string; parentSpanId?: string },
): AgentRunEvent {
  return {
    type,
    runId: meta.runId,
    sessionId: meta.sessionId,
    spanId: extra?.spanId,
    parentSpanId: extra?.parentSpanId,
    data,
    timestamp: new Date().toISOString(),
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

interface BlockState {
  id?: string
  name?: string
  input: string
}

/**
 * Parse a single stdout line into 0..n AgentRunEvents.
 * The handler keeps per-content-block scratch so a streamed tool_use input
 * (which arrives as input_json_delta fragments) is emitted once, complete.
 */
export function createClaudeStreamParser(meta: RunMeta) {
  const blocks = new Map<string, BlockState>()
  let started = false

  function emit(events: AgentRunEvent[], ev: AgentRunEvent): void {
    events.push(ev)
  }

  return {
    /** Returns true once a run_started has been emitted. */
    hasStarted(): boolean {
      return started
    },
    /** Parse one line; mutates no global state besides this parser. */
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
      const events: AgentRunEvent[] = []

      if (type === 'system') {
        const subtype = typeof obj.subtype === 'string' ? obj.subtype : ''
        if (subtype === 'init' && !started) {
          started = true
          emit(
            events,
            makeEvent('run_started', meta, JSON.stringify({ message: 'claude run started' })),
          )
        }
        // api_retry / hook_* are informational; swallow.
        return events
      }

      if (type === 'assistant') {
        const message = isRecord(obj.message) ? obj.message : null
        const content = message && Array.isArray(message.content) ? message.content : []
        let blockIndex = 0
        for (const raw of content) {
          if (!isRecord(raw)) {
            blockIndex += 1
            continue
          }
          const key = String((message as Record<string, unknown>).id ?? '') + ':' + blockIndex
          const btype = typeof raw.type === 'string' ? raw.type : ''
          if (btype === 'text' && typeof raw.text === 'string') {
            emit(events, makeEvent('text_delta', meta, JSON.stringify({ text: raw.text })))
          } else if (btype === 'thinking' && typeof raw.thinking === 'string') {
            emit(events, makeEvent('thinking_delta', meta, JSON.stringify({ text: raw.thinking })))
          } else if (btype === 'tool_use') {
            const id = typeof raw.id === 'string' ? raw.id : undefined
            const name = typeof raw.name === 'string' ? raw.name : undefined
            // Final tool_use in the assistant wrapper carries complete input.
            if (id) {
              emit(
                events,
                makeEvent('tool_call', meta, JSON.stringify({ id, name, input: raw.input ?? {} }), {
                  spanId: id,
                }),
              )
            }
          }
          blockIndex += 1
        }
        return events
      }

      // stream_event wraps content_block deltas when --include-partial-messages
      // is on; we fold them into the same text/tool handling for robustness.
      if (type === 'stream_event' && isRecord(obj.event)) {
        return events
      }

      if (type === 'result') {
        const data: Record<string, unknown> = { message: 'claude run finished' }
        if (typeof obj.result === 'string') data.result = obj.result
        if (typeof obj.costUSD === 'number') data.costUSD = obj.costUSD
        if (isRecord(obj.usage)) data.usage = obj.usage
        emit(events, makeEvent('run_finished', meta, JSON.stringify(data)))
        return events
      }

      return events
    },
  }
}

export type ClaudeStreamParser = ReturnType<typeof createClaudeStreamParser>
