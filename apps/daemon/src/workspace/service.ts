/**
 * WorkspaceService — manages Workspace metadata (G15).
 *
 * The workspace is no longer just a folder path; it's a context boundary with
 * a name, type, goals, and active sources. This service reads/writes the
 * metadata to `<workspaceRoot>/.journal/workspace.json` so it persists with
 * the workspace and is portable.
 *
 * The metadata feeds the Agent's context assembly: when a run starts, the
 * workspace's goals + active sources shape what the Agent pays attention to,
 * making the core loop's "Agent 组装上下文" step real.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import type { WorkspaceMeta, WorkspaceType } from '@journal/contracts'

const META_FILE = '.journal/workspace.json'

export class WorkspaceService {
  constructor(private readonly workspaceRoot: string) {}

  /** Read workspace metadata, deriving sensible defaults if absent. */
  getMeta(): WorkspaceMeta {
    const metaPath = join(this.workspaceRoot, META_FILE)
    if (existsSync(metaPath)) {
      try {
        const raw = JSON.parse(readFileSync(metaPath, 'utf8')) as Partial<WorkspaceMeta>
        return normalize(this.workspaceRoot, raw)
      } catch {
        // fall through to defaults
      }
    }
    return defaultMeta(this.workspaceRoot)
  }

  /** Update workspace metadata (partial — merges with existing). */
  updateMeta(patch: Partial<Omit<WorkspaceMeta, 'path' | 'updatedAt'>>): WorkspaceMeta {
    const current = this.getMeta()
    const next: WorkspaceMeta = {
      ...current,
      ...patch,
      path: this.workspaceRoot,
      updatedAt: new Date().toISOString(),
    }
    this.persist(next)
    return next
  }

  /** Add a goal to the workspace. */
  addGoal(goal: string): WorkspaceMeta {
    const meta = this.getMeta()
    if (!goal.trim() || meta.goals.includes(goal.trim())) return meta
    return this.updateMeta({ goals: [...meta.goals, goal.trim()] })
  }

  /** Mark a file/dir as an active source. */
  addActiveSource(source: string): WorkspaceMeta {
    const meta = this.getMeta()
    if (!source.trim() || meta.activeSources.includes(source.trim())) return meta
    return this.updateMeta({ activeSources: [...meta.activeSources, source.trim()] })
  }

  private persist(meta: WorkspaceMeta): void {
    const dir = join(this.workspaceRoot, '.journal')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'workspace.json'), JSON.stringify(meta, null, 2), 'utf8')
  }
}

function normalize(root: string, raw: Partial<WorkspaceMeta>): WorkspaceMeta {
  return {
    path: root,
    name: typeof raw.name === 'string' && raw.name ? raw.name : basename(root),
    type: (raw.type as WorkspaceType) ?? 'general',
    goals: Array.isArray(raw.goals) ? raw.goals.filter((g) => typeof g === 'string') : [],
    activeSources: Array.isArray(raw.activeSources)
      ? raw.activeSources.filter((s) => typeof s === 'string')
      : [],
    description: typeof raw.description === 'string' ? raw.description : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  }
}

function defaultMeta(root: string): WorkspaceMeta {
  return {
    path: root,
    name: basename(root),
    type: 'general',
    goals: [],
    activeSources: [],
    updatedAt: new Date().toISOString(),
  }
}
