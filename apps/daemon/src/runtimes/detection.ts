/**
 * Agent detection — the core probe pipeline.
 *
 * Mirrors open-design runtimes/detection.ts (detectAgents /
 * detectAgentsStream / probe / safeProbe / probeVersionAtPath). The pipeline
 * per adapter:
 *
 *   1. Resolve the executable (configured `*_BIN` override → bin + fallbackBins
 *      on PATH + well-known toolchain dirs) via `resolveAgentLaunch`, which
 *      also yields the directories we must guarantee are on the child PATH.
 *      No resolution → `not-on-path` or `configured-bin-invalid` diagnostic,
 *      agent marked unavailable.
 *   2. Spawn `<bin> <version.args>` with `applyAgentLaunchEnv`-augmented env
 *      and classify the outcome:
 *        - spawned (exit 0, any stdout)        → available; version = first line
 *        - EACCES / exit 126                   → `not-executable`
 *        - ENOENT / ENOTDIR / exit 127         → `shim-broken`
 *        - any other rejection (timeout, non-zero exit, stderr noise)
 *                                              → spawned-but-unreadable-version
 *                                                (available: true, version: null)
 *   3. For adapters that declare `authProbe`, run it and attach an
 *      `auth-missing` / `auth-unknown` diagnostic when the probe says so.
 *
 * `safeProbe` isolates faults: one adapter throwing must not collapse the
 * whole picker (open-design issue #2297). The streaming variant yields each
 * agent the moment its probe settles so the UI can paint cards incrementally.
 *
 * PATH symmetry: detection's probe child and the runtime spawn in `runner.ts`
 * share `resolveAgentLaunch` + `applyAgentLaunchEnv`, so a binary that
 * resolves under a toolchain dir also finds its shebang interpreter when we
 * actually invoke it. Without this a GUI-launched daemon with a stripped
 * PATH would resolve a `~/.local/bin/foo` shim but fail to execute its
 * `#!/usr/bin/env node` line, marking a healthy CLI as `shim-broken`.
 */
import { execFile } from 'node:child_process'
import type { AgentDiagnostic, AgentInfo, RuntimeAgentDef } from '@journal/contracts'
import { agentBinEnvKey } from './executables.js'
import {
  buildAuthDiagnostic,
  buildExecutableDiagnostic,
  buildNotInvocableDiagnostic,
  type NotInvocableCause,
} from './diagnostics.js'
import { probeAgentAuthStatus } from './auth.js'
import { listAgentDefs } from './registry.js'
import { applyAgentLaunchEnv, resolveAgentLaunch } from './launch.js'

type VersionProbeOutcome =
  | { kind: 'not-invocable'; cause: NotInvocableCause; launchPath: string | null }
  | { kind: 'spawned'; version: string | null }

/**
 * Run the agent's version probe and classify the result. See module docstring
 * for the failure-mode taxonomy. `child_process.execFile` reports OS-level
 * rejections with a string `err.code` (`'ENOENT'`, `'EACCES'`, `'ENOTDIR'`)
 * and non-zero exit codes with a *numeric* `err.code` equal to the exit
 * status, so the two arms below are unambiguous.
 */
function probeVersionAtPath(
  def: RuntimeAgentDef,
  resolved: string,
  env: NodeJS.ProcessEnv,
): Promise<VersionProbeOutcome> {
  return new Promise((resolve) => {
    execFile(
      resolved,
      def.version.args,
      { timeout: def.version.timeoutMs ?? 5000, env },
      (err, stdout) => {
        if (err) {
          const code = (err as NodeJS.ErrnoException)?.code
          if (typeof code === 'string') {
            if (code === 'EACCES') {
              resolve({ kind: 'not-invocable', cause: 'not-executable', launchPath: resolved })
              return
            }
            if (code === 'ENOENT' || code === 'ENOTDIR') {
              resolve({ kind: 'not-invocable', cause: 'missing-target', launchPath: resolved })
              return
            }
          } else if (typeof code === 'number' && (code === 126 || code === 127)) {
            resolve({
              kind: 'not-invocable',
              cause: code === 126 ? 'not-executable' : 'missing-target',
              launchPath: resolved,
            })
            return
          }
          // Spawned but `--version` was unhappy (timeout / non-zero exit /
          // stderr noise). The CLI is invocable; we just can't read a version.
          resolve({ kind: 'spawned', version: null })
          return
        }
        const version = String(stdout).trim().split('\n')[0] || null
        resolve({ kind: 'spawned', version })
      },
    )
  })
}

/**
 * Pick exactly the AgentInfo contract fields from a def — and ONLY those.
 * The AgentInfo public contract (packages/contracts/src/registry.ts) is the
 * whitelist; any internal field that accidentally survives spread (`...def`)
 * would leak spawn/runtime metadata (`fallbackBins`, `promptViaStdin`,
 * `streamFormat`, `buildArgs`, `version` probe config, `authProbe` config,
 * `promptInputFormat`, `fallbackModels`) into the API response. Building the
 * base shape explicitly from a known list closes that hole permanently — a
 * new internal field on RuntimeAgentDef no longer auto-bleeds into /agents.
 */
function agentInfoBase(
  def: RuntimeAgentDef,
): Pick<AgentInfo, 'id' | 'name' | 'bin' | 'installUrl' | 'docsUrl'> {
  const base: Pick<AgentInfo, 'id' | 'name' | 'bin' | 'installUrl' | 'docsUrl'> = {
    id: def.id,
    name: def.name,
    bin: def.bin,
  }
  if (def.installUrl) base.installUrl = def.installUrl
  if (def.docsUrl) base.docsUrl = def.docsUrl
  return base
}

function unavailableAgent(def: RuntimeAgentDef, diagnostics: AgentDiagnostic[] = []): AgentInfo {
  return {
    ...agentInfoBase(def),
    available: false,
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
  }
}

async function probe(
  def: RuntimeAgentDef,
  configuredEnv: Record<string, string> = {},
): Promise<AgentInfo> {
  const launch = resolveAgentLaunch(def, configuredEnv)
  if (!launch.selectedPath || !launch.launchPath) {
    return unavailableAgent(def, [buildExecutableDiagnostic(def, configuredEnv)])
  }
  const probeEnv = applyAgentLaunchEnv({ ...process.env, ...configuredEnv }, launch)
  const outcome = await probeVersionAtPath(def, launch.launchPath, probeEnv)
  if (outcome.kind === 'not-invocable') {
    return unavailableAgent(def, [
      buildNotInvocableDiagnostic(def, outcome.launchPath, outcome.cause),
    ])
  }
  // Auth probe runs only for adapters that declare one; the version probe
  // must finish first (it gates availability), but auth is an independent
  // read on top of an already-healthy binary.
  const auth = await probeAgentAuthStatus(def, launch.launchPath, probeEnv)
  const authDiagnostic = auth ? buildAuthDiagnostic(def, auth) : null
  const info: AgentInfo = {
    ...agentInfoBase(def),
    available: true,
    path: launch.selectedPath,
    version: outcome.version,
    ...(auth
      ? {
          authStatus: auth.status,
          ...(auth.message ? { authMessage: auth.message } : {}),
        }
      : {}),
    ...(authDiagnostic ? { diagnostics: [authDiagnostic] } : {}),
  }
  return info
}

/**
 * Fault-isolated probe: if anything throws (synchronous fs throw during PATH
 * walking, async rejection from a post-launch probe), the adapter degrades to
 * a plain unavailable card instead of collapsing the whole Promise.all.
 */
async function safeProbe(
  def: RuntimeAgentDef,
  configuredEnv: Record<string, string> = {},
): Promise<AgentInfo> {
  try {
    return await probe(def, configuredEnv)
  } catch {
    return unavailableAgent(def)
  }
}

/**
 * Per-agent configured env read from process.env at detect time. The `*_BIN`
 * override is the only configuredEnv detection consults today; future
 * per-agent env (model pins, etc.) extends here.
 */
function configuredEnvForAgent(agentId: string): Record<string, string> {
  const env: Record<string, string> = {}
  const binKey = agentBinEnvKey(agentId)
  if (binKey && typeof process.env[binKey] === 'string' && process.env[binKey]) {
    env[binKey] = process.env[binKey] as string
  }
  return env
}

/** Detect options. `forceRefresh` bypasses the short-lived result cache. */
export interface DetectAgentsOptions {
  forceRefresh?: boolean
}

// Short-lived result cache so the Settings UI's initial mount + immediate
// rescan don't double-spawn every CLI. TTL matches open-design's read pattern:
// a rescan (forceRefresh) always bypasses it.
const CACHE_TTL_MS = 5000
let cachedAt = 0
let cachedResults: AgentInfo[] | null = null

/**
 * Probe every registered adapter concurrently and return the full AgentInfo[]
 * in registry order. Mirrors open-design detectAgents(): one adapter's probe
 * blowing up never collapses the result (safeProbe isolates it).
 */
export async function detectAgents(options: DetectAgentsOptions = {}): Promise<AgentInfo[]> {
  if (!options.forceRefresh && cachedResults && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedResults
  }
  const defs = listAgentDefs()
  const results = await Promise.all(
    defs.map((def) => safeProbe(def, configuredEnvForAgent(def.id))),
  )
  cachedResults = results
  cachedAt = Date.now()
  return results
}

/**
 * Streaming variant: yields each agent the moment its probe settles, in
 * completion order rather than registry order, so the UI can paint a card as
 * soon as it resolves instead of waiting for the slowest CLI.
 */
export async function* detectAgentsStream(
  options: DetectAgentsOptions = {},
): AsyncGenerator<AgentInfo> {
  // Streaming always probes fresh; callers that want the cache use detectAgents.
  void options
  const defs = listAgentDefs()
  const tagged = defs.map((def) =>
    safeProbe(def, configuredEnvForAgent(def.id)).then((agent) => ({ agent })),
  )
  const pending = new Set(tagged)
  while (pending.size > 0) {
    const settled = await Promise.race([...pending].map((p) => p.then((r) => ({ r, p }))))
    pending.delete(settled.p)
    yield settled.r.agent
  }
}

/** Test-only: invalidate the result cache between unit cases. */
export function __resetDetectionCacheForTests(): void {
  cachedAt = 0
  cachedResults = null
}
