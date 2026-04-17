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
- **AI compilation** — Built-in LLM engine compiles raw materials into structured Markdown: title, tags, summary, body. Knowledge base updates automatically with each new input.
- **Conversation** — Chat or agent mode. Ask questions about your knowledge base, get AI-powered analysis with streaming responses.
- **Timeline memory** — All knowledge entries are arranged chronologically, forming a continuously growing personal memory system.
- **Source traceability** — Every journal entry links back to its raw materials. Click a source chip to open the original file.
- **Profiles** — Build profiles for people, projects, and concepts to help AI understand context and connections with greater precision.
- **Auto-lint** — Scheduled knowledge base maintenance: contradiction detection, orphan profile cleanup, concept extraction, and gap filling.
- **Todos** — Capture action items from journal entries, organize by workspace path, set due dates, link to conversation sessions.
- **Speaker profiles** — On-device speaker identification via Swift sidecar. Name the voices once; AI uses the names.
- **Immersive reading** — Markdown rendering, code highlighting, left-list right-detail layout, paginated timeline loading.
- **@-reference** — Right-click any entry or profile to insert an @-reference into the input dock.
- **Skill plugins** — Extensible processing pipeline via `SKILL.md` files in workspace or global `~/.claude/skills/`.
- **Feishu bridge** — Connect to Feishu (Lark) via WebSocket to receive messages and process them as journal materials.
- **Multi-workspace** — Monthly archive, configurable workspace path.
- **Light / Dark theme** — System-adaptive or manual. Amber-gold accent, ink-cyan neutral palette.
- **Voice engines** — Apple on-device (zero config, SpeechAnalyzer on macOS 26+), WhisperKit (on-device, offline), DashScope (cloud).
- **Multi-vendor AI** — Supports Anthropic, Volcengine, Zhipu AI, and Alibaba DashScope as LLM providers.

## Quick Start

1. Download the latest `.dmg` from [Releases](https://github.com/quan2005/journal/releases) and drag to Applications
2. Open JournalClaw, configure an AI provider in Settings → AI Engine (Anthropic API key, or a Chinese provider)
3. Set your workspace path in Settings, start recording or drop a file

## Roadmap

- [x] **Conversation** — Chat and agent modes with streaming AI responses
- [x] **Auto-lint** — Scheduled knowledge base maintenance with contradiction detection and gap filling
- [x] **Feishu bridge** — Receive Feishu messages as journal materials via WebSocket
- [x] **Multi-vendor AI** — Anthropic, Volcengine, Zhipu, DashScope as LLM providers
- [x] **Skill plugins** — Extensible processing pipeline via SKILL.md
- [ ] **IM remote control** — Telegram / WeChat bot to trigger recordings and query journal from anywhere

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop framework | Tauri v2 |
| Frontend | React 19 + TypeScript + Vite 7 |
| Audio capture | cpal 0.17 |
| Audio processing | nnnoiseless (denoising) + rubato (resampling) + afconvert (M4A) |
| Speech-to-text | Apple SpeechAnalyzer / SFSpeechRecognizer (Swift sidecar), WhisperKit, DashScope |
| AI engine | Built-in Anthropic Messages API client (Rust, supports multiple vendors) |
| IM integration | Feishu WebSocket bridge |
| Serialization | serde / serde_json |

## Architecture

```
User action (record / drop / paste / Feishu message)
  → Frontend invoke() → src/lib/tauri.ts
  → Rust command → workspace/yyMM/raw/ (raw materials)
  → Built-in LLM engine (src-tauri/src/llm/) → Anthropic Messages API
  → Writes workspace/yyMM/DD-title.md
  → Emits journal-updated event
  → Frontend useJournal hook reloads entries
```

```
src/                     # Frontend
  components/            # React components (30+)
  hooks/                 # useJournal, useRecorder, useTheme, useIdentity, useTodos, useConversation
  lib/tauri.ts           # All IPC calls (single entry point)
  types.ts               # Shared types
  contexts/              # I18nContext (zh/en)
  settings/              # Settings panel (9 sections)
src-tauri/src/           # Rust backend
  main.rs                # Tauri setup, menu, 50+ invoke_handler commands
  config.rs              # App config (vendors, ASR, Feishu, WhisperKit)
  llm/                   # Built-in LLM engine (Anthropic Messages API, tool loop)
  conversation.rs        # Chat/agent sessions with streaming
  ai_processor.rs        # AI processing queue, event emission
  recorder.rs            # Audio capture (cpal → WAV → M4A)
  audio_pipeline.rs      # Audio preparation pipeline for AI
  audio_process.rs       # Denoising / resampling / silence removal
  transcription.rs       # STT (Apple / DashScope / WhisperKit)
  journal.rs             # Journal entry scanning and YAML frontmatter parsing
  identity.rs            # Profile management (people, projects, concepts)
  speaker_profiles.rs    # On-device speaker identification
  todos.rs               # Todo items with path grouping and due dates
  auto_lint.rs           # Scheduled knowledge base maintenance
  skills.rs              # Skill plugin discovery (SKILL.md)
  feishu_bridge.rs       # Feishu WebSocket client
  materials.rs           # File import and text paste handling
  permissions.rs         # macOS microphone/speech permission checks
  workspace.rs           # Workspace path helpers
  workspace_settings.rs  # Per-workspace settings (theme, auto-lint)
```

## Development

**Prerequisites:** Rust stable, Node.js 18+, macOS 12+ (macOS 26+ for SpeechAnalyzer)

```bash
npm install
npm run tauri dev        # Dev mode (Vite + Tauri hot reload)
npm test                 # Frontend tests (vitest)
cd src-tauri && cargo test   # Rust unit tests
npm run test:e2e         # E2E tests (Playwright)
npm run tauri build      # Build → src-tauri/target/release/bundle/
```

First run requires microphone permission: System Settings → Privacy & Security → Microphone.
