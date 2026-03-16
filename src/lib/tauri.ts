import { invoke } from '@tauri-apps/api/core'
import type { RecordingItem, Transcript } from '../types'

export const listRecordings = (): Promise<RecordingItem[]> =>
  invoke('list_recordings')

export const startRecording = (): Promise<string> =>
  invoke('start_recording')

export const stopRecording = (): Promise<RecordingItem> =>
  invoke('stop_recording')

export const deleteRecording = (path: string): Promise<void> =>
  invoke('delete_recording', { path })

export const revealInFinder = (path: string): Promise<void> =>
  invoke('reveal_in_finder', { path })

export const playRecording = (path: string): Promise<void> =>
  invoke('play_recording', { path })

export const openSettings = (): Promise<void> =>
  invoke('open_settings')

export const getTranscript = (filename: string): Promise<Transcript | null> =>
  invoke('get_transcript', { filename })

export const retryTranscription = (filename: string): Promise<void> =>
  invoke('retry_transcription', { filename })
