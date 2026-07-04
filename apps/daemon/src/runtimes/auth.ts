/**
 * Agent auth probing.
 *
 * Mirrors open-design runtimes/auth.ts (probeAgentAuthStatus + the generic
 * auth-failure text classifier). Adapters that declare `authProbe` get an
 * active, side-effect-free credential check (e.g. `claude auth status`,
 * `codex login status`); adapters without it are never probed — their
 * authStatus stays absent and is only inferred later from a real run failure.
 *
 * Classification rules (faithful to open-design):
 *
 *   - exit 0 + JSON `{loggedIn:true}`                     → ok
 *   - exit 0 + JSON `{loggedIn:false}`                    → missing (explicit)
 *   - exit 0 + non-JSON stdout                            → unknown (we
 *                                                            couldn't tell)
 *   - non-zero exit + auth-failure text on stdout/stderr  → missing
 *   - non-zero exit + no auth-failure signal              → unknown
 *   - ENOENT / EACCES during probe                        → unknown (the
 *                                                            binary vanished
 *                                                            between version
 *                                                            probe and auth)
 *   - timeout                                             → unknown
 *
 * The previous implementation collapsed every non-zero exit into `missing`,
 * which conflated real "not logged in" with timeout / network error / CLI
 * internal failure — surfacing an incorrect `auth-missing` diagnostic for
 * healthy-but-temporarily-unreachable CLIs. The text classifier is the
 * minimal agent-agnostic subset of open-design's regex bank; we don't ship
 * per-adapter bespoke classifiers (cursor / deepseek / antigravity) because
 * journal's P1 supports only claude / codex / opencode.
 */
import { execFile } from 'node:child_process'
import type { RuntimeAgentDef } from '@journal/contracts'

export interface AgentAuthProbeResult {
  status: 'ok' | 'missing' | 'unknown'
  message?: string
  stderrTail?: string
}

// Tail length kept compact so the diagnostic block stays readable.
const PROBE_TAIL_BYTES = 400

function tailString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.length > PROBE_TAIL_BYTES ? trimmed.slice(-PROBE_TAIL_BYTES) : trimmed
}

// Authentication / authorization: a missing, invalid, or expired credential.
// Ported from open-design auth.ts `AGENT_AUTH_FAILURE_RE` (agent-agnostic
// subset). Matched against the combined stdout + stderr of the probe child.
const AUTH_FAILURE_RE =
  /(\b(unauthor(?:ized|ised)|authenticat(?:e|ed|ion)|invalid[ _-]?(?:api[ _-]?)?key|incorrect api key|x-api-key|not (?:authenticated|logged[ _-]?in)|please (?:sign|log)[ _-]?in|oauth token (?:has )?expired|session expired|credentials? (?:are )?(?:missing|invalid|required))\b|\/login\b|status[ _-]?code[:=]?\s*401\b)/i

function isAuthFailureText(text: string): boolean {
  const value = String(text || '')
  if (!value.trim()) return false
  // A 0-exit JSON payload with `loggedIn:false` is authoritative "not logged
  // in" — handled separately at the parse site. Here we only score raw text.
  return AUTH_FAILURE_RE.test(value)
}

/**
 * Classify the probe's combined output. Returns `missing` only when the text
 * carries a real auth-failure signal; otherwise `null` so the caller falls
 * through to `unknown`. This is the load-bearing distinction: ambiguous
 * output must not be reported as a definitive "not logged in".
 */
function classifyAuthFailure(text: string): { status: 'missing' } | null {
  return isAuthFailureText(text) ? { status: 'missing' } : null
}

export async function probeAgentAuthStatus(
  def: RuntimeAgentDef,
  resolvedBin: string,
  env: NodeJS.ProcessEnv,
): Promise<AgentAuthProbeResult | null> {
  if (!def.authProbe) return null
  const args = def.authProbe.args
  const timeoutMs = def.authProbe.timeoutMs ?? 5000
  return new Promise((resolve) => {
    execFile(resolvedBin, args, { timeout: timeoutMs, env }, (err, stdout, stderr) => {
      const stdoutText = String(stdout ?? '')
      const stderrText = String(stderr ?? '')
      const stderrTail = tailString(stderrText)
      const combined = `${stdoutText}\n${stderrText}`

      // Exit 0 — parse JSON for an explicit loggedIn verdict.
      if (!err) {
        try {
          const parsed = JSON.parse(stdoutText || '{}') as Record<string, unknown>
          if (parsed.loggedIn === true) {
            resolve({ status: 'ok' })
            return
          }
          if (parsed.loggedIn === false) {
            // The CLI itself reports no credential. Authoritative missing.
            resolve({ status: 'missing', stderrTail })
            return
          }
          // Exit 0 but no loggedIn field — couldn't tell.
          resolve({ status: 'unknown', stderrTail })
          return
        } catch {
          // Non-JSON stdout on a 0-exit: the CLI speaks an unknown shape.
          // Fall back to the text classifier before giving up — claude's
          // prose-mode "Not authenticated" output lands here.
          const failure = classifyAuthFailure(combined)
          if (failure) {
            resolve({ status: 'missing', stderrTail })
            return
          }
          resolve({ status: 'unknown', stderrTail })
          return
        }
      }

      // Non-zero exit. OS-level rejections (ENOENT/EACCES) mean the binary
      // vanished between version and auth probe — definitely not "logged
      // out", so unknown.
      const code = (err as NodeJS.ErrnoException)?.code
      if (typeof code === 'string' && (code === 'ENOENT' || code === 'EACCES')) {
        resolve({ status: 'unknown', stderrTail })
        return
      }
      // Otherwise look at the actual output: real "not logged in" CLIs
      // (claude, codex) emit auth-failure text on stderr/stdout. If the
      // text carries that signal, it's a definitive missing; otherwise
      // (timeout, network error, CLI internal failure) it's unknown —
      // never silently claim the user is logged out.
      const failure = classifyAuthFailure(combined)
      if (failure) {
        resolve({ status: 'missing', stderrTail })
        return
      }
      resolve({ status: 'unknown', stderrTail })
    })
  })
}
