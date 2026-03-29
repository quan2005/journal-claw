---
title: AI 处理队列设计文档
date: 2026-03-29
status: draft
---

# AI 处理队列

## 目标

将 AI 素材处理从"后台静默"改为"可见队列"，让用户始终知道每个文件的处理状态。

---

## Rust 端：串行任务队列

### 当前问题

`trigger_ai_processing` 直接 `tokio::spawn`，多文件同时提交会并行启动多个 Claude CLI 进程，资源争抢且无排队概念。

### 改动

在 `ai_processor.rs` 中引入 `tokio::sync::mpsc` 队列：

```
trigger_ai_processing()
  → 将 (material_path, year_month) 发送到 mpsc::Sender
  → 立即 emit "ai-processing" { status: "queued" }
  → 立即返回 Ok(())

队列 consumer (单 tokio task，app 启动时 spawn):
  loop {
    recv task from mpsc::Receiver
    → emit "ai-processing" { status: "processing" }
    → 调用 Claude CLI
    → emit "ai-processing" { status: "completed" | "failed" }
  }
```

### ProcessingUpdate 结构体

不变，只新增一个 status 值：

```rust
// status 字段值域：
// "queued"     — 已入队，等待处理
// "processing" — 正在调用 Claude CLI
// "completed"  — 处理完成
// "failed"     — 处理失败
```

### 队列管理

- `mpsc::channel(32)` — bounded channel，32 容量足够
- `Sender` 存入 Tauri `app.manage()` 的 State 中
- `trigger_ai_processing` 命令从 State 取 Sender 发送
- App 启动时在 `setup` 闭包中 spawn consumer task
- Consumer 是一个无限 `while let Some(task) = rx.recv().await` 循环

### 文件变更

| 文件 | 变更 |
|------|------|
| `src-tauri/src/ai_processor.rs` | 新增 `AiQueue` struct（持有 Sender）、`start_queue_consumer()` 函数；`trigger_ai_processing` 改为从 State 取 Sender 发送任务 |
| `src-tauri/src/main.rs` | setup 中创建 channel、`app.manage(AiQueue)`、spawn consumer |

---

## 前端：状态管理

### 类型

```ts
type QueueItemStatus = 'queued' | 'processing' | 'completed' | 'failed'

interface QueueItem {
  path: string
  filename: string      // 从 path 提取
  status: QueueItemStatus
  error?: string
  addedAt: number       // Date.now()，用于排序
}
```

### useJournal hook 改动

`processingPaths: string[]` → `queueItems: QueueItem[]`

事件处理逻辑：

| 收到 status | 行为 |
|-------------|------|
| `queued` | 添加 `{ status: 'queued' }` 到 queueItems |
| `processing` | 将对应 item 的 status 更新为 `'processing'` |
| `completed` | 将对应 item 的 status 更新为 `'completed'`，启动 1s 延迟后从列表移除 |
| `failed` | 将对应 item 的 status 更新为 `'failed'`，保留直到用户手动关闭 |

对外暴露：
- `queueItems: QueueItem[]` — 整个队列
- `dismissQueueItem(path: string)` — 手动移除 failed 条目
- `isProcessing: boolean` — 语义糖：`queueItems.some(i => i.status === 'processing' || i.status === 'queued')`

### 向后兼容

`AiStatusPill` 目前依赖 `processingPaths.length > 0`，改为使用 `isProcessing` 即可。

---

## 前端：ProcessingQueue 组件

### 位置

绝对定位在 CommandDock 上方。App 布局中，作为 CommandDock 的兄弟元素，`position: absolute; bottom: <dock 高度>; left: 0; right: 0`。

### 结构

```
┌──────────────────────────────────────┐
│ 📄 meeting-notes.docx      ⟳ 处理中  │  ← processing
│ 🎙 录音 14:32.m4a          ○ 排队中  │  ← queued
│ 📄 report.pdf             ✕ 失败    │  ← failed + 关闭按钮
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ [CommandDock ...]                    │
└──────────────────────────────────────┘
```

### 每行结构

```
[文件类型图标]  [文件名 — 左对齐，truncate]  [状态指示器 — 右对齐]
```

- **文件类型图标**：复用 `fileKindFromName()` 判断类型，用 emoji（🎙📄📝）
- **文件名**：从 path 提取，`text-overflow: ellipsis`
- **状态指示器**：
  - `queued`：灰色小圆点 + "排队中"
  - `processing`：`<Spinner size={10} />` + "处理中"
  - `failed`：红色文字"失败" + `×` 关闭按钮

### 视觉

- 背景：`var(--dock-bg)`，与 CommandDock 连续
- 顶部圆角 8px，底部无圆角（与 dock 无缝连接）
- 顶部 `border-top: 0.5px solid var(--dock-border)`
- 每行高度 36px，padding `0 20px`
- 行间 `border-bottom: 0.5px solid var(--dock-border)` 最后一行除外
- 字号 11px，颜色沿用 `--item-meta` / `--item-text`

### 滚动

- `max-height: 180px`（约 5 行 × 36px）
- `overflow-y: auto`
- 超过 5 行时出现滚动条

### 动画

- 条目进入：`translateY(8px) opacity:0 → translateY(0) opacity:1`，200ms ease-out
- 条目完成消失：`opacity:1 → opacity:0`，300ms ease-out，动画结束后从 DOM 移除
- 整个面板出现 / 消失：与条目动画一致（第一条进入时出现，最后一条离开时消失）

### 空状态

队列为空时组件返回 `null`，不渲染。

---

## 替代 / 保留

| 组件 | 处置 |
|------|------|
| `InboxStrip` | **删除** — 被 ProcessingQueue 完全替代 |
| `AiStatusPill` | **保留** — TitleBar 中的概要状态指示，改用 `isProcessing` |

---

## 文件变更汇总

| 文件 | 变更类型 |
|------|----------|
| `src-tauri/src/ai_processor.rs` | 重构：新增 mpsc 队列、AiQueue struct、consumer task |
| `src-tauri/src/main.rs` | 修改：setup 中初始化队列、manage State |
| `src/types.ts` | 新增：`QueueItem`、`QueueItemStatus` 类型 |
| `src/hooks/useJournal.ts` | 重构：`processingPaths` → `queueItems` + `dismissQueueItem` + `isProcessing` |
| `src/components/ProcessingQueue.tsx` | **新建**：队列面板组件 |
| `src/components/InboxStrip.tsx` | **删除** |
| `src/components/JournalList.tsx` | 修改：移除 InboxStrip 引用 |
| `src/App.tsx` | 修改：传递 queueItems 给 ProcessingQueue；AiStatusPill 改用 isProcessing |
| `src/components/TitleBar.tsx` | 修改：`isProcessing` prop 替代 `processingPaths.length > 0` |
