# Dream → Lint Rename + Capability Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the internal `dream` system to `lint` across all code layers, then enhance the lint skill with Karpathy's 6-item checklist (fact contradiction detection, orphan profiles, concept extraction, relationship cross-references, web search gap-filling).

**Architecture:** Two sequential phases — Phase 1 is a pure mechanical rename with zero behavior change; Phase 2 rewrites the SKILL.md content to add new lint dimensions to the existing 4-agent Phase 2 model. User-facing Chinese copy ("自动整理", "正在整理中") is never touched.

**Tech Stack:** Rust (Tauri v2), TypeScript/React, workspace SKILL.md (Claude CLI skill format)

---

## Phase 1 — Mechanical Rename (`dream` → `lint`)

### Task 1: Rename workspace template skill directory and SKILL.md frontmatter

**Files:**
- Rename: `src-tauri/resources/workspace-template/.claude/skills/dream/` → `src-tauri/resources/workspace-template/.claude/skills/lint/`
- Modify: `src-tauri/resources/workspace-template/.claude/skills/lint/SKILL.md` (frontmatter name only)

- [ ] **Step 1: Rename the directory**

```bash
cd /Users/yanwu/Projects/github/journal
mv src-tauri/resources/workspace-template/.claude/skills/dream \
   src-tauri/resources/workspace-template/.claude/skills/lint
```

- [ ] **Step 2: Update skill name in frontmatter**

In `src-tauri/resources/workspace-template/.claude/skills/lint/SKILL.md`, change only the `name:` line:

```
## name: lint
```

(was `## name: dream`)

- [ ] **Step 3: Verify**

```bash
head -3 src-tauri/resources/workspace-template/.claude/skills/lint/SKILL.md
```

Expected: first line is `---`, second is empty or `## name: lint`.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/resources/workspace-template/.claude/skills/
git commit -m "refactor(lint): rename workspace template skill dir dream → lint"
```

---

### Task 2: Rename Rust module file and update `main.rs`

**Files:**
- Rename: `src-tauri/src/auto_dream.rs` → `src-tauri/src/auto_lint.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Rename the file**

```bash
mv src-tauri/src/auto_dream.rs src-tauri/src/auto_lint.rs
```

- [ ] **Step 2: Update `main.rs` module declaration and all references**

In `src-tauri/src/main.rs`:

Change line 5:
```rust
mod auto_lint;
```
(was `mod auto_dream;`)

Change lines ~148-149:
```rust
.manage(auto_lint::AutoLintNotify(std::sync::Arc::new(tokio::sync::Notify::new())))
.manage(auto_lint::LintRunning(std::sync::Mutex::new(false)))
```

Change lines ~166-167:
```rust
auto_lint::check_missed_run(app.handle());
auto_lint::start_scheduler(app.handle().clone());
```

Change lines ~376-379 in `invoke_handler![]`:
```rust
auto_lint::get_auto_lint_status,
auto_lint::trigger_lint_now,
```

- [ ] **Step 3: Verify compile**

```bash
cd src-tauri && cargo check 2>&1 | head -30
```

Expected: errors only about undefined symbols in `auto_lint.rs` (not yet renamed inside the file). If `main.rs` errors appear, fix them first.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/main.rs src-tauri/src/auto_lint.rs src-tauri/src/auto_dream.rs
git commit -m "refactor(lint): rename auto_dream module to auto_lint in main.rs"
```

---

### Task 3: Rename symbols inside `auto_lint.rs`

**Files:**
- Modify: `src-tauri/src/auto_lint.rs`

- [ ] **Step 1: Rename all public types and functions**

Apply these renames throughout the file (use find-replace, all occurrences):

| Old | New |
|---|---|
| `AutoDreamStatus` | `AutoLintStatus` |
| `AutoDreamNotify` | `AutoLintNotify` |
| `DreamRunning` | `LintRunning` |
| `run_dream` | `run_lint` |
| `trigger_dream_now` | `trigger_lint_now` |
| `get_auto_dream_status` | `get_auto_lint_status` |
| `[auto_dream]` (log prefix) | `[auto_lint]` |
| `"auto-dream-status"` (Tauri event name) | `"auto-lint-status"` |
| `last-dream.json` (file name) | `last-lint.json` |

- [ ] **Step 2: Add backward-compat alias for `last-dream.json`**

In the `read_last_lint` function (was `read_last_dream`), after the primary path fails, fall back to the old filename:

```rust
fn read_last_lint(workspace: &str) -> Option<LastLint> {
    // Try new filename first
    let path = last_lint_path(workspace);
    if let Ok(data) = std::fs::read_to_string(&path) {
        if let Ok(ld) = serde_json::from_str(&data) {
            return Some(ld);
        }
    }
    // Fall back to old filename for existing users
    let old_path = std::path::PathBuf::from(workspace)
        .join(".claude")
        .join("last-dream.json");
    let data = std::fs::read_to_string(old_path).ok()?;
    serde_json::from_str(&data).ok()
}
```

- [ ] **Step 3: Verify compile**

```bash
cd src-tauri && cargo check 2>&1 | head -30
```

Expected: no errors in `auto_lint.rs` or `main.rs`.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/auto_lint.rs
git commit -m "refactor(lint): rename all symbols inside auto_lint.rs"
```

---

### Task 4: Update `workspace_settings.rs`

**Files:**
- Modify: `src-tauri/src/workspace_settings.rs`

- [ ] **Step 1: Rename struct and field**

| Old | New |
|---|---|
| `AutoDreamConfig` | `AutoLintConfig` |
| `auto_dream: AutoDreamConfig` (field in `WorkspaceSettings`) | `auto_lint: AutoLintConfig` |
| `auto_dream: AutoDreamConfig::default()` (in `Default` impl) | `auto_lint: AutoLintConfig::default()` |

- [ ] **Step 2: Add serde alias for backward compatibility**

On the `auto_lint` field in `WorkspaceSettings`:

```rust
#[derive(Debug, Serialize, Deserialize)]
struct WorkspaceSettings {
    #[serde(default = "default_theme")]
    theme: String,
    #[serde(default, alias = "auto_dream")]
    auto_lint: AutoLintConfig,
}
```

This ensures existing `.setting.json` files with `"auto_dream"` key still load correctly.

- [ ] **Step 3: Rename all functions**

| Old | New |
|---|---|
| `get_auto_dream_config` | `get_auto_lint_config` |
| `set_auto_dream_config` | `set_auto_lint_config` |
| `get_workspace_path_for_auto_dream` | `get_workspace_path_for_auto_lint` |
| `load_auto_dream_config` | `load_auto_lint_config` |

- [ ] **Step 4: Update callers in `auto_lint.rs`**

In `auto_lint.rs`, update all calls:
- `workspace_settings::load_auto_dream_config` → `workspace_settings::load_auto_lint_config`
- `workspace_settings::get_workspace_path_for_auto_dream` → `workspace_settings::get_workspace_path_for_auto_lint`

- [ ] **Step 5: Update `main.rs` invoke_handler**

```rust
workspace_settings::get_auto_lint_config,
workspace_settings::set_auto_lint_config,
```

- [ ] **Step 6: Verify compile**

```bash
cd src-tauri && cargo check 2>&1 | head -30
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/workspace_settings.rs src-tauri/src/auto_lint.rs src-tauri/src/main.rs
git commit -m "refactor(lint): rename AutoDreamConfig → AutoLintConfig in workspace_settings"
```

---

### Task 5: Update `ai_processor.rs` skill deployment

**Files:**
- Modify: `src-tauri/src/ai_processor.rs`

- [ ] **Step 1: Update include_str constant**

```rust
const SKILL_LINT_MD: &str =
    include_str!("../resources/workspace-template/.claude/skills/lint/SKILL.md");
```

(was `SKILL_DREAM_MD` pointing to `skills/dream/SKILL.md`)

- [ ] **Step 2: Update skill directory deployment in `ensure_workspace_dot_claude`**

```rust
// ── Lint skill template ────────────────────────
let lint_dir = dot_claude.join("skills").join("lint");
if let Err(e) = std::fs::create_dir_all(&lint_dir) {
    eprintln!("[ai_processor] warn: failed to create skills/lint dir: {}", e);
} else {
    let _ = std::fs::write(lint_dir.join("SKILL.md"), SKILL_LINT_MD);
}

// Remove old dream dir if it exists (cleanup for existing users)
let old_dream_dir = dot_claude.join("skills").join("dream");
if old_dream_dir.exists() {
    let _ = std::fs::remove_dir_all(&old_dream_dir);
}
```

- [ ] **Step 3: Update the slash command prompt string**

In `build_claude_args_with_creds` call inside `auto_lint.rs`:

```rust
let (args, extra_envs) = build_claude_args_with_creds(
    "auto-lint",
    "",
    None,
    Some("/lint"),
    &cfg.claude_code_model,
    &cfg.claude_code_api_key,
    &cfg.claude_code_base_url,
);
```

- [ ] **Step 4: Verify compile**

```bash
cd src-tauri && cargo build 2>&1 | tail -20
```

Expected: successful build.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/ai_processor.rs src-tauri/src/auto_lint.rs
git commit -m "refactor(lint): update ai_processor to deploy skills/lint and invoke /lint"
```

---

### Task 6: Update frontend TypeScript

**Files:**
- Modify: `src/lib/tauri.ts`
- Modify: `src/locales/en.ts`
- Modify: `src/locales/zh.ts`
- Modify: `src/settings/components/SectionAutomation.tsx`

- [ ] **Step 1: Update `src/lib/tauri.ts`**

Rename interfaces and functions (user-facing labels in comments are fine to keep):

```typescript
// Auto lint (自动整理)
export interface AutoLintConfig {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  time: '03:00' | '12:00' | '22:00'
  min_entries: 10 | 20 | 30
}

export interface AutoLintStatus {
  state: 'idle' | 'running' | 'never_run' | 'error'
  last_run: string | null
  last_run_entries: number | null
  next_check: string | null
  current_new_entries: number
  error: string | null
}

export const getAutoLintConfig = (): Promise<AutoLintConfig> =>
  invoke<AutoLintConfig>('get_auto_lint_config')

export const setAutoLintConfig = (config: AutoLintConfig): Promise<void> =>
  invoke<void>('set_auto_lint_config', { config })

export const getAutoLintStatus = (): Promise<AutoLintStatus> =>
  invoke<AutoLintStatus>('get_auto_lint_status')

export const triggerLintNow = (): Promise<void> =>
  invoke<void>('trigger_lint_now')
```

- [ ] **Step 2: Update locale keys in `src/locales/en.ts`**

```typescript
lintRunning: 'Running…',
lintFailed: 'Last run failed',
```

(remove `dreamRunning` and `dreamFailed`)

- [ ] **Step 3: Update locale keys in `src/locales/zh.ts`**

```typescript
lintRunning: '正在整理中…',
lintFailed: '上次整理失败',
```

(remove `dreamRunning` and `dreamFailed`)

- [ ] **Step 4: Update `SectionAutomation.tsx`**

Update imports:
```typescript
import { getAutoLintConfig, setAutoLintConfig, getAutoLintStatus, triggerLintNow } from '../../lib/tauri'
import type { AutoLintConfig, AutoLintStatus } from '../../lib/tauri'
```

Update event listener:
```typescript
const unlisten = listen<AutoLintStatus>('auto-lint-status', (event) => {
  setStatus(event.payload)
})
```

Update state type and initial value:
```typescript
const [config, setConfig] = useState<AutoLintConfig>({ ... })
const [status, setStatus] = useState<AutoLintStatus | null>(null)
```

Update all function calls: `getAutoDreamConfig` → `getAutoLintConfig`, etc.

Update locale key references:
```typescript
// Replace t('dreamRunning') → t('lintRunning')
// Replace t('dreamFailed') → t('lintFailed')
```

- [ ] **Step 5: Verify TypeScript build**

```bash
cd /Users/yanwu/Projects/github/journal && npm run build 2>&1 | tail -20
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tauri.ts src/locales/en.ts src/locales/zh.ts src/settings/components/SectionAutomation.tsx
git commit -m "refactor(lint): rename dream → lint in frontend IPC, locales, and SectionAutomation"
```

---

### Task 7: Phase 1 smoke test

- [ ] **Step 1: Run full build**

```bash
cd /Users/yanwu/Projects/github/journal && npm run build
cd src-tauri && cargo build
```

Both must succeed.

- [ ] **Step 2: Verify no remaining `dream` references in code (excluding git history and this plan)**

```bash
rg -l "dream" \
  src-tauri/src/ \
  src/lib/tauri.ts \
  src/locales/ \
  src/settings/ \
  src-tauri/resources/workspace-template/.claude/skills/ \
  --glob '!*.md'
```

Expected: no matches (or only in comments that are intentionally kept).

- [ ] **Step 3: Commit phase 1 completion tag**

```bash
git tag phase1-lint-rename
```

---

## Phase 2 — Enhance SKILL.md with Karpathy Lint Checks

### Task 8: Rewrite SKILL.md — add 2 new Phase 2 agents and web search

**Files:**
- Modify: `src-tauri/resources/workspace-template/.claude/skills/lint/SKILL.md`

This is the core content change. The existing 4-agent Phase 2 model is extended to 6 agents. Two new agents are added:

- **Agent 5: 事实矛盾检测** — scans for factual contradictions between entries
- **Agent 6: 概念提取 + 信息空白填补** — finds high-frequency concepts without dedicated entries, and uses web search to fill information gaps

The existing agents are also enhanced:

- **Agent 2** gets a new sub-task: detect orphan identity profiles (profiles not referenced by any entry in the scan window)
- **Agent 2** gets a new sub-task: detect missing relationship cross-references between profiles (e.g. Alice and Bob both appear in the same meeting but neither profile links to the other)

- [ ] **Step 1: Update the skill `name` and `description` frontmatter**

```markdown
---

## name: lint

description: 日志库自动 lint — 扫描日志条目和人物档案，检测事实矛盾、修复交叉引用、标注决策演进、提取高频概念、通过网络搜索填补信息空白。当用户输入 /lint 或提到「整理日志库」「整理一下」时触发。
```

- [ ] **Step 2: Update Phase 2 — add Agent 5 (事实矛盾检测)**

After the existing Agent 4 block, add:

````markdown
### Agent 5：事实矛盾检测

```
扫描范围内的日志条目正文和 identity/ 档案。
找出：
- 同一事实在不同条目中有矛盾描述（如：A 条目说某产品定价 99 元，B 条目说 199 元）
- 同一人物在不同条目中有矛盾的角色/职位描述
- 同一决策在不同条目中有矛盾的结论（区别于「演进」——演进是有时间顺序的更新，矛盾是同时期的不一致）
输出：矛盾清单，每条标注文件 A、文件 B、矛盾内容、置信度。低置信度（无法确定是矛盾还是演进）一律标为低置信度跳过。
```
````

- [ ] **Step 3: Update Phase 2 — add Agent 6 (概念提取 + 信息空白填补)**

After Agent 5, add:

````markdown
### Agent 6：概念提取 + 信息空白填补

```
扫描范围内的日志条目正文。
任务一：概念提取
找出：
- 在 3 篇以上条目中被提及、但在 identity/ 目录中没有对应档案的重要概念/术语/产品名
- 判断标准：该概念有独立的背景知识（定义、版本、关键属性），记住它能帮助理解未来的日志
- 排除：通用词汇、人名（由 Agent 2 处理）、已有档案的实体
输出：概念清单，每条标注概念名、出现次数、代表性条目路径、建议档案文件名（格式：concept-{name}.md）

任务二：信息空白填补（需要联网）
对概念清单中置信度高的条目，使用 WebSearch 工具搜索补充背景信息：
- 搜索该概念的官方定义、当前版本、核心特性
- 每个概念最多搜索 2 次，避免过度消耗
- 将搜索结果整合为简短的背景摘要（3-5 句话）
输出：每个概念的背景摘要，附搜索来源 URL
```
````

- [ ] **Step 4: Update Agent 2 to detect orphan profiles and missing relationship links**

In the existing Agent 2 block, add two new detection tasks:

````markdown
### Agent 2：人物变化（增强版）

```
扫描范围内的日志条目，交叉对比 identity/ 目录。
找出：
- 条目中出现但没有 Identity 档案的人物（仅限有实质性互动的）
- 条目中描述的人物角色与档案不一致
- 档案内部存在矛盾（如同时写了两个不同的部门）
- 【新】孤立档案：identity/ 中存在、但在扫描范围内的任何条目中均未被提及的人物档案（可能是过时档案）
- 【新】缺失关系交叉引用：两个人物在同一条目中共同出现（同一会议、同一项目），但两人的档案中均未互相提及对方
输出：变更清单，每条标注档案路径、问题类型、建议修正、置信度
孤立档案只标注，不删除。缺失关系引用只在置信度高时（同一会议明确互动）才建议补充。
```
````

- [ ] **Step 5: Update Phase 3 to handle new signal types**

In Phase 3, add handling for the new signal types after existing 3.3:

````markdown
### 3.5 创建概念档案（低优先级）

对 Agent 6 输出的概念清单中置信度高的条目，使用 identity-create 脚本创建概念档案：

```bash
.claude/scripts/identity-create "concept" "{concept-name}" --summary "{Agent 6 生成的背景摘要}"
```

创建后立即编辑档案，补充：
- `type: concept` 字段（在 frontmatter 中）
- 背景摘要（来自 Agent 6 的搜索结果）
- 首次出现的条目链接

建档门槛：出现 3 次以上 + 有独立背景知识价值。不满足则跳过。

### 3.6 标注孤立档案（低优先级）

对 Agent 2 发现的孤立档案，在档案文件的「关联记录」区追加：

```markdown
- ⚠️ 此档案在近期日志中未被提及，可能已过时，建议人工确认是否仍需保留
```

不删除档案，只标注。

### 3.7 补充人物关系交叉引用（低优先级）

对 Agent 2 发现的缺失关系引用，在相关档案的「关联记录」区追加对方的链接：

```markdown
- [对方姓名](../identity/region-name.md) — 共同参与了 [条目标题](路径)
```
````

- [ ] **Step 6: Update Phase 4 摘要条目 to include new lint dimensions**

In Phase 4.1, update the summary entry template to include new counts:

````markdown
正文包含：
- 扫描范围（时间段、条目数）
- 各类型发现数量（含：矛盾 N 处、孤立档案 N 个、新概念 N 个、关系引用 N 处）
- 实际执行的修改清单（文件路径 + 修改内容）
- 跳过的低置信度信号（供人工复核）
- 网络搜索来源列表（如有）
````

- [ ] **Step 7: Update `last-lint.json` write command in Phase 4.2**

```bash
cat > "$WORKSPACE/.claude/last-lint.json" <<EOF
{
  "last_run": "$(date -u +%Y-%m-%dT%H:%M:%S%z)",
  "entries_at_last_run": $TOTAL
}
EOF
```

- [ ] **Step 8: Verify SKILL.md is valid**

```bash
head -5 src-tauri/resources/workspace-template/.claude/skills/lint/SKILL.md
wc -l src-tauri/resources/workspace-template/.claude/skills/lint/SKILL.md
```

Expected: starts with `---`, file is non-empty.

- [ ] **Step 9: Rebuild to embed updated SKILL.md**

```bash
cd src-tauri && cargo build 2>&1 | tail -5
```

Expected: clean build (the `include_str!` macro will pick up the updated file).

- [ ] **Step 10: Commit**

```bash
git add src-tauri/resources/workspace-template/.claude/skills/lint/SKILL.md
git commit -m "feat(lint): enhance lint skill with Karpathy checks — contradiction detection, orphan profiles, concept extraction, web search gap-filling"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| dream → lint rename (code/internal) | Tasks 1–6 |
| User-facing copy unchanged | Task 6 (locale keys renamed but values kept in Chinese) |
| Backward compat for `.setting.json` `auto_dream` key | Task 4 Step 2 |
| Backward compat for `last-dream.json` | Task 3 Step 2 |
| Old `skills/dream/` dir cleanup on existing workspaces | Task 5 Step 2 |
| Fact contradiction detection | Task 8 Step 2 |
| Orphan identity profile detection | Task 8 Step 4 |
| Missing relationship cross-references | Task 8 Step 4 |
| High-frequency concept extraction | Task 8 Step 3 |
| Web search gap-filling (real network calls) | Task 8 Step 3 |
| Concept auto-creation in identity/ | Task 8 Step 5 |
| Slash command `/lint` | Task 5 Step 3 |

**Placeholder scan:** No TBDs found.

**Type consistency:** `AutoLintConfig`, `AutoLintStatus`, `AutoLintNotify`, `LintRunning` used consistently across Tasks 2–6. `get_auto_lint_config` / `set_auto_lint_config` / `get_auto_lint_status` / `trigger_lint_now` used consistently in Rust and TypeScript.
