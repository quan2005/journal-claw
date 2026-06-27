import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { SettingsService } from '../settings/service.js'

export interface TriggerInfo {
  kind: string
  label: string
}

export interface LoadInfo {
  name: string
  type: string
}

export interface SkillInfo {
  id: string
  name: string
  description: string
  scope: 'builtin' | 'project' | 'global'
  dir_name: string
  triggers: TriggerInfo[]
  output: string | null
  loads: LoadInfo[]
  enabled: boolean
  shadowed_by?: string | null
}

const DEV_SKILLS = new Set(['docs-maintenance', 'requirements-gate', 'verification-gate'])

export class SkillsService {
  constructor(
    private readonly workspaceRoot: string,
    private readonly settingsService: SettingsService,
    private readonly repoRoot = resolve(process.cwd(), '..', '..'),
    private readonly homeDir = homedir(),
  ) {}

  listSkills(): SkillInfo[] {
    const builtin = this.scanBuiltinSkills()
    const project = this.scanSkillsDir(join(this.workspaceRoot, '.agents', 'skills'), 'project')
    const global = this.scanGlobalSkillsExtended()
    const all = mergeSkillsWithPriority(builtin, project, global)
    const settings = this.settingsService.load()
    const disabled = new Set(settings.disabled_skills ?? [])
    const enabledGlobals = new Set(settings.enabled_global_skills ?? [])

    for (const skill of all) {
      if (skill.shadowed_by) {
        skill.enabled = false
      } else if (skill.scope === 'builtin') {
        skill.enabled = true
      } else if (skill.scope === 'project') {
        skill.enabled = !disabled.has(skill.id)
      } else if (skill.scope === 'global') {
        skill.enabled = enabledGlobals.has(skill.id)
      }
    }
    return all
  }

  getSkillContent(skillId: string): string {
    const path = this.resolveSkillMarkdown(skillId)
    return readFileSync(path, 'utf8')
  }

  setSkillEnabled(skillId: string, enabled: boolean): void {
    this.settingsService.setSkillEnabled(skillId, enabled)
  }

  setGlobalSkillEnabled(skillId: string, enabled: boolean): void {
    this.settingsService.setGlobalSkillEnabled(skillId, enabled)
  }

  openSkillsDir(scope: string): void {
    const dir =
      scope === 'global'
        ? join(this.homeDir, '.claude', 'skills')
        : join(this.workspaceRoot, '.agents', 'skills')
    mkdirSync(dir, { recursive: true })
    openWithSystem(dir)
  }

  openSkillDir(scope: string, dirName: string): void {
    const base =
      scope === 'global'
        ? join(this.homeDir, '.claude', 'skills')
        : join(this.workspaceRoot, '.agents', 'skills')
    const target = join(base, dirName)
    if (!existsSync(target)) throw new Error(`skill directory not found: ${target}`)
    openWithSystem(target)
  }

  private scanBuiltinSkills(): SkillInfo[] {
    return this.scanSkillsDir(
      join(
        this.repoRoot,
        'apps',
        'web',
        'resources',
        'workspace-template',
        '.claude',
        'skills',
      ),
      'builtin',
    ).filter((skill) => !DEV_SKILLS.has(skill.dir_name))
  }

  private scanGlobalSkillsExtended(): SkillInfo[] {
    const all = this.scanSkillsDir(join(this.homeDir, '.claude', 'skills'), 'global')
    const cache = join(this.homeDir, '.claude', 'plugins', 'cache')
    if (!existsSync(cache)) return all

    for (const publisher of readDirs(cache)) {
      for (const plugin of readDirs(join(cache, publisher))) {
        const pluginDir = join(cache, publisher, plugin)
        const versions = readDirs(pluginDir).sort((a, b) => b.localeCompare(a))
        const latest = versions[0]
        if (!latest) continue
        const skillsDir = join(pluginDir, latest, 'skills')
        if (!existsSync(skillsDir)) continue
        for (const skill of this.scanSkillsDir(skillsDir, 'global')) {
          skill.dir_name = `${publisher}/${plugin}/${skill.dir_name}`
          skill.id = `global:${skill.dir_name}`
          all.push(skill)
        }
      }
    }
    return all
  }

  private scanSkillsDir(dir: string, scope: SkillInfo['scope']): SkillInfo[] {
    if (!existsSync(dir)) return []
    const skills: SkillInfo[] = []
    for (const dirName of readDirs(dir)) {
      const skillDir = join(dir, dirName)
      const skillMd = join(skillDir, 'SKILL.md')
      if (!existsSync(skillMd)) continue
      const parsed = parseSkillFrontmatter(readFileSync(skillMd, 'utf8'))
      if (!parsed) continue
      skills.push({
        id: `${scope}:${dirName}`,
        name: parsed.name,
        description: parsed.description,
        scope,
        dir_name: dirName,
        triggers: parsed.triggers,
        output: parsed.output,
        loads: scanSkillLoads(skillDir),
        enabled: true,
        shadowed_by: null,
      })
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name))
  }

  private resolveSkillMarkdown(skillId: string): string {
    const [scope, dirName] = splitSkillId(skillId)
    if (scope === 'builtin') {
      return join(
        this.repoRoot,
        'apps',
        'web',
        'resources',
        'workspace-template',
        '.claude',
        'skills',
        dirName,
        'SKILL.md',
      )
    }
    if (scope === 'project')
      return join(this.workspaceRoot, '.agents', 'skills', dirName, 'SKILL.md')
    if (scope === 'global') {
      const parts = dirName.split('/')
      if (parts.length === 3) {
        const pluginDir = join(this.homeDir, '.claude', 'plugins', 'cache', parts[0], parts[1])
        const latest = readDirs(pluginDir).sort((a, b) => b.localeCompare(a))[0]
        if (!latest) throw new Error(`no version found for plugin: ${dirName}`)
        return join(pluginDir, latest, 'skills', parts[2], 'SKILL.md')
      }
      return join(this.homeDir, '.claude', 'skills', dirName, 'SKILL.md')
    }
    throw new Error(`unknown scope: ${scope}`)
  }
}

function parseSkillFrontmatter(content: string): {
  name: string
  description: string
  triggers: TriggerInfo[]
  output: string | null
} | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const fm = match?.[1] ?? ''
  const name = scalarField(fm, 'name')
  if (!name) return null
  return {
    name,
    description: scalarField(fm, 'description') ?? '',
    output: scalarField(fm, 'output'),
    triggers: parseTriggers(fm),
  }
}

function scalarField(fm: string, key: string): string | null {
  const re = new RegExp(`^${key}:\\s*(.*)$`, 'm')
  const value = fm.match(re)?.[1]?.trim()
  if (!value) return null
  return stripQuotes(value)
}

function parseTriggers(fm: string): TriggerInfo[] {
  const lines = fm.split(/\r?\n/)
  const start = lines.findIndex((line) => /^triggers:\s*$/.test(line))
  if (start < 0) return []
  const triggers: TriggerInfo[] = []
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^\S/.test(line)) break
    const scalar = line.match(/^\s*-\s+(.+)$/)?.[1]?.trim()
    if (scalar && !scalar.includes(':')) {
      triggers.push(triggerFromString(stripQuotes(scalar)))
      continue
    }
    if (line.match(/^\s*-\s*/)) {
      const block = [line.replace(/^\s*-\s*/, '')]
      while (i + 1 < lines.length && /^\s{4,}\S/.test(lines[i + 1])) block.push(lines[++i].trim())
      const record = Object.fromEntries(
        block
          .map((entry) => entry.match(/^(\w+):\s*(.*)$/))
          .filter((entry): entry is RegExpMatchArray => entry !== null)
          .map((entry) => [entry[1], stripQuotes(entry[2].trim())]),
      )
      const kind = record.k ?? record.kind ?? 'nl'
      const label = record.t ?? record.label ?? record.text ?? kind
      triggers.push({ kind, label })
    }
  }
  return triggers
}

function triggerFromString(value: string): TriggerInfo {
  return { kind: value.startsWith('/') ? 'slash' : 'nl', label: value }
}

function scanSkillLoads(skillDir: string): LoadInfo[] {
  const loads: LoadInfo[] = []
  if (existsSync(join(skillDir, 'SKILL.md'))) loads.push({ name: 'SKILL.md', type: 'md' })
  for (const sub of ['references', 'assets']) {
    const subDir = join(skillDir, sub)
    if (!existsSync(subDir)) continue
    const entries = readdirSync(subDir).sort()
    for (const entry of entries) {
      const path = join(subDir, entry)
      const kind = statSync(path).isDirectory()
        ? 'dir'
        : entry.endsWith('.md')
          ? 'md'
          : entry.endsWith('.json')
            ? 'json'
            : 'file'
      loads.push({ name: `${sub}/${entry}`, type: kind })
    }
  }
  return loads
}

function mergeSkillsWithPriority(
  builtin: SkillInfo[],
  project: SkillInfo[],
  global: SkillInfo[],
): SkillInfo[] {
  const result: SkillInfo[] = []
  const seen = new Map<string, string>()
  for (const skill of [...builtin, ...project, ...global]) {
    const shadowedBy = seen.get(skill.name)
    if (shadowedBy) {
      result.push({ ...skill, shadowed_by: shadowedBy, enabled: false })
    } else {
      seen.set(skill.name, skill.id)
      result.push(skill)
    }
  }
  return result
}

function splitSkillId(skillId: string): [string, string] {
  const index = skillId.indexOf(':')
  if (index <= 0) throw new Error(`invalid skill_id format: ${skillId}`)
  return [skillId.slice(0, index), skillId.slice(index + 1)]
}

function readDirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, '')
}

function openWithSystem(path: string): void {
  const command = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'cmd' : 'xdg-open'
  const args = platform() === 'win32' ? ['/c', 'start', '', path] : [path]
  execFile(command, args, () => undefined)
}
