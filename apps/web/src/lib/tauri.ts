import {
  hostOpenWithSystem,
  hostOpenPrivacySettings,
  hostOpenSettings,
  hostRevealInFileManager,
  pickHostFolder,
} from './hostBridge'
import { selectRuntimeClient } from './runtimeClient'
import type {
  JournalEntry,
  IdentityEntry,
  MergeMode,
  TodoItem,
  AutomationTemplate,
  AutomationRoutine,
  AutomationRun,
  CreateRoutineRequest,
  UpdateRoutineRequest,
  DomainEvent,
} from '../types'

export type { CreateRoutineRequest, UpdateRoutineRequest } from '../types'

export const revealInFileManager = (path: string): Promise<void> => hostRevealInFileManager(path)

export const openSettings = (): Promise<void> => hostOpenSettings()

export const getApiKey = (): Promise<string | null> =>
  selectRuntimeClient().invoke<string | null>('get_api_key')

export const setApiKey = (key: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_api_key', { key })

export const getWorkspacePath = () => selectRuntimeClient().invoke<string>('get_workspace_path')

export const setWorkspacePath = (path: string) =>
  selectRuntimeClient().invoke<void>('set_workspace_path', { path })

export const getWorkspaceTheme = (): Promise<'light' | 'dark' | 'system'> =>
  selectRuntimeClient().invoke<'light' | 'dark' | 'system'>('get_workspace_theme')

export const setWorkspaceTheme = (theme: 'light' | 'dark' | 'system'): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_workspace_theme', { theme })

// Unified conversation panel engine selection (builtin pi ↔ external CLI agent).
// Persisted via daemon settings (PUT /settings), never localStorage.
export const getAgentEngine = (): Promise<{ engine: 'builtin' | 'cli'; agentId: string | null }> =>
  selectRuntimeClient().invoke<{ engine: 'builtin' | 'cli'; agentId: string | null }>(
    'get_agent_engine',
  )

export const setAgentEngine = (patch: {
  engine?: 'builtin' | 'cli'
  agentId?: string | null
}): Promise<void> => selectRuntimeClient().invoke<void>('set_agent_engine', patch)

// Journal
export const listAvailableMonths = () =>
  selectRuntimeClient().invoke<string[]>('list_available_months')

export const listJournalEntriesByMonths = (months: string[]) =>
  selectRuntimeClient().invoke<JournalEntry[]>('list_journal_entries_by_months', { months })

export const listAllJournalEntries = () =>
  selectRuntimeClient().invoke<JournalEntry[]>('list_all_journal_entries')

export const listJournalEntriesPaginated = (
  offset: number,
  limit: number,
): Promise<[JournalEntry[], number]> =>
  selectRuntimeClient().invoke<[JournalEntry[], number]>('list_journal_entries_paginated', {
    offset,
    limit,
  })

export const getJournalEntryContent = (path: string) =>
  selectRuntimeClient().invoke<string>('get_journal_entry_content', { path })

export const saveJournalEntryContent = (path: string, content: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('save_journal_entry_content', { path, content })

// Materials
export const importFile = (srcPath: string) =>
  selectRuntimeClient().invoke<{ path: string; filename: string; year_month: string }>(
    'import_file',
    { srcPath },
  )

// AI Processing
export const triggerAiProcessing = (materialPath: string, yearMonth: string, note?: string) =>
  selectRuntimeClient().invoke<void>('trigger_ai_processing', {
    materialPath,
    yearMonth,
    note: note ?? null,
  })

export const deleteJournalEntry = (path: string) =>
  selectRuntimeClient().invoke<void>('delete_journal_entry', { path })

// 粘贴文本 → 写入系统 temp 目录 → 返回路径（不自动触发 AI，OS 自动清理）
export const importTextTemp = (text: string) =>
  selectRuntimeClient().invoke<{ path: string; filename: string; year_month: string }>(
    'import_text_temp',
    { text },
  )

// 粘贴文本 → 保存为 raw 文件 → 返回路径（不自动触发 AI）
export const importText = (text: string) =>
  selectRuntimeClient().invoke<{ path: string; filename: string; year_month: string }>(
    'import_text',
    { text },
  )

// Paste image → write to temp dir → return path
export const importImageTemp = (data: string, mediaType: string) =>
  selectRuntimeClient().invoke<{ path: string; filename: string; year_month: string }>(
    'import_image_temp',
    {
      data,
      mediaType,
    },
  )

// Pure prompt → send text directly (no file written)
export const triggerAiPrompt = (prompt: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('trigger_ai_prompt', { prompt })

// Paste text → save as raw material → trigger AI processing
export const submitPasteText = async (text: string): Promise<void> => {
  const result = await importText(text)
  await triggerAiProcessing(result.path, result.year_month)
}

export const getWorkspacePrompt = () => selectRuntimeClient().invoke<string>('get_workspace_prompt')

export const setWorkspacePrompt = (content: string) =>
  selectRuntimeClient().invoke<void>('set_workspace_prompt', { content })

export const resetWorkspacePrompt = () =>
  selectRuntimeClient().invoke<string>('reset_workspace_prompt')

export const openFile = (path: string): Promise<void> => hostOpenWithSystem(path)

export const openUrl = (url: string): Promise<void> => hostOpenWithSystem(url)

export const cancelAiProcessing = () => selectRuntimeClient().invoke<void>('cancel_ai_processing')

export const cancelQueuedItem = (materialPath: string) =>
  selectRuntimeClient().invoke<void>('cancel_queued_item', { materialPath })

export const importAudioFile = (srcPath: string) =>
  selectRuntimeClient().invoke<{ path: string; filename: string; year_month: string }>(
    'import_file',
    { srcPath },
  )

// Folder picker
export const pickFolder = (): Promise<string | null> => {
  return pickHostFolder()
}

// App version
export const getAppVersion = (): Promise<string> =>
  selectRuntimeClient().invoke<string>('get_app_version')

export interface PlatformCapabilities {
  os: 'macos' | 'windows' | 'linux' | string
  apple_stt: boolean
  whisperkit: boolean
  speaker_diarization: boolean
  native_permissions: boolean
}

export const getPlatformCapabilities = (): Promise<PlatformCapabilities> =>
  selectRuntimeClient().invoke<PlatformCapabilities>('get_platform_capabilities')

// Engine config — provider list (v3)
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

export const getEngineConfig = (): Promise<EngineConfig> =>
  selectRuntimeClient().invoke<EngineConfig>('get_engine_config')

export const setEngineConfig = (cfg: EngineConfig): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_engine_config', {
    config: cfg,
  })

export const createSampleEntryIfNeeded = (): Promise<boolean> =>
  selectRuntimeClient().invoke<boolean>('create_sample_entry_if_needed')

export const createSampleEntry = (): Promise<void> =>
  selectRuntimeClient().invoke<void>('create_sample_entry')

// Onboarding
export interface OnboardingStatus {
  completed: boolean
  last_step: number | null
}

export const getOnboardingStatus = (): Promise<OnboardingStatus> =>
  selectRuntimeClient().invoke<OnboardingStatus>('get_onboarding_status')

export const completeOnboarding = (): Promise<void> =>
  selectRuntimeClient().invoke<void>('complete_onboarding')

export const setOnboardingStep = (step: number): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_onboarding_step', { step })

export const resetOnboarding = (): Promise<void> =>
  selectRuntimeClient().invoke<void>('reset_onboarding')

// Permissions
export type PermStatus = 'granted' | 'denied' | 'not_determined' | 'restricted' | 'unknown'

export const requestPermission = (perm: 'speech_recognition'): Promise<PermStatus> =>
  selectRuntimeClient().invoke<PermStatus>('request_permission', { perm })
export interface AppPermissions {
  speech_recognition: PermStatus
}

export const checkAppPermissions = (): Promise<AppPermissions> =>
  selectRuntimeClient().invoke<AppPermissions>('check_app_permissions')

export const openPrivacySettings = (pane: 'speech_recognition'): Promise<void> =>
  hostOpenPrivacySettings(pane)

// Identity library (身份档案)
export const listIdentities = (): Promise<IdentityEntry[]> =>
  selectRuntimeClient().invoke<IdentityEntry[]>('list_identities')

export const getIdentityContent = (path: string): Promise<string> =>
  selectRuntimeClient().invoke<string>('get_identity_content', { path })

export const saveIdentityContent = (path: string, content: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('save_identity_content', { path, content })

export const deleteIdentity = (path: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('delete_identity', { path })

export const archiveIdentity = (path: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('archive_identity', { path })

export const unarchiveIdentity = (path: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('unarchive_identity', { path })

export const createIdentity = (
  region: string,
  name: string,
  summary: string,
  tags: string[],
  speakerId: string,
): Promise<string> =>
  selectRuntimeClient().invoke<string>('create_identity', {
    region,
    name,
    summary,
    tags,
    speakerId,
  })

export const mergeIdentity = (
  sourcePath: string,
  targetPath: string,
  mode: MergeMode,
): Promise<void> =>
  selectRuntimeClient().invoke<void>('merge_identity', { sourcePath, targetPath, mode })

// Todos (待办事项)
export const listTodos = (): Promise<TodoItem[]> =>
  selectRuntimeClient().invoke<TodoItem[]>('list_todos')

export const addTodo = (
  text: string,
  due?: string,
  source?: string,
  path?: string,
): Promise<TodoItem> =>
  selectRuntimeClient().invoke<TodoItem>('add_todo', {
    text,
    due: due ?? null,
    source: source ?? null,
    path: path ?? null,
  })

export const toggleTodo = (lineIndex: number, checked: boolean, doneFile: boolean): Promise<void> =>
  selectRuntimeClient().invoke<void>('toggle_todo', { lineIndex, checked, doneFile })

export const deleteTodo = (lineIndex: number, doneFile: boolean): Promise<void> =>
  selectRuntimeClient().invoke<void>('delete_todo', { lineIndex, doneFile })

export const setTodoDue = (
  lineIndex: number,
  due: string | null,
  doneFile: boolean,
): Promise<void> => selectRuntimeClient().invoke<void>('set_todo_due', { lineIndex, due, doneFile })

export const setTodoPath = (
  lineIndex: number,
  path: string | null,
  doneFile: boolean,
): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_todo_path', { lineIndex, path, doneFile })

export const removeTodoPath = (lineIndex: number, doneFile: boolean): Promise<void> =>
  selectRuntimeClient().invoke<void>('remove_todo_path', { lineIndex, doneFile })

export const setTodoSessionId = (
  lineIndex: number,
  sessionId: string | null,
  doneFile: boolean,
): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_todo_session_id', { lineIndex, sessionId, doneFile })

export const updateTodoText = (lineIndex: number, text: string, doneFile: boolean): Promise<void> =>
  selectRuntimeClient().invoke<void>('update_todo_text', { lineIndex, text, doneFile })

// Auto lint (自动整理)
export interface AutoLintConfig {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  time: '03:00' | '12:00' | '22:00'
  min_entries: 10 | 20 | 30
}

export interface AutoLintStatus {
  state: 'idle' | 'running' | 'never_run' | 'error'
  last_run: string | null
  last_run_entries: number | null
  next_check: string | null
  current_new_entries: number
  error: string | null
}

export const getAutoLintConfig = (): Promise<AutoLintConfig> =>
  selectRuntimeClient().invoke<AutoLintConfig>('get_auto_lint_config')

export const setAutoLintConfig = (config: AutoLintConfig): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_auto_lint_config', { config })

export const getAutoLintStatus = (): Promise<AutoLintStatus> =>
  selectRuntimeClient().invoke<AutoLintStatus>('get_auto_lint_status')

export const triggerLintNow = (): Promise<void> =>
  selectRuntimeClient().invoke<void>('trigger_lint_now')

// Automation workbench
export const listAutomationTemplates = (): Promise<AutomationTemplate[]> =>
  selectRuntimeClient().invoke<AutomationTemplate[]>('list_automation_templates')

export const listRoutines = (): Promise<AutomationRoutine[]> =>
  selectRuntimeClient().invoke<AutomationRoutine[]>('list_routines')

export const createRoutine = (request: CreateRoutineRequest): Promise<AutomationRoutine> =>
  selectRuntimeClient().invoke<AutomationRoutine>('create_routine', { request })

export const updateRoutine = (
  id: string,
  patch: UpdateRoutineRequest,
): Promise<AutomationRoutine> =>
  selectRuntimeClient().invoke<AutomationRoutine>('update_routine', { id, patch })

export const deleteRoutine = (id: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('delete_routine', { id })

export const pauseRoutine = (id: string): Promise<AutomationRoutine> =>
  selectRuntimeClient().invoke<AutomationRoutine>('pause_routine', { id })

export const resumeRoutine = (id: string): Promise<AutomationRoutine> =>
  selectRuntimeClient().invoke<AutomationRoutine>('resume_routine', { id })

export const runRoutineNow = (id: string): Promise<AutomationRun> =>
  selectRuntimeClient().invoke<AutomationRun>('run_routine_now', { id })

export const listRoutineRuns = (id: string): Promise<AutomationRun[]> =>
  selectRuntimeClient().invoke<AutomationRun[]>('list_routine_runs', { id })

export const getAutomationRun = (id: string): Promise<AutomationRun> =>
  selectRuntimeClient().invoke<AutomationRun>('get_automation_run', { id })

// Global skills setting
export const getGlobalSkillsEnabled = (): Promise<boolean> =>
  selectRuntimeClient().invoke<boolean>('get_global_skills_enabled')

export const setGlobalSkillsEnabled = (enabled: boolean): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_global_skills_enabled', { enabled })

// Feishu bridge
export interface FeishuConfig {
  enabled: boolean
  app_id: string
  app_secret: string
}

export interface FeishuStatus {
  state: 'idle' | 'connecting' | 'connected' | 'error'
  error: string | null
}

export const getFeishuConfig = (): Promise<FeishuConfig> =>
  selectRuntimeClient().invoke<FeishuConfig>('get_feishu_config')

export const setFeishuConfig = (config: FeishuConfig): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_feishu_config', { config })

export const getFeishuStatus = (): Promise<FeishuStatus> =>
  selectRuntimeClient().invoke<FeishuStatus>('get_feishu_status')

// Skills (技能插件)
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

export const listSkills = (): Promise<SkillInfo[]> =>
  selectRuntimeClient().invoke<SkillInfo[]>('list_skills')

export const openSkillsDir = (scope: 'builtin' | 'project' | 'global'): Promise<void> =>
  selectRuntimeClient().invoke<void>('open_skills_dir', { scope })

export const openSkillDir = (
  scope: 'builtin' | 'project' | 'global',
  dirName: string,
): Promise<void> => selectRuntimeClient().invoke<void>('open_skill_dir', { scope, dirName })

export const setSkillEnabled = (skillId: string, enabled: boolean): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_skill_enabled', { skillId, enabled })

export const setGlobalSkillEnabled = (skillId: string, enabled: boolean): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_global_skill_enabled', { skillId, enabled })

export const getSkillContent = (skillId: string): Promise<string> =>
  selectRuntimeClient().invoke<string>('get_skill_content', { skillId })

// Conversation
export const conversationCreate = (context?: string, contextFiles?: string[]): Promise<string> =>
  selectRuntimeClient().invoke<string>('conversation_create', {
    context: context ?? null,
    contextFiles: contextFiles ?? null,
  })

export interface ImageAttachment {
  media_type: string
  data: string
}

export const conversationSend = (
  sessionId: string,
  message: string,
  images?: ImageAttachment[],
): Promise<void> =>
  selectRuntimeClient().invoke<void>('conversation_send', {
    sessionId,
    message,
    images: images ?? null,
  })

export const conversationCancel = (sessionId: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('conversation_cancel', { sessionId })

export const conversationClose = (sessionId: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('conversation_close', { sessionId })

export const conversationInject = (sessionId: string, message: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('conversation_inject', { sessionId, message })

export const conversationTruncate = (sessionId: string, keepCount: number): Promise<void> =>
  selectRuntimeClient().invoke<void>('conversation_truncate', { sessionId, keepCount })

export const conversationRetry = (sessionId: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('conversation_retry', { sessionId })

export interface SessionSummary {
  id: string
  title: string | null
  created_at: number
  updated_at: number
  is_streaming: boolean
  message_count: number
}

export const conversationList = (): Promise<SessionSummary[]> =>
  selectRuntimeClient().invoke<SessionSummary[]>('conversation_list')

export const conversationRename = (sessionId: string, title: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('conversation_rename', { sessionId, title })

export const conversationDelete = (sessionId: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('conversation_delete', { sessionId })

export interface LoadedMessage {
  role: string
  content: string
  thinking?: string
  tools?: { name: string; label: string; output?: string; is_error?: boolean }[]
}

export const conversationLoad = (sessionId: string): Promise<LoadedMessage[]> =>
  selectRuntimeClient().invoke<LoadedMessage[]>('conversation_load', { sessionId })

export const conversationGetMessages = (sessionId: string): Promise<LoadedMessage[]> =>
  selectRuntimeClient().invoke<LoadedMessage[]>('conversation_get_messages', { sessionId })

export interface SessionStats {
  elapsed_secs: number
  total_input_tokens: number
  total_output_tokens: number
}

export const conversationGetStats = (sessionId: string): Promise<SessionStats> =>
  selectRuntimeClient().invoke<SessionStats>('conversation_get_stats', { sessionId })

// Models
export const listModels = (
  engine: string,
  apiKey: string,
  baseUrl: string,
  protocol?: string,
): Promise<string[]> =>
  selectRuntimeClient().invoke<string[]>('list_models', { engine, apiKey, baseUrl, protocol })

// Work Queue
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

export const enqueueWork = (params: {
  text?: string
  files?: string[]
  prompt?: string
  displayName: string
}): Promise<WorkItem> =>
  selectRuntimeClient().invoke<WorkItem>('enqueue_work', {
    text: params.text ?? null,
    files: params.files ?? null,
    prompt: params.prompt ?? null,
    displayName: params.displayName,
  })

export const listWorkQueue = (): Promise<WorkItem[]> =>
  selectRuntimeClient().invoke<WorkItem[]>('list_work_queue')

export const cancelWorkItem = (id: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('cancel_work_item', { id })

export const retryWorkItem = (id: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('retry_work_item', { id })

export const dismissWorkItem = (id: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('dismiss_work_item', { id })

export interface WorkspaceDirEntry {
  name: string
  is_dir: boolean
  path: string
  created_secs?: number
  mtime_secs: number
}
export const listWorkspaceDir = (relativePath: string): Promise<WorkspaceDirEntry[]> =>
  selectRuntimeClient().invoke<WorkspaceDirEntry[]>('list_workspace_dir', { relativePath })

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

export const listAtMentionCandidates = (
  relativePath: string,
  query = '',
): Promise<AtMentionCandidate[]> =>
  selectRuntimeClient().invoke<AtMentionCandidate[]>('list_at_mention_candidates', {
    relativePath,
    query,
  })

export const workspaceDuplicateFile = (relativePath: string): Promise<string> =>
  selectRuntimeClient().invoke<string>('workspace_duplicate_file', { relativePath })

export const workspaceRenameFile = (relativePath: string, newName: string): Promise<string> =>
  selectRuntimeClient().invoke<string>('workspace_rename_file', { relativePath, newName })

export const workspaceMoveFile = (relativePath: string, destDir: string): Promise<string> =>
  selectRuntimeClient().invoke<string>('workspace_move_file', { relativePath, destDir })

export const workspaceDeleteFile = (relativePath: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('workspace_delete_file', { relativePath })

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

export const listTopicsDir = (relativePath: string): Promise<TopicEntry[]> =>
  selectRuntimeClient().invoke<TopicEntry[]>('list_topics_dir', { relativePath })

export const createTopic = (name: string, parentPath?: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('create_topic', { name, parentPath: parentPath ?? null })

export const deleteTopic = (relativePath: string): Promise<void> =>
  selectRuntimeClient().invoke<void>('delete_topic', { relativePath })

export const importFileToTopic = (source: string, topicPath: string): Promise<string> =>
  selectRuntimeClient().invoke<string>('import_file_to_topic', { source, topicPath })

// ── Pinned ───────────────────────────────────────────────────

export interface PinnedItem {
  type: 'journal' | 'identity' | 'topic'
  path: string
  order: number
}

export const getPinnedItems = (): Promise<PinnedItem[]> =>
  selectRuntimeClient().invoke<PinnedItem[]>('get_pinned_items')

export const setPinnedItems = (items: PinnedItem[]): Promise<void> =>
  selectRuntimeClient().invoke<void>('set_pinned_items', { items })

// ── Event Log (catch-up mechanism) ──────────────────────────
export const getEventsSince = (sinceSeq: number): Promise<DomainEvent[]> =>
  selectRuntimeClient().invoke<DomainEvent[]>('get_events_since', { sinceSeq })
