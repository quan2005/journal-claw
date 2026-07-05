import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { ChangeSetService } from '../changeset/service.js'
import {
  assertInsideRoot,
  fieldBool,
  fieldList,
  fieldString,
  mtimeSecs,
  parseSimpleFrontmatter,
  parseYamlishFields,
  readWorkspaceFile,
  removeTracked,
  stripSurroundingQuotes,
  writeTracked,
  yamlEscape,
} from '../local/service.js'

export interface IdentityEntry {
  filename: string
  path: string
  name: string
  region: string
  summary: string
  tags: string[]
  aliases: string[]
  expert_skill: string
  is_expert: boolean
  speaker_id: string
  mtime_secs: number
  archived: boolean
}

const RUN_ID = 'identity-manual'

export class IdentityService {
  constructor(
    private readonly workspaceRoot: string,
    private readonly changeSetService: ChangeSetService,
  ) {}

  list(): IdentityEntry[] {
    this.ensureDir()
    this.ensureSelfIdentity()
    return readdirSync(this.dir(), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => this.toEntry(entry.name))
      .filter((entry): entry is IdentityEntry => entry !== null)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  getContent(path: string): string {
    return readWorkspaceFile(this.workspaceRoot, path)
  }

  saveContent(path: string, content: string): void {
    writeTracked(
      this.changeSetService,
      this.workspaceRoot,
      RUN_ID,
      assertInsideRoot(this.workspaceRoot, path),
      content,
    )
  }

  delete(path: string): void {
    if (basename(path) === 'README.md') throw new Error('不可删除「关于我」')
    removeTracked(
      this.changeSetService,
      this.workspaceRoot,
      RUN_ID,
      assertInsideRoot(this.workspaceRoot, path),
    )
  }

  archive(path: string): void {
    this.setArchived(path, true)
  }

  unarchive(path: string): void {
    this.setArchived(path, false)
  }

  create(region: string, name: string, summary: string, tags: string[], speakerId: string): string {
    this.ensureDir()
    const filename = identityFilename(region, name)
    const path = join(this.dir(), filename)
    if (existsSync(path)) throw new Error(`身份文件已存在: ${filename}`)
    const tagsYaml = tags.map((tag) => `"${yamlEscape(tag)}"`).join(', ')
    const content = `---\nsummary: ${summary}\ntags: [${tagsYaml}]\nspeaker_id: "${yamlEscape(speakerId)}"\n---\n\n# ${name}\n`
    writeTracked(this.changeSetService, this.workspaceRoot, RUN_ID, path, content)
    return resolve(path)
  }

  merge(sourcePath: string, targetPath: string, mode: 'voice_only' | 'full'): void {
    if (sourcePath === targetPath) throw new Error('Cannot merge an identity into itself')
    const source = readWorkspaceFile(this.workspaceRoot, sourcePath)
    const target = readWorkspaceFile(this.workspaceRoot, targetPath)
    const src = parseIdentityFrontmatter(source)
    const tgt = parseIdentityFrontmatter(target)
    const mergedSpeakerId = tgt.speaker_id ? tgt.speaker_id : src.speaker_id
    const newTarget = formatIdentityContent(
      tgt.summary,
      tgt.tags,
      tgt.aliases,
      tgt.expert_skill,
      mergedSpeakerId,
      tgt.archived,
      parseSimpleFrontmatter(target).body,
    )
    this.saveContent(targetPath, newTarget)
    if (mode === 'voice_only') this.delete(sourcePath)
  }

  private setArchived(path: string, archived: boolean): void {
    const content = readWorkspaceFile(this.workspaceRoot, path)
    const parsed = parseSimpleFrontmatter(content)
    if (!parsed.hasFrontmatter) {
      if (!archived) return
      this.saveContent(path, `---\narchived: true\n---\n\n${content}`)
      return
    }
    const fm = parseIdentityFrontmatter(content)
    if (fm.archived === archived) return
    this.saveContent(
      path,
      formatIdentityContent(
        fm.summary,
        fm.tags,
        fm.aliases,
        fm.expert_skill,
        fm.speaker_id,
        archived,
        parsed.body,
      ),
    )
  }

  private toEntry(filename: string): IdentityEntry | null {
    const special = filename === 'README.md'
    const parsed = special ? { region: '', name: '关于我' } : parseIdentityFilename(filename)
    if (!parsed) return null
    const path = join(this.dir(), filename)
    const fm = parseIdentityFrontmatter(readFileSync(path, 'utf8'))
    return {
      filename,
      path: resolve(path),
      name: parsed.name,
      region: parsed.region,
      summary: stripSurroundingQuotes(fm.summary),
      tags: fm.tags,
      aliases: fm.aliases,
      expert_skill: fm.expert_skill,
      is_expert: isExpertIdentity(fm.tags, fm.expert_skill),
      speaker_id: fm.speaker_id,
      mtime_secs: mtimeSecs(path),
      archived: fm.archived,
    }
  }

  private ensureDir(): void {
    mkdirSync(this.dir(), { recursive: true })
  }

  private ensureSelfIdentity(): void {
    const path = join(this.dir(), 'README.md')
    if (existsSync(path)) return
    writeTracked(this.changeSetService, this.workspaceRoot, RUN_ID, path, selfIdentityContent())
  }

  private dir(): string {
    return join(this.workspaceRoot, 'identity')
  }
}

export function identityFilename(region: string, name: string): string {
  return `${region}-${name}.md`
}

export function parseIdentityFilename(filename: string): { region: string; name: string } | null {
  if (!filename.endsWith('.md')) return null
  const stem = filename.slice(0, -3)
  const dash = stem.indexOf('-')
  if (dash < 0) return null
  const region = stem.slice(0, dash)
  const name = stem.slice(dash + 1)
  return region && name ? { region, name } : null
}

function parseIdentityFrontmatter(content: string): {
  summary: string
  tags: string[]
  aliases: string[]
  expert_skill: string
  speaker_id: string
  archived: boolean
} {
  const { fields } = parseYamlishFields(content)
  return {
    summary: stripSurroundingQuotes(fieldString(fields, 'summary')),
    tags: fieldList(fields, 'tags'),
    aliases: fieldList(fields, 'aliases'),
    expert_skill: stripSurroundingQuotes(fieldString(fields, 'expert_skill')),
    speaker_id: stripSurroundingQuotes(fieldString(fields, 'speaker_id')),
    archived: fieldBool(fields, 'archived'),
  }
}

function formatIdentityContent(
  summary: string,
  tags: string[],
  aliases: string[],
  expertSkill: string,
  speakerId: string,
  archived: boolean,
  body: string,
): string {
  const tagsYaml = tags.map((tag) => `"${yamlEscape(tag)}"`).join(', ')
  const aliasesLine = aliases.length
    ? `aliases: [${aliases.map((alias) => `"${yamlEscape(alias)}"`).join(', ')}]\n`
    : ''
  const expertLine = expertSkill.trim() ? `expert_skill: "${yamlEscape(expertSkill)}"\n` : ''
  const archivedLine = archived ? 'archived: true\n' : ''
  return `---\nsummary: "${yamlEscape(summary)}"\ntags: [${tagsYaml}]\n${aliasesLine}${expertLine}speaker_id: "${yamlEscape(speakerId)}"\n${archivedLine}---\n\n${body.replace(/^\s+/, '')}`
}

function isExpertIdentity(tags: string[], expertSkill: string): boolean {
  return (
    expertSkill.trim().length > 0 ||
    tags.some((tag) => tag.trim() === '专家' || tag.trim().toLowerCase() === 'expert')
  )
}

function selfIdentityContent(): string {
  return `---
summary: "你的个人档案，谨迹会参考这里的信息来更好地整理你的日志"
tags: []
speaker_id: ""
---

# 关于我

## 基本信息

- 姓名：
- 角色：
- 所在地：

## 工作偏好

- 沟通风格：
- 关注领域：
`
}
