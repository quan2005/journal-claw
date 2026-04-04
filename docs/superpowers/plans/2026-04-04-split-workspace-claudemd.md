# Split Workspace CLAUDE.md Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate workspace CLAUDE.md into an immutable system prompt (`.claude/CLAUDE.md`) and a user-editable prompt (`workspace/CLAUDE.md`).

**Architecture:** Dual-file model leveraging Claude CLI's automatic reading of both `CLAUDE.md` (project root) and `.claude/CLAUDE.md`. The system template stays in `.claude/CLAUDE.md` with forced overwrites; a new user-facing default template is extracted into `workspace/CLAUDE.md`, created only when missing. All Tauri commands (`get/set/reset_workspace_prompt`) switch from `.claude/CLAUDE.md` to `workspace/CLAUDE.md`.

**Tech Stack:** Rust (Tauri commands, `include_str!`), Markdown templates.

---

### Task 1: Extract user-facing default template

**Files:**
- Create: `src-tauri/resources/workspace-template/CLAUDE.md`

Extract the personalized content from the existing `.claude/CLAUDE.md` into a new user-facing template. This content will serve as the initial `workspace/CLAUDE.md` for new workspaces.

- [ ] **Step 1: Create the user-facing default template**

Create `src-tauri/resources/workspace-template/CLAUDE.md` with the following content (extracted from the current template's personality/style sections):

```markdown
你是用户的私人秘书。你的使命是帮用户把碎片化的素材——录音转写、文档、粘贴的文字——整理成秘书稿：结构清晰、措辞精炼、可直接回溯。

你要像一个称职的秘书一样，听懂意思，理清逻辑，用详实的书面语重新组织。遇到信息模糊或前后矛盾的地方，显式标注「⚠️ 待确认」——不要替用户猜测或补全。

## 行为准则

- 直接操作文件，不输出解释性文字
- 同一天同主题的素材合并到已有条目，不重复新建
- 不要修改 `raw/` 目录中的原始素材
- summary 要有信息量，不要写「讨论了若干议题」这种空话
- 遇到无法理解的素材，仍然尽力整理，在 summary 中标注「素材质量较低」

## 正文结构

根据素材类型灵活组织，但遵循这些原则：

- 结论先行，细节在后
- 用标题分层，保持可扫读性
- 待办事项明确标注负责人和截止时间
- 保留关键数据和引用，不要过度概括丢失信息
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/resources/workspace-template/CLAUDE.md
git commit -m "feat: add user-facing default CLAUDE.md template"
```

---

### Task 2: Trim system CLAUDE.md to system-only instructions

**Files:**
- Modify: `src-tauri/resources/workspace-template/.claude/CLAUDE.md`

Remove the personalized content (role definition paragraph, `## 行为准则`, body structure under `## 输出规范`) that was extracted to the user template in Task 1. Keep only system-level instructions.

- [ ] **Step 1: Edit `.claude/CLAUDE.md` — remove extracted sections**

Remove:
1. **Lines 1-3** (role definition: "你是用户的私人秘书..." and "你要像一个称职的秘书一样...")
2. **Lines 99-106** (正文结构 section under `## 输出规范`)
3. **Lines 117-123** (行为准则 section — "直接操作文件" through "素材质量较低")

The remaining content starts directly with `## 你所在的系统` and covers: system directory, identity system, core behavior, output spec (frontmatter format, file naming), reading materials, and todo extraction.

- [ ] **Step 2: Commit**

```bash
git add src-tauri/resources/workspace-template/.claude/CLAUDE.md
git commit -m "refactor: trim system CLAUDE.md to system-only instructions"
```

---

### Task 3: Add Rust constant and modify `ensure_workspace_dot_claude`

**Files:**
- Modify: `src-tauri/src/ai_processor.rs` (lines ~78-88 for constants, lines ~89-119 for function)

- [ ] **Step 1: Add new `include_str!` constant**

At `src-tauri/src/ai_processor.rs:88` (after the existing `SCRIPT_IDENTITY_CREATE` constant), add:

```rust
const WORKSPACE_USER_CLAUDE_MD: &str =
    include_str!("../resources/workspace-template/CLAUDE.md");
```

- [ ] **Step 2: Add user CLAUDE.md creation to `ensure_workspace_dot_claude`**

At the end of `ensure_workspace_dot_claude()` (after the script writing loop, around line 119), add:

```rust
    // Ensure workspace/CLAUDE.md exists (only create if missing — never overwrite user edits)
    let user_claude_md = std::path::PathBuf::from(workspace_path).join("CLAUDE.md");
    if !user_claude_md.exists() {
        let _ = std::fs::write(&user_claude_md, WORKSPACE_USER_CLAUDE_MD);
    }
```

- [ ] **Step 3: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: compiles with no errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/ai_processor.rs
git commit -m "feat: create user CLAUDE.md on workspace init"
```

---

### Task 4: Switch Tauri commands to user CLAUDE.md path

**Files:**
- Modify: `src-tauri/src/ai_processor.rs` (lines ~855-885)

- [ ] **Step 1: Modify `get_workspace_prompt`**

Change path from `.claude/CLAUDE.md` to workspace-root `CLAUDE.md`, and update the fallback constant:

```rust
#[tauri::command]
pub fn get_workspace_prompt(app: AppHandle) -> Result<String, String> {
    let cfg = config::load_config(&app)?;
    let path = std::path::PathBuf::from(&cfg.workspace_path).join("CLAUDE.md");
    if path.exists() {
        std::fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok(WORKSPACE_USER_CLAUDE_MD.to_string())
    }
}
```

- [ ] **Step 2: Modify `set_workspace_prompt`**

Change path from `.claude/CLAUDE.md` to workspace-root `CLAUDE.md`:

```rust
#[tauri::command]
pub fn set_workspace_prompt(app: AppHandle, content: String) -> Result<(), String> {
    let cfg = config::load_config(&app)?;
    let path = std::path::PathBuf::from(&cfg.workspace_path).join("CLAUDE.md");
    std::fs::write(&path, content).map_err(|e| e.to_string())
}
```

- [ ] **Step 3: Modify `reset_workspace_prompt`**

Change to write the user template instead of system template, and write to workspace root:

```rust
#[tauri::command]
pub fn reset_workspace_prompt(app: AppHandle) -> Result<String, String> {
    let cfg = config::load_config(&app)?;
    let path = std::path::PathBuf::from(&cfg.workspace_path).join("CLAUDE.md");
    std::fs::write(&path, WORKSPACE_USER_CLAUDE_MD).map_err(|e| e.to_string())?;
    Ok(WORKSPACE_USER_CLAUDE_MD.to_string())
}
```

- [ ] **Step 4: Verify Rust compiles**

Run: `cd src-tauri && cargo check`
Expected: compiles with no errors.

- [ ] **Step 5: Run existing frontend tests**

Run: `npm test`
Expected: all tests pass (SoulView tests mock `getWorkspacePrompt`/`setWorkspacePrompt`, so they are unaffected by the path change).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/ai_processor.rs
git commit -m "feat: switch workspace prompt Tauri commands to user CLAUDE.md"
```

---

### Task 5: Manual verification

- [ ] **Step 1: Build and run the app**

Run: `npm run tauri dev`

- [ ] **Step 2: Verify workspace initialization**

Check that:
1. `workspace/.claude/CLAUDE.md` contains only system instructions (no role definition, no 行为准则)
2. `workspace/CLAUDE.md` contains the user-facing default template
3. Both files exist

- [ ] **Step 3: Verify SoulView reads user CLAUDE.md**

Open the SoulView editor in the app. Confirm it shows the user-facing default template content (not the system instructions).

- [ ] **Step 4: Verify editing persists**

Edit the content in SoulView, click save, restart the app, reopen SoulView. Confirm the edit is preserved.

- [ ] **Step 5: Verify reset works**

Click the reset button (if available via IdentityDetail). Confirm `workspace/CLAUDE.md` is restored to the default user template.

- [ ] **Step 6: Verify AI processing uses both files**

Process a recording/file. Confirm Claude CLI receives both `.claude/CLAUDE.md` (system) and `CLAUDE.md` (user) — the generated journal entry should reflect both system rules and user style preferences.

---

## Self-Review

**Spec coverage:**
- Dual-file model: Task 1 (user template), Task 2 (system template trim), Task 3 (init logic), Task 4 (command paths) — covered
- Rust changes to 5 functions: Task 3 (`ensure_workspace_dot_claude`), Task 4 (`get/set/reset_workspace_prompt`) — covered
- No frontend changes: confirmed, tests still pass — covered by Task 4 Step 5
- Reset behavior: Task 4 Step 3 uses `WORKSPACE_USER_CLAUDE_MD` — covered
- Upgrade compatibility: `ensure_workspace_dot_claude` only creates `CLAUDE.md` if missing — covered by Task 3 Step 2

**Placeholder scan:** No TBD/TODO placeholders. All steps have complete code.

**Type consistency:** All functions use `WORKSPACE_USER_CLAUDE_MD` constant defined in Task 3. Path construction uses `PathBuf::from(&cfg.workspace_path).join("CLAUDE.md")` consistently.
