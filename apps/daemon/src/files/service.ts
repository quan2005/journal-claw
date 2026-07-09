import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
  type Dirent,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import type { AuthorizationMode, ChangeSet } from '@journal/contracts'
import { isPathAllowed } from '../changeset/authorization.js'
import { ChangeSetService } from '../changeset/service.js'
import { identityDir, memoryMonthRawDir } from '../workspace/paths.js'

export interface WorkspaceDirEntry {
  name: string
  is_dir: boolean
  path: string
  mtime_secs: number
  /** Compact-folders: joined chain (e.g. "a/b/c") when this directory is the
   * terminal of a single-child chain. Absent when no compaction happened. */
  display_name?: string
}

export type AtMentionKind = 'file' | 'directory' | 'expert'

export interface AtMentionCandidate extends WorkspaceDirEntry {
  kind: AtMentionKind
  insert_text?: string | null
  summary?: string | null
  tags: string[]
}

export interface ImportResult {
  path: string
  filename: string
  year_month: string
}

export interface FileMutationResult<T> {
  result: T
  changeSet: ChangeSet
}

export class WorkspaceFsError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message)
  }
}

const EXPERTS_VIRTUAL_DIR = '__experts__'
const EXPERTS_VIRTUAL_LABEL = '专家'
const CLEAR_EXPERTS_PATH = '__experts__/clear'
const CLEAR_EXPERTS_INSERT_TEXT = '清除专家'
const DEFAULT_RUN_ID = 'fs-manual'

function mtimeSecs(path: string): number {
  try {
    return Math.floor(statSync(path).mtimeMs / 1000)
  } catch {
    return 0
  }
}

function queryMatches(haystacks: string[], query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return haystacks.some((s) => s.toLowerCase().includes(q))
}

function currentYearMonth(date = new Date()): string {
  return `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}`
}

function dayPrefix(date = new Date()): string {
  return String(date.getDate()).padStart(2, '0')
}

function timestamp(date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`
}

function hash8(path: string): string {
  try {
    return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 8)
  } catch {
    return 'unknown'
  }
}

function parseList(value: string | undefined): string[] {
  if (!value) return []
  const trimmed = value.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return []
  return trimmed
    .slice(1, -1)
    .split(',')
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

function parseIdentityFrontmatter(content: string): {
  summary: string
  tags: string[]
  aliases: string[]
  expert_skill: string
  archived: boolean
} {
  if (!content.startsWith('---')) {
    return { summary: '', tags: [], aliases: [], expert_skill: '', archived: false }
  }
  const end = content.indexOf('\n---', 3)
  if (end < 0) return { summary: '', tags: [], aliases: [], expert_skill: '', archived: false }
  const lines = content.slice(3, end).split(/\r?\n/)
  const raw = new Map<string, string>()
  for (const line of lines) {
    const idx = line.indexOf(':')
    if (idx < 0) continue
    raw.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim())
  }
  const unquote = (v: string | undefined): string => (v ?? '').replace(/^['"]|['"]$/g, '')
  return {
    summary: unquote(raw.get('summary')),
    tags: parseList(raw.get('tags')),
    aliases: parseList(raw.get('aliases')),
    expert_skill: unquote(raw.get('expert_skill')),
    archived: raw.get('archived') === 'true',
  }
}

function parseIdentityName(filename: string): string | null {
  if (filename === 'README.md') return '关于我'
  if (!filename.endsWith('.md')) return null
  const stem = filename.slice(0, -3)
  const dash = stem.indexOf('-')
  if (dash < 0) return null
  return stem.slice(dash + 1)
}

function isExpert(tags: string[], expertSkill: string): boolean {
  return (
    expertSkill.trim().length > 0 ||
    tags.some((tag) => tag.trim() === '专家' || tag.trim().toLowerCase() === 'expert')
  )
}

export class FilesService {
  constructor(
    private readonly workspaceRoot: string,
    private readonly changeSetService: ChangeSetService,
    private readonly runId = DEFAULT_RUN_ID,
  ) {}

  /** Reads a workspace file as raw bytes with a MIME type inferred from its
   * extension (images/PDF preview — AC-1/AC-2 of fix-image-preview). Electron's
   * renderer runs at an http:// origin, so `file://` src URLs are blocked by
   * the browser's cross-origin policy; the daemon streaming the bytes over
   * HTTP is the fix. */
  getBinaryContent(relativePath: string): { data: Buffer; mimeType: string } {
    const source = this.resolveExistingFile(relativePath)
    return { data: readFileSync(source), mimeType: mimeTypeFromExtension(source) }
  }

  listWorkspaceDir(
    relativePath = '',
    opts: { compact?: boolean } = {},
  ): WorkspaceDirEntry[] {
    const target = this.resolveExistingDir(relativePath)
    let entries: Dirent[]
    try {
      entries = readdirSync(target, { withFileTypes: true })
    } catch (err) {
      throw new WorkspaceFsError('read_dir_failed', String(err), 500)
    }

    const result = entries
      .filter((entry) => !entry.name.startsWith('.'))
      .map((entry) => {
        const entryPath = join(target, entry.name)
        const isDir = statSync(entryPath).isDirectory()
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
        const base: WorkspaceDirEntry = {
          name: entry.name,
          is_dir: isDir,
          path: relPath,
          mtime_secs: mtimeSecs(entryPath),
        }
        if (opts.compact && isDir) {
          const chain = this.compactChain(entryPath, [entry.name])
          if (chain.length >= 2) {
            const terminalRel = chain
              .reduce<string>((acc, part) => (acc ? `${acc}/${part}` : part), relativePath)
            base.display_name = chain.join('/')
            base.name = chain[chain.length - 1]
            base.path = terminalRel
          }
        }
        return base
      })
      .sort((a, b) => {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
        return b.name.localeCompare(a.name)
      })

    return result
  }

  /**
   * Compact-folders: walk down a single-child directory chain, returning the
   * list of directory names from the start to the terminal (inclusive). Stops
   * when a level has zero or >1 visible entries, or its only entry is a file,
   * or the depth limit is hit, or a read error occurs. Returns at least the
   * starting name.
   */
  private compactChain(startAbsDir: string, initial: string[]): string[] {
    const chain = [...initial]
    const MAX_DEPTH = 50
    let current = startAbsDir
    while (chain.length < initial.length + MAX_DEPTH) {
      let children: Dirent[]
      try {
        children = readdirSync(current, { withFileTypes: true }).filter(
          (d) => !d.name.startsWith('.'),
        )
      } catch {
        break
      }
      if (children.length !== 1) break
      const only = children[0]
      if (!only.isDirectory()) break
      chain.push(only.name)
      current = join(current, only.name)
    }
    return chain
  }

  listAtMentionCandidates(relativePath = '', query = ''): AtMentionCandidate[] {
    if (relativePath === EXPERTS_VIRTUAL_DIR) {
      return this.expertMentionCandidates(query, true)
    }

    const candidates: AtMentionCandidate[] = this.listWorkspaceDir(relativePath).map((entry) => ({
      ...entry,
      kind: entry.is_dir ? ('directory' as const) : ('file' as const),
      insert_text: null,
      summary: null,
      tags: [] as string[],
    }))

    if (!relativePath) {
      candidates.push({
        name: EXPERTS_VIRTUAL_LABEL,
        is_dir: true,
        path: EXPERTS_VIRTUAL_DIR,
        mtime_secs: 0,
        kind: 'directory',
        insert_text: null,
        summary: '可召唤的专家视角',
        tags: ['专家'],
      })
      candidates.push(...this.expertMentionCandidates(query, query.trim().length > 0))
    }

    return candidates
  }

  importFile(
    srcPath: string,
    mode: AuthorizationMode = 'workspace_write',
  ): FileMutationResult<ImportResult> {
    const source = resolve(srcPath)
    if (!existsSync(source) || !statSync(source).isFile()) {
      throw new WorkspaceFsError('file_not_found', '文件不存在', 404)
    }
    const ym = currentYearMonth()
    const raw = memoryMonthRawDir(this.workspaceRoot, ym)
    const parsedExt = extname(source)
    const stem = basename(source, parsedExt)
    const filename = `${dayPrefix()}-${stem}-${hash8(source)}${parsedExt}`
    const dest = join(raw, filename)
    const relPath = `.journal/memory/${ym}/raw/${filename}`
    const content = readFileSync(source)
    this.assertCreatableTarget(dest, mode)
    const changeSet = this.recordWritableChange(relPath, 'create', mode, content.toString('utf8'))
    if (changeSet.status !== 'applied') {
      throw new WorkspaceFsError('write_blocked', '写入被权限策略拒绝', 403, { changeSet })
    }
    mkdirSync(raw, { recursive: true })
    if (!existsSync(dest)) copyFileSync(source, dest)
    return { result: { path: dest, filename, year_month: ym }, changeSet }
  }

  importText(
    text: string,
    mode: AuthorizationMode = 'workspace_write',
  ): FileMutationResult<ImportResult> {
    const ym = currentYearMonth()
    const raw = memoryMonthRawDir(this.workspaceRoot, ym)
    const filename = `${dayPrefix()}-paste-${timestamp()}.txt`
    const dest = join(raw, filename)
    const relPath = `.journal/memory/${ym}/raw/${filename}`
    this.assertCreatableTarget(dest, mode)
    const changeSet = this.recordWritableChange(relPath, 'create', mode, text)
    if (changeSet.status !== 'applied') {
      throw new WorkspaceFsError('write_blocked', '写入被权限策略拒绝', 403, { changeSet })
    }
    mkdirSync(raw, { recursive: true })
    writeFileSync(dest, text)
    return { result: { path: relPath, filename, year_month: ym }, changeSet }
  }

  importTextTemp(text: string): ImportResult {
    const filename = `paste-${timestamp()}.txt`
    const dest = join(tmpdir(), filename)
    writeFileSync(dest, text)
    return { path: dest, filename, year_month: '' }
  }

  importImageTemp(data: string, mediaType: string): ImportResult {
    const ext =
      mediaType === 'image/jpeg'
        ? 'jpg'
        : mediaType === 'image/gif'
          ? 'gif'
          : mediaType === 'image/webp'
            ? 'webp'
            : 'png'
    const filename = `paste-${timestamp()}.${ext}`
    const dest = join(tmpdir(), filename)
    writeFileSync(dest, Buffer.from(data, 'base64'))
    return { path: dest, filename, year_month: '' }
  }

  duplicate(
    relativePath: string,
    mode: AuthorizationMode = 'workspace_write',
  ): FileMutationResult<string> {
    const source = this.resolveExistingFile(relativePath)
    const ext = extname(source)
    const stem = basename(source, ext)
    const parent = dirname(source)
    let i = 1
    let dest = ''
    while (!dest) {
      const suffix = i > 1 ? ` ${i}` : ''
      const candidate = join(parent, `${stem} copy${suffix}${ext}`)
      if (!existsSync(candidate)) dest = candidate
      i += 1
    }
    const relPath = this.relativeFromRoot(dest)
    const content = readFileSync(source)
    const changeSet = this.recordWritableChange(relPath, 'create', mode, content.toString('utf8'))
    if (changeSet.status !== 'applied') {
      throw new WorkspaceFsError('write_blocked', '写入被权限策略拒绝', 403, { changeSet })
    }
    copyFileSync(source, dest)
    return { result: relPath, changeSet }
  }

  createFile(
    dirPath: string,
    name: string,
    mode: AuthorizationMode = 'workspace_write',
  ): FileMutationResult<string> {
    if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
      throw new WorkspaceFsError('invalid_name', '文件名无效')
    }
    const dir = this.resolveExistingDir(dirPath)
    const dest = join(dir, name)
    this.assertWritableTarget(dest, mode)
    if (existsSync(dest)) throw new WorkspaceFsError('target_exists', '同名文件已存在', 409)
    const relPath = this.relativeFromRoot(dest)
    const changeSet = this.recordWritableChange(relPath, 'create', mode, '')
    if (changeSet.status !== 'applied') {
      throw new WorkspaceFsError('write_blocked', '写入被权限策略拒绝', 403, { changeSet })
    }
    writeFileSync(dest, '')
    return { result: relPath, changeSet }
  }

  createFolder(
    dirPath: string,
    name: string,
    mode: AuthorizationMode = 'workspace_write',
  ): FileMutationResult<string> {
    if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
      throw new WorkspaceFsError('invalid_name', '文件夹名无效')
    }
    const dir = this.resolveExistingDir(dirPath)
    const dest = join(dir, name)
    this.assertWritableTarget(dest, mode)
    if (existsSync(dest)) throw new WorkspaceFsError('target_exists', '同名文件夹已存在', 409)
    const relPath = this.relativeFromRoot(dest)
    const changeSet = this.recordWritableChange(relPath, 'create', mode, '')
    if (changeSet.status !== 'applied') {
      throw new WorkspaceFsError('write_blocked', '写入被权限策略拒绝', 403, { changeSet })
    }
    mkdirSync(dest, { recursive: false })
    return { result: relPath, changeSet }
  }

  rename(
    relativePath: string,
    newName: string,
    mode: AuthorizationMode = 'workspace_write',
  ): FileMutationResult<string> {
    if (
      !newName ||
      newName.includes('/') ||
      newName.includes('\\') ||
      newName === '.' ||
      newName === '..'
    ) {
      throw new WorkspaceFsError('invalid_name', '文件名无效')
    }
    const source = this.resolveExistingPath(relativePath)
    const dest = join(dirname(source), newName)
    this.assertWritableTarget(dest, mode)
    if (existsSync(dest)) throw new WorkspaceFsError('target_exists', '目标文件已存在', 409)
    const relPath = this.relativeFromRoot(dest)
    const changeSet = this.recordWritableChange(
      relPath,
      'create',
      mode,
      this.readAfterContent(source),
    )
    if (changeSet.status !== 'applied') {
      throw new WorkspaceFsError('write_blocked', '写入被权限策略拒绝', 403, { changeSet })
    }
    renameSync(source, dest)
    return { result: relPath, changeSet }
  }

  move(
    relativePath: string,
    destDir: string,
    mode: AuthorizationMode = 'workspace_write',
  ): FileMutationResult<string> {
    const source = this.resolveExistingPath(relativePath)
    const targetDir = this.resolveExistingDir(destDir)
    const dest = join(targetDir, basename(source))
    this.assertWritableTarget(dest, mode)
    if (existsSync(dest)) throw new WorkspaceFsError('target_exists', '目标位置已存在同名文件', 409)
    const relPath = this.relativeFromRoot(dest)
    const changeSet = this.recordWritableChange(
      relPath,
      'create',
      mode,
      this.readAfterContent(source),
    )
    if (changeSet.status !== 'applied') {
      throw new WorkspaceFsError('write_blocked', '写入被权限策略拒绝', 403, { changeSet })
    }
    renameSync(source, dest)
    return { result: relPath, changeSet }
  }

  delete(
    relativePath: string,
    mode: AuthorizationMode = 'workspace_write',
  ): FileMutationResult<void> {
    this.resolveExistingPath(relativePath)
    const changeSet = this.changeSetService.recordChangeSet({
      runId: this.runId,
      path: this.normalizeRelative(relativePath),
      operation: 'remove',
      mode,
      risk: 'medium',
    })
    if (changeSet.status !== 'applied') {
      throw new WorkspaceFsError('write_blocked', '写入被权限策略拒绝', 403, { changeSet })
    }
    return { result: undefined, changeSet }
  }

  private expertMentionCandidates(query: string, includeControls: boolean): AtMentionCandidate[] {
    const candidates: AtMentionCandidate[] = []
    if (
      includeControls &&
      queryMatches(
        ['清除专家视角', CLEAR_EXPERTS_INSERT_TEXT, '重置专家', 'clear expert', 'reset expert'],
        query,
      )
    ) {
      candidates.push({
        name: '清除专家视角',
        is_dir: false,
        path: CLEAR_EXPERTS_PATH,
        mtime_secs: 0,
        kind: 'expert',
        insert_text: CLEAR_EXPERTS_INSERT_TEXT,
        summary: '发送后移除当前会话里的专家视角',
        tags: ['专家'],
      })
    }
    candidates.push(...this.listExpertIdentities(query))
    return candidates
  }

  private listExpertIdentities(query: string): AtMentionCandidate[] {
    const dir = identityDir(this.workspaceRoot)
    if (!existsSync(dir)) return []
    const candidates: AtMentionCandidate[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      const name = parseIdentityName(entry.name)
      if (!name) continue
      const full = join(dir, entry.name)
      const fm = parseIdentityFrontmatter(readFileSync(full, 'utf8'))
      if (fm.archived || !isExpert(fm.tags, fm.expert_skill)) continue
      if (
        !queryMatches(
          [name, entry.name, fm.summary, fm.expert_skill, ...fm.aliases, ...fm.tags],
          query,
        )
      ) {
        continue
      }
      candidates.push({
        name,
        is_dir: false,
        path: `identities/${entry.name}`,
        mtime_secs: mtimeSecs(full),
        kind: 'expert',
        insert_text: null,
        summary: fm.summary.trim() ? fm.summary : null,
        tags: fm.tags,
      })
    }
    return candidates.sort((a, b) => a.name.localeCompare(b.name))
  }

  private resolveExistingDir(relativePath: string): string {
    const target = this.resolveInsideRoot(relativePath)
    if (!existsSync(target))
      throw new WorkspaceFsError('path_not_found', `路径不存在: ${relativePath}`, 404)
    if (!statSync(target).isDirectory())
      throw new WorkspaceFsError('not_directory', '目标目录不存在')
    this.assertNoSymlink(target)
    return target
  }

  private resolveExistingFile(relativePath: string): string {
    const target = this.resolveExistingPath(relativePath)
    if (!statSync(target).isFile()) throw new WorkspaceFsError('not_file', '目标不是文件')
    return target
  }

  private resolveExistingPath(relativePath: string): string {
    const target = this.resolveInsideRoot(relativePath)
    if (!existsSync(target)) throw new WorkspaceFsError('file_not_found', '文件不存在', 404)
    this.assertNoSymlink(target)
    return target
  }

  private resolveInsideRoot(relativePath: string): string {
    const rel = this.normalizeRelative(relativePath)
    const target = resolve(this.workspaceRoot, rel)
    const root = resolve(this.workspaceRoot)
    const out = relative(root, target)
    if (out.startsWith('..') || isAbsolute(out)) {
      throw new WorkspaceFsError('path_outside_workspace', '路径超出 workspace 范围', 403)
    }
    return target
  }

  private normalizeRelative(relativePath: string): string {
    if (typeof relativePath !== 'string') {
      throw new WorkspaceFsError('invalid_path', '路径无效')
    }
    const rel = relativePath.trim()
    if (rel.startsWith('/') || rel.match(/^[A-Za-z]:[\\/]/)) {
      throw new WorkspaceFsError('path_outside_workspace', '路径超出 workspace 范围', 403)
    }
    return rel
  }

  private assertNoSymlink(path: string): void {
    let current = resolve(this.workspaceRoot)
    const rel = relative(current, path)
    for (const part of rel.split(/[\\/]/).filter(Boolean)) {
      current = join(current, part)
      if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
        throw new WorkspaceFsError('symlink_rejected', '拒绝通过符号链接访问 workspace 文件', 403)
      }
    }
  }

  private assertWritableTarget(path: string, mode: AuthorizationMode): void {
    const decision = isPathAllowed(mode, this.workspaceRoot, path)
    if (!decision.allowed) {
      throw new WorkspaceFsError('write_blocked', decision.reason ?? '写入被权限策略拒绝', 403)
    }
    const parent = dirname(path)
    if (!existsSync(parent)) throw new WorkspaceFsError('path_not_found', '目标目录不存在', 404)
    this.assertNoSymlink(parent)
  }

  private assertCreatableTarget(path: string, mode: AuthorizationMode): void {
    const decision = isPathAllowed(mode, this.workspaceRoot, path)
    if (!decision.allowed) {
      throw new WorkspaceFsError('write_blocked', decision.reason ?? '写入被权限策略拒绝', 403)
    }

    const root = resolve(this.workspaceRoot)
    const parent = dirname(resolve(path))
    const rel = relative(root, parent)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new WorkspaceFsError('path_outside_workspace', '路径超出 workspace 范围', 403)
    }

    let current = root
    for (const part of rel.split(/[\\/]/).filter(Boolean)) {
      current = join(current, part)
      if (!existsSync(current)) break
      if (lstatSync(current).isSymbolicLink()) {
        throw new WorkspaceFsError('symlink_rejected', '拒绝通过符号链接访问 workspace 文件', 403)
      }
      if (!statSync(current).isDirectory()) {
        throw new WorkspaceFsError('not_directory', '目标目录不存在')
      }
    }
  }

  private recordWritableChange(
    relPath: string,
    operation: 'create' | 'edit',
    mode: AuthorizationMode,
    afterContent: string,
  ): ChangeSet {
    return this.changeSetService.recordChangeSet({
      runId: this.runId,
      path: relPath,
      operation,
      mode,
      afterContent,
    })
  }

  private relativeFromRoot(path: string): string {
    return relative(resolve(this.workspaceRoot), resolve(path)).split(/[\\/]/).join('/')
  }

  private readAfterContent(path: string): string {
    try {
      return statSync(path).isFile() ? readFileSync(path, 'utf8') : ''
    } catch {
      return ''
    }
  }
}

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  pdf: 'application/pdf',
}

function mimeTypeFromExtension(path: string): string {
  const ext = extname(path).slice(1).toLowerCase()
  return MIME_TYPES_BY_EXTENSION[ext] ?? 'application/octet-stream'
}
