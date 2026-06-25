/**
 * codex JSONL stream -> AgentRunEvent parser.
 *
 * Codex's `--json` mode emits one JSON object per line. The core event types
 * (measured from codex exec --json):
 *   {"type":"message","role":"assistant","content":[...]}  -> text_delta
 *   {"type":"function_call","name":"...","arguments":"..."} -> tool_call
 *   {"type":"completed","reason":"..."}                      -> run_finished
 *   {"type":"error","message":"..."}                         -> run_failed
 *
 * The parser is a pure function over lines, same shape as claudeStream.
 */
import type { AgentRunEvent, AgentRunEventType } from '@journal/contracts'
import type { RunMeta } from './claudeStream.js'
import { makeEvent } from './claudeStream.js'

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

export function createCodexStreamParser(meta: RunMeta) {
  let started = false
  return {
    hasStarted(): boolean { return started },
    parseLine(line: string): AgentRunEvent[] {
      const trimmed = line.trim()
      if (!trimmed) return []
      let obj: unknown
      try { obj = JSON.parse(trimmed) } catch { return [] }
      if (!isRecord(obj)) return []
      const type = typeof obj.type === 'string' ? obj.type : ''
      const events: AgentRunEvent[] = []

      if (!started) {
        started = true
        events.push(makeEvent('run_started', meta, JSON.stringify({ message: 'codex run started' })))
      }

      if (type === 'message' || type === 'text') {
        // Extract text from content blocks
        const content = Array.isArray(obj.content) ? obj.content : []
        for (const block of content) {
          if (isRecord(block) && typeof block.text === 'string') {
            events.push(makeEvent('text_delta', meta, JSON.stringify({ text: block.text })))
          }
        }
        // Some codex versions put text directly
        if (typeof obj.text === 'string') {
          events.push(makeEvent('text_delta', meta, JSON.stringify({ text: obj.text })))
        }
      }

      if (type === 'function_call') {
        const name = typeof obj.name === 'string' ? obj.name : 'tool'
        const args = typeof obj.arguments === 'string' ? obj.arguments : ''
        events.push(makeEvent('tool_call', meta, JSON.stringify({ name, input: args.slice(0, 500) }), { spanId: typeof obj.id === 'string' ? obj.id : undefined }))
      }

      if (type === 'completed') {
        events.push(makeEvent('run_finished', meta, JSON.stringify({ message: 'codex run finished', reason: obj.reason })))
      }

      if (type === 'error') {
        events.push(makeEvent('run_failed', meta, JSON.stringify({ error: obj.message ?? 'codex error' })))
      }

      return events
    },
  }
}

export type CodexStreamParser = ReturnType<typeof createCodexStreamParser>
