/**
 * executeRun — spawn a Coding Agent CLI and feed its stream into the
 * AgentRunService as AgentRunEvents.
 *
 * Flow: resolve def -> buildArgs -> spawn(def.bin, args) -> write prompt to
 * stdin -> line-split stdout -> claudeStream parser -> service.appendEvent.
 * On child error / non-zero exit, append run_failed.
 *
 * The spawner is injectable so tests can feed a mock child without touching
 * the real claude binary.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type { AgentRunService } from '../runs/service.js'
import { getAgentDef } from './registry.js'
import {
  createClaudeStreamParser,
  makeEvent,
  type ClaudeStreamParser,
} from './stream/claudeStream.js'

export interface ExecuteRunInput {
  runId: string
  agentId: string
  prompt: string
  model?: string | null
  cwd?: string
}

export interface ExecuteRunOptions {
  /** Inject a custom spawner (tests). Defaults to node child_process.spawn. */
  spawnChild?: (bin: string, args: string[], opts: { cwd?: string }) => ChildProcessWithoutNullStreams
  /** Optional signal to abort the run (closes the child). */
  signal?: AbortSignal
}

export interface ExecuteRunResult {
  exitCode: number | null
  ok: boolean
}

function framePromptAsStreamJson(prompt: string): string {
  // Single user turn, stream-json framing (matches claude --input-format stream-json).
  return (
    JSON.stringify({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: prompt }] },
    }) + '\n'
  )
}

function runMeta(service: AgentRunService, runId: string) {
  const run = service.getRun(runId)
  return { runId, sessionId: run ? run.sessionId : runId }
}

export async function executeRun(
  service: AgentRunService,
  input: ExecuteRunInput,
  options: ExecuteRunOptions = {},
): Promise<ExecuteRunResult> {
  const def = getAgentDef(input.agentId)
  const meta = runMeta(service, input.runId)
  if (!def) {
    service.appendEvent(input.runId, makeEvent('run_failed', meta, JSON.stringify({ error: `unknown agent: ${input.agentId}` })))
    return { exitCode: null, ok: false }
  }

  const args = def.buildArgs(input.prompt, [], [], { model: input.model ?? null })
  const spawnChild =
    options.spawnChild ??
    ((bin: string, a: string[], opts: { cwd?: string }) =>
      spawn(bin, a, { cwd: opts.cwd, stdio: ['pipe', 'pipe', 'pipe'] }))

  const parser: ClaudeStreamParser = createClaudeStreamParser(meta)

  return new Promise<ExecuteRunResult>((resolve) => {
    let child: ChildProcessWithoutNullStreams
    try {
      child = spawnChild(def.bin, args, { cwd: input.cwd })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      service.appendEvent(input.runId, makeEvent('run_failed', meta, JSON.stringify({ error: message })))
      resolve({ exitCode: null, ok: false })
      return
    }

    // Fallback run_started in case the CLI emits no system/init line.
    service.appendEvent(input.runId, makeEvent('run_started', meta, JSON.stringify({ message: `${def.name} run started` })))

    // Feed the prompt via stdin per the def's framing, then close stdin.
    const framed =
      def.promptInputFormat === 'stream-json'
        ? framePromptAsStreamJson(input.prompt)
        : input.prompt + '\n'
    try {
      child.stdin.write(framed)
    } catch {
      // ignore — child may have exited already
    }
    try {
      child.stdin.end()
    } catch {
      // ignore
    }

    let buffer = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk
      let nl: number
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl)
        buffer = buffer.slice(nl + 1)
        for (const ev of parser.parseLine(line)) {
          service.appendEvent(input.runId, ev)
        }
      }
    })

    let stderrText = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderrText += chunk
    })

    child.on('error', (err) => {
      service.appendEvent(input.runId, makeEvent('run_failed', meta, JSON.stringify({ error: err.message })))
      resolve({ exitCode: null, ok: false })
    })

    child.on('close', (code) => {
      if (buffer.trim()) {
        for (const ev of parser.parseLine(buffer)) {
          service.appendEvent(input.runId, ev)
        }
      }
      const run = service.getRun(input.runId)
      if (code !== 0 && run && run.status !== 'succeeded' && run.status !== 'canceled') {
        service.appendEvent(input.runId, makeEvent('run_failed', meta, JSON.stringify({ error: `claude exited ${code}`, stderr: stderrText.slice(0, 4000) })))
      }
      resolve({ exitCode: code, ok: code === 0 })
    })

    if (options.signal) {
      const onAbort = (): void => {
        try {
          child.kill('SIGTERM')
        } catch {
          // ignore
        }
      }
      options.signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}

export { makeEvent }
