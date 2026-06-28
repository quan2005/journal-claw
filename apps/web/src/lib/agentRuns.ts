/**
 * Daemon AgentRun API client.
 *
 * Thin fetch wrapper over the daemon's /runs surface. Used by the Agent Run
 * panel (G12) to create a run, subscribe to its event stream, and list its
 * recorded file changes. Transport-agnostic in spirit: this always hits the
 * daemon HTTP/SSE surface (the runtime flag decides whether the *chat* path
 * uses Tauri or daemon; the Run panel is daemon-native).
 */
import type { AgentRun, AgentRunEvent, AuthorizationMode, ChangeSet, Artifact, MemoryRecord, SourceBinding, RunEngine } from '../types/agentRun'

const DEFAULT_BASE_URL = 'http://127.0.0.1:17510'

function baseUrl(): string {
  try {
    const ls = typeof localStorage !== 'undefined' ? localStorage.getItem('JOURNAL_DAEMON_URL') : null
    if (ls) return ls
  } catch {
    // ignore
  }
  return DEFAULT_BASE_URL
}

export interface CreateRunInput {
  goal: string
  mode?: 'chat' | 'agent' | 'observe'
  /** Backend engine: `builtin` (pi) or `cli` (external agent). Defaults to `cli`. */
  engine?: RunEngine
  agentId?: string
  prompt?: string
  model?: string
  authorizationMode?: AuthorizationMode
}

export async function createRun(input: CreateRunInput): Promise<AgentRun> {
  const engine: RunEngine = input.engine === 'builtin' ? 'builtin' : 'cli'
  const res = await fetch(`${baseUrl()}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: input.goal,
      mode: input.mode ?? 'agent',
      engine,
      agentId: input.agentId ?? 'claude',
      prompt: input.prompt ?? input.goal,
      model: input.model,
      authorizationMode: input.authorizationMode,
    }),
  })
  if (!res.ok) throw new Error(`createRun failed: ${res.status}`)
  return (await res.json()) as AgentRun
}

export async function listChangeSets(runId: string): Promise<ChangeSet[]> {
  const res = await fetch(`${baseUrl()}/runs/${encodeURIComponent(runId)}/changesets`)
  if (!res.ok) throw new Error(`listChangeSets failed: ${res.status}`)
  const body = (await res.json()) as { changeSets: ChangeSet[] }
  return body.changeSets
}

/**
 * Subscribe to a run's SSE event stream. Returns an unsubscribe function.
 * Each parsed `data:` line is fed to onEvent.
 */
export function subscribeRunEvents(runId: string, onEvent: (event: AgentRunEvent) => void): () => void {
  const es = new EventSource(`${baseUrl()}/runs/${encodeURIComponent(runId)}/events`)
  es.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as AgentRunEvent)
    } catch {
      // ignore malformed frames
    }
  }
  return () => es.close()
}

export async function listArtifacts(runId: string): Promise<Artifact[]> {
  const res = await fetch(`${baseUrl()}/runs/${encodeURIComponent(runId)}/artifacts`)
  if (!res.ok) throw new Error(`listArtifacts failed: ${res.status}`)
  const body = (await res.json()) as { artifacts: Artifact[] }
  return body.artifacts
}

export async function listMemory(runId: string): Promise<MemoryRecord[]> {
  const res = await fetch(`${baseUrl()}/runs/${encodeURIComponent(runId)}/memory`)
  if (!res.ok) throw new Error(`listMemory failed: ${res.status}`)
  const body = (await res.json()) as { memory: MemoryRecord[] }
  return body.memory
}

export async function listSources(runId: string): Promise<SourceBinding[]> {
  const res = await fetch(`${baseUrl()}/runs/${encodeURIComponent(runId)}/sources`)
  if (!res.ok) throw new Error(`listSources failed: ${res.status}`)
  const body = (await res.json()) as { sources: SourceBinding[] }
  return body.sources
}
