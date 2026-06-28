/**
 * Launch path + env resolution shared by detection probe AND runtime spawn.
 *
 * Mirrors open-design runtimes/launch.ts (resolveAgentLaunch /
 * applyAgentLaunchEnv), trimmed to journal's P1 scope: we do not yet ship
 * the Codex native-binary upgrade, only the PATH-symmetry guarantees the
 * detection/spawn layers need to agree on. The load-bearing invariant is
 * that *both* layers — version/auth probe in detection.ts and the long-lived
 * spawn in runner.ts — reach the same `launchPath` and build the child
 * `PATH` from the same rules. Without that symmetry the resolver can find a
 * CLI shim under `~/.local/bin` while the probe/run child PATH doesn't
 * include that dir, so a `#!/usr/bin/env <interp>` wrapper fails to find
 * its interpreter and the agent is wrongly marked `shim-broken` even though
 * a real run would succeed.
 */
import path, { delimiter } from 'node:path'
import {
  inspectAgentExecutableResolution,
  type AgentExecutableResolution,
  userToolchainBinDirs,
} from './executables.js'
import type { RuntimeAgentDef } from '@journal/contracts'

export interface AgentLaunchResolution extends AgentExecutableResolution {
  /** Path to actually spawn (may differ from selectedPath in future upgrades). */
  launchPath: string | null
  /** Directories to prepend to the child PATH so the resolved binary's
   *  shebang interpreter and any sibling shims resolve at spawn time. */
  childPathPrepend: string[]
}

/**
 * Resolve the executable to launch from a def + per-agent configuredEnv.
 * Today `launchPath` mirrors `selectedPath`; the indirection is preserved
 * from open-design so a future native-binary upgrade (Codex Rust binary,
 * OpenCode companion, …) drops in here without touching every call site.
 */
export function resolveAgentLaunch(
  def: RuntimeAgentDef,
  configuredEnv: Record<string, string> = {},
): AgentLaunchResolution {
  const resolution = inspectAgentExecutableResolution(def, configuredEnv)
  if (!resolution.selectedPath) {
    return {
      ...resolution,
      launchPath: null,
      childPathPrepend: [],
    }
  }
  // The wrapper directory is prepended so shims that look up sibling tools
  // (node, bun, …) relative to themselves resolve consistently. Only
  // absolute resolved paths contribute — relative entries would pollute
  // PATH without a clear anchor.
  const childPathPrepend = path.isAbsolute(resolution.selectedPath)
    ? [path.dirname(resolution.selectedPath)]
    : []
  return {
    ...resolution,
    launchPath: resolution.selectedPath,
    childPathPrepend,
  }
}

/**
 * Build the child spawn env by merging `nodeBinDir` (so npm `.cmd` shims that
 * invoke bare `node` find the correct binary even when the daemon was
 * GUI-launched without a nodejs entry on PATH), `launch.childPathPrepend`
 * (the resolved binary's own directory) and the user toolchain dirs (appended
 * so a resolved binary's shebang interpreter is findable at spawn time even
 * under a minimal GUI PATH). Mirrors open-design `applyAgentLaunchEnv` with
 * the test-injected append list overridable for determinism.
 */
export function applyAgentLaunchEnv(
  env: NodeJS.ProcessEnv,
  launch: Pick<AgentLaunchResolution, 'childPathPrepend'>,
  nodeBinDir: string = path.dirname(process.execPath),
  appendPathDirs: string[] = userToolchainBinDirs(),
): NodeJS.ProcessEnv {
  const toPrepend = [...(nodeBinDir ? [nodeBinDir] : []), ...launch.childPathPrepend]
  if (toPrepend.length === 0 && appendPathDirs.length === 0) return env
  // Case-insensitive key lookup — Windows uses 'Path', not 'PATH'. Using
  // env.PATH directly would be undefined on Windows, yielding a one-entry
  // PATH and discarding all system paths.
  const pathKey =
    Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH'
  const existing = typeof env[pathKey] === 'string' ? (env[pathKey] as string) : ''
  const normalize = (p: string): string => {
    const trimmed = p.replace(/[/\\]+$/, '')
    return process.platform === 'win32' ? trimmed.toLowerCase() : trimmed
  }
  const existingParts = existing.split(delimiter).filter((e) => e.length > 0)
  const seen = new Set<string>()
  const merged: string[] = []
  for (const entry of [...toPrepend, ...existingParts, ...appendPathDirs]) {
    const n = normalize(entry)
    if (!seen.has(n)) {
      seen.add(n)
      merged.push(entry)
    }
  }
  return { ...env, [pathKey]: merged.join(delimiter) }
}
