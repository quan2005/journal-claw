import { invoke } from '@tauri-apps/api/core'
import type {
  RecordingItem,
  Transcript,
  JournalEntry,
  SpeakerProfile,
  IdentityEntry,
  MergeMode,
  TodoItem,
} from '../types'

export const listRecordings = (): Promise<RecordingItem[]> => invoke('list_recordings')

export const startRecording = (): Promise<string> => invoke('start_recording')

export const stopRecording = (): Promise<void> => invoke('stop_recording')

export const deleteRecording = (path: string): Promise<void> => invoke('delete_recording', { path })

export const revealInFinder = (path: string): Promise<void> => invoke('reveal_in_finder', { path })

export const playRecording = (path: string): Promise<void> => invoke('play_recording', { path })

export const openSettings = (): Promise<void> => invoke('open_settings')

export const getTranscript = (path: string): Promise<Transcript | null> =>
  invoke('get_transcript', { path })

export const retryTranscription = (path: string): Promise<void> =>
  invoke('retry_transcription', { path })

export const getApiKey = (): Promise<string | null> => invoke<string | null>('get_api_key')

export const setApiKey = (key: string): Promise<void> => invoke('set_api_key', { key })

export const getWorkspacePath = () => invoke<string>('get_workspace_path')

export const setWorkspacePath = (path: string) => invoke<void>('set_workspace_path', { path })

// Journal
export const listAvailableMonths = () => invoke<string[]>('list_available_months')

export const listJournalEntriesByMonths = (months: string[]) =>
  invoke<JournalEntry[]>('list_journal_entries_by_months', { months })

export const listAllJournalEntries = () => invoke<JournalEntry[]>('list_all_journal_entries')

export const getJournalEntryContent = (path: string) =>
  invoke<string>('get_journal_entry_content', { path })

// Materials
export const importFile = (srcPath: string) =>
  invoke<{ path: string; filename: string; year_month: string }>('import_file', { srcPath })

// AI Processing
export const triggerAiProcessing = (materialPath: string, yearMonth: string, note?: string) =>
  invoke<void>('trigger_ai_processing', { materialPath, yearMonth, note: note ?? null })

export const deleteJournalEntry = (path: string) => invoke<void>('delete_journal_entry', { path })

// 粘贴文本 → 写入系统 temp 目录 → 返回路径（不自动触发 AI，OS 自动清理）
export const importTextTemp = (text: string) =>
  invoke<{ path: string; filename: string; year_month: string }>('import_text_temp', { text })

// 粘贴文本 → 保存为 raw 文件 → 返回路径（不自动触发 AI）
export const importText = (text: string) =>
  invoke<{ path: string; filename: string; year_month: string }>('import_text', { text })

// Paste image → write to temp dir → return path
export const importImageTemp = (data: string, mediaType: string) =>
  invoke<{ path: string; filename: string; year_month: string }>('import_image_temp', {
    data,
    mediaType,
  })

// Pure prompt → send text directly (no file written)
export const triggerAiPrompt = (prompt: string): Promise<void> =>
  invoke<void>('trigger_ai_prompt', { prompt })

// Paste text → save as raw material → trigger AI processing
export const submitPasteText = async (text: string): Promise<void> => {
  const result = await invoke<{ path: string; filename: string; year_month: string }>(
    'import_text',
    { text },
  )
  await triggerAiProcessing(result.path, result.year_month)
}

export const getWorkspacePrompt = () => invoke<string>('get_workspace_prompt')

export const setWorkspacePrompt = (content: string) =>
  invoke<void>('set_workspace_prompt', { content })

export const resetWorkspacePrompt = () => invoke<string>('reset_workspace_prompt')

export const openFile = (path: string): Promise<void> => invoke('open_with_system', { path })

export const cancelAiProcessing = () => invoke<void>('cancel_ai_processing')

export const cancelQueuedItem = (materialPath: string) =>
  invoke<void>('cancel_queued_item', { materialPath })

export const importAudioFile = (srcPath: string) =>
  invoke<{ path: string; filename: string; year_month: string }>('import_file', { srcPath })

export const prepareAudioForAi = (audioPath: string, yearMonth: string, note?: string) =>
  invoke<void>('prepare_audio_for_ai', { audioPath, yearMonth, note: note ?? null })

// Folder picker
export const pickFolder = (): Promise<string | null> => {
  return import('@tauri-apps/plugin-dialog').then(
    ({ open }) => open({ directory: true, multiple: false }) as Promise<string | null>,
  )
}

// App version
export const getAppVersion = (): Promise<string> => invoke<string>('get_app_version')

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
  invoke<EngineConfig>('get_engine_config')

export const setEngineConfig = (cfg: EngineConfig): Promise<void> =>
  invoke<void>('set_engine_config', {
    config: cfg,
  })

// ASR config
export interface AsrConfig {
  asr_engine: 'apple' | 'dashscope' | 'whisperkit' | 'siliconflow' | 'zhipu'
  dashscope_api_key: string
  whisperkit_model: 'base' | 'small' | 'large-v3-turbo'
  dashscope_asr_model: string
  volcengine_asr_api_key: string
  volcengine_asr_resource_id: string
  siliconflow_asr_api_key: string
  siliconflow_asr_model: string
  zhipu_asr_api_key: string
}

export const getAsrConfig = (): Promise<AsrConfig> => invoke<AsrConfig>('get_asr_config')

export const getAppleSttVariant = (): Promise<string> => invoke<string>('get_apple_stt_variant')

export const setAsrConfig = (cfg: AsrConfig): Promise<void> =>
  invoke<void>('set_asr_config', {
    asrEngine: cfg.asr_engine,
    dashscopeApiKey: cfg.dashscope_api_key,
    whisperkitModel: cfg.whisperkit_model,
    dashscopeAsrModel: cfg.dashscope_asr_model,
    siliconflowAsrApiKey: cfg.siliconflow_asr_api_key,
    siliconflowAsrModel: cfg.siliconflow_asr_model,
    zhipuAsrApiKey: cfg.zhipu_asr_api_key,
  })

export const getWhisperkitModelsDir = (): Promise<string> =>
  invoke<string>('get_whisperkit_models_dir')

export const checkWhisperkitModelDownloaded = (model: string): Promise<boolean> =>
  invoke<boolean>('check_whisperkit_model_downloaded', { model })

export const downloadWhisperkitModel = (model: string): Promise<void> =>
  invoke<void>('download_whisperkit_model', { model })

export const checkWhisperkitCliInstalled = (): Promise<boolean> =>
  invoke<boolean>('check_whisperkit_cli_installed')

export const installWhisperkitCli = (): Promise<void> => invoke<void>('install_whisperkit_cli')

export const createSampleEntryIfNeeded = (): Promise<boolean> =>
  invoke<boolean>('create_sample_entry_if_needed')

export const createSampleEntry = (): Promise<void> => invoke<void>('create_sample_entry')

// Speaker profiles (声纹档案)
export const getSpeakerProfiles = (): Promise<SpeakerProfile[]> =>
  invoke<SpeakerProfile[]>('get_speaker_profiles')

export const updateSpeakerName = (id: string, name: string): Promise<void> =>
  invoke<void>('update_speaker_name', { id, name })

export const deleteSpeakerProfile = (id: string): Promise<void> =>
  invoke<void>('delete_speaker_profile', { id })

export const mergeSpeakerProfiles = (sourceId: string, targetId: string): Promise<void> =>
  invoke<void>('merge_speaker_profiles', { sourceId, targetId })

export const checkSpeakerEmbedder = (): Promise<{
  available: boolean
  binary_path: string | null
  model_path: string | null
}> => invoke('check_speaker_embedder')

// Permissions
export type PermStatus = 'granted' | 'denied' | 'not_determined' | 'restricted' | 'unknown'

export const requestPermission = (perm: 'microphone' | 'speech_recognition'): Promise<PermStatus> =>
  invoke<PermStatus>('request_permission', { perm })
export interface AppPermissions {
  microphone: PermStatus
  speech_recognition: PermStatus
}

export const checkAppPermissions = (): Promise<AppPermissions> =>
  invoke<AppPermissions>('check_app_permissions')

export const openPrivacySettings = (pane: 'microphone' | 'speech_recognition'): Promise<void> =>
  invoke<void>('open_privacy_settings', { pane })

// Identity library (身份档案)
export const listIdentities = (): Promise<IdentityEntry[]> =>
  invoke<IdentityEntry[]>('list_identities')

export const getIdentityContent = (path: string): Promise<string> =>
  invoke<string>('get_identity_content', { path })

export const saveIdentityContent = (path: string, content: string): Promise<void> =>
  invoke<void>('save_identity_content', { path, content })

export const deleteIdentity = (path: string): Promise<void> =>
  invoke<void>('delete_identity', { path })

export const createIdentity = (
  region: string,
  name: string,
  summary: string,
  tags: string[],
  speakerId: string,
): Promise<string> => invoke<string>('create_identity', { region, name, summary, tags, speakerId })

export const mergeIdentity = (
  sourcePath: string,
  targetPath: string,
  mode: MergeMode,
): Promise<void> => invoke<void>('merge_identity', { sourcePath, targetPath, mode })

// Todos (待办事项)
export const listTodos = (): Promise<TodoItem[]> => invoke<TodoItem[]>('list_todos')

export const addTodo = (
  text: string,
  due?: string,
  source?: string,
  path?: string,
): Promise<TodoItem> =>
  invoke<TodoItem>('add_todo', {
    text,
    due: due ?? null,
    source: source ?? null,
    path: path ?? null,
  })

export const toggleTodo = (lineIndex: number, checked: boolean, doneFile: boolean): Promise<void> =>
  invoke<void>('toggle_todo', { lineIndex, checked, doneFile })

export const deleteTodo = (lineIndex: number, doneFile: boolean): Promise<void> =>
  invoke<void>('delete_todo', { lineIndex, doneFile })

export const setTodoDue = (
  lineIndex: number,
  due: string | null,
  doneFile: boolean,
): Promise<void> => invoke<void>('set_todo_due', { lineIndex, due, doneFile })

export const setTodoPath = (
  lineIndex: number,
  path: string | null,
  doneFile: boolean,
): Promise<void> => invoke<void>('set_todo_path', { lineIndex, path, doneFile })

export const removeTodoPath = (lineIndex: number, doneFile: boolean): Promise<void> =>
  invoke<void>('remove_todo_path', { lineIndex, doneFile })

export const setTodoSessionId = (
  lineIndex: number,
  sessionId: string | null,
  doneFile: boolean,
): Promise<void> => invoke<void>('set_todo_session_id', { lineIndex, sessionId, doneFile })

export const updateTodoText = (lineIndex: number, text: string, doneFile: boolean): Promise<void> =>
  invoke<void>('update_todo_text', { lineIndex, text, doneFile })

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
  invoke<AutoLintConfig>('get_auto_lint_config')

export const setAutoLintConfig = (config: AutoLintConfig): Promise<void> =>
  invoke<void>('set_auto_lint_config', { config })

export const getAutoLintStatus = (): Promise<AutoLintStatus> =>
  invoke<AutoLintStatus>('get_auto_lint_status')

export const triggerLintNow = (): Promise<void> => invoke<void>('trigger_lint_now')

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
  invoke<FeishuConfig>('get_feishu_config')

export const setFeishuConfig = (config: FeishuConfig): Promise<void> =>
  invoke<void>('set_feishu_config', { config })

export const getFeishuStatus = (): Promise<FeishuStatus> =>
  invoke<FeishuStatus>('get_feishu_status')

// Skills (技能插件)
export interface SkillInfo {
  id: string
  name: string
  description: string
  scope: 'project' | 'global'
  dir_name: string
}

export const listSkills = (): Promise<SkillInfo[]> => invoke<SkillInfo[]>('list_skills')

export const openSkillsDir = (scope: 'project' | 'global'): Promise<void> =>
  invoke<void>('open_skills_dir', { scope })

// Conversation dialog
export type SessionMode = 'chat' | 'agent'

export const conversationCreate = (
  mode: SessionMode,
  context?: string,
  contextFiles?: string[],
): Promise<string> =>
  invoke<string>('conversation_create', {
    mode,
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
  invoke<void>('conversation_send', { sessionId, message, images: images ?? null })

export const conversationCancel = (sessionId: string): Promise<void> =>
  invoke<void>('conversation_cancel', { sessionId })

export const conversationClose = (sessionId: string): Promise<void> =>
  invoke<void>('conversation_close', { sessionId })

export const conversationInject = (sessionId: string, message: string): Promise<void> =>
  invoke<void>('conversation_inject', { sessionId, message })

export const conversationTruncate = (sessionId: string, keepCount: number): Promise<void> =>
  invoke<void>('conversation_truncate', { sessionId, keepCount })

export const conversationRetry = (sessionId: string): Promise<void> =>
  invoke<void>('conversation_retry', { sessionId })

export interface SessionSummary {
  id: string
  title: string | null
  mode: SessionMode
  created_at: number
  updated_at: number
  is_streaming: boolean
  message_count: number
}

export const conversationList = (): Promise<SessionSummary[]> =>
  invoke<SessionSummary[]>('conversation_list')

export const conversationRename = (sessionId: string, title: string): Promise<void> =>
  invoke<void>('conversation_rename', { sessionId, title })

export const conversationDelete = (sessionId: string): Promise<void> =>
  invoke<void>('conversation_delete', { sessionId })

export interface LoadedMessage {
  role: string
  content: string
  thinking?: string
  tools?: { name: string; label: string; output?: string; is_error?: boolean }[]
}

export const conversationLoad = (sessionId: string): Promise<LoadedMessage[]> =>
  invoke<LoadedMessage[]>('conversation_load', { sessionId })

export const conversationGetMessages = (sessionId: string): Promise<LoadedMessage[]> =>
  invoke<LoadedMessage[]>('conversation_get_messages', { sessionId })

export interface SessionStats {
  elapsed_secs: number
  total_input_tokens: number
  total_output_tokens: number
}

export const conversationGetStats = (sessionId: string): Promise<SessionStats> =>
  invoke<SessionStats>('conversation_get_stats', { sessionId })

// Models
export const listModels = (engine: string, apiKey: string, baseUrl: string): Promise<string[]> =>
  invoke<string[]>('list_models', { engine, apiKey, baseUrl })

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
  invoke<WorkItem>('enqueue_work', {
    text: params.text ?? null,
    files: params.files ?? null,
    prompt: params.prompt ?? null,
    displayName: params.displayName,
  })

export const listWorkQueue = (): Promise<WorkItem[]> => invoke<WorkItem[]>('list_work_queue')

export const cancelWorkItem = (id: string): Promise<void> =>
  invoke<void>('cancel_work_item', { id })

export const retryWorkItem = (id: string): Promise<void> => invoke<void>('retry_work_item', { id })

export const dismissWorkItem = (id: string): Promise<void> =>
  invoke<void>('dismiss_work_item', { id })

export interface WorkspaceDirEntry {
  name: string
  is_dir: boolean
  path: string
}
export const listWorkspaceDir = (relativePath: string): Promise<WorkspaceDirEntry[]> =>
  invoke<WorkspaceDirEntry[]>('list_workspace_dir', { relativePath })
