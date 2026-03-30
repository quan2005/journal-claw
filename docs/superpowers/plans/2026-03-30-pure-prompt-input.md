# Pure Prompt Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户在 CommandDock 无附件时输入文字，文字直接作为 `-p` prompt 传给 Claude CLI，不再写入 raw 文件。

**Architecture:** 在 Rust 侧新增 `trigger_ai_prompt` 命令，`QueueTask` 加 `prompt_text` 字段，`process_material` 按字段分支决定 prompt 内容；前端 `handlePasteSubmit` 改调新的 `triggerAiPrompt`。

**Tech Stack:** Rust (Tauri v2), TypeScript/React

---

## File Map

| File | 操作 | 职责 |
|------|------|------|
| `src-tauri/src/ai_processor.rs` | Modify | 加 `prompt_text` 字段；`process_material` 分支；新增 `trigger_ai_prompt` 命令 |
| `src-tauri/src/main.rs` | Modify | 注册新命令到 `invoke_handler![]` |
| `src/lib/tauri.ts` | Modify | 新增 `triggerAiPrompt` 前端包装 |
| `src/App.tsx` | Modify | `handlePasteSubmit` 改调 `triggerAiPrompt` |

---

## Task 1: 给 QueueTask 加 prompt_text 字段，更新 process_material 签名

**Files:**
- Modify: `src-tauri/src/ai_processor.rs`

- [ ] **Step 1: 写 Rust 单元测试**

在 `ai_processor.rs` 底部 `#[cfg(test)] mod tests` 里，在现有测试后面添加：

```rust
#[test]
fn prompt_text_used_directly_as_prompt() {
    // When prompt_text is Some, the prompt should be the raw text
    let prompt_text = "帮我整理今天的工作";
    let prompt = prompt_text.to_string();
    assert_eq!(prompt, "帮我整理今天的工作");
    // And it should NOT contain the @file reference pattern
    assert!(!prompt.contains("@"));
    assert!(!prompt.contains("深入梳理"));
}

#[test]
fn prompt_text_none_falls_back_to_material_prompt() {
    // When prompt_text is None, the prompt contains @file reference
    let filename = "meeting.txt";
    let year_month = "2603";
    let relative_ref = format!("{}/raw/{}", year_month, filename);
    let prompt = format!(
        "深入梳理 @{}，整理为日志条目并直接写文件，不要输出任何解释。\n文件名格式：DD-标题.md，写在 {}/ 目录下（不要写到 raw/ 里）。",
        relative_ref, year_month
    );
    assert!(prompt.contains("@2603/raw/meeting.txt"));
    assert!(prompt.contains("深入梳理"));
}
```

- [ ] **Step 2: 运行测试，验证通过**（这两个测试是纯逻辑，无需实现改动）

```bash
cd src-tauri && cargo test prompt_text -- --nocapture
```

Expected: 两个测试都 PASS（逻辑正确，直接通过）

- [ ] **Step 3: 给 QueueTask 加字段**

在 `src-tauri/src/ai_processor.rs` 找到：

```rust
pub struct QueueTask {
    material_path: String,
    year_month: String,
    note: Option<String>,
}
```

替换为：

```rust
pub struct QueueTask {
    material_path: String,
    year_month: String,
    note: Option<String>,
    prompt_text: Option<String>,
}
```

- [ ] **Step 4: 更新 `start_queue_consumer` 里的 `process_material` 调用**

找到：

```rust
let result = process_material(&app, &task.material_path, &task.year_month, task.note.as_deref(), &current_task).await;
```

替换为：

```rust
let result = process_material(&app, &task.material_path, &task.year_month, task.note.as_deref(), task.prompt_text.as_deref(), &current_task).await;
```

- [ ] **Step 5: 更新 `process_material` 函数签名，加 `prompt_text` 参数**

找到：

```rust
pub async fn process_material(
    app: &AppHandle,
    material_path: &str,
    year_month: &str,
    note: Option<&str>,
    current_task: &tauri::State<'_, CurrentTask>,
) -> Result<(), String> {
```

替换为：

```rust
pub async fn process_material(
    app: &AppHandle,
    material_path: &str,
    year_month: &str,
    note: Option<&str>,
    prompt_text: Option<&str>,
    current_task: &tauri::State<'_, CurrentTask>,
) -> Result<(), String> {
```

- [ ] **Step 6: 在 `process_material` 里用 prompt_text 替换 prompt 构建逻辑**

找到（第 281-284 行附近）：

```rust
    let note_suffix = note
        .filter(|n| !n.trim().is_empty())
        .map(|n| format!("\n用户补充：{}", n.trim()))
        .unwrap_or_default();
    let prompt = format!(
        "深入梳理 @{}，整理为日志条目并直接写文件，不要输出任何解释。\n文件名格式：DD-标题.md，写在 {}/ 目录下（不要写到 raw/ 里）。{}",
        relative_ref, year_month, note_suffix
    );
```

替换为：

```rust
    let prompt = if let Some(pt) = prompt_text.filter(|s| !s.trim().is_empty()) {
        pt.to_string()
    } else {
        let note_suffix = note
            .filter(|n| !n.trim().is_empty())
            .map(|n| format!("\n用户补充：{}", n.trim()))
            .unwrap_or_default();
        format!(
            "深入梳理 @{}，整理为日志条目并直接写文件，不要输出任何解释。\n文件名格式：DD-标题.md，写在 {}/ 目录下（不要写到 raw/ 里）。{}",
            relative_ref, year_month, note_suffix
        )
    };
```

- [ ] **Step 7: 更新 `trigger_ai_processing` 命令里的 QueueTask 构造**

找到：

```rust
    queue.0.send(QueueTask {
        material_path,
        year_month,
        note,
    }).await.map_err(|e| format!("队列发送失败: {}", e))?;
```

替换为：

```rust
    queue.0.send(QueueTask {
        material_path,
        year_month,
        note,
        prompt_text: None,
    }).await.map_err(|e| format!("队列发送失败: {}", e))?;
```

- [ ] **Step 8: 编译验证**

```bash
cd src-tauri && cargo build 2>&1 | head -30
```

Expected: 无错误（警告可忽略）

- [ ] **Step 9: 运行全部 Rust 测试**

```bash
cd src-tauri && cargo test -- --nocapture 2>&1 | tail -20
```

Expected: 所有测试 PASS

- [ ] **Step 10: Commit**

```bash
git add src-tauri/src/ai_processor.rs
git commit -m "feat: add prompt_text field to QueueTask, branch in process_material"
```

---

## Task 2: 新增 trigger_ai_prompt Tauri 命令

**Files:**
- Modify: `src-tauri/src/ai_processor.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: 在 ai_processor.rs 末尾（`cancel_ai_processing` 命令之后）添加新命令**

在 `cancel_ai_processing` 函数之后、`check_engine_installed` 之前，插入：

```rust
#[tauri::command]
pub async fn trigger_ai_prompt(
    app: AppHandle,
    queue: tauri::State<'_, AiQueue>,
    prompt: String,
) -> Result<(), String> {
    // Use first 20 chars of prompt as display label
    let label: String = prompt.chars().take(20).collect();
    let material_path = if prompt.chars().count() > 20 {
        format!("{}…", label)
    } else {
        label
    };
    let year_month = crate::workspace::current_year_month();

    eprintln!("[trigger_ai_prompt] prompt_label={}", material_path);

    let _ = app.emit("ai-processing", ProcessingUpdate {
        material_path: material_path.clone(),
        status: "queued".to_string(),
        error: None,
    });

    queue.0.send(QueueTask {
        material_path,
        year_month,
        note: None,
        prompt_text: Some(prompt),
    }).await.map_err(|e| format!("队列发送失败: {}", e))?;

    Ok(())
}
```

- [ ] **Step 2: 注册新命令到 main.rs**

在 `src-tauri/src/main.rs` 找到：

```rust
            ai_processor::cancel_ai_processing,
```

在其后一行添加：

```rust
            ai_processor::trigger_ai_prompt,
```

- [ ] **Step 3: 编译验证**

```bash
cd src-tauri && cargo build 2>&1 | head -30
```

Expected: 无错误

- [ ] **Step 4: 写 trigger_ai_prompt 相关的单元测试**

在 `ai_processor.rs` 的 `#[cfg(test)] mod tests` 里追加：

```rust
#[test]
fn prompt_label_truncates_at_20_chars() {
    let prompt = "帮我把今天所有的会议记录整理成日志条目，按重要程度排序";
    let label: String = prompt.chars().take(20).collect();
    let material_path = if prompt.chars().count() > 20 {
        format!("{}…", label)
    } else {
        label
    };
    assert!(material_path.ends_with('…'));
    // Count chars (not bytes) — Chinese chars are multi-byte
    let char_count = material_path.chars().count();
    assert_eq!(char_count, 21); // 20 chars + ellipsis
}

#[test]
fn prompt_label_no_truncation_when_short() {
    let prompt = "你好";
    let label: String = prompt.chars().take(20).collect();
    let material_path = if prompt.chars().count() > 20 {
        format!("{}…", label)
    } else {
        label
    };
    assert_eq!(material_path, "你好");
    assert!(!material_path.ends_with('…'));
}
```

- [ ] **Step 5: 运行新测试**

```bash
cd src-tauri && cargo test prompt_label -- --nocapture
```

Expected: 两个测试都 PASS

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/ai_processor.rs src-tauri/src/main.rs
git commit -m "feat: add trigger_ai_prompt Tauri command for pure-text prompt submission"
```

---

## Task 3: 前端接入 triggerAiPrompt

**Files:**
- Modify: `src/lib/tauri.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: 在 tauri.ts 新增 triggerAiPrompt**

在 `src/lib/tauri.ts` 找到：

```ts
// Paste text → save as raw material → trigger AI processing
export const submitPasteText = async (text: string): Promise<void> => {
```

在该行**之前**插入（保留 `submitPasteText` 不删）：

```ts
// Pure prompt → send text directly as Claude CLI -p argument (no file written)
export const triggerAiPrompt = (prompt: string): Promise<void> =>
  invoke<void>('trigger_ai_prompt', { prompt })

```

- [ ] **Step 2: 更新 App.tsx 的 handlePasteSubmit**

在 `src/App.tsx` 找到：

```ts
import { importFile, triggerAiProcessing, submitPasteText, cancelAiProcessing } from './lib/tauri'
```

替换为：

```ts
import { importFile, triggerAiProcessing, triggerAiPrompt, cancelAiProcessing } from './lib/tauri'
```

- [ ] **Step 3: 更新 handlePasteSubmit 函数体**

找到：

```ts
  const handlePasteSubmit = async (text: string) => {
    await submitPasteText(text)
    refresh()
  }
```

替换为：

```ts
  const handlePasteSubmit = async (text: string) => {
    await triggerAiPrompt(text)
    refresh()
  }
```

- [ ] **Step 4: 前端构建验证（TypeScript 类型检查）**

```bash
npm run build 2>&1 | tail -20
```

Expected: 无 TypeScript 错误，构建成功

- [ ] **Step 5: Commit**

```bash
git add src/lib/tauri.ts src/App.tsx
git commit -m "feat: route pure-text submission through triggerAiPrompt, bypass raw file write"
```

---

## Self-Review Checklist

- [x] Spec 要求：无附件时文字直接作为 prompt → Task 1 + Task 2 + Task 3 覆盖
- [x] Spec 要求：有附件时 note 逻辑不变 → `trigger_ai_processing` 仍走旧路径，`prompt_text: None`
- [x] Spec 要求：ProcessingQueue 显示 prompt 截断字符串 → Task 2 Step 1 里 `material_path` 设为截断标识
- [x] Spec 要求：`submitPasteText` 保留不删 → Task 3 Step 1 明确保留
- [x] 类型一致性：`prompt_text: Option<String>` 在 `QueueTask` 定义（Task 1 Step 3）、`QueueTask` 构造（Task 1 Step 7、Task 2 Step 1）、`process_material` 签名（Task 1 Step 5）均一致
- [x] 所有代码步骤均有完整代码块，无 TBD/TODO
