# DayNote Settings & Speech-to-Text Design

> Date: 2026-03-13

## Summary

Add a settings page (API key configuration) and automatic speech-to-text transcription for recordings > 30s using DashScope's `qwen3-asr-flash-filetrans` model. All DashScope API calls happen on the Rust side; the frontend receives results via Tauri events.

---

## 1. Configuration Storage & Settings Window

### Storage

- File: `~/Library/Application Support/journal/config.json`
- Format:

```json
{ "dashscope_api_key": "sk-xxx" }
```

- Rust-side only: read/write via Tauri commands, API key never exposed to frontend

### Settings Window

- Tauri multi-window: separate `settings` window configured in `tauri.conf.json`
- Resizable, ~400x250 default, centered
- Independent HTML entry (`settings.html`) with its own React root
- UI: text input for API Key + save button
- Opened via Tauri command `open_settings()` called from a gear icon in the main title bar

### Rust Changes

- New file: `src-tauri/src/config.rs`
- New commands:
  - `get_api_key()` → returns `Option<String>`
  - `set_api_key(key: String)` → writes to `config.json`
  - `open_settings(app_handle)` → creates settings window via `WebviewWindowBuilder`

---

## 2. Speech-to-Text (Rust Side)

### New Dependency

- `reqwest` — HTTP client with multipart upload support

### New File

- `src-tauri/src/transcription.rs`

### Trigger

After `stop_recording` completes:
1. Check if API key is configured in `config.json`
2. Check if recording duration > 30 seconds
3. If both: spawn a background thread to run transcription

### DashScope API Flow

```
Recording stops (duration > 30s, key configured)
  │
  ├─ 1. POST https://dashscope.aliyuncs.com/api/v1/uploads
  │     multipart/form-data upload of the M4A file
  │     → receives file_url
  │
  ├─ 2. POST https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription
  │     body: { model: "qwen3-asr-flash-filetrans", input: { file_url }, parameters: { channel_id: [0] } }
  │     headers: Authorization, Content-Type, X-DashScope-Async: enable
  │     → receives task_id
  │
  ├─ 3. Poll GET https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}
  │     every 3 seconds
  │     → until SUCCEEDED / FAILED / UNKNOWN
  │
  ├─ 4. On success: parse transcription text → save to transcript file
  │
  └─ Emit Tauri events at each stage
```

### Transcription Result Storage

- Directory: `~/Library/Application Support/journal/transcripts/`
- One JSON file per recording, named `{original_filename_without_ext}.json`
- Format:

```json
{
  "status": "completed",
  "text": "Transcribed text here..."
}
```

### Tauri Events (Rust → Frontend)

| Event | Payload | When |
|-------|---------|------|
| `transcription-progress:{filename}` | `{ "status": "uploading" \| "transcribing" \| "completed" \| "failed" }` | Each stage change |
| `transcription-result:{filename}` | `{ "text": "..." }` | Only on completion |

### Error Handling

- Upload failure → emit `failed` event
- Transcription task failure → emit `failed` event
- Network errors → emit `failed` event with retry hint
- No retry logic (keep it simple; user can re-trigger via detail panel)

---

## 3. Frontend UI Changes

### Layout Change: Single Column → Master-Detail

```
┌──────────────────────────────────────────┐
│ TitleBar                     ⚙️ (gear)  │
├────────────┬─────────────────────────────┤
│            │                             │
│ Recording  │   Detail Panel              │
│ List       │   Transcription status      │
│ (existing) │   + text                    │
│            │                             │
├────────────┴─────────────────────────────┤
│ RecordButton                             │
└──────────────────────────────────────────┘
```

- Default: no detail panel shown
- Click a recording → right panel slides in with transcription status + text
- Click same recording or empty area → panel closes
- Window minimum width: 500px (was 280px)

### Detail Panel Content

- Transcription status indicator (loading animation or text)
- Transcription text (read-only, scrollable)
- "Transcription failed" message with retry option (only on failure)

### Transcription Status on Recording Items

- Small icon/badge on RecordingItem showing status:
  - No icon: not transcribed (short recording or no key)
  - Spinning icon: uploading/transcribing
  - Check icon: transcription completed
  - Warning icon: transcription failed

### New/Modified Files

- New: `src/components/SettingsButton.tsx` — gear icon in title bar
- New: `src/components/DetailPanel.tsx` — right-side detail panel
- New: `src/settings/main.tsx` + `src/settings/index.html` — settings window entry
- Modify: `App.tsx` — master-detail layout, selected recording state
- Modify: `RecordingItem.tsx` — add transcription status indicator
- Modify: `TitleBar.tsx` — include settings button
- Modify: `useRecorder.ts` — listen for transcription events, manage transcript state
- Modify: `types.ts` — add transcription status types
- Modify: `src/lib/tauri.ts` — add new command wrappers + event listeners

---

## 4. Capabilities & Permissions

- Add to `capabilities/default.json`:
  - `core:webview:allow-create-webview-window` (for settings window)

---

## 5. Out of Scope

- Editing transcription text (read-only for now)
- Manual trigger for transcription (automatic only)
- Offline/local speech-to-text
- Support for other STT providers
