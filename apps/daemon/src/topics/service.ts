import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { ChangeSetService } from '../changeset/service.js'
import {
  assertInsideRoot,
  createdSecs,
  LocalCrudError,
  mtimeSecs,
  recordWrite,
  removeTracked,
} from '../local/service.js'

export interface TopicEntry {
  name: string
  is_dir: boolean
  path: string
  created_secs: number
  mtime_secs: number
}

const RUN_ID = 'topics-manual'

export class TopicsService {
  constructor(
    private readonly workspaceRoot: string,
    private readonly changeSetService: ChangeSetService,
  ) {}

  listDir(relativePath = ''): TopicEntry[] {
    const dir = relativePath ? this.resolveTopicPath(relativePath) : this.topicsDir()
    if (!existsSync(dir)) return []
    if (!statSync(dir).isDirectory()) throw new LocalCrudError('not_directory', '目标不是目录')
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'DS_Store')
      .map((entry) => {
        const full = join(dir, entry.name)
        const rel = relativePath ? `${relativePath}/${entry.name}` : entry.name
        return {
          name: entry.name,
          is_dir: entry.isDirectory(),
          path: rel,
          created_secs: createdSecs(full),
          mtime_secs: mtimeSecs(full),
        }
      })
      .sort((a, b) => Number(b.is_dir) - Number(a.is_dir) || a.name.localeCompare(b.name))
  }

  create(name: string, parentPath?: string | null): void {
    const dir = parentPath ? this.resolveTopicPath(parentPath, name) : this.resolveTopicPath(name)
    recordWrite(this.changeSetService, this.workspaceRoot, RUN_ID, dir, 'create', '')
    mkdirSync(dir, { recursive: true })
  }

  delete(relativePath: string): void {
    const full = this.resolveTopicPath(relativePath)
    if (!existsSync(full))
      throw new LocalCrudError('path_not_found', `路径不存在: ${relativePath}`, 404)
    removeTracked(this.changeSetService, this.workspaceRoot, RUN_ID, full)
  }

  importFile(source: string, topicPath: string): string {
    const destDir = topicPath ? this.resolveTopicPath(topicPath) : this.topicsDir()
    mkdirSync(destDir, { recursive: true })
    const fname = basename(source)
    if (!fname) throw new LocalCrudError('invalid_filename', '无效文件名')
    const dest = join(destDir, fname)
    const content = existsSync(source) ? undefined : null
    if (content === null) throw new LocalCrudError('file_not_found', '文件不存在', 404)
    recordWrite(this.changeSetService, this.workspaceRoot, RUN_ID, dest, 'create', '')
    copyFileSync(source, dest)
    return topicPath ? `${topicPath}/${fname}` : fname
  }

  private topicsDir(): string {
    return join(this.workspaceRoot, 'topics')
  }

  private resolveTopicPath(...parts: string[]): string {
    const full = resolve(this.topicsDir(), ...parts)
    assertInsideRoot(this.workspaceRoot, full)
    const out = relative(resolve(this.topicsDir()), full)
    if (out.startsWith('..')) {
      throw new LocalCrudError('path_outside_topics', '路径超出 topics 范围', 403)
    }
    return full
  }
}
