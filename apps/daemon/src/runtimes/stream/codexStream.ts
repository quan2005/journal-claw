/**
 * codex JSONL stream -> AgentRunEvent parser.
 *
 * Codex CLI 0.142.1 `exec --json` emits one JSON object per line. The real
 * event types measured on this machine are:
 *   {"type":"thread.started","thread_id":"..."}                         -> run_started
 *   {"type":"turn.started"}                                             -> step_started
 *   {"type":"item.started","item":{"type":"command_execution",...}}     -> tool_call
 *   {"type":"item.completed","item":{"type":"command_execution",...}}   -> tool_result
 *   {"type":"item.completed","item":{"type":"agent_message","text":...}} -> text_delta
 *   {"type":"item.completed","item":{"type":"error","message":...}}     -> swallowed warning
 *   {"type":"turn.completed","usage":{...}}                             -> run_finished
 *   {"type":"error","message":"..."}                                    -> run_failed
 *
 * The parser is a pure function over lines, same shape as claudeStream.
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

function extractErrorMessage(candidate: unknown, fallback: string): string {
  if (typeof candidate === 'string' && candidate.trim()) return candidate
  if (isRecord(candidate)) {
    const msg = candidate.message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return fallback
}

export function createCodexStreamParser(meta: RunMeta) {
  let started = false
  const toolCallsSeen = new Set<string>()
  const toolResultsSeen = new Set<string>()

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
      const events: AgentRunEvent[] = []

      if (type === 'thread.started') {
        if (!started) {
          started = true
          emit(
            events,
            makeEvent(
              'run_started',
              meta,
              JSON.stringify({
                message: 'codex run started',
                threadId: typeof obj.thread_id === 'string' ? obj.thread_id : undefined,
              }),
            ),
          )
        }
        return events
      }

      if (type === 'turn.started') {
        emit(
          events,
          makeEvent('step_started', meta, JSON.stringify({ message: 'codex turn started' })),
        )
        return events
      }

      if (type === 'item.started' || type === 'item.completed') {
        const item = isRecord(obj.item) ? obj.item : null
        if (!item) return events
        const itemType = typeof item.type === 'string' ? item.type : ''
        const itemId = typeof item.id === 'string' ? item.id : undefined

        if (type === 'item.started' && itemType === 'command_execution' && itemId) {
          if (!toolCallsSeen.has(itemId)) {
            toolCallsSeen.add(itemId)
            const command = typeof item.command === 'string' ? item.command : ''
            emit(
              events,
              makeEvent(
                'tool_call',
                meta,
                JSON.stringify({
                  id: itemId,
                  name: 'command_execution',
                  command,
                  input: { command },
                }),
                { spanId: itemId },
              ),
            )
          }
          return events
        }

        if (type === 'item.completed' && itemType === 'command_execution' && itemId) {
          if (!toolResultsSeen.has(itemId)) {
            toolResultsSeen.add(itemId)
            emit(
              events,
              makeEvent(
                'tool_result',
                meta,
                JSON.stringify({
                  id: itemId,
                  content: stringifyContent(item.aggregated_output),
                  exitCode: item.exit_code ?? null,
                  status: item.status ?? null,
                  isError: item.exit_code !== 0 && item.exit_code !== '0',
                }),
                { spanId: itemId },
              ),
            )
          }
          return events
        }

        if (
          type === 'item.completed' &&
          itemType === 'agent_message' &&
          typeof item.text === 'string'
        ) {
          emit(events, makeEvent('text_delta', meta, JSON.stringify({ text: item.text })))
          return events
        }

        // Codex emits item.type=error for non-fatal warnings such as skill
        // context budget truncation. Do not turn those into run_failed.
        return events
      }

      if (type === 'turn.completed') {
        const data: Record<string, unknown> = { message: 'codex run finished' }
        if (isRecord(obj.usage)) data.usage = obj.usage
        emit(events, makeEvent('run_finished', meta, JSON.stringify(data)))
        return events
      }

      if (type === 'error') {
        const message = extractErrorMessage(obj.error ?? obj.message, 'codex error')
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

export type CodexStreamParser = ReturnType<typeof createCodexStreamParser>
