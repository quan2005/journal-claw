/**
 * RuntimeAgentDef — declarative Coding Agent CLI adapter definition.
 *
 * One adapter per CLI (claude / codex / opencode / ...). The daemon's
 * runner uses buildArgs() to spawn the CLI, then a per-streamFormat
 * parser turns the CLI's stream-json output into AgentRunEvent.
 *
 * Mirrors open-design RuntimeAgentDef, trimmed to journal's needs:
 * - buildArgs is synchronous (no per-adapter async model fetch yet)
 * - prompt delivered via stdin (stream-json / text), not argv, to dodge
 *   MAX_ARG_STRLEN — matches open-design claude/codex/gemini/opencode defs.
 */

export type RuntimeStreamFormat = string

export interface RuntimeBuildOptions {
  model?: string | null
  reasoning?: string | null
  /** Authorization mode applied to the spawned CLI; maps to its permission flag. */
  authorizationMode?: 'read_only' | 'workspace_write' | 'full_access' | 'wide_with_audit'
}

export interface RuntimeContext {
  cwd?: string
  resumeSessionId?: string | null
  newSessionId?: string
}

/** Probe result for detect — is the CLI installed, and if so is it authed? */
export interface AgentAuthStatus {
  id: string
  installed: boolean
  version: string | null
  authed: boolean
  authMethod?: string | null
  apiProvider?: string | null
}

export interface RuntimeProbeDef {
  /** argv appended to the bin, e.g. ['auth','status'] for claude. */
  args: string[]
  timeoutMs?: number
}

export interface RuntimeVersionDef {
  args: string[]
  timeoutMs?: number
}

export interface RuntimeAgentDef {
  /** Stable id; the registry rejects duplicates. e.g. 'claude'. */
  id: string
  name: string
  bin: string
  fallbackBins?: string[]
  version: RuntimeVersionDef
  authProbe?: RuntimeProbeDef
  /** Compose the CLI argv (without the bin itself). Prompt goes via stdin. */
  buildArgs: (
    prompt: string,
    imagePaths: string[],
    extraAllowedDirs?: string[],
    options?: RuntimeBuildOptions,
    runtimeContext?: RuntimeContext,
  ) => string[]
  promptViaStdin: boolean
  promptInputFormat?: 'text' | 'stream-json'
  streamFormat: RuntimeStreamFormat
  fallbackModels?: { id: string; label: string }[]
}

export function isRuntimeAgentDef(value: unknown): value is RuntimeAgentDef {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.bin === 'string' &&
    typeof v.buildArgs === 'function' &&
    typeof v.streamFormat === 'string'
  )
}

export function isAgentAuthStatus(value: unknown): value is AgentAuthStatus {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.installed === 'boolean' &&
    typeof v.authed === 'boolean'
  )
}
