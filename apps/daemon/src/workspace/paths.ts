/**
 * Centralized workspace disk-layout contract.
 *
 * The workspace root belongs to the user; everything daemon-private lives
 * under `.journal/`. These helpers are the single source of truth for
 * system-managed paths so service code never hard-codes them again.
 *
 * Layout (see `docs/final-state.md` §0.2):
 *
 *   <workspace>/
 *     （用户区：所有非 dot 开头内容，UI 全展示）
 *     .journal/
 *       workspace.json         ← layoutVersion marks migration completion
 *       runs/                  ← run summaries (sediment)
 *       memory/YYMM/           ← date memory dirs (was root YYMM/)
 *         raw/                 ← material assets
 *       todos.md
 *       todos.done.md
 *       identity/              ← was root identity/
 *       trash/                 ← was root .journal-trash/
 *       index/                 ← artifact index (future)
 */
import { join } from 'node:path'

/** `<root>/.journal` — the daemon-private namespace. */
export function journalDir(root: string): string {
  return join(root, '.journal')
}

/** `<root>/.journal/workspace.json` — workspace meta + layoutVersion marker. */
export function workspaceMetaPath(root: string): string {
  return join(journalDir(root), 'workspace.json')
}

/** `<root>/.journal/memory` — parent of all YYMM date memory dirs. */
export function memoryDir(root: string): string {
  return join(journalDir(root), 'memory')
}

/** `<root>/.journal/memory/<yearMonth>` — a single YYMM memory dir. */
export function memoryMonthDir(root: string, yearMonth: string): string {
  return join(memoryDir(root), yearMonth)
}

/** `<root>/.journal/memory/<yearMonth>/raw` — material assets for a month. */
export function memoryMonthRawDir(root: string, yearMonth: string): string {
  return join(memoryMonthDir(root, yearMonth), 'raw')
}

/** `<root>/.journal/todos.md` — active todo list. */
export function todosPath(root: string): string {
  return join(journalDir(root), 'todos.md')
}

/** `<root>/.journal/todos.done.md` — completed todo archive. */
export function todosDonePath(root: string): string {
  return join(journalDir(root), 'todos.done.md')
}

/** `<root>/.journal/identity` — identity profile cards. */
export function identityDir(root: string): string {
  return join(journalDir(root), 'identity')
}

/** `<root>/.journal/trash` — ChangeSet stash for revert (post-migration). */
export function trashDir(root: string): string {
  return join(journalDir(root), 'trash')
}

/** `<root>/.journal-trash` — pre-migration ChangeSet stash (legacy fallback). */
export function legacyTrashDir(root: string): string {
  return join(root, '.journal-trash')
}

/**
 * Convert a post-migration trash path back to its legacy equivalent.
 * Returns the input unchanged if it is not under the new trash dir.
 */
export function toLegacyTrashPath(newTrashPath: string, root: string): string {
  const next = trashDir(root)
  if (newTrashPath === next || newTrashPath.startsWith(next + '/')) {
    return join(legacyTrashDir(root), newTrashPath.slice(next.length))
  }
  return newTrashPath
}
