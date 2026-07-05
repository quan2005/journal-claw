import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const isWindows = process.platform === 'win32'
import { mkdtempSync, writeFileSync, chmodSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectAgents, detectAgentsStream, __resetDetectionCacheForTests } from './detection.js'
import { registerAgentDef, __resetRegistryForTests } from './registry.js'
import { __resetToolchainDirCacheForTests } from './executables.js'
import type { RuntimeAgentDef, AgentInfo } from '@journal/contracts'

// Each case uses a unique bin name so the real dev machine's installed CLIs
// (claude/codex/opencode) never leak into detection results. PATH is pointed
// at a tmp dir holding the fixture scripts; HOME is untouched so the
// user-toolchain whitelist stays stable.
let tmpDir: string
let savedPath: string
let savedCodexBin: string | undefined
let savedHome: string | undefined

function makeBin(name: string, body: string, mode: number = 0o755): string {
  const p = join(tmpDir, name)
  writeFileSync(p, body, { mode })
  chmodSync(p, mode)
  return p
}

function stubDef(id: string, bin: string, extra: Partial<RuntimeAgentDef> = {}): RuntimeAgentDef {
  return {
    id,
    name: id,
    bin,
    version: { args: ['--version'], timeoutMs: 3000 },
    buildArgs: () => [],
    promptViaStdin: true,
    streamFormat: 'test',
    ...extra,
  }
}

async function detectOne(id: string): Promise<AgentInfo> {
  const all = await detectAgents({ forceRefresh: true })
  const found = all.find((a) => a.id === id)
  if (!found) throw new Error(`detection did not return agent ${id}`)
  return found
}

describe.sequential('agent detection', () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'journal-detect-'))
    savedPath = process.env.PATH ?? ''
    savedCodexBin = process.env.CODEX_BIN
    savedHome = process.env.HOME
    // Point PATH exclusively at the tmp dir so only our fixtures resolve.
    process.env.PATH = tmpDir
    __resetRegistryForTests()
    __resetToolchainDirCacheForTests()
    __resetDetectionCacheForTests()
  })

  afterEach(() => {
    process.env.PATH = savedPath
    if (savedCodexBin === undefined) delete process.env.CODEX_BIN
    else process.env.CODEX_BIN = savedCodexBin
    if (savedHome === undefined) delete process.env.HOME
    else process.env.HOME = savedHome
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('not-on-path: missing binary yields available:false + searchedDirs', async () => {
    registerAgentDef(stubDef('missing', 'journal-detect-no-such-bin'))
    const agent = await detectOne('missing')
    expect(agent.available).toBe(false)
    expect(agent.diagnostics).toHaveLength(1)
    expect(agent.diagnostics![0].reason).toBe('not-on-path')
    expect(agent.diagnostics![0].severity).toBe('error')
    expect(agent.diagnostics![0].searchedDirs?.length).toBeGreaterThan(0)
    // openInstall + rescan are always offered for not-on-path.
    const kinds = agent.diagnostics![0].fixActions!.map((a) => a.kind)
    expect(kinds).toContain('openInstall')
    expect(kinds).toContain('rescan')
    expect(agent.version).toBeUndefined()
    expect(agent.path).toBeUndefined()
  })

  it('configured-bin-invalid: *_BIN override pointing nowhere', async () => {
    // id 'codex' maps to CODEX_BIN in AGENT_BIN_ENV_KEYS, so detection reads
    // the override. The override path doesn't exist → configured-bin-invalid
    // (NOT not-on-path, because the user explicitly configured a bad path).
    process.env.CODEX_BIN = '/definitely/not/installed/anywhere/codex'
    registerAgentDef(stubDef('codex', 'journal-detect-not-present-codex'))
    const agent = await detectOne('codex')
    expect(agent.available).toBe(false)
    expect(agent.diagnostics![0].reason).toBe('configured-bin-invalid')
    expect(agent.diagnostics![0].detail).toBe(process.env.CODEX_BIN)
    const kinds = agent.diagnostics![0].fixActions!.map((a) => a.kind)
    expect(kinds).toContain('setEnv')
    expect(kinds).toContain('clearEnv')
    expect(kinds).toContain('rescan')
  })

  describe.skipIf(isWindows)('unix executable semantics', () => {
    it('available + version: healthy CLI resolves with path + version', async () => {
      makeBin('journal-detect-ok-bin', '#!/bin/sh\necho "1.2.3"\n')
      registerAgentDef(stubDef('ok', 'journal-detect-ok-bin'))
      const agent = await detectOne('ok')
      expect(agent.available).toBe(true)
      expect(agent.version).toBe('1.2.3')
      expect(agent.path).toBe(join(tmpDir, 'journal-detect-ok-bin'))
      expect(agent.diagnostics ?? []).toEqual([])
      expect(agent.authStatus).toBeUndefined()
    })

    it('toolchain PATH symmetry: shims resolved from user bins can find their interpreter', async () => {
      const home = join(tmpDir, 'home with space')
      const localBin = join(home, '.local', 'bin')
      mkdirSync(localBin, { recursive: true })
      process.env.HOME = home
      process.env.PATH = tmpDir
      __resetToolchainDirCacheForTests()

      const interpreter = join(localBin, 'journal-detect-interp')
      writeFileSync(interpreter, '#!/bin/sh\necho "7.7.7"\n', { mode: 0o755 })
      chmodSync(interpreter, 0o755)
      const agentBin = join(localBin, 'journal-detect-toolchain-bin')
      writeFileSync(agentBin, '#!/usr/bin/env journal-detect-interp\n', { mode: 0o755 })
      chmodSync(agentBin, 0o755)

      registerAgentDef(stubDef('toolchain', 'journal-detect-toolchain-bin'))
      const agent = await detectOne('toolchain')
      expect(agent.available).toBe(true)
      expect(agent.version).toBe('7.7.7')
      expect(agent.path).toBe(agentBin)
    })

    it('version parse failure still available: bad --version exit → available:true, version:null', async () => {
      // Exits non-zero (code 2) but the binary IS invocable — probe keeps the
      // agent available with version null rather than hiding it.
      makeBin('journal-detect-badver-bin', '#!/bin/sh\necho "oops" >&2\nexit 2\n')
      registerAgentDef(stubDef('badver', 'journal-detect-badver-bin'))
      const agent = await detectOne('badver')
      expect(agent.available).toBe(true)
      expect(agent.version).toBeNull()
    })

    it('auth-missing: installed but not authenticated surfaces auth-missing', async () => {
      // --version succeeds; `auth status` exits 1 with auth-failure text on
      // stderr — the real-world CLI signal for "not logged in". claude and
      // codex both emit such text; the auth classifier matches it as a
      // definitive missing. A non-zero exit *without* this text would fall
      // to auth-unknown instead (see auth-unknown test below).
      makeBin(
        'journal-detect-auth-bin',
        '#!/bin/sh\nif [ "$1" = "auth" ]; then echo "Not logged in. Run `cli login` to authenticate." >&2; exit 1; fi\necho "2.0.0"\n',
      )
      registerAgentDef(
        stubDef('authfail', 'journal-detect-auth-bin', {
          authProbe: { args: ['auth', 'status'], timeoutMs: 3000 },
        }),
      )
      const agent = await detectOne('authfail')
      expect(agent.available).toBe(true)
      expect(agent.version).toBe('2.0.0')
      expect(agent.authStatus).toBe('missing')
      expect(agent.diagnostics).toHaveLength(1)
      expect(agent.diagnostics![0].reason).toBe('auth-missing')
      expect(agent.diagnostics![0].severity).toBe('error')
      const kinds = agent.diagnostics![0].fixActions!.map((a) => a.kind)
      expect(kinds).toContain('openDocs')
      expect(kinds).toContain('rescan')
    })

    it('auth-unknown: non-zero exit without auth-failure text falls to auth-unknown', async () => {
      // `auth status` exits 1 with no recognizable auth signal — a CLI
      // internal failure, transient network error, or timeout must NOT be
      // misreported as "not logged in". The classifier returns unknown so
      // the UI surfaces a warning rather than a false auth-missing error.
      makeBin(
        'journal-detect-authunknown-bin',
        '#!/bin/sh\nif [ "$1" = "auth" ]; then echo "internal error: connection reset" >&2; exit 1; fi\necho "2.0.0"\n',
      )
      registerAgentDef(
        stubDef('authunknown', 'journal-detect-authunknown-bin', {
          authProbe: { args: ['auth', 'status'], timeoutMs: 3000 },
        }),
      )
      const agent = await detectOne('authunknown')
      expect(agent.available).toBe(true)
      expect(agent.authStatus).toBe('unknown')
      expect(agent.diagnostics).toHaveLength(1)
      expect(agent.diagnostics![0].reason).toBe('auth-unknown')
      expect(agent.diagnostics![0].severity).toBe('warning')
    })

    it('auth-ok: authenticated CLI has no auth diagnostic', async () => {
      makeBin(
        'journal-detect-authok-bin',
        '#!/bin/sh\nif [ "$1" = "auth" ]; then echo \'{"loggedIn":true}\'; exit 0; fi\necho "3.0.0"\n',
      )
      registerAgentDef(
        stubDef('authok', 'journal-detect-authok-bin', {
          authProbe: { args: ['auth', 'status'], timeoutMs: 3000 },
        }),
      )
      const agent = await detectOne('authok')
      expect(agent.available).toBe(true)
      expect(agent.authStatus).toBe('ok')
      expect(agent.diagnostics ?? []).toEqual([])
    })

    it('not-executable: file present without +x → not-executable diagnostic', async () => {
      // resolveOnPath selects the file (existsSync only); execFile then fails
      // with EACCES because the execute bit is missing.
      makeBin('journal-detect-noexec-bin', '#!/bin/sh\necho "1.0"\n', 0o644)
      registerAgentDef(stubDef('noexec', 'journal-detect-noexec-bin'))
      const agent = await detectOne('noexec')
      expect(agent.available).toBe(false)
      expect(agent.diagnostics![0].reason).toBe('not-executable')
      expect(agent.diagnostics![0].severity).toBe('error')
    })

    it('shim-broken: shebang targets missing interpreter → shim-broken', async () => {
      // env cannot find the interpreter → exit 127 → missing-target.
      makeBin(
        'journal-detect-shim-bin',
        '#!/usr/bin/env journal-detect-no-such-interpreter\necho "1.0"\n',
      )
      registerAgentDef(stubDef('shim', 'journal-detect-shim-bin'))
      const agent = await detectOne('shim')
      expect(agent.available).toBe(false)
      expect(agent.diagnostics![0].reason).toBe('shim-broken')
      const kinds = agent.diagnostics![0].fixActions!.map((a) => a.kind)
      expect(kinds).toContain('openDocs')
    })

    it('configured *_BIN override pointing at a valid executable is used', async () => {
      // CODEX_BIN points at a real script on disk; detection must use it even
      // though the registry bin name doesn't exist on PATH.
      const overridePath = makeBin('my-codex-build', '#!/bin/sh\necho "9.9.9"\n')
      process.env.CODEX_BIN = overridePath
      registerAgentDef(stubDef('codex', 'journal-detect-codex-override'))
      const agent = await detectOne('codex')
      expect(agent.available).toBe(true)
      expect(agent.version).toBe('9.9.9')
      expect(agent.path).toBe(overridePath)
    })

    it('fault isolation: one throwing adapter does not collapse the batch', async () => {
      // A def with a version probe that resolves but whose fixture exits 126
      // alongside a healthy adapter — both must produce a result. Built-ins
      // (claude/codex/opencode) also appear because listAgentDefs re-registers
      // them; we only assert our two adapters landed.
      makeBin('journal-detect-ok2-bin', '#!/bin/sh\necho "1.0"\n')
      registerAgentDef(stubDef('ok2', 'journal-detect-ok2-bin'))
      registerAgentDef(stubDef('missing', 'journal-detect-also-missing'))
      const all = await detectAgents({ forceRefresh: true })
      expect(all.find((a) => a.id === 'ok2')?.available).toBe(true)
      expect(all.find((a) => a.id === 'missing')?.available).toBe(false)
    })

    it('cache: repeated detect without forceRefresh returns cached result', async () => {
      makeBin('journal-detect-cache-bin', '#!/bin/sh\necho "1.0"\n')
      registerAgentDef(stubDef('cache', 'journal-detect-cache-bin'))
      const first = await detectAgents({ forceRefresh: true })
      expect(first.find((a) => a.id === 'cache')?.available).toBe(true)
      // Remove the binary; without cache bypass, detection must still report
      // the cached available state.
      rmSync(join(tmpDir, 'journal-detect-cache-bin'), { force: true })
      const cached = await detectAgents()
      expect(cached.find((a) => a.id === 'cache')?.available).toBe(true)
      // forceRefresh re-probes and now sees the missing binary.
      const refreshed = await detectAgents({ forceRefresh: true })
      expect(refreshed.find((a) => a.id === 'cache')?.available).toBe(false)
    })

    it('streaming variant yields every agent exactly once in some order', async () => {
      makeBin('journal-detect-s1-bin', '#!/bin/sh\necho "1.0"\n')
      makeBin('journal-detect-s2-bin', '#!/bin/sh\necho "2.0"\n')
      registerAgentDef(stubDef('s1', 'journal-detect-s1-bin'))
      registerAgentDef(stubDef('s2', 'journal-detect-s2-bin'))
      const seen: string[] = []
      for await (const agent of detectAgentsStream({ forceRefresh: true })) {
        seen.push(agent.id)
      }
      // Built-ins also stream by; assert ours are present exactly once each.
      expect(seen.filter((id) => id === 's1')).toHaveLength(1)
      expect(seen.filter((id) => id === 's2')).toHaveLength(1)
    })
  })
})
