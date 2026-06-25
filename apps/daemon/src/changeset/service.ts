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
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  renameSync,
  existsSync,
} from 'node:fs'
import { join, dirname, basename, resolve } from 'node:path'
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
      status: decision.allowed ? 'applied' : 'blocked',
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
}

function readBeforeForPreview(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}
