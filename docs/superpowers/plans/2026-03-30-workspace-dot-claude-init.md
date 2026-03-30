# Workspace .claude/ Initialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On first AI processing, auto-initialize `workspace/.claude/` with a CLAUDE.md rules file and 5 utility scripts, all compiled into the binary via `include_str!()`.

**Architecture:** Template files live in `src-tauri/resources/workspace-template/.claude/` for developer maintenance. `include_str!()` embeds them at compile time. `ensure_workspace_dot_claude()` replaces `ensure_workspace_prompt()` and writes all files idempotently (skip if exists), setting `chmod 755` on scripts.

**Tech Stack:** Rust, Tauri v2, `std::fs`, `std::os::unix::fs::PermissionsExt`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src-tauri/resources/workspace-template/.claude/CLAUDE.md` | Journal rules embedded into binary |
| Create | `src-tauri/resources/workspace-template/.claude/scripts/journal-note` | bash script — create new journal entry |
| Create | `src-tauri/resources/workspace-template/.claude/scripts/journal-audit` | python3 script — audit journal files |
| Create | `src-tauri/resources/workspace-template/.claude/scripts/journal-normalize-frontmatter` | python3 script — normalize frontmatter |
| Create | `src-tauri/resources/workspace-template/.claude/scripts/journalize-categories` | python3 script — categorize entries |
| Create | `src-tauri/resources/workspace-template/.claude/scripts/recent-summaries` | python3 script — list recent summaries |
| Modify | `src-tauri/src/ai_processor.rs` | Replace `ensure_workspace_prompt` with `ensure_workspace_dot_claude`; update `get/set_workspace_prompt` paths; add `include_str!` constants |

---

## Task 1: Create resource directory and copy template files

**Files:**
- Create: `src-tauri/resources/workspace-template/.claude/CLAUDE.md`
- Create: `src-tauri/resources/workspace-template/.claude/scripts/journal-note`
- Create: `src-tauri/resources/workspace-template/.claude/scripts/journal-audit`
- Create: `src-tauri/resources/workspace-template/.claude/scripts/journal-normalize-frontmatter`
- Create: `src-tauri/resources/workspace-template/.claude/scripts/journalize-categories`
- Create: `src-tauri/resources/workspace-template/.claude/scripts/recent-summaries`

- [ ] **Step 1: Create directories**

```bash
mkdir -p src-tauri/resources/workspace-template/.claude/scripts
```

- [ ] **Step 2: Write CLAUDE.md**

The content is the journal assistant rules. Copy the existing `WORKSPACE_PROMPT` constant from `src-tauri/src/ai_processor.rs` (lines 37–63) as the starting content — this is the same text currently written to `workspace/CLAUDE.md`. Content:

```
src-tauri/resources/workspace-template/.claude/CLAUDE.md
```

```markdown
# 谨迹

你叫谨迹，是一名智能日志助理。你负责把用户的原始素材整理成 journal 条目。素材可能是录音转写、PDF、文档或粘贴的文字。

整理时，直接在 `yyMM/` 目录下创建或更新 `DD-标题.md` 文件。frontmatter 只写 `tags` 和 `summary`，summary 先结论后背景。同一天同主题的内容合并到已有条目里，不要另起新文件。

## 输出规范

- 文件名：`DD-标题.md`，放在对应的 `yyMM/` 目录下
- frontmatter 只保留 `tags` 和 `summary` 两个字段
- `summary`：1-3句，先结论后背景
- 同一天同主题的素材追加到已有条目，不要重复新建
- 不输出任何解释性文字，直接写文件

## 格式模板

```markdown
---
tags: [meeting, ai]
summary: "结论。背景与约束。"
---

# 标题

正文内容
```
```

- [ ] **Step 3: Copy scripts from notebook**

```bash
cp ~/Projects/github/notebook/refs/scripts/journal-note \
   src-tauri/resources/workspace-template/.claude/scripts/journal-note

cp ~/Projects/github/notebook/refs/scripts/journal-audit \
   src-tauri/resources/workspace-template/.claude/scripts/journal-audit

cp ~/Projects/github/notebook/refs/scripts/journal-normalize-frontmatter \
   src-tauri/resources/workspace-template/.claude/scripts/journal-normalize-frontmatter

cp ~/Projects/github/notebook/refs/scripts/journalize-categories \
   src-tauri/resources/workspace-template/.claude/scripts/journalize-categories

cp ~/Projects/github/notebook/refs/scripts/recent-summaries \
   src-tauri/resources/workspace-template/.claude/scripts/recent-summaries
```

- [ ] **Step 4: Verify files exist**

```bash
ls -la src-tauri/resources/workspace-template/.claude/
ls -la src-tauri/resources/workspace-template/.claude/scripts/
```

Expected: 1 file in `.claude/` (CLAUDE.md), 5 files in `scripts/`.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/resources/
git commit -m "chore: add workspace-template .claude/ resources"
```

---

## Task 2: Add `include_str!` constants and `ensure_workspace_dot_claude()`

**Files:**
- Modify: `src-tauri/src/ai_processor.rs`

- [ ] **Step 1: Write the failing test**

In `src-tauri/src/ai_processor.rs`, inside the `#[cfg(test)] mod tests` block, add this test **before** writing the implementation:

```rust
#[test]
fn ensure_workspace_dot_claude_creates_structure() {
    let tmp = std::env::temp_dir().join("journal_dot_claude_test");
    std::fs::create_dir_all(&tmp).unwrap();
    // Clean slate
    let dot_claude = tmp.join(".claude");
    let _ = std::fs::remove_dir_all(&dot_claude);

    ensure_workspace_dot_claude(tmp.to_str().unwrap());

    // CLAUDE.md exists and has expected content
    let claude_md = dot_claude.join("CLAUDE.md");
    assert!(claude_md.exists(), ".claude/CLAUDE.md should exist");
    let content = std::fs::read_to_string(&claude_md).unwrap();
    assert!(content.contains("tags"), "CLAUDE.md should mention tags");
    assert!(content.contains("summary"), "CLAUDE.md should mention summary");
    assert!(content.contains("DD-标题.md"), "CLAUDE.md should mention filename format");

    // Scripts exist and are executable
    use std::os::unix::fs::PermissionsExt;
    for script in &["journal-note", "journal-audit", "journal-normalize-frontmatter",
                    "journalize-categories", "recent-summaries"] {
        let p = dot_claude.join("scripts").join(script);
        assert!(p.exists(), "script {} should exist", script);
        let mode = std::fs::metadata(&p).unwrap().permissions().mode();
        assert!(mode & 0o111 != 0, "script {} should be executable", script);
    }

    // Second call should NOT overwrite existing files
    std::fs::write(&claude_md, "用户自定义内容").unwrap();
    ensure_workspace_dot_claude(tmp.to_str().unwrap());
    let content2 = std::fs::read_to_string(&claude_md).unwrap();
    assert_eq!(content2, "用户自定义内容", "second call must not overwrite");

    std::fs::remove_dir_all(&tmp).ok();
}
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd src-tauri && cargo test ensure_workspace_dot_claude_creates_structure -- --nocapture 2>&1 | tail -20
```

Expected: compile error — `ensure_workspace_dot_claude` not found.

- [ ] **Step 3: Add `include_str!` constants**

In `src-tauri/src/ai_processor.rs`, **replace** the existing `WORKSPACE_PROMPT` constant block (lines 37–63, the `r##"..."##` literal) with:

```rust
// ── Embedded workspace template ──────────────────────────
// Source files live in src-tauri/resources/workspace-template/.claude/
// Edit those files to update the template; include_str! embeds at compile time.

const WORKSPACE_CLAUDE_MD: &str =
    include_str!("../resources/workspace-template/.claude/CLAUDE.md");

const SCRIPT_JOURNAL_NOTE: &str =
    include_str!("../resources/workspace-template/.claude/scripts/journal-note");
const SCRIPT_JOURNAL_AUDIT: &str =
    include_str!("../resources/workspace-template/.claude/scripts/journal-audit");
const SCRIPT_JOURNAL_NORMALIZE: &str =
    include_str!("../resources/workspace-template/.claude/scripts/journal-normalize-frontmatter");
const SCRIPT_JOURNALIZE_CATEGORIES: &str =
    include_str!("../resources/workspace-template/.claude/scripts/journalize-categories");
const SCRIPT_RECENT_SUMMARIES: &str =
    include_str!("../resources/workspace-template/.claude/scripts/recent-summaries");
```

- [ ] **Step 4: Add `ensure_workspace_dot_claude()` and remove `ensure_workspace_prompt()`**

**Replace** the existing `ensure_workspace_prompt` function (lines 65–71) with:

```rust
/// 确保 workspace/.claude/ 已初始化。仅在文件不存在时创建，不覆盖用户修改。
fn ensure_workspace_dot_claude(workspace_path: &str) {
    let dot_claude = std::path::PathBuf::from(workspace_path).join(".claude");
    let scripts_dir = dot_claude.join("scripts");
    let _ = std::fs::create_dir_all(&scripts_dir);

    // Write CLAUDE.md
    let claude_md = dot_claude.join("CLAUDE.md");
    if !claude_md.exists() {
        let _ = std::fs::write(&claude_md, WORKSPACE_CLAUDE_MD);
    }

    // Write scripts, set executable bit
    let scripts: &[(&str, &str)] = &[
        ("journal-note",                    SCRIPT_JOURNAL_NOTE),
        ("journal-audit",                   SCRIPT_JOURNAL_AUDIT),
        ("journal-normalize-frontmatter",   SCRIPT_JOURNAL_NORMALIZE),
        ("journalize-categories",           SCRIPT_JOURNALIZE_CATEGORIES),
        ("recent-summaries",               SCRIPT_RECENT_SUMMARIES),
    ];
    for (name, content) in scripts {
        let path = scripts_dir.join(name);
        if !path.exists() {
            if std::fs::write(&path, content).is_ok() {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let _ = std::fs::set_permissions(&path,
                        std::fs::Permissions::from_mode(0o755));
                }
            }
        }
    }
}
```

- [ ] **Step 5: Update call site in `process_material`**

In `process_material()` (around line 242), replace:

```rust
ensure_workspace_prompt(&cfg.workspace_path);
```

with:

```rust
ensure_workspace_dot_claude(&cfg.workspace_path);
```

- [ ] **Step 6: Run the test to confirm it passes**

```bash
cd src-tauri && cargo test ensure_workspace_dot_claude_creates_structure -- --nocapture 2>&1 | tail -20
```

Expected: `test ensure_workspace_dot_claude_creates_structure ... ok`

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/ai_processor.rs
git commit -m "feat: replace ensure_workspace_prompt with ensure_workspace_dot_claude"
```

---

## Task 3: Update `get_workspace_prompt` / `set_workspace_prompt` to use `.claude/CLAUDE.md`

**Files:**
- Modify: `src-tauri/src/ai_processor.rs`

- [ ] **Step 1: Update `get_workspace_prompt`**

Find `get_workspace_prompt` (around line 430). Change:

```rust
let path = std::path::PathBuf::from(&cfg.workspace_path).join("CLAUDE.md");
if path.exists() {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
} else {
    Ok(WORKSPACE_PROMPT.to_string())
}
```

to:

```rust
let path = std::path::PathBuf::from(&cfg.workspace_path)
    .join(".claude")
    .join("CLAUDE.md");
if path.exists() {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
} else {
    Ok(WORKSPACE_CLAUDE_MD.to_string())
}
```

- [ ] **Step 2: Update `set_workspace_prompt`**

Find `set_workspace_prompt` (around line 441). Change:

```rust
let path = std::path::PathBuf::from(&cfg.workspace_path).join("CLAUDE.md");
std::fs::write(&path, content).map_err(|e| e.to_string())
```

to:

```rust
let dot_claude = std::path::PathBuf::from(&cfg.workspace_path).join(".claude");
let _ = std::fs::create_dir_all(&dot_claude);
let path = dot_claude.join("CLAUDE.md");
std::fs::write(&path, content).map_err(|e| e.to_string())
```

- [ ] **Step 3: Update the old test for `ensure_workspace_prompt_creates_file`**

The old test at `fn ensure_workspace_prompt_creates_file` (around line 591) references the deleted function. **Replace the entire test** with a smoke test for the new path logic:

```rust
#[test]
fn get_workspace_prompt_returns_default_when_no_file() {
    // WORKSPACE_CLAUDE_MD is non-empty (compile-time check via include_str!)
    assert!(!WORKSPACE_CLAUDE_MD.is_empty());
    assert!(WORKSPACE_CLAUDE_MD.contains("tags"));
    assert!(WORKSPACE_CLAUDE_MD.contains("summary"));
}
```

- [ ] **Step 4: Run all ai_processor tests**

```bash
cd src-tauri && cargo test 2>&1 | tail -30
```

Expected: all tests pass, no compile errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/ai_processor.rs
git commit -m "feat: update get/set_workspace_prompt to use .claude/CLAUDE.md path"
```

---

## Task 4: End-to-end smoke test

**Files:**
- No code changes — manual verification only

- [ ] **Step 1: Build the app**

```bash
cd /Users/yanwu/Projects/github/journal && npm run build 2>&1 | tail -20
```

Expected: `tsc` and `vite build` succeed with no errors.

- [ ] **Step 2: Verify `cargo test` passes**

```bash
cd src-tauri && cargo test 2>&1 | grep -E "^test |FAILED|error"
```

Expected: all lines show `ok`, none show `FAILED`.

- [ ] **Step 3: Manually verify workspace initialization**

Run the app with `npm run tauri dev`, trigger an AI processing task on any material. Then:

```bash
ls -la ~/Documents/journal/.claude/
ls -la ~/Documents/journal/.claude/scripts/
# Verify scripts are executable:
ls -l ~/Documents/journal/.claude/scripts/ | grep "^-rwx"
# Verify CLAUDE.md exists:
cat ~/Documents/journal/.claude/CLAUDE.md | head -5
```

Expected: `.claude/CLAUDE.md` exists with journal rules; all 5 scripts exist and are executable (`-rwxr-xr-x`).

- [ ] **Step 4: Verify old `workspace/CLAUDE.md` is no longer created**

```bash
ls ~/Documents/journal/CLAUDE.md 2>/dev/null && echo "EXISTS (unexpected)" || echo "NOT FOUND (expected)"
```

Expected: `NOT FOUND (expected)`

- [ ] **Step 5: Final commit**

```bash
git add -A
git status  # confirm only expected files staged
git commit -m "chore: verify workspace .claude/ init end-to-end"
```
