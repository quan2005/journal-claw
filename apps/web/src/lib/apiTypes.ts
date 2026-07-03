/**
 * apiTypes — single source of truth for daemon API shapes.
 *
 * Pure types, constants and small utilities with NO runtime dependencies on
 * runtimeClient / hostBridge. Components, hooks and lib modules import from
 * here instead of re-declaring the same daemon payload shapes.
 *
 * Domain entities that already live in `apps/web/src/types.ts` (JournalEntry,
 * IdentityEntry, PinnedItem, Automation*, DomainEvent, …) are NOT duplicated
 * here — import those from `../types`.
 */

// ── Topics ──────────────────────────────────────────────────
export interface TopicEntry {
  name: string
  is_dir: boolean
  path: string // workspace-relative
  created_secs?: number
  mtime_secs: number
  /** frontmatter title for .md/.mdx notes (parsed daemon-side); absent otherwise. */
  title?: string
}

// ── Conversation ────────────────────────────────────────────
export interface SessionSummary {
  id: string
  title: string | null
  created_at: number
  updated_at: number
  is_streaming: boolean
  message_count: number
}

export interface LoadedMessage {
  role: string
  content: string
  thinking?: string
  tools?: { name: string; label: string; output?: string; is_error?: boolean }[]
}

export interface SessionStats {
  elapsed_secs: number
  total_input_tokens: number
  total_output_tokens: number
}

export interface ImageAttachment {
  media_type: string
  data: string
}

// ── Engine config (provider list v3) ────────────────────────
export interface ProviderEntry {
  protocol: string
  id: string
  label: string
  api_key: string
  base_url: string
  model: string
}

export interface EngineConfig {
  active_provider: string
  providers: ProviderEntry[]
}

export interface BuiltinPreset {
  id: string
  label: string
  defaultProtocol: string
  defaultBaseUrl: string
  defaultModel: string
  apiKeyUrl: string
  apiKeyPlaceholder: string
}

export const BUILTIN_PRESETS: BuiltinPreset[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    defaultProtocol: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: '',
    apiKeyUrl: '',
    apiKeyPlaceholder: 'sk-ant-…',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultProtocol: 'openai',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    apiKeyPlaceholder: 'sk-…',
  },
  {
    id: 'volcengine',
    label: '火山方舟',
    defaultProtocol: 'openai',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-1.5-pro-256k',
    apiKeyUrl: 'https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=MAZQUPQF',
    apiKeyPlaceholder: '',
  },
  {
    id: 'kimi',
    label: 'Kimi',
    defaultProtocol: 'openai',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'kimi-k2-0711-preview',
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    apiKeyPlaceholder: 'sk-…',
  },
  {
    id: 'dashscope',
    label: '阿里云百炼',
    defaultProtocol: 'openai',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-max',
    apiKeyUrl: 'https://bailian.console.aliyun.com/?apiKey=1#/api-key',
    apiKeyPlaceholder: 'sk-…',
  },
]

export function newProviderId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

// ── Skills ──────────────────────────────────────────────────
export interface SkillTrigger {
  kind: string
  label: string
}

export interface SkillLoad {
  name: string
  type: string
}

export interface SkillInfo {
  id: string
  name: string
  description: string
  scope: 'builtin' | 'project' | 'global'
  dir_name: string
  triggers: SkillTrigger[]
  output: string | null
  loads: SkillLoad[]
  enabled: boolean
  shadowed_by?: string | null
}

// ── Permissions / Platform ──────────────────────────────────
export interface PlatformCapabilities {
  os: 'macos' | 'windows' | 'linux' | string
  apple_stt: boolean
  whisperkit: boolean
  speaker_diarization: boolean
  native_permissions: boolean
}

export type PermStatus = 'granted' | 'denied' | 'not_determined' | 'restricted' | 'unknown'

export interface AppPermissions {
  speech_recognition: PermStatus
}

// ── Workspace files ─────────────────────────────────────────
export interface WorkspaceDirEntry {
  name: string
  is_dir: boolean
  path: string
  created_secs?: number
  mtime_secs: number
}

export type AtMentionKind = 'file' | 'directory' | 'expert'

export interface AtMentionCandidate {
  name: string
  is_dir: boolean
  path: string
  mtime_secs: number
  kind: AtMentionKind
  insert_text?: string | null
  summary?: string | null
  tags: string[]
}

// ── Work queue ──────────────────────────────────────────────
export interface WorkItem {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  session_id: string | null
  text: string | null
  files: string[] | null
  prompt: string | null
  display_name: string
  error: string | null
  created_at: number
}

// ── Onboarding ──────────────────────────────────────────────
export interface OnboardingStatus {
  completed: boolean
  last_step: number | null
}

// ── Materials ───────────────────────────────────────────────
export interface ImportResult {
  path: string
  filename: string
  year_month: string
}

// ── Auto lint (workspace settings slice) ────────────────────
export interface AutoLintConfig {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  time: '03:00' | '12:00' | '22:00'
  min_entries: 10 | 20 | 30
}
