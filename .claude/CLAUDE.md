# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Design Context

### Users
知识工作者：频繁参与会议、整理会议记录和文档，每天产生多条日志。核心任务是**高效浏览 + 沉浸阅读**，不是创作。

### Brand Personality
**克制 · 沉静 · 专业**

- Bear / Things 3 基调：深灰背景，大量留白，内容主导
- 只有一种 accent 色（`#ff3b30` / `#ff375f` 红色，用于录音按钮和选中态）
- 无阴影、无渐变、无多余装饰
- 情感目标：打开即平静，阅读不费力

### Aesthetic Direction
- **参考**：Bear App、Things 3、Linear（密度参考）
- **反参考**：Notion 彩色 banner / 卡片阴影；插件堆砌感
- **主题优先级**：深色模式为主要呈现质量基准

### Design Principles

1. **留白即信息**：行高、段落间距比字号更重要
2. **层级靠尺寸，不靠颜色**：h1/h2/h3/正文字号差要明显
3. **代码可操作**：代码块加复制按钮；inline code 用中性色，不用红色
4. **过渡有温度**：加载态、空状态与深色调协调，避免生硬
5. **单一 accent**：全局只有录音红色，其余交互用透明度变化

详细改进路线图见 `.impeccable.md`。

---

## Commands

```bash
# Dev (starts both Vite + Tauri)
npm run tauri dev

# Frontend only (Vite at localhost:1420)
npm run dev

# Frontend tests (vitest)
npm test
npm run test:watch          # watch mode
npx vitest run src/tests/JournalItem.test.tsx   # single file

# Frontend build check
npm run build               # tsc + vite build

# Rust tests (unit tests inside src-tauri/src/)
cd src-tauri && cargo test

# Production app bundle
npm run tauri build
```

## Architecture

谨迹 is a **Tauri v2 + React + TypeScript + Rust** macOS app. The app has two webview windows: `index.html` (main journal view) and `settings.html` (settings panel).

### Data Flow

```
User action (drop file / record / paste)
  → Frontend calls invoke() via src/lib/tauri.ts
  → Rust command in src-tauri/src/
  → Writes raw material to workspace/yyMM/raw/
  → Spawns Claude CLI via tokio::process::Command
  → Claude CLI writes .md journal entries to workspace/yyMM/
  → Rust emits Tauri event (ai-processing, journal-updated)
  → Frontend useJournal hook re-fetches entries
```

### Workspace Layout (user-configured, default `~/Documents/journal/`)

```
workspace/
  yyMM/           # e.g. "2603" = March 2026
    raw/          # raw materials: .m4a, .txt, .pdf, .docx, ...
    DD-title.md   # journal entries with YAML frontmatter (summary, tags)
```

### Frontend (`src/`)

- **`App.tsx`** — root layout: left list (resizable) + divider + right detail panel + bottom CommandDock
- **`src/lib/tauri.ts`** — all `invoke()` calls in one place; this is the IPC boundary
- **`src/hooks/useJournal.ts`** — loads entries, listens for `ai-processing` / `journal-updated` / `recording-processed` events
- **`src/hooks/useRecorder.ts`** — recording state machine (idle → recording → idle)
- **`src/hooks/useTheme.ts`** — light/dark/system theme, persisted via `workspace_settings` Rust command
- **`src/types.ts`** — shared TypeScript types (`JournalEntry`, `RawMaterial`, `ProcessingUpdate`, `Theme`)

### Rust (`src-tauri/src/`)

| Module | Responsibility |
|---|---|
| `main.rs` | Tauri setup, menu, `invoke_handler` registration |
| `config.rs` | `Config` struct; reads/writes `app_data_dir/config.json`; `workspace_path`, `dashscope_api_key`, `claude_cli_path` |
| `journal.rs` | `JournalEntry` / `RawMaterial` types; filesystem scan of workspace dirs; `list_all_journal_entries` walks all `yyMM/` dirs |
| `workspace.rs` | Path helpers: `year_month_dir`, `raw_dir`, `ensure_dirs`, `current_year_month` |
| `ai_processor.rs` | Spawns Claude CLI (`claude --cwd <yyMM_dir> -p @<material_path> <prompt>`); emits `ai-processing` / `journal-updated` events |
| `recorder.rs` | Audio capture via `cpal`; writes WAV → converts to M4A via `afconvert` |
| `transcription.rs` | Reads/writes `.transcript.json` sidecar files alongside recordings |
| `materials.rs` | `import_file` (copy to `raw/`) and `import_text` (save as `.txt` in `raw/`) |
| `workspace_settings.rs` | Per-workspace `settings.json` (currently stores theme) |

### Tauri IPC Conventions

- All Tauri commands are registered in `main.rs` `invoke_handler![]`
- Frontend wrappers live in `src/lib/tauri.ts` — add new commands there too
- Events emitted from Rust use string names: `"ai-processing"`, `"journal-updated"`, `"recording-processed"`
- Custom DOM events dispatched on `window` from frontend: `"journal-entry-deleted"`

### Journal Entry Format

```markdown
---
summary: 一句话摘要
tags: [tag1, tag2]
---

# Title

Body content...
```

Filename: `DD-title.md` (e.g. `28-AI平台产品会议纪要.md`). The `DD` prefix determines sort order.

### Key Constraints

- **Context menu**: Use Tauri v2 `@tauri-apps/api/menu` (`Menu`, `MenuItem`). `tauri-plugin-context-menu` is v1-only — do not use it.
- **Theme**: Stored per-workspace via `workspace_settings` Rust commands, not in localStorage (except panel width).
- **AI processing**: Claude CLI is called as an external process. The path defaults to `~/.local/bin/claude`, `/usr/local/bin/claude`, or `/opt/homebrew/bin/claude`.
