# JournalClaw

[中文](README.cn.md)

You capture. AI organizes.

JournalClaw is a macOS desktop app — an AI-powered knowledge base for knowledge workers. You don't write notes. You throw in raw materials, and AI compiles them into searchable knowledge entries, building a personal memory system along a timeline.

## The Idea

Andrej Karpathy [wrote about](https://karpathy.bearblog.dev/the-append-and-review-note/) a note-taking principle that resonates: *append first, review later*. The friction of organizing while capturing kills the thought. The value is in the review cycle, not the structure.

JournalClaw takes this to the extreme: **you never write a single note**. Documents, pasted text — all raw materials go into `raw/`, and the LLM incrementally compiles them into structured Markdown knowledge entries. Every new material triggers an update. You only do two things: feed it materials, and come back to read.

```
Raw materials (documents / text)
  ↓  LLM incremental compilation
Memory (timeline .md knowledge entries)
  ↓  Search + use
Your questions answered
```

## Features

![JournalClaw main UI](docs/images/screenshot-20260407-095213.png)

- **File import** — Drop PDF, DOCX, TXT. AI extracts, summarizes, files it.
- **Paste text** — Meeting notes, web clips, rough ideas. Submit and move on.
- **AI compilation** — Built-in LLM engine compiles raw materials into structured Markdown: title, tags, summary, body. Knowledge base updates automatically with each new input.
- **Conversation** — Chat or agent mode. Ask questions about your knowledge base, get AI-powered analysis with streaming responses.
- **Timeline memory** — All knowledge entries are arranged chronologically, forming a continuously growing personal memory system.
- **Source traceability** — Every journal entry links back to its raw materials. Click a source chip to open the original file.
- **Profiles** — Build profiles for people, projects, and concepts to help AI understand context and connections with greater precision.
- **Auto-lint** — Scheduled knowledge base maintenance: contradiction detection, orphan profile cleanup, concept extraction, and gap filling.
- **Todos** — Capture action items from journal entries, organize by workspace path, set due dates, link to conversation sessions.
- **Immersive reading** — Markdown rendering, code highlighting, left-list right-detail layout, paginated timeline loading.
- **@-reference** — Right-click any entry or profile to insert an @-reference into the input dock.
- **Skill plugins** — Extensible processing pipeline via `SKILL.md` files in workspace or global `~/.claude/skills/`.
- **Feishu bridge** — Connect to Feishu (Lark) via WebSocket to receive messages and process them as journal materials.
- **Multi-workspace** — Monthly archive, configurable workspace path.
- **Light / Dark theme** — System-adaptive or manual. Signal orange (#FF5701) accent, warm-white layered surfaces.
- **Multi-vendor AI** — Supports Anthropic, Volcengine, Zhipu AI, and Alibaba DashScope as LLM providers.

## Quick Start

1. Download the latest `.dmg` from [Releases](https://github.com/quan2005/journal/releases) and drag to Applications
2. Open JournalClaw, configure an AI provider in Settings → AI Engine (Anthropic API key, or a Chinese provider)
3. Set your workspace path in Settings, drop a file or paste text

## Roadmap

- [x] **Conversation** — Chat and agent modes with streaming AI responses
- [x] **Auto-lint** — Scheduled knowledge base maintenance with contradiction detection and gap filling
- [x] **Feishu bridge** — Receive Feishu messages as journal materials via WebSocket
- [x] **Multi-vendor AI** — Anthropic, Volcengine, Zhipu, DashScope as LLM providers
- [x] **Skill plugins** — Extensible processing pipeline via SKILL.md
- [ ] **IM remote control** — Telegram / WeChat bot to submit materials and query journal from anywhere

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop framework | Electron |
| Frontend | React 19 + TypeScript + Vite 7 |
| Backend | TypeScript daemon (HTTP + SSE) |
| AI engine | daemon pi built-in engine + CLI adapters |
| File changes | ChangeSet service |
| Host capabilities | Electron preload host bridge |

## Architecture

```
User action (drop / paste / Agent Run)
  → React frontend → runtimeClient / hostBridge
  → TypeScript daemon services (HTTP + SSE)
  → workspace files / ChangeSet / AgentRunEvent
  → frontend hooks subscribe to events and refresh views
```

```
apps/web/src/            # React frontend
  components/            # React components
  hooks/                 # useJournal, useTheme, useIdentity, useTodos, useConversation
  lib/tauri.ts           # Compatibility shim delegating to runtime/host bridge
  lib/runtimeClient.ts   # daemon runtime abstraction
  lib/hostBridge.ts      # Electron host capabilities
apps/daemon/src/         # TypeScript daemon
  server.ts              # HTTP/SSE routes
  engine/                # pi built-in engine
  runs/                  # Agent Run lifecycle
  changeset/             # file change records and recovery
  journal/ todos/ topics/ identity/
apps/desktop/src/        # Electron host
  main.ts                # window and app lifecycle
  daemon.ts              # daemon child-process lifecycle
  hostIpc.ts             # preload IPC whitelist
```

## Development

**Prerequisites:** Node.js 20+, pnpm 9

```bash
pnpm install
npm run desktop:dev      # Dev mode (Vite + Electron)
npm test                 # Frontend tests (vitest)
cd apps/daemon && npx vitest run
cd apps/desktop && npx vitest run
npm run test:e2e         # E2E tests (Playwright)
npm run desktop:build    # Electron production build
```

## Documentation

- [User Guide](docs/guide/quick-start.md) — installation, import, conversation, timeline
- [Developer Guide](docs/dev/index.md) — environment setup, architecture, frontend/backend development, build & release
- [Design System](docs/DESIGN.md) — colors, typography, components, layout, animation, structured tokens
- [Architecture (ARCH.md)](docs/ARCH.md) — full architecture document
- [llms.txt](llms.txt) — machine-readable documentation index for AI agents
