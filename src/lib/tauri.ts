import { invoke } from '@tauri-apps/api/core'
import type { RecordingItem, Transcript, JournalEntry } from '../types'

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
  invoke<{ path: string; filename: string; year_month: string }>('import_file', { src_path: srcPath })

// AI Processing
export const triggerAiProcessing = (materialPath: string, yearMonth: string) =>
  invoke<void>('trigger_ai_processing', { material_path: materialPath, year_month: yearMonth })

export const deleteJournalEntry = (path: string) =>
  invoke<void>('delete_journal_entry', { path })
