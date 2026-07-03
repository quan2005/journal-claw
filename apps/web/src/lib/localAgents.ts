/**
 * Local Agent detection API client.
 *
 * Thin fetch wrapper over the daemon's GET /agents surface, mirroring the
 * lib/agentRuns.ts pattern (direct daemon HTTP, not the runtimeClient invoke
 * switch — /agents is a pure detection read with no settings persistence).
 * Used by Settings → 本地 Agent 引擎 to list detected CLI adapters and to
 * power the "重新扫描" affordance.
 */
import type { AgentInfo, AgentsResponse } from '@journal/contracts'

const DEFAULT_BASE_URL = 'http://127.0.0.1:17510'

function baseUrl(): string {
  try {
    const ls =
      typeof localStorage !== 'undefined' ? localStorage.getItem('JOURNAL_DAEMON_URL') : null
    if (ls) return ls
  } catch {
    // ignore
  }
  return DEFAULT_BASE_URL
}

/**
 * List detected local agents. Pass `rescan: true` to bypass the daemon's
 * short-lived detection cache (the Settings "重新扫描" button).
 */
export async function listLocalAgents(rescan = false): Promise<AgentInfo[]> {
  const url = rescan ? `${baseUrl()}/agents?rescan=1` : `${baseUrl()}/agents`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`listLocalAgents failed: ${res.status}`)
  const body = (await res.json()) as AgentsResponse
  return body.agents ?? []
}
