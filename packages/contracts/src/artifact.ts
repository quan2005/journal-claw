/**
 * Artifact — first-class output of an Agent Run.
 *
 * Promotes the existing <artifact> stream tag into an independent, indexed
 * asset (G7). An Artifact is what the Agent produced: an article, outline,
 * report, summary, plan, todo list, index. It carries the run that produced
 * it so the evidence chain (Sources → Run → Artifact) is traceable.
 */
export type ArtifactType =
  | 'article'
  | 'outline'
  | 'report'
  | 'summary'
  | 'plan'
  | 'todo'
  | 'index'
  | 'card'
  | 'note'
  | string // forward-compatible with future types

export interface Artifact {
  id: string
  /** Run that produced this artifact (evidence chain). */
  runId: string
  /** Logical type (article/outline/report/...). */
  type: ArtifactType
  /** Human title from the <artifact title="..."> attribute. */
  title: string
  /** Full rendered content (markdown/text). */
  content: string
  /** Workspace-relative path if the artifact was persisted to a file. */
  path?: string
  /** Source runs/files cited as evidence (future: G6 source binding). */
  sourceRefs?: string[]
  createdAt: string
}

export function isArtifact(value: unknown): value is Artifact {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.runId === 'string' &&
    typeof v.type === 'string' &&
    typeof v.title === 'string' &&
    typeof v.content === 'string' &&
    typeof v.createdAt === 'string'
  )
}
