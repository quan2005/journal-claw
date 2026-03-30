# Prompt Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化 `WORKSPACE_PROMPT` 常量和 per-call prompt 模板，使语感更自然、去除冗余表达。

**Architecture:** 两处修改均在 `src-tauri/src/ai_processor.rs`：替换 `WORKSPACE_PROMPT` 字符串常量，修改 `process_material` 函数中的 `prompt` format 模板。同步更新相关单元测试的断言。

**Tech Stack:** Rust, Tauri v2

---

### Task 1: 更新 per-call prompt 及其测试

**Files:**
- Modify: `src-tauri/src/ai_processor.rs:178-181`（prompt format 模板）
- Modify: `src-tauri/src/ai_processor.rs:480-489`（测试断言）

- [ ] **Step 1: 更新测试断言以匹配新 prompt**

在 `src-tauri/src/ai_processor.rs` 中找到 `prompt_contains_material_reference` 测试（约第480行），替换为：

```rust
#[test]
fn prompt_contains_material_reference() {
    let filename = "note.txt";
    let year_month = "2603";
    let prompt = format!(
        "深入梳理 @{}/raw/{}，整理为日志条目并直接写文件，不要输出任何解释。\n文件名格式：DD-标题.md，写在 {}/ 目录下（不要写到 raw/ 里）。",
        year_month, filename, year_month
    );
    assert!(prompt.contains("@2603/raw/note.txt"));
    assert!(prompt.contains("深入梳理"));
    assert!(prompt.contains("DD-标题.md"));
    assert!(prompt.contains("2603/"));
}
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd src-tauri && cargo test prompt_contains_material_reference -- --nocapture
```

Expected: FAIL，因为实现还未改

- [ ] **Step 3: 更新 process_material 中的 prompt 模板**

在 `src-tauri/src/ai_processor.rs` 中找到第178-181行，替换：

```rust
let prompt = format!(
    "深入梳理 @{}，整理为日志条目并直接写文件，不要输出任何解释。\n文件名格式：DD-标题.md，写在 {}/ 目录下（不要写到 raw/ 里）。",
    relative_ref, year_month
);
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd src-tauri && cargo test prompt_contains_material_reference -- --nocapture
```

Expected: PASS

- [ ] **Step 5: 运行全部测试确认无回归**

```bash
cd src-tauri && cargo test
```

Expected: 全部 PASS

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/ai_processor.rs
git commit -m "feat(ai): optimize per-call prompt — 深入梳理，去冗余"
```

---

### Task 2: 更新 WORKSPACE_PROMPT 常量及其测试

**Files:**
- Modify: `src-tauri/src/ai_processor.rs:36-69`（WORKSPACE_PROMPT 常量）
- Modify: `src-tauri/src/ai_processor.rs:501-504`（ensure_workspace_prompt 测试断言）

- [ ] **Step 1: 运行现有 workspace prompt 测试，确认当前状态**

```bash
cd src-tauri && cargo test ensure_workspace_prompt_creates_file -- --nocapture
```

Expected: PASS（确认测试目前是绿的）

- [ ] **Step 2: 替换 WORKSPACE_PROMPT 常量**

在 `src-tauri/src/ai_processor.rs` 中，将第36-69行的 `WORKSPACE_PROMPT` 常量替换为：

```rust
const WORKSPACE_PROMPT: &str = r#"# 谨迹

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
"#;
```

注意：`WORKSPACE_PROMPT` 内部的 ` ```markdown ` 代码块需要用 `\`\`\`` 转义，或改用其他 raw string 边界（如 `r##"..."##`）避免冲突。实际写法：

```rust
const WORKSPACE_PROMPT: &str = r##"# 谨迹

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
"##;
```

- [ ] **Step 3: 运行测试确认断言仍然覆盖**

```bash
cd src-tauri && cargo test ensure_workspace_prompt_creates_file -- --nocapture
```

Expected: PASS（新内容仍包含 `tags`、`summary`、`DD-标题.md`）

- [ ] **Step 4: 运行全部测试确认无回归**

```bash
cd src-tauri && cargo test
```

Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/ai_processor.rs
git commit -m "feat(ai): rewrite WORKSPACE_PROMPT — 谨迹角色，叙事化语感"
```
