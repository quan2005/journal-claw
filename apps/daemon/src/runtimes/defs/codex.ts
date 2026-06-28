/**
 * codex adapter def — spawns `codex exec --json` with JSONL event output.
 *
 * Real argv (measured on this machine, codex-cli 0.142.1):
 *   codex exec --json [--model <m>] [-s <sandbox>] <prompt>
 *
 * Codex prints structured JSONL events to stdout. The stream parser
 * (codexStream) maps those to AgentRunEvent. Unlike claude, codex takes the
 * prompt as a positional argv argument (not stdin), so promptViaStdin is
 * false and the prompt is embedded in buildArgs.
 *
 * Sandbox modes (codex --sandbox): read-only / workspace-write /
 * danger-full-access — mapped from AuthorizationMode.
 */
import type { RuntimeAgentDef, RuntimeBuildOptions, RuntimeContext } from '@journal/contracts'

const CODEX_SANDBOX: Record<string, string> = {
  read_only: 'read-only',
  workspace_write: 'workspace-write',
  full_access: 'danger-full-access',
  wide_with_audit: 'danger-full-access',
}

export const codexAgentDef: RuntimeAgentDef = {
  id: 'codex',
  name: 'Codex CLI',
  bin: 'codex',
  version: { args: ['--version'], timeoutMs: 5000 },
  // `codex login status` reports real login state (the previous empty argv
  // just ran `codex` with no args, which prints help text and makes
  // server.ts detectAuth throw on JSON.parse -> always authed=false). The
  // real probe mirrors open-design runtimes/defs/codex.ts and the claude
  // adapter pattern: `codex login status` exits 0 + emits
  // `{loggedIn, authMethod, apiProvider}` JSON when authed, non-zero
  // otherwise; detectAuth already speaks that shape.
  authProbe: { args: ['login', 'status'], timeoutMs: 5000 },
  buildArgs: (
    prompt: string,
    _imagePaths: string[],
    _extraAllowedDirs: string[] = [],
    options: RuntimeBuildOptions = {},
    _runtimeContext: RuntimeContext = {},
  ): string[] => {
    const args = ['exec', '--json']
    if (options.model && options.model !== 'default') {
      args.push('--model', options.model)
    }
    const mode = options.authorizationMode ?? 'workspace_write'
    args.push('--sandbox', CODEX_SANDBOX[mode] ?? 'workspace-write')
    // Codex takes the prompt as a trailing positional argument
    args.push(prompt)
    return args
  },
  promptViaStdin: false,
  promptInputFormat: 'text',
  streamFormat: 'codex-jsonl',
  fallbackModels: [
    { id: 'default', label: 'Default' },
    { id: 'o3', label: 'o3' },
    { id: 'gpt-5.5', label: 'GPT-5.5' },
  ],
  installUrl: 'https://github.com/openai/codex',
  docsUrl: 'https://github.com/openai/codex/blob/main/docs/authentication.md',
}
