import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import type { AuthorizationMode, ChangeSet, ChangeSetOperation } from '@journal/contracts'
import { isPathAllowed } from '../changeset/authorization.js'
import { ChangeSetService } from '../changeset/service.js'
import { memoryMonthRawDir } from '../workspace/paths.js'

export class LocalCrudError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'LocalCrudError'
  }
}

export const DEFAULT_MODE: AuthorizationMode = 'workspace_write'

export function currentYearMonth(date = new Date()): string {
  return `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function dayPrefix(date = new Date()): string {
  return String(date.getDate()).padStart(2, '0')
}

export function timestamp(date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`
}

export function mtimeSecs(path: string): number {
  try {
    return Math.floor(statSync(path).mtimeMs / 1000)
  } catch {
    return 0
  }
}

export function mtimeMs(path: string): number {
  try {
    return Math.floor(statSync(path).mtimeMs)
  } catch {
    return 0
  }
}

export function createdSecs(path: string): number {
  try {
    return Math.floor(statSync(path).birthtimeMs / 1000)
  } catch {
    return mtimeSecs(path)
  }
}

export function createdDisplayTime(path: string): string {
  try {
    const st = statSync(path)
    const d = Number.isFinite(st.birthtimeMs) ? st.birthtime : st.mtime
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

export function ensureYearMonthDirs(workspaceRoot: string, yearMonth: string): void {
  mkdirSync(memoryMonthRawDir(workspaceRoot, yearMonth), { recursive: true })
}

export function stripSurroundingQuotes(input: string): string {
  let result = input.trim()
  while (result.length >= 2) {
    const t = result.trim()
    const pairs: Array<[string, string, boolean]> = [
      ['"', '"', true],
      ["'", "'", false],
      ['“', '”', false],
      ['\\"', '\\"', false],
    ]
    const found = pairs.find(([a, b]) => t.startsWith(a) && t.endsWith(b))
    if (!found) break
    result = t.slice(found[0].length, t.length - found[1].length)
    if (found[2]) result = unescapeYamlDoubleQuoted(result)
  }
  return result
}

function unescapeYamlDoubleQuoted(value: string): string {
  return value
    .replace(/\\\\/g, '\\')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
}

export function yamlEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function parseInlineList(value: string | undefined): string[] {
  if (!value) return []
  const trimmed = value.trim().replace(/^\[/, '').replace(/\]$/, '')
  if (!trimmed) return []
  return splitInlineList(trimmed)
    .map((item) => stripSurroundingQuotes(item.trim()))
    .filter(Boolean)
}

function splitInlineList(value: string): string[] {
  const items: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let escaped = false
  for (const char of value) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }
    if (char === '\\' && quote === '"') {
      current += char
      escaped = true
      continue
    }
    if ((char === '"' || char === "'") && quote === null) {
      quote = char
      current += char
      continue
    }
    if (quote === char) {
      quote = null
      current += char
      continue
    }
    if (char === ',' && quote === null) {
      items.push(current)
      current = ''
      continue
    }
    current += char
  }
  items.push(current)
  return items
}

export function parseYamlishFields(content: string): {
  fields: Map<string, string | string[] | boolean>
  body: string
  hasFrontmatter: boolean
} {
  if (!content.startsWith('---')) {
    return { fields: new Map(), body: content, hasFrontmatter: false }
  }
  const end = content.indexOf('\n---', 3)
  if (end < 0) return { fields: new Map(), body: content, hasFrontmatter: false }
  const fields = new Map<string, string | string[] | boolean>()
  const lines = content.slice(3, end).split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    const raw = line.slice(idx + 1).trim()
    if (!raw) {
      const list: string[] = []
      while (i + 1 < lines.length && lines[i + 1].trimStart().startsWith('- ')) {
        i += 1
        list.push(stripSurroundingQuotes(lines[i].trimStart().slice(2).trim()))
      }
      fields.set(key, list)
    } else if (raw.startsWith('[') && raw.endsWith(']')) {
      fields.set(key, parseInlineList(raw))
    } else if (raw === 'true' || raw === 'false') {
      fields.set(key, raw === 'true')
    } else {
      fields.set(key, stripSurroundingQuotes(raw))
    }
  }
  return {
    fields,
    body: content.slice(end + 4).replace(/^\r?\n/, ''),
    hasFrontmatter: true,
  }
}

export function fieldString(fields: Map<string, string | string[] | boolean>, key: string): string {
  const value = fields.get(key)
  return typeof value === 'string' ? value : ''
}

export function fieldList(fields: Map<string, string | string[] | boolean>, key: string): string[] {
  const value = fields.get(key)
  if (Array.isArray(value)) return value
  return typeof value === 'string' ? parseInlineList(value) : []
}

export function fieldBool(fields: Map<string, string | string[] | boolean>, key: string): boolean {
  return fields.get(key) === true
}

export function parseSimpleFrontmatter(content: string): {
  fields: Map<string, string>
  body: string
  hasFrontmatter: boolean
} {
  if (!content.startsWith('---')) {
    return { fields: new Map(), body: content, hasFrontmatter: false }
  }
  const end = content.indexOf('\n---', 3)
  if (end < 0) return { fields: new Map(), body: content, hasFrontmatter: false }
  const fields = new Map<string, string>()
  for (const line of content.slice(3, end).split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx < 0) continue
    fields.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim())
  }
  return {
    fields,
    body: content.slice(end + 4).replace(/^\r?\n/, ''),
    hasFrontmatter: true,
  }
}

export function assertInsideRoot(workspaceRoot: string, path: string): string {
  const abs = resolve(path)
  const root = resolve(workspaceRoot)
  const out = relative(root, abs)
  if (out.startsWith('..') || isAbsolute(out)) {
    throw new LocalCrudError('path_outside_workspace', '路径超出 workspace 范围', 403)
  }
  return abs
}

export function assertNoSymlink(workspaceRoot: string, path: string): void {
  let current = resolve(workspaceRoot)
  const rel = relative(current, resolve(path))
  for (const part of rel.split(/[\\/]/).filter(Boolean)) {
    current = resolve(current, part)
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new LocalCrudError('symlink_rejected', '拒绝通过符号链接访问 workspace 文件', 403)
    }
  }
}

export function assertWritable(
  workspaceRoot: string,
  path: string,
  mode: AuthorizationMode = DEFAULT_MODE,
): void {
  const abs = resolve(path)
  const decision = isPathAllowed(mode, workspaceRoot, abs)
  if (!decision.allowed) {
    throw new LocalCrudError('write_blocked', decision.reason ?? '写入被权限策略拒绝', 403)
  }
  const parent = dirname(abs)
  const root = resolve(workspaceRoot)
  const out = relative(root, parent)
  if (out.startsWith('..') || isAbsolute(out)) {
    throw new LocalCrudError('path_outside_workspace', '路径超出 workspace 范围', 403)
  }
  if (existsSync(parent)) assertNoSymlink(workspaceRoot, parent)
}

export function recordWrite(
  changeSetService: ChangeSetService,
  workspaceRoot: string,
  runId: string,
  path: string,
  operation: ChangeSetOperation,
  afterContent: string | undefined,
  mode: AuthorizationMode = DEFAULT_MODE,
): ChangeSet {
  const rel = relative(resolve(workspaceRoot), resolve(path)).split(/[\\/]/).join('/')
  const cs = changeSetService.recordChangeSet({
    runId,
    path: rel,
    operation,
    mode,
    afterContent,
    risk: operation === 'remove' ? 'medium' : 'low',
  })
  if (cs.status !== 'applied') {
    throw new LocalCrudError('write_blocked', '写入被权限策略拒绝', 403, { changeSet: cs })
  }
  return cs
}

export function writeTracked(
  changeSetService: ChangeSetService,
  workspaceRoot: string,
  runId: string,
  path: string,
  content: string | Buffer,
  mode: AuthorizationMode = DEFAULT_MODE,
): void {
  assertWritable(workspaceRoot, path, mode)
  mkdirSync(dirname(path), { recursive: true })
  const operation = existsSync(path) ? 'edit' : 'create'
  recordWrite(
    changeSetService,
    workspaceRoot,
    runId,
    path,
    operation,
    Buffer.isBuffer(content) ? content.toString('utf8') : content,
    mode,
  )
  writeFileSync(path, content)
}

export function removeTracked(
  changeSetService: ChangeSetService,
  workspaceRoot: string,
  runId: string,
  path: string,
  mode: AuthorizationMode = DEFAULT_MODE,
): void {
  const abs = assertInsideRoot(workspaceRoot, path)
  if (!existsSync(abs)) throw new LocalCrudError('file_not_found', '文件不存在', 404)
  assertNoSymlink(workspaceRoot, abs)
  recordWrite(changeSetService, workspaceRoot, runId, abs, 'remove', undefined, mode)
  if (existsSync(abs)) rmSync(abs, { recursive: true, force: true })
}

export function readWorkspaceFile(workspaceRoot: string, path: string): string {
  const abs = assertInsideRoot(workspaceRoot, path)
  assertNoSymlink(workspaceRoot, abs)
  return readFileSync(abs, 'utf8')
}
