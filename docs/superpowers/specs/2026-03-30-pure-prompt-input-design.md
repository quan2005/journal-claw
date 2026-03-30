# 纯文本 Prompt 输入设计

**日期**：2026-03-30
**状态**：已批准

---

## 背景

当前用户在 CommandDock 输入框输入纯文本（无附件）并提交时，文字会经过 `import_text` 写成 `raw/paste-*.txt` 文件，再触发 AI 以"整理素材"的方式处理。这导致：

- 短指令（"帮我总结今天的工作"）被当成素材文件处理，语义错误
- raw 目录积累无意义的临时文件

**期望行为**：无附件时，输入的文字直接作为 `-p` prompt 传给 Claude CLI，不写入任何文件。有附件时，输入文字保持现有"备注/note"角色，追加在素材处理 prompt 末尾。

---

## 架构

### Rust 侧（`src-tauri/src/ai_processor.rs`）

#### `QueueTask` 新增字段

```rust
pub struct QueueTask {
    material_path: String,
    year_month: String,
    note: Option<String>,
    prompt_text: Option<String>,   // 新增：纯 prompt 模式
}
```

#### `process_material` 分支逻辑

函数签名新增参数 `prompt_text: Option<&str>`：

- `prompt_text` 有值 → 直接用该字符串作为 `-p` 参数，跳过 `@file` 引用和目录写入逻辑
- `prompt_text` 为 None → 沿用现有 `"深入梳理 @{file}..."` 逻辑

#### 新增 Tauri 命令

```rust
#[tauri::command]
pub async fn trigger_ai_prompt(
    app: AppHandle,
    queue: tauri::State<'_, AiQueue>,
    prompt: String,
) -> Result<(), String>
```

- `material_path`：取 prompt 前 20 字 + `"…"` 作为展示标识（供 ProcessingQueue 显示）
- `year_month`：调用 `ws::current_year_month()`
- emit `"queued"` 后入队，`prompt_text` 设为 `Some(prompt)`

注册到 `main.rs` 的 `invoke_handler![]`。

---

### 前端侧

#### `src/lib/tauri.ts`

新增：

```ts
export const triggerAiPrompt = (prompt: string): Promise<void> =>
  invoke<void>('trigger_ai_prompt', { prompt })
```

#### `src/App.tsx`

```ts
const handlePasteSubmit = async (text: string) => {
  await triggerAiPrompt(text)
  refresh()
}
```

`submitPasteText` 函数保留不删（避免破坏其他可能的调用方），但不再被 `handlePasteSubmit` 调用。

---

## 数据流（纯 prompt 路径）

```
用户在 textarea 输入文字 → 点击"提交 Agent 整理"
  → handlePasteSubmit(text)
  → triggerAiPrompt(text)       [tauri.ts]
  → invoke('trigger_ai_prompt') [IPC]
  → Rust: emit "queued", 入队
  → process_material(..., prompt_text=Some(text))
  → Claude CLI: claude -p "{text}" --permission-mode bypassPermissions ...
  → AI 执行，写文件到 workspace/yyMM/
  → emit journal-updated → 前端刷新列表
```

---

## ProcessingQueue 展示

纯 prompt 模式下 `material_path` 设为 prompt 截断字符串（前 20 字 + `…`），ProcessingQueue 组件无需改动，直接取 `filename` 字段（从 `material_path` 截取文件名部分）展示。

---

## 不涉及范围

- CommandDock UI 不变（placeholder 文案、输入框逻辑均不变）
- 有附件时的 note 逻辑不变
- 长文本粘贴（>300字）走附件流程的逻辑不变
