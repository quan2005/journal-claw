import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ChangeSetService } from '../changeset/service.js'
import { FilesService, WorkspaceFsError } from './service.js'

describe('FilesService', () => {
  let ws: string
  let changes: ChangeSetService
  let files: FilesService

  beforeEach(() => {
    ws = join(tmpdir(), `journal-files-${Math.random().toString(36).slice(2)}`)
    mkdirSync(ws, { recursive: true })
    changes = new ChangeSetService(ws)
    files = new FilesService(ws, changes)
  })

  afterEach(() => {
    rmSync(ws, { recursive: true, force: true })
  })

  it('lists workspace dirs like Rust: hidden skipped, dirs first, names descending', () => {
    mkdirSync(join(ws, 'z-dir'))
    mkdirSync(join(ws, 'a-dir'))
    mkdirSync(join(ws, '.git'))
    mkdirSync(join(ws, '.journal'))
    writeFileSync(join(ws, 'z.md'), 'z')
    writeFileSync(join(ws, 'a.md'), 'a')
    writeFileSync(join(ws, '.hidden.md'), 'hidden')
    writeFileSync(join(ws, '.env'), 'env')

    expect(files.listWorkspaceDir('').map((entry) => [entry.name, entry.is_dir])).toEqual([
      ['z-dir', true],
      ['a-dir', true],
      ['z.md', false],
      ['a.md', false],
    ])
  })

  it('filters every dot-prefixed entry at root (AC-3: .journal stays hidden)', () => {
    mkdirSync(join(ws, 'visible-dir'))
    mkdirSync(join(ws, '.journal'))
    mkdirSync(join(ws, '.git'))
    mkdirSync(join(ws, '.cache'))
    writeFileSync(join(ws, 'visible.md'), 'v')
    writeFileSync(join(ws, '.dotfile'), 'd')
    writeFileSync(join(ws, '.journal', 'workspace.json'), '{}')
    writeFileSync(join(ws, '.git', 'config'), 'c')

    const listed = files.listWorkspaceDir('')
    const names = listed.map((entry) => entry.name)
    expect(names).toEqual(['visible-dir', 'visible.md'])
    expect(names.some((name) => name.startsWith('.'))).toBe(false)
  })

  it('adds expert virtual directory and filters expert candidates by query', () => {
    mkdirSync(join(ws, '.journal', 'identity'), { recursive: true })
    writeFileSync(
      join(ws, '.journal', 'identity', 'cn-Alice.md'),
      '---\nsummary: "LLM researcher"\ntags: ["expert", "ai"]\naliases: ["ali"]\n---\n# Alice\n',
    )

    const root = files.listAtMentionCandidates('', '')
    expect(root.some((entry) => entry.path === '__experts__')).toBe(true)
    expect(root.some((entry) => entry.path === 'identities/cn-Alice.md')).toBe(true)

    const filtered = files.listAtMentionCandidates('__experts__', 'researcher')
    expect(filtered.map((entry) => entry.name)).toEqual(['Alice'])
  })

  it('imports text to current raw directory and records a ChangeSet', () => {
    const { result, changeSet } = files.importText('hello')
    expect(result.path).toMatch(/^\.journal\/memory\/\d{4}\/raw\/\d{2}-paste-\d{8}-\d{6}\.txt$/)
    expect(readFileSync(join(ws, result.path), 'utf8')).toBe('hello')
    expect(changeSet.runId).toBe('fs-manual')
    expect(changeSet.operation).toBe('create')
  })

  it('duplicates, renames, and moves files with Rust-compatible conflict names', () => {
    mkdirSync(join(ws, 'dest'))
    writeFileSync(join(ws, 'note.md'), 'hello')

    const duplicated = files.duplicate('note.md').result
    expect(duplicated).toBe('note copy.md')
    expect(readFileSync(join(ws, duplicated), 'utf8')).toBe('hello')

    const renamed = files.rename('note copy.md', 'renamed.md').result
    expect(renamed).toBe('renamed.md')

    const moved = files.move('renamed.md', 'dest').result
    expect(moved).toBe('dest/renamed.md')
    expect(readFileSync(join(ws, moved), 'utf8')).toBe('hello')
  })

  it('deletes through ChangeSetService trash and can revert', () => {
    writeFileSync(join(ws, 'gone.md'), 'content')
    const { changeSet } = files.delete('gone.md')

    expect(existsSync(join(ws, 'gone.md'))).toBe(false)
    expect(changeSet.beforePath).toBeTruthy()
    expect(existsSync(changeSet.beforePath!)).toBe(true)

    changes.revertChangeSet(changeSet.id)
    expect(readFileSync(join(ws, 'gone.md'), 'utf8')).toBe('content')
  })

  it('rejects path escapes and read_only writes without touching disk', () => {
    expect(() => files.delete('../outside.md')).toThrow(WorkspaceFsError)
    expect(() => files.importText('blocked', 'read_only')).toThrow(/read_only/)
    expect(existsSync(join(ws, 'raw'))).toBe(false)
  })

  it('rejects symlink traversal for writes', () => {
    const outside = join(tmpdir(), `journal-outside-${Math.random().toString(36).slice(2)}`)
    mkdirSync(outside, { recursive: true })
    writeFileSync(join(outside, 'secret.md'), 'secret')
    symlinkSync(outside, join(ws, 'linked'), 'dir')
    try {
      expect(() => files.delete('linked/secret.md')).toThrow(/符号链接/)
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('rejects import writes when raw directory is a symlink', () => {
    const outside = join(tmpdir(), `journal-import-outside-${Math.random().toString(36).slice(2)}`)
    mkdirSync(outside, { recursive: true })
    const ym = `${String(new Date().getFullYear()).slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}`
    mkdirSync(join(ws, '.journal', 'memory', ym), { recursive: true })
    symlinkSync(outside, join(ws, '.journal', 'memory', ym, 'raw'), 'dir')
    try {
      expect(() => files.importText('blocked')).toThrow(/符号链接/)
      expect(changes.listChangeSets('fs-manual')).toHaveLength(0)
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it('creates a new empty file inside an existing directory and records a create ChangeSet', () => {
    mkdirSync(join(ws, '专题'), { recursive: true })
    const relPath = files.createFile('专题', 'notes.md').result
    expect(relPath).toBe('专题/notes.md')
    expect(readFileSync(join(ws, relPath), 'utf8')).toBe('')
  })

  it('creates a new folder inside an existing directory', () => {
    mkdirSync(join(ws, '专题'), { recursive: true })
    const relPath = files.createFolder('专题', '新建文件夹').result
    expect(relPath).toBe('专题/新建文件夹')
    expect(statSync(join(ws, relPath)).isDirectory()).toBe(true)
  })

  it('rejects creating a file that already exists', () => {
    mkdirSync(join(ws, '专题'), { recursive: true })
    files.createFile('专题', 'dup.md')
    expect(() => files.createFile('专题', 'dup.md')).toThrowError(/已存在/)
  })
})
