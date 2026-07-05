/**
 * Executable resolution for agent detection.
 *
 * Mirrors open-design runtimes/executables.ts (resolveOnPath /
 * inspectAgentExecutableResolution / agentSearchDirs / agentBinEnvKey),
 * reimplemented without the `@open-design/platform` dependency (CLAUDE.md
 * Rule1: reuse, don't pull new third-party libs). The well-known user
 * toolchain dir list is a hand-rolled subset covering the install roots the
 * three supported CLIs (claude / codex / opencode) actually land in on macOS
 * and Linux: Homebrew, npm global prefixes, version-manager dirs, ~/.local/bin.
 */
import { accessSync, constants, existsSync, statSync } from 'node:fs'
import { delimiter } from 'node:path'
import path from 'node:path'
import { homedir } from 'node:os'
import { expandHomePath } from './paths.js'
import type { RuntimeAgentDef } from '@journal/contracts'

/**
 * The per-agent `*_BIN` environment variable that overrides PATH detection
 * (e.g. `claude` → `CLAUDE_BIN`). Drives the `setEnv` / `clearEnv` fix intents
 * and the `configured-bin-invalid` diagnostic reason.
 */
const AGENT_BIN_ENV_KEYS = new Map<string, string>([
  ['claude', 'CLAUDE_BIN'],
  ['codex', 'CODEX_BIN'],
  ['opencode', 'OPENCODE_BIN'],
])

export function agentBinEnvKey(agentId: string | undefined): string | null {
  if (!agentId) return null
  return AGENT_BIN_ENV_KEYS.get(agentId) ?? null
}

const TOOLCHAIN_DIR_CACHE_TTL_MS = 5000
let cachedToolchainHome: string | null = null
let cachedToolchainDirs: string[] | null = null
let cachedToolchainDirsAt = 0

/**
 * User-level CLI install directories beyond process.env.PATH: Homebrew
 * prefixes, npm global bin, version-manager dirs, ~/.local/bin, ~/.bun/bin.
 * GUI launchers (macOS .app bundles) start with a minimal PATH, so detection
 * must also walk these to match the user's shell-installed CLIs (especially
 * under nvm/fnm/volta). The list is intentionally conservative — only dirs
 * that actually exist on disk are kept, so a barebones machine doesn't pay
 * for probing ghosts.
 */
function userToolchainDirs(): string[] {
  const home = process.env.HOME || homedir()
  const now = Date.now()
  if (
    cachedToolchainHome === home &&
    cachedToolchainDirs &&
    now - cachedToolchainDirsAt < TOOLCHAIN_DIR_CACHE_TTL_MS
  ) {
    return cachedToolchainDirs
  }
  cachedToolchainHome = home
  cachedToolchainDirsAt = now

  const candidates: string[] = []
  const pushIfExists = (p: string | undefined): void => {
    if (!p) return
    const expanded = expandHomePath(p)
    if (expanded && existsSync(expanded)) candidates.push(expanded)
  }

  // System Homebrew / Linux system bins
  if (process.platform !== 'win32') {
    pushIfExists('/usr/local/bin')
    pushIfExists('/opt/homebrew/bin')
  }

  // User-local install roots
  pushIfExists('~/.local/bin')
  pushIfExists('~/bin')
  pushIfExists('~/.bun/bin')
  pushIfExists('~/.deno/bin')
  pushIfExists('~/.volta/bin')
  pushIfExists('~/.cargo/bin')

  // npm global prefix. `npm config get prefix` is async + spawns a process;
  // instead read the conventional locations. Two roots cover the vast
  // majority of installs: the npm-global symlink farm and its target.
  pushIfExists('~/.npm-global/bin')
  pushIfExists('~/.nvm/versions/node') // readdir-walked below

  // Node version managers: each installed node ships its own `bin`. We expand
  // the single-level child dirs (the version dirs) so a binary installed
  // under the active node resolves even when the manager's shim isn't on the
  // daemon's PATH.
  const nvmRoot = expandHomePath('~/.nvm/versions/node')
  if (nvmRoot && existsSync(nvmRoot)) {
    try {
      for (const child of readdirSafe(nvmRoot)) {
        pushIfExists(path.join(nvmRoot, child, 'bin'))
      }
    } catch {
      // ignore unreadable dirs
    }
  }
  const fnmRoot = expandHomePath('~/Library/Application Support/fnm/node-versions')
  if (fnmRoot && existsSync(fnmRoot)) {
    try {
      for (const child of readdirSafe(fnmRoot)) {
        pushIfExists(path.join(fnmRoot, child, 'installation', 'bin'))
      }
    } catch {
      // ignore
    }
  }

  cachedToolchainDirs = candidates
  return candidates
}

/**
 * The user-level toolchain bin directories that *resolution* searches beyond
 * process.env.PATH. Exposed so the spawn env (`launch.ts` →
 * `applyAgentLaunchEnv`) can append the same dirs to the child PATH:
 * a binary can resolve here yet fail to *execute* if its shebang interpreter
 * (e.g. `#!/usr/bin/env bun`) lives in one of these dirs and the spawn PATH
 * doesn't include it. Keeping resolution and spawn PATH symmetric fixes the
 * GUI-launched / minimal-PATH trap that otherwise marks a healthy CLI as
 * `shim-broken`. Mirrors open-design `userToolchainBinDirs`.
 */
export function userToolchainBinDirs(): string[] {
  return userToolchainDirs()
}

function readdirSafe(dir: string): string[] {
  try {
    // Lazy require so a missing fs API never breaks the module load.
    const { readdirSync } = require('node:fs') as typeof import('node:fs')
    return readdirSync(dir)
  } catch {
    return []
  }
}

function resolvePathDirs(): string[] {
  const seen = new Set<string>()
  const dirs = [...(process.env.PATH || '').split(delimiter), ...userToolchainDirs()]
  return dirs.filter((dir) => {
    if (!dir || seen.has(dir)) return false
    seen.add(dir)
    return true
  })
}

/**
 * The exact, de-duplicated directory list `resolveOnPath` walks. Surfaced so
 * detection can attach it to a `not-on-path` diagnostic verbatim — the UI
 * shows the user where we actually looked before asking them to set an
 * explicit binary path, instead of recomputing PATH client-side.
 */
export function agentSearchDirs(): string[] {
  return resolvePathDirs()
}

export function resolveOnPath(bin: string): string | null {
  const exts =
    process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : ['']
  const dirs = resolvePathDirs()
  for (const dir of dirs) {
    for (const ext of exts) {
      const full = path.join(dir, bin + ext)
      if (full && existsSync(full)) return full
    }
  }
  return null
}

function looksExecutableOnWindows(filePath: string): boolean {
  const ext = path.extname(filePath).trim().toUpperCase()
  if (!ext) return false
  const executableExts = (process.env.PATHEXT || '.EXE;.CMD;.BAT')
    .split(';')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
  return executableExts.includes(ext)
}

function executableFilePath(raw: string | undefined): string | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null
  const expanded = expandHomePath(raw.trim())
  if (!path.isAbsolute(expanded)) return null
  try {
    if (!statSync(expanded).isFile()) return null
    if (process.platform === 'win32') {
      if (!looksExecutableOnWindows(expanded)) return null
    } else {
      accessSync(expanded, constants.X_OK)
    }
    return expanded
  } catch {
    return null
  }
}

function configuredExecutableOverride(
  def: RuntimeAgentDef,
  configuredEnv: Record<string, string> = {},
): string | null {
  const envKey = AGENT_BIN_ENV_KEYS.get(def?.id)
  if (!envKey) return null
  return executableFilePath(configuredEnv?.[envKey])
}

export interface AgentExecutableResolution {
  configuredOverridePath: string | null
  pathResolvedPath: string | null
  selectedPath: string | null
}

/**
 * Resolve the first available binary for an agent definition. Tries
 * `def.bin` first, then walks `def.fallbackBins` in order. Returns the
 * inspection triple so diagnostics can distinguish a bad `*_BIN` override
 * (`configuredOverridePath` set, `selectedPath` from it) from a plain
 * not-on-path miss (both null). Precedence: explicit `*_BIN` override →
 * PATH-resolved (bin + fallbackBins).
 */
export function inspectAgentExecutableResolution(
  def: RuntimeAgentDef,
  configuredEnv: Record<string, string> = {},
): AgentExecutableResolution {
  if (!def?.bin) {
    return {
      configuredOverridePath: null,
      pathResolvedPath: null,
      selectedPath: null,
    }
  }
  const configuredOverridePath = configuredExecutableOverride(def, configuredEnv)
  const candidates = [def.bin, ...(Array.isArray(def.fallbackBins) ? def.fallbackBins : [])]
  let pathResolvedPath: string | null = null
  for (const bin of candidates) {
    const resolved = resolveOnPath(bin)
    if (resolved) {
      pathResolvedPath = resolved
      break
    }
  }
  return {
    configuredOverridePath,
    pathResolvedPath,
    selectedPath: configuredOverridePath || pathResolvedPath,
  }
}

export function resolveAgentExecutable(
  def: RuntimeAgentDef,
  configuredEnv: Record<string, string> = {},
): string | null {
  return inspectAgentExecutableResolution(def, configuredEnv).selectedPath
}

/** Test-only: invalidate the toolchain dir cache (home change / injected dirs). */
export function __resetToolchainDirCacheForTests(): void {
  cachedToolchainHome = null
  cachedToolchainDirs = null
  cachedToolchainDirsAt = 0
}
