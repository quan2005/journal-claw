/**
 * claude adapter def — spawns `claude -p` with stream-json I/O.
 *
 * Real argv (measured on this machine, claude 2.1.191):
 *   claude -p --input-format stream-json --output-format stream-json \
 *     --verbose [--model <m>] [--resume <id> | --session-id <id>]
 * Prompt is delivered via stdin (promptViaStdin) framed as a single
 * stream-json user turn, so tool_result blocks can be injected later
 * without respawning. Mirrors open-design runtimes/defs/claude.ts.
 */
import type { RuntimeAgentDef, RuntimeBuildOptions, RuntimeContext } from '@journal/contracts'

const FALLBACK_MODELS = [
  { id: 'default', label: 'Default' },
  { id: 'sonnet', label: 'Sonnet (alias)' },
  { id: 'opus', label: 'Opus (alias)' },
  { id: 'haiku', label: 'Haiku (alias)' },
]

export const claudeAgentDef: RuntimeAgentDef = {
  id: 'claude',
  name: 'Claude Code',
  bin: 'claude',
  fallbackBins: ['openclaude'],
  version: { args: ['--version'], timeoutMs: 5000 },
  authProbe: { args: ['auth', 'status'], timeoutMs: 5000 },
  buildArgs: (
    _prompt: string,
    _imagePaths: string[],
    extraAllowedDirs: string[] = [],
    options: RuntimeBuildOptions = {},
    runtimeContext: RuntimeContext = {},
  ): string[] => {
    const args = [
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
    ]
    if (options.model && options.model !== 'default') {
      args.push('--model', options.model)
    }
    const dirs = (extraAllowedDirs || []).filter(
      (d) => typeof d === 'string' && d.length > 0,
    )
    if (dirs.length > 0) {
      args.push('--add-dir', ...dirs)
    }
    if (typeof runtimeContext.resumeSessionId === 'string' && runtimeContext.resumeSessionId) {
      args.push('--resume', runtimeContext.resumeSessionId)
    } else if (typeof runtimeContext.newSessionId === 'string' && runtimeContext.newSessionId) {
      args.push('--session-id', runtimeContext.newSessionId)
    }
    // G9 AuthorizationMode mapping is not wired yet; default to the CLI's own
    // default permission mode. --permission-mode will be added in G9.
    return args
  },
  promptViaStdin: true,
  promptInputFormat: 'stream-json',
  streamFormat: 'claude-stream-json',
  fallbackModels: FALLBACK_MODELS,
}
