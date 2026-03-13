# DayNote Recording App Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal macOS desktop recording app with a single record/stop button and a time-grouped recording list.

**Architecture:** Tauri v2 app with a React + TypeScript frontend. The Rust backend captures audio via `cpal`, writes a temporary WAV using `hound`, then converts to M4A via macOS built-in `afconvert`. Duration is read from the M4A header via `mp4ameta`. Six Tauri commands are exposed to the frontend. The frontend manages all UI state (recording status, live timer, in-progress list entry) independently of the Rust layer.

**Tech Stack:** Tauri v2 · React 18 · TypeScript · Vite · Vitest · cpal 0.17 · hound 3.5 · mp4ameta 0.13 · chrono 0.4 · tauri-plugin-context-menu 0.8

---

## File Structure

```
journal/
├── src-tauri/
│   ├── Cargo.toml                  # Rust dependencies
│   ├── tauri.conf.json             # Tauri window config (320px wide, 480px tall, min 360px)
│   ├── Info.plist                  # NSMicrophoneUsageDescription
│   ├── src/
│   │   ├── main.rs                 # Tauri app entry, registers commands and managed state
│   │   ├── recorder.rs             # Audio capture (cpal → hound WAV → afconvert M4A)
│   │   ├── recordings.rs           # list_recordings, delete_recording, reveal_in_finder, play_recording
│   │   └── types.rs                # RecordingItem struct shared by all commands
├── src/
│   ├── main.tsx                    # React entry point, imports global styles
│   ├── App.tsx                     # Root: recording state, list state, context menu handler
│   ├── components/
│   │   ├── TitleBar.tsx            # Custom titlebar: idle name / recording timer
│   │   ├── RecordingList.tsx       # List with month grouping, injects in-progress entry
│   │   ├── MonthDivider.tsx        # Grey month label divider
│   │   ├── RecordingItem.tsx       # Single row, right-click triggers context menu
│   │   └── RecordButton.tsx        # Record/stop toggle button with pulse animation
│   ├── hooks/
│   │   └── useRecorder.ts          # Recording state machine + timer logic
│   ├── lib/
│   │   ├── tauri.ts                # Typed wrappers around invoke() calls
│   │   └── format.ts               # formatDuration(), formatTimer(), formatYearMonth()
│   ├── types.ts                    # RecordingItem TypeScript interface
│   └── styles/
│       ├── globals.css             # CSS variables for light/dark theme, reset
│       └── animations.css          # Pulse and blink keyframe animations
└── src/tests/
    ├── format.test.ts              # Unit tests for format.ts
    └── useRecorder.test.ts         # Unit tests for useRecorder hook
```

---

## Chunk 1: Project Scaffold + Rust Backend

### Task 1: Scaffold Tauri + React project

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Initialise git repository**

```bash
cd /Users/yanwu/Projects/github/journal
git init
```

Expected: `.git/` directory created.

- [ ] **Step 2: Scaffold the project**

```bash
npx @tauri-apps/cli create . --template react-ts --manager npm
```

When prompted: app name `journal`, window title `DayNote`, identifier `com.journal.app`.

Expected output: project files created, `src-tauri/` and `src/` directories present.

- [ ] **Step 3: Verify `.gitignore` excludes build artifacts**

Open `.gitignore` and confirm these lines are present (add them if missing):

```
node_modules/
src-tauri/target/
dist/
.superpowers/
```

- [ ] **Step 4: Add Rust dependencies to `src-tauri/Cargo.toml`**

In the `[dependencies]` section, add:

```toml
cpal = "0.17"
hound = "3.5"
chrono = { version = "0.4", features = ["clock"] }
mp4ameta = "0.13"
tauri-plugin-context-menu = "0.8"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 5: Configure window in `src-tauri/tauri.conf.json`**

Find the `windows` array and replace its contents:

```json
"windows": [
  {
    "title": "DayNote",
    "width": 320,
    "height": 480,
    "minWidth": 320,
    "maxWidth": 320,
    "minHeight": 360,
    "resizable": true,
    "decorations": false,
    "titleBarStyle": "Overlay"
  }
]
```

`decorations: false` with `titleBarStyle: Overlay` gives the native traffic-light buttons without the default title text (we render our own title bar).

- [ ] **Step 6: Add `NSMicrophoneUsageDescription` to `src-tauri/Info.plist`**

Create the file if it doesn't exist. Ensure this key is present:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSMicrophoneUsageDescription</key>
  <string>DayNote needs microphone access to record audio.</string>
</dict>
</plist>
```

- [ ] **Step 7: Register context menu plugin in `src-tauri/src/main.rs`**

Replace the generated `main.rs` with:

```rust
mod types;
mod recordings;
mod recorder;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_context_menu::init())
        .manage(recorder::RecorderState(std::sync::Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            recordings::list_recordings,
            recordings::delete_recording,
            recordings::reveal_in_finder,
            recordings::play_recording,
            recorder::start_recording,
            recorder::stop_recording,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Note: `types`, `recordings`, and `recorder` modules are declared here. The actual source files are created in subsequent tasks. The project will not compile until all three files exist.

- [ ] **Step 8: Verify project installs (npm only at this stage)**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Tauri v2 + React project with dependencies"
```

---

### Task 2: Shared types

**Files:**
- Create: `src-tauri/src/types.rs`
- Create: `src/types.ts`

- [ ] **Step 1: Write Rust types**

Create `src-tauri/src/types.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingItem {
    pub filename: String,      // "录音 2026-03-12 22:41.m4a"
    pub path: String,          // absolute path
    pub display_name: String,  // "录音 2026-03-12 22:41"
    pub duration_secs: f64,    // 0.0 if unreadable
    pub year_month: String,    // "202603"
}
```

- [ ] **Step 2: Write TypeScript types**

Create `src/types.ts`:

```typescript
export interface RecordingItem {
  filename: string;       // "录音 2026-03-12 22:41.m4a"
  path: string;           // absolute path
  display_name: string;   // "录音 2026-03-12 22:41"
  duration_secs: number;  // 0 if unreadable
  year_month: string;     // "202603"
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/types.rs src/types.ts
git commit -m "feat: add shared RecordingItem types (Rust + TypeScript)"
```

---

### Task 3: Utility functions (format) + tests

**Files:**
- Create: `src/lib/format.ts`
- Create: `src/tests/format.test.ts`

- [ ] **Step 1: Install Vitest and testing dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Update `vite.config.ts` to add test configuration:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Write failing tests**

Create `src/tests/format.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatDuration, formatYearMonth, formatDisplayDate } from '../lib/format'

describe('formatDuration', () => {
  it('formats zero seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
  })
  it('formats seconds under one minute', () => {
    expect(formatDuration(45)).toBe('0:45')
  })
  it('formats minutes and seconds', () => {
    expect(formatDuration(154)).toBe('2:34')
  })
  it('formats exactly one hour', () => {
    expect(formatDuration(3600)).toBe('1:00:00')
  })
  it('formats over one hour', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
  })
})

describe('formatYearMonth', () => {
  it('extracts year_month from display_name', () => {
    expect(formatYearMonth('录音 2026-03-12 22:41')).toBe('202603')
  })
  it('returns 000000 for unrecognised format', () => {
    expect(formatYearMonth('unknown')).toBe('000000')
  })
})

describe('formatDisplayDate', () => {
  it('passes through display_name unchanged', () => {
    expect(formatDisplayDate('录音 2026-03-12 22:41')).toBe('录音 2026-03-12 22:41')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../lib/format'`

- [ ] **Step 4: Implement `src/lib/format.ts`**

```typescript
/**
 * Format seconds into m:ss or h:mm:ss display string.
 */
export function formatDuration(totalSecs: number): string {
  const secs = Math.floor(totalSecs)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Format elapsed seconds for the title bar timer. Alias of formatDuration.
 */
export function formatTimer(totalSecs: number): string {
  return formatDuration(totalSecs)
}

/**
 * Extract yyyyMM group key from a display_name like "录音 2026-03-12 22:41".
 * Returns "202603".
 */
export function formatYearMonth(displayName: string): string {
  const match = displayName.match(/(\d{4})-(\d{2})-\d{2}/)
  if (!match) return '000000'
  return `${match[1]}${match[2]}`
}

/**
 * Format a display_name as the list label (pass-through).
 */
export function formatDisplayDate(displayName: string): string {
  return displayName
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — 8 tests passing

- [ ] **Step 6: Commit**

```bash
git add src/lib/format.ts src/tests/format.test.ts vite.config.ts package.json
git commit -m "feat: add formatDuration/formatTimer/formatYearMonth utilities with tests"
```

---

### Task 4: Rust — `recordings.rs` (list, delete, reveal, play)

**Files:**
- Create: `src-tauri/src/recordings.rs`

- [ ] **Step 1: Write `recordings.rs`**

Create `src-tauri/src/recordings.rs`:

```rust
use crate::types::RecordingItem;
use std::path::PathBuf;
use tauri::AppHandle;

/// Returns the recordings storage directory (App data dir), creating it if needed.
/// On macOS: ~/Library/Application Support/journal/
pub fn recordings_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Read M4A duration in seconds from file header.
/// Returns 0.0 on any failure (incomplete/corrupt file).
pub(crate) fn read_duration_pub(path: &PathBuf) -> f64 {
    mp4ameta::Tag::read_from_path(path)
        .ok()
        .and_then(|tag| tag.duration())
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0)
}

/// Parse display_name and year_month from a filename like "录音 2026-03-12 22:41.m4a".
pub(crate) fn parse_filename_pub(filename: &str) -> (String, String) {
    let display_name = filename.trim_end_matches(".m4a").to_string();
    // Extract yyyyMM: look for pattern YYYY-MM in the display name
    let year_month = display_name
        .split_whitespace()
        .find_map(|part| {
            let mut it = part.splitn(3, '-');
            let y = it.next()?;
            let m = it.next()?;
            if y.len() == 4 && m.len() == 2 && y.chars().all(|c| c.is_ascii_digit()) && m.chars().all(|c| c.is_ascii_digit()) {
                Some(format!("{}{}", y, m))
            } else {
                None
            }
        })
        .unwrap_or_else(|| "000000".to_string());
    (display_name, year_month)
}

#[tauri::command]
pub fn list_recordings(app: AppHandle) -> Result<Vec<RecordingItem>, String> {
    let dir = recordings_dir(&app)?;
    let mut items: Vec<RecordingItem> = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let filename = entry.file_name().to_string_lossy().into_owned();
            if !filename.ends_with(".m4a") {
                return None;
            }
            let path = entry.path();
            let (display_name, year_month) = parse_filename_pub(&filename);
            let duration_secs = read_duration_pub(&path);
            Some(RecordingItem {
                filename,
                path: path.to_string_lossy().into_owned(),
                display_name,
                duration_secs,
                year_month,
            })
        })
        .collect();
    // Sort descending by filename (filename contains timestamp → lexicographic == chronological)
    items.sort_by(|a, b| b.filename.cmp(&a.filename));
    Ok(items)
}

#[tauri::command]
pub fn delete_recording(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    // open -R highlights the file in Finder (equivalent to NSWorkspace.activateFileViewerSelectingURLs)
    std::process::Command::new("open")
        .args(["-R", &path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn play_recording(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_filename_standard() {
        let (display, ym) = parse_filename_pub("录音 2026-03-12 22:41.m4a");
        assert_eq!(display, "录音 2026-03-12 22:41");
        assert_eq!(ym, "202603");
    }

    #[test]
    fn parse_filename_with_seconds() {
        let (display, ym) = parse_filename_pub("录音 2026-03-12 22:41:05.m4a");
        assert_eq!(display, "录音 2026-03-12 22:41:05");
        assert_eq!(ym, "202603");
    }

    #[test]
    fn parse_filename_unknown() {
        let (display, ym) = parse_filename_pub("unknown.m4a");
        assert_eq!(display, "unknown");
        assert_eq!(ym, "000000");
    }
}
```

- [ ] **Step 2: Create a stub `recorder.rs` so the project compiles**

`main.rs` declares `mod recorder`, so a stub file is required before running any `cargo` commands. Create `src-tauri/src/recorder.rs`:

```rust
use crate::types::RecordingItem;
use std::sync::Mutex;
use tauri::{AppHandle, State};

pub struct RecorderState(pub Mutex<Option<()>>);

#[tauri::command]
pub fn start_recording(_app: AppHandle, _state: State<'_, RecorderState>) -> Result<String, String> {
    Err("not_implemented".to_string())
}

#[tauri::command]
pub fn stop_recording(_app: AppHandle, _state: State<'_, RecorderState>) -> Result<RecordingItem, String> {
    Err("not_implemented".to_string())
}
```

This stub will be replaced in Task 5.

- [ ] **Step 3: Run Rust unit tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml recordings::tests
```

Expected: 3 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/recordings.rs src-tauri/src/recorder.rs
git commit -m "feat: add list/delete/reveal/play Rust commands with unit tests"
```

---

### Task 5: Rust — `recorder.rs` (start/stop recording)

**Files:**
- Create: `src-tauri/src/recorder.rs`

Recording uses `cpal` to capture audio from the default input device. Samples are written to a temporary WAV file via `hound`. On stop, `afconvert` (macOS built-in) converts WAV → M4A. The temporary WAV is deleted after conversion.

- [ ] **Step 1: Write `recorder.rs`**

Create `src-tauri/src/recorder.rs`:

```rust
use crate::recordings::{recordings_dir, parse_filename_pub, read_duration_pub};
use crate::types::RecordingItem;
use chrono::Local;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};

pub struct RecorderState(pub Mutex<Option<ActiveRecording>>);

pub struct ActiveRecording {
    stream: cpal::Stream,
    output_path: PathBuf,
    writer: Arc<Mutex<Option<hound::WavWriter<std::io::BufWriter<std::fs::File>>>>>,
}

/// Generate a unique filename for a new recording.
/// Format: "录音 YYYY-MM-DD HH:mm.m4a", with ":SS" appended if that file already exists.
fn unique_filename(dir: &PathBuf) -> String {
    let now = Local::now();
    let base = format!("录音 {}", now.format("%Y-%m-%d %H:%M"));
    let candidate = format!("{}.m4a", base);
    if !dir.join(&candidate).exists() {
        return candidate;
    }
    format!("录音 {}.m4a", now.format("%Y-%m-%d %H:%M:%S"))
}

#[tauri::command]
pub fn start_recording(
    app: AppHandle,
    state: State<'_, RecorderState>,
) -> Result<String, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Err("already_recording".to_string());
    }

    let dir = recordings_dir(&app)?;
    let filename = unique_filename(&dir);
    let output_path = dir.join(&filename);
    let wav_path = output_path.with_extension("wav.tmp");

    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "no_input_device".to_string())?;
    let config = device
        .default_input_config()
        .map_err(|e| {
            // Map macOS permission-denied error to a recognisable string for the frontend
            let msg = e.to_string();
            if msg.contains("PermissionDenied") || msg.contains("permission") {
                "permission_denied".to_string()
            } else {
                msg
            }
        })?;

    // Convert config once — config.into() consumes the value, so do it before the match
    let sample_format = config.sample_format();
    let stream_config: cpal::StreamConfig = config.into();

    let spec = hound::WavSpec {
        channels: stream_config.channels,
        sample_rate: stream_config.sample_rate.0,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let writer = Arc::new(Mutex::new(Some(
        hound::WavWriter::create(&wav_path, spec).map_err(|e| e.to_string())?,
    )));

    // Clone writer handle inside each match arm to avoid double-move
    let stream = match sample_format {
        cpal::SampleFormat::F32 => {
            let writer_clone = Arc::clone(&writer);
            device
                .build_input_stream(
                    &stream_config,
                    move |data: &[f32], _| {
                        if let Ok(mut g) = writer_clone.lock() {
                            if let Some(w) = g.as_mut() {
                                for &s in data {
                                    let _ = w.write_sample((s * i16::MAX as f32) as i16);
                                }
                            }
                        }
                    },
                    |err| eprintln!("stream error: {}", err),
                    None,
                )
                .map_err(|e| e.to_string())?
        }
        cpal::SampleFormat::I16 => {
            let writer_clone = Arc::clone(&writer);
            device
                .build_input_stream(
                    &stream_config,
                    move |data: &[i16], _| {
                        if let Ok(mut g) = writer_clone.lock() {
                            if let Some(w) = g.as_mut() {
                                for &s in data { let _ = w.write_sample(s); }
                            }
                        }
                    },
                    |err| eprintln!("stream error: {}", err),
                    None,
                )
                .map_err(|e| e.to_string())?
        }
        _ => return Err("unsupported_sample_format".to_string()),
    };

    stream.play().map_err(|e| e.to_string())?;

    *guard = Some(ActiveRecording { stream, output_path: output_path.clone(), writer });
    Ok(output_path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn stop_recording(
    app: AppHandle,
    state: State<'_, RecorderState>,
) -> Result<RecordingItem, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let active = guard.take().ok_or("not_recording")?;

    drop(active.stream);

    {
        let mut wg = active.writer.lock().map_err(|e| e.to_string())?;
        if let Some(w) = wg.take() {
            w.finalize().map_err(|e| e.to_string())?;
        }
    }

    let wav_path = active.output_path.with_extension("wav.tmp");
    let status = std::process::Command::new("afconvert")
        .args(["-f", "m4af", "-d", "aac",
               wav_path.to_str().unwrap(),
               active.output_path.to_str().unwrap()])
        .status()
        .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err("afconvert_failed".to_string());
    }
    let _ = std::fs::remove_file(&wav_path);

    let filename = active.output_path
        .file_name().unwrap()
        .to_string_lossy().into_owned();
    let (display_name, year_month) = parse_filename_pub(&filename);
    let duration_secs = read_duration_pub(&active.output_path);

    Ok(RecordingItem { filename, path: active.output_path.to_string_lossy().into_owned(), display_name, duration_secs, year_month })
}
```

- [ ] **Step 2: Verify the full project compiles**

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

Expected: build succeeds. macOS may prompt for microphone permission during linking — allow it.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/recorder.rs src-tauri/src/main.rs
git commit -m "feat: add start_recording/stop_recording via cpal + afconvert"
```

---

## Chunk 2: React Frontend

### Task 6: CSS variables and animations

**Files:**
- Create: `src/styles/globals.css`
- Create: `src/styles/animations.css`

- [ ] **Step 1: Write `globals.css`**

Create `src/styles/globals.css`:

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: #ffffff;
  --titlebar-bg: #f2f2f7;
  --divider: #e5e5ea;
  --month-label: #c7c7cc;
  --item-text: #1c1c1e;
  --item-meta: #aeaeb2;
  --duration-text: #c7c7cc;
  --record-btn: #ff3b30;
  --record-highlight: rgba(255, 59, 48, 0.06);
  --record-highlight-icon: rgba(255, 59, 48, 0.15);
  --item-icon-bg: #f2f2f7;
  --item-hover-bg: #f2f2f7;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1c1c1e;
    --titlebar-bg: #2c2c2e;
    --divider: #3a3a3c;
    --month-label: #48484a;
    --item-text: #e8e8e8;
    --item-meta: #636366;
    --duration-text: #48484a;
    --record-btn: #ff375f;
    --record-highlight: rgba(255, 55, 95, 0.06);
    --record-highlight-icon: rgba(255, 55, 95, 0.15);
    --item-icon-bg: #2c2c2e;
    --item-hover-bg: #2c2c2e;
  }
}

html, body, #root {
  height: 100%;
  width: 100%;
  background: var(--bg);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  overflow: hidden;
}

#root {
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 2: Write `animations.css`**

Create `src/styles/animations.css`:

```css
/* Breathing glow on idle record button: 2.4s ease-in-out, 0 → 12px box-shadow */
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  50%       { box-shadow: 0 0 0 12px rgba(255, 59, 48, 0.18); }
}

@media (prefers-color-scheme: dark) {
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 transparent; }
    50%       { box-shadow: 0 0 0 12px rgba(255, 55, 95, 0.18); }
  }
}

/* Title bar recording dot blink: 1s ease-in-out */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.25; }
}
```

- [ ] **Step 3: Import styles in `src/main.tsx`**

Replace the generated `src/main.tsx` with:

```typescript
import './styles/globals.css'
import './styles/animations.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 4: Commit**

```bash
git add src/styles/ src/main.tsx
git commit -m "feat: add CSS variables for light/dark theme and keyframe animations"
```

---

### Task 7: Tauri invoke wrappers

**Files:**
- Create: `src/lib/tauri.ts`

- [ ] **Step 1: Write `src/lib/tauri.ts`**

```typescript
import { invoke } from '@tauri-apps/api/core'
import type { RecordingItem } from '../types'

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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/tauri.ts
git commit -m "feat: add typed Tauri invoke wrappers"
```

---

### Task 8: `useRecorder` hook + tests

**Files:**
- Create: `src/hooks/useRecorder.ts`
- Create: `src/tests/useRecorder.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/tests/useRecorder.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRecorder } from '../hooks/useRecorder'

vi.mock('../lib/tauri', () => ({
  startRecording: vi.fn().mockResolvedValue('/path/to/录音 2026-03-12 22:41.m4a'),
  stopRecording: vi.fn().mockResolvedValue({
    filename: '录音 2026-03-12 22:41.m4a',
    path: '/path/to/录音 2026-03-12 22:41.m4a',
    display_name: '录音 2026-03-12 22:41',
    duration_secs: 5.0,
    year_month: '202603',
  }),
}))

describe('useRecorder', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('starts in idle state', () => {
    const { result } = renderHook(() => useRecorder(vi.fn()))
    expect(result.current.status).toBe('idle')
    expect(result.current.elapsedSecs).toBe(0)
  })

  it('transitions to recording on start()', async () => {
    const { result } = renderHook(() => useRecorder(vi.fn()))
    await act(async () => { await result.current.start() })
    expect(result.current.status).toBe('recording')
  })

  it('increments elapsedSecs each second while recording', async () => {
    const { result } = renderHook(() => useRecorder(vi.fn()))
    await act(async () => { await result.current.start() })
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.elapsedSecs).toBe(3)
  })

  it('returns to idle and calls onStopped with RecordingItem on stop()', async () => {
    const onStopped = vi.fn()
    const { result } = renderHook(() => useRecorder(onStopped))
    await act(async () => { await result.current.start() })
    await act(async () => { await result.current.stop() })
    expect(result.current.status).toBe('idle')
    expect(result.current.elapsedSecs).toBe(0)
    expect(onStopped).toHaveBeenCalledWith(expect.objectContaining({ duration_secs: 5.0 }))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../hooks/useRecorder'`

- [ ] **Step 3: Implement `src/hooks/useRecorder.ts`**

```typescript
import { useState, useRef, useCallback } from 'react'
import { startRecording, stopRecording } from '../lib/tauri'
import type { RecordingItem } from '../types'

export type RecorderStatus = 'idle' | 'recording'

interface UseRecorderReturn {
  status: RecorderStatus
  elapsedSecs: number
  start: () => Promise<void>
  stop: () => Promise<void>
}

export function useRecorder(
  onStopped: (item: RecordingItem) => void
): UseRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsedSecs, setElapsedSecs] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(async () => {
    await startRecording()
    setStatus('recording')
    setElapsedSecs(0)
    timerRef.current = setInterval(() => {
      setElapsedSecs(s => s + 1)
    }, 1000)
  }, [])

  const stop = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const item = await stopRecording()
    setStatus('idle')
    setElapsedSecs(0)
    onStopped(item)
  }, [onStopped])

  return { status, elapsedSecs, start, stop }
}
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
npm test
```

Expected: PASS — 12 tests passing (8 format + 4 useRecorder)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRecorder.ts src/tests/useRecorder.test.ts
git commit -m "feat: add useRecorder hook with timer logic and tests"
```

---

### Task 9: `TitleBar` component

**Files:**
- Create: `src/components/TitleBar.tsx`

- [ ] **Step 1: Write `TitleBar.tsx`**

```tsx
import { formatTimer } from '../lib/format'
import type { RecorderStatus } from '../hooks/useRecorder'

interface TitleBarProps {
  status: RecorderStatus
  elapsedSecs: number
}

export function TitleBar({ status, elapsedSecs }: TitleBarProps) {
  return (
    <div
      data-tauri-drag-region
      style={{
        height: 36,
        background: 'var(--titlebar-bg)',
        borderBottom: '1px solid var(--divider)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        // 70px left padding to clear the macOS traffic-light buttons
        paddingLeft: 70,
        paddingRight: 16,
      }}
    >
      {status === 'idle' ? (
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--item-meta)',
        }}>
          DayNote
        </span>
      ) : (
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--record-btn)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span style={{ animation: 'blink 1s ease-in-out infinite' }}>●</span>
          {formatTimer(elapsedSecs)}
        </span>
      )}
    </div>
  )
}
```

Note: `data-tauri-drag-region` allows the user to drag the window by the title bar.

- [ ] **Step 2: Commit**

```bash
git add src/components/TitleBar.tsx
git commit -m "feat: add TitleBar component with idle/recording states and drag region"
```

---

### Task 10: `MonthDivider` and `RecordingItem` components

**Files:**
- Create: `src/components/MonthDivider.tsx`
- Create: `src/components/RecordingItem.tsx`

- [ ] **Step 1: Write `MonthDivider.tsx`**

```tsx
interface MonthDividerProps {
  yearMonth: string  // "202603"
}

export function MonthDivider({ yearMonth }: MonthDividerProps) {
  const year = yearMonth.slice(0, 4)
  const month = yearMonth.slice(4, 6)
  return (
    <div style={{
      padding: '14px 20px 6px',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--month-label)',
    }}>
      {year} · {month}
    </div>
  )
}
```

- [ ] **Step 2: Write `RecordingItem.tsx`**

```tsx
import { useState } from 'react'
import { formatDuration } from '../lib/format'
import type { RecordingItem as RecordingItemType } from '../types'

interface RecordingItemProps {
  item: RecordingItemType
  isActive?: boolean
  elapsedSecs?: number
  onContextMenu: (e: React.MouseEvent, item: RecordingItemType) => void
}

const MicIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="5" y="1" width="6" height="9" rx="3" />
    <path d="M3 8a5 5 0 0 0 10 0M8 13v2" />
  </svg>
)

export function RecordingItem({ item, isActive, elapsedSecs, onContextMenu }: RecordingItemProps) {
  const [hovered, setHovered] = useState(false)
  const duration = isActive && elapsedSecs !== undefined
    ? formatDuration(elapsedSecs)
    : formatDuration(item.duration_secs)

  const bg = isActive
    ? 'var(--record-highlight)'
    : hovered ? 'var(--item-hover-bg)' : 'transparent'

  return (
    <div
      onContextMenu={e => onContextMenu(e, item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 20px',
        gap: 12,
        cursor: 'default',
        background: bg,
      }}
    >
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: isActive ? 'var(--record-highlight-icon)' : 'var(--item-icon-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: isActive ? 'var(--record-btn)' : 'var(--item-meta)',
      }}>
        <MicIcon />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          color: isActive ? 'var(--record-btn)' : 'var(--item-text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {item.display_name}
        </div>
        {isActive && (
          <div style={{ fontSize: 11, color: 'var(--item-meta)', marginTop: 2 }}>
            录制中…
          </div>
        )}
      </div>
      <div style={{
        fontSize: 12,
        color: isActive ? 'var(--record-btn)' : 'var(--duration-text)',
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
        animation: isActive ? 'blink 1s ease-in-out infinite' : 'none',
      }}>
        {duration}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/MonthDivider.tsx src/components/RecordingItem.tsx
git commit -m "feat: add MonthDivider and RecordingItem components"
```

---

### Task 11: `RecordingList` component

**Files:**
- Create: `src/components/RecordingList.tsx`

- [ ] **Step 1: Write `RecordingList.tsx`**

```tsx
import { MonthDivider } from './MonthDivider'
import { RecordingItem } from './RecordingItem'
import type { RecordingItem as RecordingItemType } from '../types'
import type { RecorderStatus } from '../hooks/useRecorder'

interface RecordingListProps {
  recordings: RecordingItemType[]
  status: RecorderStatus
  activeItem: RecordingItemType | null
  elapsedSecs: number
  onContextMenu: (e: React.MouseEvent, item: RecordingItemType) => void
}

type Group = { yearMonth: string; items: RecordingItemType[] }

export function RecordingList({
  recordings,
  status,
  activeItem,
  elapsedSecs,
  onContextMenu,
}: RecordingListProps) {
  // Build month groups. The activeItem is merged into the correct month group
  // (not prepended as a separate group), matching the spec requirement:
  // "录制中的条目始终置顶，属于当前月份组".
  const groups: Group[] = []

  // Add active item to its month group first
  if (status === 'recording' && activeItem) {
    groups.push({ yearMonth: activeItem.year_month, items: [activeItem] })
  }

  for (const item of recordings) {
    const existing = groups.find(g => g.yearMonth === item.year_month)
    if (existing) {
      existing.items.push(item)
    } else {
      groups.push({ yearMonth: item.year_month, items: [item] })
    }
  }

  // Sort groups descending by yearMonth
  groups.sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      {groups.map(group => (
        <div key={group.yearMonth}>
          <MonthDivider yearMonth={group.yearMonth} />
          {group.items.map(item => (
            <RecordingItem
              key={item.path}
              item={item}
              isActive={status === 'recording' && activeItem?.path === item.path}
              elapsedSecs={elapsedSecs}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RecordingList.tsx
git commit -m "feat: add RecordingList with correct month group merging for active item"
```

---

### Task 12: `RecordButton` component

**Files:**
- Create: `src/components/RecordButton.tsx`

- [ ] **Step 1: Write `RecordButton.tsx`**

```tsx
import type { RecorderStatus } from '../hooks/useRecorder'

interface RecordButtonProps {
  status: RecorderStatus
  onClick: () => void
}

export function RecordButton({ status, onClick }: RecordButtonProps) {
  const isRecording = status === 'recording'
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 120,
      flexShrink: 0,
      borderTop: '1px solid var(--divider)',
      background: 'var(--bg)',
    }}>
      <button
        onClick={onClick}
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'var(--record-btn)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Pulse animation only while idle; no animation while recording
          animation: isRecording ? 'none' : 'pulse 2.4s ease-in-out infinite',
          outline: 'none',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        {isRecording ? (
          <div style={{ width: 24, height: 24, borderRadius: 5, background: '#fff' }} />
        ) : (
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff' }} />
        )}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RecordButton.tsx
git commit -m "feat: add RecordButton with pulse animation and stop icon"
```

---

## Chunk 3: Integration

### Task 13: `App.tsx` — wire everything together

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Install `tauri-plugin-context-menu` npm package**

```bash
npm install tauri-plugin-context-menu
```

Verify the Rust crate is already in `src-tauri/Cargo.toml` (added in Task 1 Step 3) and registered in `main.rs` (Task 1 Step 6). If not, add it now:

```toml
# src-tauri/Cargo.toml [dependencies]
tauri-plugin-context-menu = "0.8"
```

- [ ] **Step 2: Write `App.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { showMenu } from 'tauri-plugin-context-menu'
import { TitleBar } from './components/TitleBar'
import { RecordingList } from './components/RecordingList'
import { RecordButton } from './components/RecordButton'
import { useRecorder } from './hooks/useRecorder'
import { listRecordings, deleteRecording, revealInFinder, playRecording } from './lib/tauri'
import { formatYearMonth } from './lib/format'
import type { RecordingItem } from './types'

export default function App() {
  const [recordings, setRecordings] = useState<RecordingItem[]>([])
  const [activeItem, setActiveItem] = useState<RecordingItem | null>(null)

  const loadRecordings = useCallback(async () => {
    const items = await listRecordings()
    setRecordings(items)
  }, [])

  useEffect(() => { loadRecordings() }, [loadRecordings])

  const handleStopped = useCallback((item: RecordingItem) => {
    setActiveItem(null)
    setRecordings(prev => [item, ...prev])
  }, [])

  const { status, elapsedSecs, start, stop } = useRecorder(handleStopped)

  const handleRecordButton = useCallback(async () => {
    if (status === 'idle') {
      try {
        await start()
        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        const displayName = `录音 ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
        setActiveItem({
          filename: displayName + '.m4a',
          path: '__active__',
          display_name: displayName,
          duration_secs: 0,
          year_month: formatYearMonth(displayName),
        })
      } catch (err: unknown) {
        if (typeof err === 'string' && err === 'permission_denied') {
          alert('DayNote 需要麦克风权限。请前往「系统设置 → 隐私与安全性 → 麦克风」开启。')
        }
      }
    } else {
      await stop()
    }
  }, [status, start, stop])

  const handleContextMenu = useCallback(async (e: React.MouseEvent, item: RecordingItem) => {
    e.preventDefault()
    if (item.path === '__active__') return
    await showMenu({
      items: [
        { label: '播放', event: 'play' },
        { label: '在 Finder 中显示', event: 'reveal' },
        { label: '-' },   // separator — tauri-plugin-context-menu 0.8 uses label: '-'
        { label: '删除', event: 'delete' },
      ],
      event_handler: async (event: string) => {
        if (event === 'play') {
          await playRecording(item.path).catch(() => {})
        } else if (event === 'reveal') {
          await revealInFinder(item.path).catch(() => {})
        } else if (event === 'delete') {
          await deleteRecording(item.path).catch(() => {})
          setRecordings(prev => prev.filter(r => r.path !== item.path))
        }
      },
    })
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TitleBar status={status} elapsedSecs={elapsedSecs} />
      <RecordingList
        recordings={recordings}
        status={status}
        activeItem={activeItem}
        elapsedSecs={elapsedSecs}
        onContextMenu={handleContextMenu}
      />
      <RecordButton status={status} onClick={handleRecordButton} />
    </div>
  )
}
```

- [ ] **Step 3: Verify npm build compiles**

```bash
npm run build
```

Expected: Vite build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx package.json package-lock.json
git commit -m "feat: wire App.tsx — recording state, list, context menu integration"
```

---

### Task 14: End-to-end smoke test

**Files:** none (manual verification)

- [ ] **Step 1: Run the app in development mode**

```bash
npm run tauri dev
```

Expected: DayNote window opens (320×480, traffic-light buttons visible, custom title bar showing "DayNote", record button at bottom with pulse animation).

- [ ] **Step 2: Verify idle state appearance**

- Record button is visible at bottom, red circle with white dot, pulse animation running.
- Title bar shows "DayNote".
- If no recordings exist, the list area is empty.
- Drag the window by the title bar — it should move.

- [ ] **Step 3: Test recording flow**

- Click the record button.
- Expected: button changes to stop icon (rounded square). Title bar shows `● 00:01` counting up. A new row appears at the top of the list, highlighted in red, showing current timestamp and "录制中…".

- [ ] **Step 4: Test stop flow**

- Click the stop button after a few seconds.
- Expected: button returns to record icon. Title bar returns to "DayNote". The in-progress row is replaced by the completed recording with real duration.

- [ ] **Step 5: Test right-click menu**

- Right-click a completed recording row.
- Expected: native macOS context menu with 播放 / 在 Finder 中显示 / — / 删除.
- "在 Finder 中显示" → Finder opens with file selected.
- "播放" → QuickTime opens the file.
- "删除" → row disappears.

- [ ] **Step 6: Test month grouping and sort order**

- Verify: recordings from different months appear in separate groups with grey month dividers (`2026 · 03` etc.).
- Verify: within each month group, newest recording appears first (top).

- [ ] **Step 7: Test theme switching**

- In System Settings → Appearance, switch between Light and Dark.
- Expected: app colors update automatically without restart.

- [ ] **Step 8: Test permission-denied path (if possible)**

- In System Settings → Privacy & Security → Microphone, revoke DayNote's permission.
- Click the record button.
- Expected: native alert dialog appears with the permission message.

- [ ] **Step 9: Fix any issues, then commit**

```bash
git add src/
git commit -m "fix: address issues found during smoke test"
```

---

### Task 15: Build release and verify

**Files:** none (build step)

- [ ] **Step 1: Confirm `.gitignore` excludes `src-tauri/target/`**

```bash
grep "target" .gitignore
```

Expected output includes `src-tauri/target/`. If missing, add it before proceeding.

- [ ] **Step 2: Build release bundle**

```bash
npm run tauri build
```

Expected: `src-tauri/target/release/bundle/macos/DayNote.app` created.

- [ ] **Step 3: Verify bundle size**

```bash
du -sh src-tauri/target/release/bundle/macos/DayNote.app
```

Expected: under 20MB.

- [ ] **Step 4: Run the release build**

```bash
open src-tauri/target/release/bundle/macos/DayNote.app
```

Verify: microphone permission prompt appears on first launch if not already granted. App behaves identically to dev mode.

- [ ] **Step 5: Final commit**

```bash
git add .gitignore
git commit -m "chore: verify release build passes"
```
