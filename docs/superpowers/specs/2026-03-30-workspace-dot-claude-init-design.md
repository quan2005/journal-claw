# Workspace .claude/ Initialization Design

**Date:** 2026-03-30

## Problem

Currently `ai_processor.rs` only writes `workspace/CLAUDE.md` (root prompt). The notebook's `refs/scripts/` tools and structured rules live outside the app. New workspaces lack these tools out of the box.

## Goal

When the first AI processing task runs on a workspace, initialize `workspace/.claude/` with:
- `CLAUDE.md` — journal rules (replaces current `workspace/CLAUDE.md`)
- `scripts/journal-note` — create new journal entry
- `scripts/journal-audit` — audit journal files
- `scripts/journal-normalize-frontmatter` — normalize frontmatter
- `scripts/journalize-categories` — categorize entries
- `scripts/recent-summaries` — list recent summaries

All files are compiled into the binary via `include_str!()`. Source files live in `src-tauri/resources/workspace-template/.claude/` for developer maintenance.

## Resource Layout

```
src-tauri/
└── resources/
    └── workspace-template/
        └── .claude/
            ├── CLAUDE.md
            └── scripts/
                ├── journal-note
                ├── journal-audit
                ├── journal-normalize-frontmatter
                ├── journalize-categories
                └── recent-summaries
```

## Rust Changes

### Constants (ai_processor.rs)

```rust
const WORKSPACE_CLAUDE_MD: &str = include_str!("../resources/workspace-template/.claude/CLAUDE.md");
const SCRIPT_JOURNAL_NOTE: &str = include_str!("../resources/workspace-template/.claude/scripts/journal-note");
// ... one per script
```

### Function

Replace `ensure_workspace_prompt()` with `ensure_workspace_dot_claude()`:

1. Create `workspace/.claude/scripts/` dirs
2. Write `workspace/.claude/CLAUDE.md` — skip if exists
3. Write each script — skip if exists
4. `chmod 755` each script (Unix only, via `std::os::unix::fs::PermissionsExt`)

### Trigger

Same as current: called at the top of `process_material()`, i.e. first (and every) AI processing call. The skip-if-exists guard makes it idempotent.

### Existing Commands

`get_workspace_prompt` / `set_workspace_prompt` update to read/write `workspace/.claude/CLAUDE.md` instead of `workspace/CLAUDE.md`.

## Behavior

- **Idempotent**: existing files are never overwritten (user customizations preserved)
- **Write path**: `workspace/.claude/CLAUDE.md` (Claude CLI finds it via upward search from `workspace/yyMM/`)
- **Scripts**: executable after write, immediately usable from terminal

## Out of Scope

- Updating scripts on app upgrade (files are never overwritten once created)
- Windows executable bit (scripts are bash/python, macOS/Linux only)
