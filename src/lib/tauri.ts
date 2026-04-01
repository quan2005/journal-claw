import { invoke } from '@tauri-apps/api/core'
import type { RecordingItem, Transcript, JournalEntry, SpeakerProfile } from '../types'

export const listRecordings = (): Promise<RecordingItem[]> =>
  invoke('list_recordings')

export const startRecording = (): Promise<string> =>
  invoke('start_recording')

export const stopRecording = (): Promise<void> =>
  invoke('stop_recording')

export const deleteRecording = (path: string): Promise<void> =>
  invoke('delete_recording', { path })

export const revealInFinder = (path: string): Promise<void> =>
  invoke('reveal_in_finder', { path })

export const playRecording = (path: string): Promise<void> =>
  invoke('play_recording', { path })

export const openSettings = (): Promise<void> =>
  invoke('open_settings')

export const getTranscript = (path: string): Promise<Transcript | null> =>
  invoke('get_transcript', { path })

export const retryTranscription = (path: string): Promise<void> =>
  invoke('retry_transcription', { path })

export const getApiKey = (): Promise<string | null> =>
  invoke<string | null>('get_api_key')

export const setApiKey = (key: string): Promise<void> =>
  invoke('set_api_key', { key })

export const getWorkspacePath = () =>
  invoke<string>('get_workspace_path')

export const setWorkspacePath = (path: string) =>
  invoke<void>('set_workspace_path', { path })

export const getClaudeCliPath = () =>
  invoke<string>('get_claude_cli_path')

export const setClaudeCliPath = (path: string) =>
  invoke<void>('set_claude_cli_path', { path })

// Journal
export const listAllJournalEntries = () =>
  invoke<JournalEntry[]>('list_all_journal_entries')

export const getJournalEntryContent = (path: string) =>
  invoke<string>('get_journal_entry_content', { path })

// Materials
export const importFile = (srcPath: string) =>
  invoke<{ path: string; filename: string; year_month: string }>('import_file', { srcPath })

// AI Processing
export const triggerAiProcessing = (materialPath: string, yearMonth: string, note?: string) =>
  invoke<void>('trigger_ai_processing', { materialPath, yearMonth, note: note ?? null })

export const deleteJournalEntry = (path: string) =>
  invoke<void>('delete_journal_entry', { path })

// 粘贴文本 → 写入系统 temp 目录 → 返回路径（不自动触发 AI，OS 自动清理）
export const importTextTemp = (text: string) =>
  invoke<{ path: string; filename: string; year_month: string }>('import_text_temp', { text })

// 粘贴文本 → 保存为 raw 文件 → 返回路径（不自动触发 AI）
export const importText = (text: string) =>
  invoke<{ path: string; filename: string; year_month: string }>('import_text', { text })

// Pure prompt → send text directly as Claude CLI -p argument (no file written)
export const triggerAiPrompt = (prompt: string): Promise<void> =>
  invoke<void>('trigger_ai_prompt', { prompt })

// Paste text → save as raw material → trigger AI processing
export const submitPasteText = async (text: string): Promise<void> => {
  const result = await invoke<{ path: string; filename: string; year_month: string }>(
    'import_text', { text }
  )
  await triggerAiProcessing(result.path, result.year_month)
}

export const getWorkspacePrompt = () =>
  invoke<string>('get_workspace_prompt')

export const setWorkspacePrompt = (content: string) =>
  invoke<void>('set_workspace_prompt', { content })

export const openFile = (path: string): Promise<void> =>
  invoke('open_with_system', { path })

export const cancelAiProcessing = () =>
  invoke<void>('cancel_ai_processing')

export const cancelQueuedItem = (materialPath: string) =>
  invoke<void>('cancel_queued_item', { materialPath })

export const importAudioFile = (srcPath: string) =>
  invoke<{ path: string; filename: string; year_month: string }>('import_file', { srcPath })

export const prepareAudioForAi = (audioPath: string, yearMonth: string, note?: string) =>
  invoke<void>('prepare_audio_for_ai', { audioPath, yearMonth, note: note ?? null })

// Folder picker
export const pickFolder = (): Promise<string | null> => {
  return import('@tauri-apps/plugin-dialog').then(({ open }) =>
    open({ directory: true, multiple: false }) as Promise<string | null>
  )
}

// Engine install/check
export const checkEngineInstalled = (engine: 'claude' | 'qwen'): Promise<boolean> =>
  invoke<boolean>('check_engine_installed', { engine })

export const installEngine = (engine: 'claude' | 'qwen'): Promise<void> =>
  invoke<void>('install_engine', { engine })

// App version
export const getAppVersion = (): Promise<string> =>
  invoke<string>('get_app_version')

// Engine config
export interface EngineConfig {
  active_ai_engine: 'claude' | 'qwen'
  claude_code_api_key: string
  claude_code_base_url: string
  claude_code_model: string
  qwen_code_api_key: string
  qwen_code_base_url: string
  qwen_code_model: string
}

export const getEngineConfig = (): Promise<EngineConfig> =>
  invoke<EngineConfig>('get_engine_config')

export const setEngineConfig = (cfg: EngineConfig): Promise<void> =>
  invoke<void>('set_engine_config', {
    config: cfg,
  })

// ASR config
export interface AsrConfig {
  asr_engine: 'apple' | 'dashscope' | 'whisperkit'
  dashscope_api_key: string
  whisperkit_model: 'base' | 'small' | 'large-v3-turbo'
}

export const getAsrConfig = (): Promise<AsrConfig> =>
  invoke<AsrConfig>('get_asr_config')

export const getAppleSttVariant = (): Promise<string> =>
  invoke<string>('get_apple_stt_variant')

export const setAsrConfig = (cfg: AsrConfig): Promise<void> =>
  invoke<void>('set_asr_config', {
    asrEngine: cfg.asr_engine,
    dashscopeApiKey: cfg.dashscope_api_key,
    whisperkitModel: cfg.whisperkit_model,
  })

export const getWhisperkitModelsDir = (): Promise<string> =>
  invoke<string>('get_whisperkit_models_dir')

export const checkWhisperkitModelDownloaded = (model: string): Promise<boolean> =>
  invoke<boolean>('check_whisperkit_model_downloaded', { model })

export const downloadWhisperkitModel = (model: string): Promise<void> =>
  invoke<void>('download_whisperkit_model', { model })

export const checkWhisperkitCliInstalled = (): Promise<boolean> =>
  invoke<boolean>('check_whisperkit_cli_installed')

export const installWhisperkitCli = (): Promise<void> =>
  invoke<void>('install_whisperkit_cli')

export const createSampleEntryIfNeeded = (): Promise<boolean> =>
  invoke<boolean>('create_sample_entry_if_needed')

export const createSampleEntry = (): Promise<void> =>
  invoke<void>('create_sample_entry')

// Speaker profiles (声纹档案)
export const getSpeakerProfiles = (): Promise<SpeakerProfile[]> =>
  invoke<SpeakerProfile[]>('get_speaker_profiles')

export const updateSpeakerName = (id: string, name: string): Promise<void> =>
  invoke<void>('update_speaker_name', { id, name })

export const deleteSpeakerProfile = (id: string): Promise<void> =>
  invoke<void>('delete_speaker_profile', { id })

export const mergeSpeakerProfiles = (sourceId: string, targetId: string): Promise<void> =>
  invoke<void>('merge_speaker_profiles', { sourceId, targetId })
