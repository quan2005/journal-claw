import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrateWorkspaceLayout, readLayoutVersion, WORKSPACE_LAYOUT_VERSION } from './migration.js'
import {
  identityDir,
  journalDir,
  memoryDir,
  memoryMonthDir,
  todosDonePath,
  todosPath,
  trashDir,
} from './paths.js'

describe('migrateWorkspaceLayout', () => {
  let ws: string
  beforeEach(() => {
    ws = mkdtempSync(join(tmpdir(), 'migration-'))
  })
  afterEach(() => {
    rmSync(ws, { recursive: true, force: true })
  })

  it('migrates legacy root layout into .journal/ (AC-1)', () => {
    // Legacy system content at root.
    mkdirSync(join(ws, '2606'), { recursive: true })
    writeFileSync(join(ws, '2606', '27-note.md'), 'entry')
    mkdirSync(join(ws, '2606', 'raw'), { recursive: true })
    writeFileSync(join(ws, '2606', 'raw', 'asset.txt'), 'asset')
    writeFileSync(join(ws, 'todos.md'), '- [ ] task')
    writeFileSync(join(ws, 'todos.done.md'), '- [x] done')
    mkdirSync(join(ws, 'identity'), { recursive: true })
    writeFileSync(join(ws, 'identity', 'README.md'), 'me')
    mkdirSync(join(ws, '.journal-trash', 'cs-1'), { recursive: true })
    writeFileSync(join(ws, '.journal-trash', 'cs-1', 'gone.md'), 'gone')
    // User content stays put.
    mkdirSync(join(ws, 'topics'), { recursive: true })
    writeFileSync(join(ws, 'topics', 'mine.md'), 'mine')
    writeFileSync(join(ws, 'README.md'), 'user readme')

    migrateWorkspaceLayout(ws)

    // Memory YYMM moved.
    expect(existsSync(join(ws, '2606'))).toBe(false)
    expect(readFileSync(join(memoryMonthDir(ws, '2606'), '27-note.md'), 'utf8')).toBe('entry')
    expect(readFileSync(join(memoryMonthDir(ws, '2606'), 'raw', 'asset.txt'), 'utf8')).toBe(
      'asset',
    )
    // Todos moved.
    expect(existsSync(join(ws, 'todos.md'))).toBe(false)
    expect(existsSync(join(ws, 'todos.done.md'))).toBe(false)
    expect(readFileSync(todosPath(ws), 'utf8')).toBe('- [ ] task')
    expect(readFileSync(todosDonePath(ws), 'utf8')).toBe('- [x] done')
    // Identity moved.
    expect(existsSync(join(ws, 'identity'))).toBe(false)
    expect(readFileSync(join(identityDir(ws), 'README.md'), 'utf8')).toBe('me')
    // Trash moved.
    expect(existsSync(join(ws, '.journal-trash'))).toBe(false)
    expect(readFileSync(join(trashDir(ws), 'cs-1', 'gone.md'), 'utf8')).toBe('gone')
    // User content untouched.
    expect(readFileSync(join(ws, 'topics', 'mine.md'), 'utf8')).toBe('mine')
    expect(readFileSync(join(ws, 'README.md'), 'utf8')).toBe('user readme')
    // Marker persisted.
    expect(readLayoutVersion(ws)).toBe(WORKSPACE_LAYOUT_VERSION)
  })

  it('initializes empty workspace with marker only (AC-4)', () => {
    migrateWorkspaceLayout(ws)
    expect(existsSync(journalDir(ws))).toBe(true)
    expect(readLayoutVersion(ws)).toBe(WORKSPACE_LAYOUT_VERSION)
    // No phantom directories created.
    expect(existsSync(memoryDir(ws))).toBe(false)
    expect(existsSync(identityDir(ws))).toBe(false)
    expect(existsSync(trashDir(ws))).toBe(false)
  })

  it('is idempotent on second run (AC-5)', () => {
    mkdirSync(join(ws, '2606'), { recursive: true })
    writeFileSync(join(ws, '2606', 'x.md'), 'x')

    migrateWorkspaceLayout(ws)
    expect(existsSync(join(ws, '2606'))).toBe(false)
    expect(readLayoutVersion(ws)).toBe(WORKSPACE_LAYOUT_VERSION)

    // Second run must be a no-op: no warnings, no moves, no double-write.
    migrateWorkspaceLayout(ws)
    expect(readLayoutVersion(ws)).toBe(WORKSPACE_LAYOUT_VERSION)
    expect(readFileSync(join(memoryMonthDir(ws, '2606'), 'x.md'), 'utf8')).toBe('x')
  })

  it('resumes a partial migration (crash mid-way, no marker)', () => {
    // Simulate post-crash state: YYMM moved but todos / identity not yet,
    // and no layoutVersion marker on disk.
    mkdirSync(join(ws, '.journal', 'memory', '2606'), { recursive: true })
    writeFileSync(join(ws, '.journal', 'memory', '2606', 'note.md'), 'n')
    writeFileSync(join(ws, 'todos.md'), '- [ ] task')
    mkdirSync(join(ws, 'identity'), { recursive: true })
    writeFileSync(join(ws, 'identity', 'README.md'), 'me')

    expect(existsSync(join(ws, '.journal', 'workspace.json'))).toBe(false)

    migrateWorkspaceLayout(ws)

    // Remaining items finished.
    expect(existsSync(join(ws, 'todos.md'))).toBe(false)
    expect(readFileSync(todosPath(ws), 'utf8')).toBe('- [ ] task')
    expect(existsSync(join(ws, 'identity'))).toBe(false)
    expect(readFileSync(join(identityDir(ws), 'README.md'), 'utf8')).toBe('me')
    // Already-migrated memory dir left intact.
    expect(readFileSync(join(memoryMonthDir(ws, '2606'), 'note.md'), 'utf8')).toBe('n')
    expect(readLayoutVersion(ws)).toBe(WORKSPACE_LAYOUT_VERSION)
  })

  it('skips item on target conflict and leaves source in place', () => {
    // Both source and target exist — must not overwrite, must warn.
    mkdirSync(join(ws, '2606'), { recursive: true })
    writeFileSync(join(ws, '2606', 'old.md'), 'old')
    mkdirSync(join(ws, '.journal', 'memory', '2606'), { recursive: true })
    writeFileSync(join(ws, '.journal', 'memory', '2606', 'new.md'), 'new')

    const warnings: string[] = []
    const originalWarn = console.warn
    console.warn = (msg: string) => warnings.push(msg)
    try {
      migrateWorkspaceLayout(ws)
    } finally {
      console.warn = originalWarn
    }

    // Source preserved (no overwrite).
    expect(readFileSync(join(ws, '2606', 'old.md'), 'utf8')).toBe('old')
    // Target preserved (no overwrite).
    expect(readFileSync(join(memoryMonthDir(ws, '2606'), 'new.md'), 'utf8')).toBe('new')
    expect(warnings.some((msg) => msg.includes('skipping'))).toBe(true)
    // Marker still written so next run doesn't keep retrying the conflict.
    expect(readLayoutVersion(ws)).toBe(WORKSPACE_LAYOUT_VERSION)
  })

  it('preserves existing workspace.json fields when writing layoutVersion', () => {
    mkdirSync(join(ws, '.journal'), { recursive: true })
    writeFileSync(
      join(ws, '.journal', 'workspace.json'),
      JSON.stringify({ name: 'My WS', type: 'project', goals: ['g1'] }),
    )

    migrateWorkspaceLayout(ws)

    const meta = JSON.parse(readFileSync(join(ws, '.journal', 'workspace.json'), 'utf8'))
    expect(meta.name).toBe('My WS')
    expect(meta.type).toBe('project')
    expect(meta.goals).toEqual(['g1'])
    expect(meta.layoutVersion).toBe(WORKSPACE_LAYOUT_VERSION)
  })

  it('skips non-YYMM root dirs (user content not picked up by regex)', () => {
    mkdirSync(join(ws, 'topics'), { recursive: true })
    writeFileSync(join(ws, 'topics', 'a.md'), 'a')
    mkdirSync(join(ws, 'projects'), { recursive: true })
    writeFileSync(join(ws, 'projects', 'b.md'), 'b')
    writeFileSync(join(ws, 'user-notes.md'), 'user')

    migrateWorkspaceLayout(ws)

    expect(existsSync(join(ws, 'topics', 'a.md'))).toBe(true)
    expect(existsSync(join(ws, 'projects', 'b.md'))).toBe(true)
    expect(existsSync(join(ws, 'user-notes.md'))).toBe(true)
    expect(existsSync(memoryDir(ws))).toBe(false)
  })
})
