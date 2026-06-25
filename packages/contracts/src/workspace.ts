/**
 * WorkspaceMeta — the "Workspace" first-class object's metadata (G15).
 *
 * Promotes the workspace from "a folder path" to a context boundary: a named
 * scope for knowledge work (a project, topic, writing task, or research
 * question) with goals, active sources, and a type. This is what makes the
 * Agent operate within a coherent context rather than against an undifferentiated
 * directory tree.
 */
export type WorkspaceType = 'project' | 'topic' | 'writing' | 'research' | 'general'

export interface WorkspaceMeta {
  /** Workspace root path (absolute). */
  path: string
  /** Human-readable name for this context boundary. */
  name: string
  /** What kind of knowledge work this workspace is for. */
  type: WorkspaceType
  /** High-level goals the user is pursuing in this workspace. */
  goals: string[]
  /** Files/dirs the user has marked as active sources for this workspace. */
  activeSources: string[]
  /** Free-form description of the workspace's scope. */
  description?: string
  updatedAt: string
}

export function isWorkspaceMeta(value: unknown): value is WorkspaceMeta {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.path === 'string' &&
    typeof v.name === 'string' &&
    typeof v.type === 'string' &&
    Array.isArray(v.goals) &&
    Array.isArray(v.activeSources) &&
    typeof v.updatedAt === 'string'
  )
}
