import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * One-shot global (home) migration: `~/.claude/{skills,plugins/cache}` →
 * `~/.agent/{skills,plugins/cache}` (story 20260708-remove-claude-branding).
 *
 * Mirrors `workspace/migration.ts`'s `migrateOne` semantics: only moves when
 * the source exists and the destination does not; never overwrites user data.
 * Idempotent via the source-exists check — no version marker needed, a second
 * call is a no-op once the source has been moved away.
 */
export function migrateGlobalAgentDir(homeDir: string): void {
  migrateGlobalOne(join(homeDir, '.claude', 'skills'), join(homeDir, '.agent', 'skills'))
  migrateGlobalOne(
    join(homeDir, '.claude', 'plugins', 'cache'),
    join(homeDir, '.agent', 'plugins', 'cache'),
  )
}

function migrateGlobalOne(src: string, dst: string): void {
  if (!existsSync(src)) return
  if (existsSync(dst)) {
    console.warn(
      `[global agent-dir migration] target already exists, skipping: ${dst} (source left in place: ${src})`,
    )
    return
  }
  mkdirSync(dirname(dst), { recursive: true })
  renameSync(src, dst)
}
