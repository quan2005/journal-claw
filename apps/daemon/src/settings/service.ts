import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type Theme = 'light' | 'dark' | 'system'
export type AutoLintFrequency = 'daily' | 'weekly' | 'monthly'
export type AutoLintTime = '03:00' | '12:00' | '22:00'
export type AutoLintMinEntries = 10 | 20 | 30

export interface AutoLintConfig {
  enabled: boolean
  frequency: AutoLintFrequency
  time: AutoLintTime
  min_entries: AutoLintMinEntries
}

export type WorkspaceTreeSort = 'name-asc' | 'name-desc' | 'mtime-desc' | 'type-first' | 'manual'

export type ComposerThinkingLevel = 'low' | 'medium' | 'high'

export interface WorkspaceSettings {
  theme: Theme
  auto_lint: AutoLintConfig
  global_skills_enabled: boolean
  pinned?: unknown
  disabled_skills?: string[]
  enabled_global_skills?: string[]
  workspace_tree_sort: WorkspaceTreeSort
  workspace_tree_manual_order?: Record<string, string[]>
  composer_selected_provider_id?: string
  composer_thinking_level: ComposerThinkingLevel
  [key: string]: unknown
}

export class SettingsValidationError extends Error {
  constructor(
    readonly field: string,
    readonly value: unknown,
    message: string,
  ) {
    super(message)
    this.name = 'SettingsValidationError'
  }
}

const SETTINGS_FILE = '.setting.json'
const DEFAULT_SETTINGS: WorkspaceSettings = {
  theme: 'system',
  auto_lint: {
    enabled: false,
    frequency: 'daily',
    time: '03:00',
    min_entries: 10,
  },
  global_skills_enabled: false,
  workspace_tree_sort: 'name-asc',
  composer_thinking_level: 'medium',
}

export class SettingsService {
  constructor(private readonly workspaceRoot: string) {}

  load(): WorkspaceSettings {
    const raw = this.readRaw()
    return normalizeSettings(raw)
  }

  update(patch: Record<string, unknown>): WorkspaceSettings {
    const raw = this.readRaw()
    const nextRaw = mergeSettingsRaw(raw, patch)
    const normalized = normalizeSettings(nextRaw, { strict: true })
    this.persist(nextRaw)
    return normalized
  }

  setSkillEnabled(skillId: string, enabled: boolean): WorkspaceSettings {
    const current = this.load()
    const list = current.disabled_skills ?? []
    const next = enabled ? list.filter((id) => id !== skillId) : [...new Set([...list, skillId])]
    return this.update({ disabled_skills: next.length > 0 ? next : undefined })
  }

  setGlobalSkillEnabled(skillId: string, enabled: boolean): WorkspaceSettings {
    const current = this.load()
    const list = current.enabled_global_skills ?? []
    const next = enabled ? [...new Set([...list, skillId])] : list.filter((id) => id !== skillId)
    return this.update({ enabled_global_skills: next.length > 0 ? next : undefined })
  }

  private readRaw(): Record<string, unknown> {
    const path = join(this.workspaceRoot, SETTINGS_FILE)
    if (!existsSync(path)) return {}
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
      return isRecord(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }

  private persist(raw: Record<string, unknown>): void {
    writeFileSync(join(this.workspaceRoot, SETTINGS_FILE), JSON.stringify(raw, null, 2), 'utf8')
  }
}

function mergeSettingsRaw(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current }
  for (const [key, value] of Object.entries(patch)) {
    if (
      value === undefined ||
      (value === null && (key === 'disabled_skills' || key === 'enabled_global_skills'))
    ) {
      delete next[key]
    } else if (key === 'auto_lint' && isRecord(value) && isRecord(next.auto_lint)) {
      next.auto_lint = { ...next.auto_lint, ...value }
    } else {
      next[key] = value
    }
  }
  return next
}

function normalizeSettings(
  raw: Record<string, unknown>,
  opts: { strict?: boolean } = {},
): WorkspaceSettings {
  const theme = normalizeTheme(raw.theme, opts.strict)
  const autoLintSource = isRecord(raw.auto_lint)
    ? raw.auto_lint
    : isRecord(raw.auto_dream)
      ? raw.auto_dream
      : {}
  const autoLint = normalizeAutoLint(autoLintSource, opts.strict)
  return {
    ...raw,
    theme,
    auto_lint: autoLint,
    global_skills_enabled:
      typeof raw.global_skills_enabled === 'boolean'
        ? raw.global_skills_enabled
        : DEFAULT_SETTINGS.global_skills_enabled,
    disabled_skills: normalizeStringList(raw.disabled_skills),
    enabled_global_skills: normalizeStringList(raw.enabled_global_skills),
    workspace_tree_sort: normalizeTreeSort(raw.workspace_tree_sort),
    workspace_tree_manual_order: isRecord(raw.workspace_tree_manual_order)
      ? (raw.workspace_tree_manual_order as Record<string, string[]>)
      : undefined,
    composer_selected_provider_id:
      typeof raw.composer_selected_provider_id === 'string' && raw.composer_selected_provider_id
        ? raw.composer_selected_provider_id
        : undefined,
    composer_thinking_level: normalizeComposerThinkingLevel(raw.composer_thinking_level),
  }
}

function normalizeAutoLint(raw: Record<string, unknown>, strict = false): AutoLintConfig {
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_SETTINGS.auto_lint.enabled,
    frequency: normalizeFrequency(raw.frequency, strict),
    time: normalizeTime(raw.time, strict),
    min_entries: normalizeMinEntries(raw.min_entries, strict),
  }
}

function normalizeTheme(value: unknown, strict = false): Theme {
  if (isValidTheme(value)) return value
  if (strict && value !== undefined) throw invalid('theme', value)
  return DEFAULT_SETTINGS.theme
}

function normalizeFrequency(value: unknown, strict = false): AutoLintFrequency {
  if (isValidFrequency(value)) return value
  if (strict && value !== undefined) throw invalid('auto_lint.frequency', value)
  return DEFAULT_SETTINGS.auto_lint.frequency
}

function normalizeTime(value: unknown, strict = false): AutoLintTime {
  if (isValidTime(value)) return value
  if (strict && value !== undefined) throw invalid('auto_lint.time', value)
  return DEFAULT_SETTINGS.auto_lint.time
}

function normalizeMinEntries(value: unknown, strict = false): AutoLintMinEntries {
  if (isValidMinEntries(value)) return value
  if (strict && value !== undefined) throw invalid('auto_lint.min_entries', value)
  return DEFAULT_SETTINGS.auto_lint.min_entries
}

function normalizeStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const list = value.filter((item): item is string => typeof item === 'string')
  return list.length > 0 ? list : undefined
}

const VALID_TREE_SORTS: WorkspaceTreeSort[] = [
  'name-asc',
  'name-desc',
  'mtime-desc',
  'type-first',
  'manual',
]

function normalizeTreeSort(value: unknown): WorkspaceTreeSort {
  return VALID_TREE_SORTS.includes(value as WorkspaceTreeSort)
    ? (value as WorkspaceTreeSort)
    : 'name-asc'
}

const VALID_COMPOSER_THINKING_LEVELS: ComposerThinkingLevel[] = ['low', 'medium', 'high']

function normalizeComposerThinkingLevel(value: unknown): ComposerThinkingLevel {
  return VALID_COMPOSER_THINKING_LEVELS.includes(value as ComposerThinkingLevel)
    ? (value as ComposerThinkingLevel)
    : 'medium'
}

function isValidTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

function isValidFrequency(value: unknown): value is AutoLintFrequency {
  return value === 'daily' || value === 'weekly' || value === 'monthly'
}

function isValidTime(value: unknown): value is AutoLintTime {
  return value === '03:00' || value === '12:00' || value === '22:00'
}

function isValidMinEntries(value: unknown): value is AutoLintMinEntries {
  return value === 10 || value === 20 || value === 30
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalid(field: string, value: unknown): SettingsValidationError {
  return new SettingsValidationError(field, value, `invalid ${field}: ${String(value)}`)
}
