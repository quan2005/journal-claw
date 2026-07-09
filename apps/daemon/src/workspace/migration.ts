/**
 * One-shot workspace disk-layout migration (story 20260706-workspace-disk-contract).
 *
 * Pre-migration the workspace root was littered with system files (YYMM/,
 * todos.md, identity/, .journal-trash/) alongside user content. This migrates
 * them under `.journal/` so the root belongs to the user.
 *
 * v3 (story 20260708-remove-claude-branding): renames the workspace-level
 * system prompt `CLAUDE.md` → `AGENTS.md` and lint-state dir `.claude/` →
 * `.agent/` to drop the Claude Code brand.
 *
 * Guarantees (design.md §2):
 *   - Idempotent: `.journal/workspace.json#layoutVersion >= 2` short-circuits.
 *   - Resumable: each item moves only if source exists and target does not;
 *     a partial run + crash leaves no marker, so the next run continues.
 *   - Non-overwriting: a target collision skips the item with a warning.
 *   - Atomic per-item: same-volume `renameSync` (rename is atomic on POSIX).
 *   - Marker last: `layoutVersion: 2` is written only after every item moved.
 *   - Empty workspace: creates `.journal/` + marker directly (AC-4).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  identityDir,
  journalDir,
  memoryDir,
  todosDonePath,
  todosPath,
  trashDir,
  workspaceMetaPath,
} from './paths.js'

export const WORKSPACE_LAYOUT_VERSION = 3

interface WorkspaceJson {
  layoutVersion?: unknown
  [key: string]: unknown
}

/**
 * Migrate `root` to the current disk-layout version. Safe to call on every
 * workspace access — already-migrated workspaces return immediately.
 */
export function migrateWorkspaceLayout(root: string): void {
  mkdirSync(journalDir(root), { recursive: true })

  if (readLayoutVersion(root) >= WORKSPACE_LAYOUT_VERSION) return

  migrateYearMonthDirs(root)
  migrateOne(join(root, 'todos.md'), todosPath(root))
  migrateOne(join(root, 'todos.done.md'), todosDonePath(root))
  migrateOne(join(root, 'identity'), identityDir(root))
  migrateOne(join(root, '.journal-trash'), trashDir(root))
  // v3: drop Claude Code brand — rename workspace-level system prompt and
  // lint-state dir (story 20260708-remove-claude-branding).
  migrateOne(join(root, 'CLAUDE.md'), join(root, 'AGENTS.md'))
  migrateOne(join(root, '.claude'), join(root, '.agent'))

  writeLayoutVersion(root, WORKSPACE_LAYOUT_VERSION)
}

/** Read the persisted layoutVersion (0 if absent / corrupt). */
export function readLayoutVersion(root: string): number {
  const metaPath = workspaceMetaPath(root)
  if (!existsSync(metaPath)) return 0
  try {
    const parsed = JSON.parse(readFileSync(metaPath, 'utf8')) as WorkspaceJson
    return typeof parsed.layoutVersion === 'number' ? parsed.layoutVersion : 0
  } catch {
    return 0
  }
}

/** Persist `layoutVersion` while preserving all other workspace.json fields. */
function writeLayoutVersion(root: string, version: number): void {
  const metaPath = workspaceMetaPath(root)
  const existing = readMetaObject(metaPath)
  existing.layoutVersion = version
  writeFileSync(metaPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8')
}

function readMetaObject(metaPath: string): WorkspaceJson {
  if (!existsSync(metaPath)) return {}
  try {
    const parsed = JSON.parse(readFileSync(metaPath, 'utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as WorkspaceJson
    }
  } catch {
    // corrupt meta — start fresh but preserve by overwriting
  }
  return {}
}

/** Move every root-level `/^\d{4}$/` dir into `.journal/memory/`. */
function migrateYearMonthDirs(root: string): void {
  if (!existsSync(root)) return
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (!/^\d{4}$/.test(entry.name)) continue
    migrateOne(join(root, entry.name), join(memoryDir(root), entry.name))
  }
}

/**
 * Move `src` to `dst` if `src` exists and `dst` does not. A target collision
 * is logged and skipped — never overwrite user data.
 */
function migrateOne(src: string, dst: string): void {
  if (!existsSync(src)) return
  if (existsSync(dst)) {
    console.warn(
      `[workspace migration] target already exists, skipping: ${dst} (source left in place: ${src})`,
    )
    return
  }
  mkdirSync(dirname(dst), { recursive: true })
  renameSync(src, dst)
}
