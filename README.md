# JournalClaw

[中文](README.cn.md)

You capture. AI organizes.

JournalClaw is a macOS desktop app — an AI-powered knowledge base for knowledge workers. You don't write notes. You throw in raw materials, and AI compiles them into searchable knowledge entries, building a personal memory system along a timeline.

## The Idea

Andrej Karpathy [wrote about](https://karpathy.bearblog.dev/the-append-and-review-note/) a note-taking principle that resonates: *append first, review later*. The friction of organizing while capturing kills the thought. The value is in the review cycle, not the structure.

JournalClaw takes this to the extreme: **you never write a single note**. Recordings, documents, pasted text — all raw materials go into `raw/`, and the LLM incrementally compiles them into structured Markdown knowledge entries. Every new material triggers an update. You only do two things: feed it materials, and come back to read.

```
Raw materials (recordings / documents / text)
  ↓  LLM incremental compilation
Memory (timeline .md knowledge entries)
  ↓  Search + use
Your questions answered
```

## Features

![JournalClaw main UI](docs/images/screenshot-20260407-095213.png)

- **Voice recording** — One click, noise reduction, silence removal, M4A output. AI transcribes and structures it.
- **File import** — Drop PDF, DOCX, TXT. AI extracts, summarizes, files it.
- **Paste text** — Meeting notes, web clips, rough ideas. Submit and move on.
- **AI compilation** — LLM incrementally compiles raw materials into structured Markdown: title, tags, summary, body. Knowledge base updates automatically with each new input.
- **Timeline memory** — All knowledge entries are arranged chronologically, forming a continuously growing personal memory system.
- **Profiles** — Build profiles for people, projects, and more to help AI understand context and connections with greater precision.
- **Ideas** — Capture thoughts anytime. When ready to go deeper, right-click and select "Explore in Depth" to let AI expand your thinking.
- **Speaker profiles** — On-device speaker identification. Name the voices once; AI uses the names.
- **Immersive reading** — Markdown rendering, code highlighting, left-list right-detail layout.
- **Multi-workspace** — Monthly archive, configurable workspace path.
- **Light / Dark theme** — System-adaptive or manual.
- **Voice engines** — Apple on-device (zero config), WhisperKit (on-device, offline), DashScope (cloud).

## Quick Start

1. Download the latest `.dmg` from [Releases](https://github.com/quan2005/journal/releases) and drag to Applications
2. Install [Claude CLI](https://claude.ai/download) — ensure `claude` is in your PATH
3. Open JournalClaw, set your workspace path in Settings, start recording or drop a file

## Roadmap

- [x] **Ideas** — Capture thoughts anytime; right-click "Explore in Depth" to let AI expand your thinking
- [ ] **Multi-AI** — plug in different providers (Claude, OpenAI, local models)
- [ ] **Skill plugins** — extensible processing pipeline, user-defined workflows
- [ ] **Auto-organize** — scheduled or trigger-based tagging and summarization
- [ ] **Remote control** — Telegram / WeChat bot to trigger recordings and query journal from anywhere

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop framework | Tauri v2 |
| Frontend | React 19 + TypeScript + Vite |
| Audio capture | cpal 0.17 |
| Audio processing | nnnoiseless (denoising) + rubato (resampling) + afconvert (M4A) |
| AI processing | Claude CLI (external process) |
| Serialization | serde / serde_json |

## Architecture

```
User action (record / drop / paste)
  → Frontend invoke() → src/lib/tauri.ts
  → Rust command → workspace/yyMM/raw/ (raw materials)
  → Claude CLI spawned → writes workspace/yyMM/DD-title.md
  → Emits journal-updated event
  → Frontend useJournal hook reloads entries
```

```
src/                     # Frontend
  components/            # React components
  hooks/                 # useJournal, useRecorder, useTheme
  lib/tauri.ts           # All IPC calls
  types.ts               # Shared types
src-tauri/src/           # Rust backend
  ai_processor.rs        # Claude CLI invocation, event emission
  recorder.rs            # Recording state machine
  audio_process.rs       # Denoising / resampling / silence removal
  journal.rs             # Journal entry scanning and parsing
  config.rs              # App config read/write
  workspace.rs           # Workspace path helpers
```

## Development

**Prerequisites:** Rust stable, Node.js 18+, macOS 12+

```bash
npm install
npm run tauri dev        # Dev mode (Vite + Tauri hot reload)
npm test                 # Frontend tests (vitest)
cd src-tauri && cargo test   # Rust unit tests
npm run tauri build      # Build → src-tauri/target/release/bundle/
```

First run requires microphone permission: System Settings → Privacy & Security → Microphone.
