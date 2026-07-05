import { spawn } from 'node:child_process'
import type { EngineAgentTool, EngineToolContext } from './context.js'
import { schema, textResult } from './context.js'

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_TIMEOUT_MS = 600_000
const MAX_OUTPUT_BYTES = 100 * 1024

export function createBashTool(ctx: EngineToolContext): EngineAgentTool {
  return {
    name: 'bash',
    label: 'Bash',
    description:
      'Execute a shell command in the workspace. Prefer file tools for filesystem operations.',
    parameters: schema({
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        timeout_ms: {
          type: 'integer',
          description: 'Optional timeout in milliseconds. Default 120000, max 600000.',
        },
      },
      required: ['command'],
    }),
    executionMode: 'sequential',
    execute: async (_toolCallId, params, signal) => {
      const input = params as Record<string, unknown>
      const command = String(input.command ?? '').trim()
      if (!command) throw new Error("missing or empty 'command'")
      const timeoutMs = Math.min(
        Math.max(Number(input.timeout_ms ?? DEFAULT_TIMEOUT_MS), 1_000),
        MAX_TIMEOUT_MS,
      )
      const { output, exitCode, timedOut } = await runShell(
        command,
        ctx.workspaceRoot,
        timeoutMs,
        signal,
      )
      return textResult(output, {
        kind: 'bash',
        command,
        exitCode,
        timedOut,
        runId: ctx.runId,
      })
    },
  }
}

async function runShell(
  command: string,
  cwd: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<{ output: string; exitCode: number | null; timedOut: boolean }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal,
    })
    const chunks: Buffer[] = []
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    const collect = (chunk: Buffer) => {
      chunks.push(chunk)
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const combined = Buffer.concat(chunks)
      const truncated = combined.length > MAX_OUTPUT_BYTES
      const bytes = truncated ? combined.subarray(0, MAX_OUTPUT_BYTES) : combined
      let output = bytes.toString('utf8')
      if (truncated) output += '\n\n[output truncated at 100KB]'
      if (timedOut) output += `\n\n[command timed out after ${timeoutMs}ms]`
      if (code && code !== 0) output += `\n\n[exit code: ${code}]`
      resolve({ output, exitCode: code, timedOut })
    })
  })
}
