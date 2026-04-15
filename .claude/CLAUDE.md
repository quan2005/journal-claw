# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Design Context

### Users
知识工作者：频繁参与会议、整理文档，每天产生多条日志。核心任务是**高效浏览 + 沉浸阅读**，不是创作。情感期望：打开即平静，阅读时忘记工具的存在。

### Brand Personality
**克制 · 沉静 · 专业**（Intentional · Quiet · Precise）

- Bear / Things 3 / Aesop 基调：深灰背景，大量留白，内容主导
- 只有一种 accent 色（`#ff3b30` / `#ff375f` 红色，用于录音按钮和选中态）
- 无阴影、无渐变、无多余装饰
- 高级感路径：**Quieter** — 奢侈品式精密克制

### Aesthetic Direction
- **参考**：Bear App（阅读沉浸）、Things 3（交互精度）、Linear（信息密度）、Aesop（克制的高级感）
- **反参考**：Notion 彩色 banner / 卡片阴影；AI slop（紫蓝渐变、霓虹、玻璃态、bounce 缓动）
- **主题优先级**：深色模式为主要质量基准；浅色同等打磨

### Design Principles

1. **留白即信息** — 行高、段落间距比字号更重要。紧密（8–12px）用于组内，宽松（32–48px）用于章节
2. **层级靠字号 + 字重** — 不靠颜色。h1/h2/h3/正文用字号差 + 字重差建立层级
3. **单一 accent** — 全局只有录音红色。其余交互用透明度变化和 tinted neutral 色阶
4. **字体有意图** — 正文用系统无衬线（SF Pro），代码块用 IBM Plex Mono。等宽不是品牌气质而是代码语义
5. **动效有纪律** — 只动 transform + opacity，≤300ms，ease-out 家族，尊重 prefers-reduced-motion
6. **Neutrals 带墨水青调** — 灰色系带微妙冷青 tint，不是死灰
7. **Anti-slop** — 拒绝紫蓝渐变、bounce 缓动、装饰性模糊、渐变文字、卡片套卡片

完整设计规范见 `.impeccable.md`。

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

### Versioning

版本号在三个文件中必须保持一致，由 release-please 自动同步，**不要手动修改**：
- `package.json` → `version`
- `src-tauri/Cargo.toml` → `[package].version`
- `src-tauri/tauri.conf.json` → `version`

所有 commit message 必须遵循 **Conventional Commits** 格式，release-please 依此自动判断版本类型：

| 格式 | 版本变化 | 示例 |
|---|---|---|
| `fix: ...` | patch | `fix: 修复跨文件夹链接跳转` |
| `feat: ...` | minor | `feat: 新增标签筛选功能` |
| `feat!: ...` 或 body 含 `BREAKING CHANGE:` | major | `feat!: 重构存储格式` |
| `chore:` / `docs:` / `refactor:` / `test:` 等 | 无变化 | `chore: 更新依赖` |

合并到 master 后，release-please 自动维护一个 Release PR；合并该 PR 即完成打 tag 和发布 GitHub Release。

### Key Constraints

- **视觉一致性**：如无特殊说明，日志列表栏（`JournalList`）与画像列表栏（`IdentityList`）的表现保持一致；日志详情（`DetailPanel`）与画像详情（`IdentityDetail`）的表现也保持一致。修改其中一个时同步修改另一个。
- **Context menu**: Use Tauri v2 `@tauri-apps/api/menu` (`Menu`, `MenuItem`). `tauri-plugin-context-menu` is v1-only — do not use it.
- **Theme**: Stored per-workspace via `workspace_settings` Rust commands, not in localStorage (except panel width).
- **AI processing**: Claude CLI is called as an external process. The path is detected via `which claude` at startup; falls back to the bare `claude` command if not found.
