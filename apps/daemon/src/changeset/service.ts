/**
 * ChangeSetService — records, persists, and reverts Agent file operations.
 *
 * Every create/edit/move/remove an Agent performs becomes a ChangeSet:
 *   { id, runId, path, operation, beforeHash, afterHash, diffPreview, risk,
 *     authorizationMode, status }
 *
 * remove/move stash the original in `<workspace>/.journal-trash/<id>/` so a
 * revert restores it without touching the system Trash. ChangeSets are kept
 * in-memory keyed by runId (v1); the JSONL run log already captures the
 * change_proposed/change events for replay.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, mkdirSync, renameSync, existsSync, type Dirent } from 'node:fs'
import { join, dirname, basename, resolve, relative } from 'node:path'
import type {
  AuthorizationMode,
  ChangeSet,
  ChangeSetOperation,
  ChangeSetRisk,
} from '@journal/contracts'
import { isPathAllowed } from './authorization.js'

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}

function hashFile(path: string): string | undefined {
  try {
    return sha256(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

/**
 * A snapshot of the workspace's tracked files (path -> content hash) at one
 * point in time. Two snapshots bracket an Agent run; diffing them yields the
 * real file changes the Agent performed — captured as ChangeSets without
 * intercepting CLI internals.
 */
export interface WorkspaceSnapshot {
  /** Map of workspace-relative path -> sha256 content hash. */
  readonly files: ReadonlyMap<string, string>
}

/** Paths the snapshotter always ignores (daemon-private / VCS metadata). */
const SNAPSHOT_IGNORE = new Set([
  '.journal',
  '.journal-trash',
  '.journal-daemon-data',
  '.git',
  'node_modules',
])

/** Minimal unified-diff-style preview: before/after content summary. */
function diffPreview(operation: ChangeSetOperation, before?: string, after?: string): string {
  const bl = before ? before.split('\n').length : 0
  const al = after ? after.split('\n').length : 0
  return `${operation}: ${bl} -> ${al} lines`
}

export class ChangeSetService {
  private readonly sets = new Map<string, ChangeSet[]>()

  constructor(private readonly workspaceRoot: string) {}

  recordChangeSet(input: {
    runId: string
    path: string
    operation: ChangeSetOperation
    mode: AuthorizationMode
    afterContent?: string
    risk?: ChangeSetRisk
  }): ChangeSet {
    const abs = resolve(this.workspaceRoot, input.path)
    const decision = isPathAllowed(input.mode, this.workspaceRoot, abs)
    const id = `cs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Authorization gate (G6/Phase 4): the decision is evaluated BEFORE any
    // filesystem mutation. Under read_only (or a workspace_write path escape)
    // we MUST NOT touch the disk — no stashing, no writing. We return a
    // structured 'blocked' record so the caller + UI can show what would have
    // happened and the user can approve an escalation.
    if (!decision.allowed) {
      const beforeHash = hashFile(abs)
      const afterHash = input.afterContent ? sha256(input.afterContent) : undefined
      const cs: ChangeSet = {
        id,
        runId: input.runId,
        path: input.path,
        operation: input.operation,
        beforeHash,
        afterHash,
        diffPreview: diffPreview(
          input.operation,
          beforeHash ? readBeforeForPreview(abs) : undefined,
          input.afterContent,
        ),
        risk: input.risk ?? 'low',
        authorizationMode: input.mode,
        status: 'blocked',
      }
      const list = this.sets.get(input.runId) ?? []
      list.push(cs)
      this.sets.set(input.runId, list)
      return cs
    }

    const beforeHash = hashFile(abs)
    let beforePath: string | undefined

    // For remove/move, stash the original in the recoverable trash BEFORE the
    // operation mutates the filesystem (the caller is expected to perform the
    // actual fs change after recordChangeSet returns; here we just snapshot).
    if ((input.operation === 'remove' || input.operation === 'move') && existsSync(abs)) {
      const trashDir = join(this.workspaceRoot, '.journal-trash', id)
      mkdirSync(trashDir, { recursive: true })
      const stashed = join(trashDir, basename(abs))
      renameSync(abs, stashed)
      beforePath = stashed
    }

    const afterHash = input.afterContent ? sha256(input.afterContent) : undefined
    const cs: ChangeSet = {
      id,
      runId: input.runId,
      path: input.path,
      operation: input.operation,
      beforeHash,
      afterHash,
      beforePath,
      diffPreview: diffPreview(
        input.operation,
        beforeHash ? readBeforeForPreview(beforePath ?? abs) : undefined,
        input.afterContent,
      ),
      risk: input.risk ?? 'low',
      authorizationMode: input.mode,
      status: 'applied',
    }

    const list = this.sets.get(input.runId) ?? []
    list.push(cs)
    this.sets.set(input.runId, list)
    return cs
  }

  listChangeSets(runId: string): ChangeSet[] {
    return this.sets.get(runId) ?? []
  }

  getChangeSet(id: string): ChangeSet | undefined {
    for (const list of this.sets.values()) {
      const found = list.find((c) => c.id === id)
      if (found) return found
    }
    return undefined
  }

  /** Revert a remove/move by restoring the stashed original. */
  revertChangeSet(id: string): ChangeSet | undefined {
    const cs = this.getChangeSet(id)
    if (!cs) return undefined
    if (cs.operation === 'remove' && cs.beforePath && existsSync(cs.beforePath)) {
      const target = resolve(this.workspaceRoot, cs.path)
      mkdirSync(dirname(target), { recursive: true })
      renameSync(cs.beforePath, target)
      cs.status = 'reverted'
    }
    return cs
  }

  // ── before/after workspace snapshots ────────────────────────────────────
  // A run's real file changes are observed by diffing two snapshots of the
  // workspace tree taken immediately before and after executeRun. This avoids
  // intercepting the Coding Agent CLI's internals: the daemon owns the
  // workspace boundary, so it can observe net effects. The diff is captured as
  // ChangeSets (create/edit/remove) tied to the run, respecting auth mode — a
  // read_only run produces no filesystem changes, so its diff is naturally
  // empty; under workspace_write only in-root changes are recorded.

  /** Take a content-hash snapshot of the workspace file tree (recursively). */
  snapshotWorkspace(): WorkspaceSnapshot {
    const files = new Map<string, string>()
    const root = resolve(this.workspaceRoot)
    const walk = (dir: string): void => {
      let entries: Dirent[]
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        const name = entry.name
        if (SNAPSHOT_IGNORE.has(name)) continue
        const full = join(dir, name)
        try {
          if (entry.isDirectory()) {
            walk(full)
          } else if (entry.isFile()) {
            const rel = relative(root, full)
            const h = hashFile(full)
            if (h) files.set(rel, h)
          }
        } catch {
          continue
        }
      }
    }
    walk(root)
    return { files }
  }

  /**
   * Diff a before/after snapshot pair and record each change as a ChangeSet
   * for `runId`. Returns the newly recorded ChangeSets.
   *
   * - file present after but not before      -> 'create'
   * - file present in both, hash changed     -> 'edit'
   * - file present before but not after      -> 'remove'
   *
   * Auth mode is honored: paths that would escape the workspace (or under
   * read_only) are recorded as 'blocked'. Since snapshots are confined to the
   * workspace root, the only blocked case in practice is read_only — the diff
   * is then empty because the CLI could not have written, but we still gate
   * each entry to keep the invariant explicit.
   */
  captureSnapshotDiff(
    runId: string,
    before: WorkspaceSnapshot,
    after: WorkspaceSnapshot,
    mode: AuthorizationMode,
  ): ChangeSet[] {
    const recorded: ChangeSet[] = []
    const allPaths = new Set<string>([...before.files.keys(), ...after.files.keys()])
    for (const rel of allPaths) {
      const beforeHash = before.files.get(rel)
      const afterHash = after.files.get(rel)
      if (beforeHash === afterHash) continue
      let operation: ChangeSetOperation
      let afterContent: string | undefined
      if (!beforeHash && afterHash) operation = 'create'
      else if (beforeHash && !afterHash) operation = 'remove'
      else operation = 'edit'
      if (operation !== 'remove') {
        try {
          afterContent = readFileSync(join(this.workspaceRoot, rel), 'utf8')
        } catch {
          afterContent = undefined
        }
      }
      recorded.push(
        this.recordChangeSet({
          runId,
          path: rel,
          operation,
          mode,
          afterContent,
        }),
      )
    }
    return recorded
  }
}

function readBeforeForPreview(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}
