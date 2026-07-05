/**
 * ArtifactIndexService — indexes Agent-produced Artifacts (G7).
 *
 * Records artifacts keyed by id, queryable by runId / type / free text.
 * In-memory v1 (the run JSONL already logs artifact_created events for
 * replay). This is the "Artifacts" first-class object's service layer: the
 * Agent's outputs become independent, traceable assets instead of ephemeral
 * chat-stream tags.
 *
 * captureFromRun() scans a run's accumulated assistant text for <artifact>
 * tags (reusing the same tag shape the frontend parser understands) and
 * indexes each as an Artifact — bridging the stream tag to a first-class
 * object.
 */
import { randomUUID } from 'node:crypto'
import type { Artifact, ArtifactType } from '@journal/contracts'

const ARTIFACT_OPEN = /<artifact(?:\s+type="([^"]*)")?(?:\s+title="([^"]*)")?[^>]*>/i
const ARTIFACT_CLOSE = /<\/artifact>/i

export interface RecordArtifactInput {
  runId: string
  type: ArtifactType
  title: string
  content: string
  path?: string
  sourceRefs?: string[]
}

export class ArtifactIndexService {
  private readonly byId = new Map<string, Artifact>()
  private readonly byRun = new Map<string, string[]>()

  recordArtifact(input: RecordArtifactInput): Artifact {
    const id = `art-${randomUUID()}`
    const artifact: Artifact = {
      id,
      runId: input.runId,
      type: input.type,
      title: input.title,
      content: input.content,
      path: input.path,
      sourceRefs: input.sourceRefs,
      createdAt: new Date().toISOString(),
    }
    this.byId.set(id, artifact)
    const list = this.byRun.get(input.runId) ?? []
    list.push(id)
    this.byRun.set(input.runId, list)
    return artifact
  }

  getArtifact(id: string): Artifact | null {
    return this.byId.get(id) ?? null
  }

  listByRun(runId: string): Artifact[] {
    return (this.byRun.get(runId) ?? []).map((id) => this.byId.get(id)!).filter(Boolean)
  }

  listByType(type: string): Artifact[] {
    return [...this.byId.values()].filter((a) => a.type === type)
  }

  listAll(): Artifact[] {
    return [...this.byId.values()]
  }

  /**
   * Scan accumulated assistant text for <artifact> tags and index each.
   * Returns the newly recorded artifacts. Re-scanning the same text is
   * idempotent-ish (produces new ids) — callers should pass incremental or
   * final text deliberately.
   */
  captureFromRun(runId: string, text: string): Artifact[] {
    const recorded: Artifact[] = []
    let cursor = 0
    while (cursor < text.length) {
      const open = ARTIFACT_OPEN.exec(text.slice(cursor))
      if (!open) break
      const start = cursor + open.index + open[0].length
      const rest = text.slice(start)
      const close = ARTIFACT_CLOSE.exec(rest)
      const content = close ? rest.slice(0, close.index) : rest
      recorded.push(
        this.recordArtifact({
          runId,
          type: (open[1] || 'note') as ArtifactType,
          title: open[2] || 'Untitled',
          content: content.trim(),
        }),
      )
      cursor = start + (close ? close.index + close[0].length : rest.length)
    }
    return recorded
  }
}
