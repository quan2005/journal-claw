/**
 * Local Agent registry contract — detection / diagnostics / fix intents.
 *
 * Mirrors open-design packages/contracts/src/api/registry.ts (AgentInfo /
 * AgentDiagnostic / AgentFixIntent subset), trimmed to journal's P1 scope:
 * - `launchOAuth` intent omitted (journal has no daemon-side OAuth producer).
 * - `models` / `reasoningOptions` / `externalMcpInjection` / `supportsCustomModel`
 *   omitted (P2 conversation-surface concerns; P1 is detect+display only).
 *
 * The daemon's agent detection emits AgentInfo[] over GET /agents; the web
 * Settings → 本地 Agent 引擎 section renders each card from this shape.
 */

/**
 * A typed "what should the UI do to fix this" intent attached to an
 * {@link AgentDiagnostic}. The UI renders a button per intent and owns the
 * concrete handler (open a URL, re-run detection, prompt for a binary path).
 * Keeping the intent typed — rather than a pre-baked button label + URL —
 * means the Settings card and any future health-check surface render the
 * same fix affordances from one source of truth.
 */
export type AgentFixIntent =
  | { kind: 'openDocs' }
  | { kind: 'openInstall' }
  | { kind: 'rescan' }
  | { kind: 'setEnv'; envKey: string }
  | { kind: 'clearEnv'; envKey: string }

export type AgentDiagnosticReason =
  | 'not-on-path'
  | 'not-executable'
  | 'shim-broken'
  | 'configured-bin-invalid'
  | 'auth-missing'
  | 'auth-unknown'

export type AgentDiagnosticSeverity = 'error' | 'warning' | 'info'

export interface AgentDiagnostic {
  reason: AgentDiagnosticReason
  severity: AgentDiagnosticSeverity
  message: string
  detail?: string
  searchedDirs?: string[]
  fixActions?: AgentFixIntent[]
}

export interface AgentInfo {
  id: string
  name: string
  bin: string
  available: boolean
  authStatus?: 'ok' | 'missing' | 'unknown'
  authMessage?: string
  path?: string
  version?: string | null
  diagnostics?: AgentDiagnostic[]
  installUrl?: string
  docsUrl?: string
}

export interface AgentsResponse {
  agents: AgentInfo[]
}
