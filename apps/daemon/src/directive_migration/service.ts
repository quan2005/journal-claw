import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { validateMdxDocument } from '../mdx/service.js'

const EXCLUDED_DIRS = new Set([
  'raw',
  '.claude',
  '.Codex',
  'node_modules',
  '.directive-migration-backup',
])

export interface LegacyDirectiveFile {
  path: string
  relative_path: string
  extension: string
}

export interface ApplyDirectiveMigrationRequest {
  source_path: string
  destination_path: string
  content: string
}

export interface ApplyDirectiveMigrationResult {
  destination_path: string
  backup_path: string
}

export class DirectiveMigrationService {
  constructor(
    private readonly workspaceRoot: string,
    private readonly now = () => new Date(),
  ) {}

  scanLegacyDirectiveFiles(): LegacyDirectiveFile[] {
    if (!existsSync(this.workspaceRoot)) return []
    const workspace = resolve(this.workspaceRoot)
    const files: LegacyDirectiveFile[] = []
    this.scanDir(workspace, workspace, files)
    return files.sort((a, b) => a.relative_path.localeCompare(b.relative_path))
  }

  applyDirectiveMigration(request: ApplyDirectiveMigrationRequest): ApplyDirectiveMigrationResult {
    const workspace = resolve(this.workspaceRoot)
    const source = this.resolveSource(workspace, request.source_path)
    const destination = this.resolveDestination(workspace, request.destination_path)
    if (extname(destination) !== '.mdx') {
      throw new Error('directive migration destination must use the .mdx extension')
    }
    if (source !== destination && existsSync(destination)) {
      throw new Error('directive migration destination already exists')
    }
    validateMdxDocument(request.content, destination)

    const relativeSource = relative(workspace, source)
    const backup = join(
      workspace,
      '.Codex',
      'migrations',
      'directive-to-jsx',
      formatTimestamp(this.now()),
      relativeSource,
    )
    mkdirSync(dirname(backup), { recursive: true })
    copyFileSync(source, backup)

    const temporary = join(
      dirname(destination),
      `.${basename(destination)}.directive-migration-${randomUUID()}.tmp`,
    )
    try {
      writeFileSync(temporary, request.content, 'utf8')
      renameSync(temporary, destination)
      if (source !== destination) rmSync(source)
    } catch (err) {
      try {
        rmSync(temporary)
      } catch {
        // ignore cleanup failure
      }
      throw err
    }

    return { destination_path: destination, backup_path: backup }
  }

  private scanDir(workspace: string, dir: string, files: LegacyDirectiveFile[]): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) this.scanDir(workspace, path, files)
        continue
      }
      if (!entry.isFile()) continue
      const extension = extname(entry.name).slice(1)
      if (extension !== 'md' && extension !== 'mdx') continue
      const source = readFileSync(path, 'utf8')
      if (!hasLegacyDirective(source)) continue
      files.push({ path, relative_path: relative(workspace, path), extension })
    }
  }

  private resolveSource(workspace: string, requested: string): string {
    if (!requested || !isAbsoluteNormalized(requested)) {
      throw new Error('source path must be an absolute normalized path')
    }
    const resolved = resolve(requested)
    if (!resolved.startsWith(workspace) || !existsSync(resolved) || !statSync(resolved).isFile()) {
      throw new Error('source path is outside the configured workspace')
    }
    return resolved
  }

  private resolveDestination(workspace: string, requested: string): string {
    if (!requested || !isAbsoluteNormalized(requested)) {
      throw new Error('destination path must be an absolute normalized path')
    }
    const parent = resolve(dirname(requested))
    if (!parent.startsWith(workspace) || !existsSync(parent)) {
      throw new Error('destination path is outside the configured workspace')
    }
    return join(parent, basename(requested))
  }
}

export function hasLegacyDirective(source: string): boolean {
  let fence: '`' | '~' | null = null
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trimStart()
    const marker = trimmed.startsWith('```') ? '`' : trimmed.startsWith('~~~') ? '~' : null
    if (marker) {
      fence = fence === marker ? null : fence === null ? marker : fence
      continue
    }
    if (fence) continue
    const name = trimmed.startsWith(':::') ? trimmed.slice(3) : ''
    if (/^[A-Za-z]/.test(name)) return true
  }
  return false
}

function isAbsoluteNormalized(path: string): boolean {
  return (
    resolve(path) === path &&
    !path.split(/[\\/]/).includes('..') &&
    !path.split(/[\\/]/).includes('.')
  )
}

function formatTimestamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
