# Recording Queue Persistence Design

**Date:** 2026-03-30
**Status:** Approved

## Problem

停止录音后，processing queue 中的录音 item 消失，等到 `ai-processing` 事件到达时再重新出现。用户体验有断层感。导入音频文件同理——文件导入后 queue 没有即时反馈。

## Goal

录音停止 / 音频文件导入后，queue item 立刻出现并持续到 AI 处理完成，状态平滑过渡，无闪烁、无消失。

---

## State Machine

### 录音流程

```
[录音中 recording]  →  用户点击停止
    ↓ 前端立即插入 converting item（占位 path: '__recording__'）
[转换中 converting]  →  recording-processed 事件到达（携带真实 path + filename）
    ↓ 占位 item 替换为真实路径，status → queued
[排队中 queued]      →  ai-processing: processing
    ↓
[处理中 processing]  →  ai-processing: completed
    ↓
[完成 completed]     →  1s 后自动移除
```

### 音频文件导入流程

```
importAudioFile() 返回 { path, filename }
    ↓ 前端立即插入 queued item（真实路径，跳过 converting）
[排队中 queued]      →  ai-processing: processing
    ↓
[处理中 processing]  →  ai-processing: completed
    ↓
[完成 completed]     →  1s 后自动移除
```

---

## Changes

### 1. `src/types.ts`

`QueueItemStatus` 新增 `'converting'`：

```ts
export type QueueItemStatus = 'recording' | 'converting' | 'queued' | 'processing' | 'completed' | 'failed'
```

### 2. `src/hooks/useJournal.ts`

新增导出函数 `addConvertingItem(placeholderPath: string, filename: string)`：
- 在 `queueItems` 头部插入 `{ path, filename, status: 'converting', addedAt: Date.now(), logs: [] }`
- 若已存在相同 path 则不重复插入

`recording-processed` 监听器改造：
- 目前只调用 `refresh()`，改为同时将 placeholder item（`path === '__recording__'`）替换为真实 `{ path, filename, status: 'queued' }`
- 仍然调用 `refresh()`

新增导出函数 `addQueuedItem(path: string, filename: string)`：
- 供音频文件导入使用，直接插入真实路径的 `queued` item
- 若已存在相同 path（`ai-processing: queued` 可能先到）则不重复插入

### 3. `src/App.tsx`

**录音停止：**
- `handleRecord` 在 `await stop()` 之后，调用 `addConvertingItem('__recording__', '录音处理中')`
- 移除 `visibleQueueItems` 的虚拟 recording item 注入逻辑（`status === 'recording'` 的 item 仍由 `useRecorder` 驱动，但现在由 `queueItems` 而非临时构造管理）

**音频文件导入：**
- `handleFilesSubmit` 中，`await importAudioFile(path)` 的返回值 `{ path, filename }` 用于调用 `addQueuedItem(path, filename)`

**虚拟 recording item 注入：**
- `visibleQueueItems` 逻辑保持，仍在录音进行中时在 queue 头部注入虚拟 `recording` item
- 停止录音后该虚拟 item 消失，由 `converting` item 接替

### 4. `src/components/ProcessingQueue.tsx`

`StatusIndicator` 新增 `'converting'` 分支：
- 样式同 `'processing'`：Spinner + 文字 "转换中"
- 颜色用 `var(--item-meta)` 而非 `var(--ai-pill-active-text)`，区分于 AI 处理阶段

---

## Constraints

- 不改动 Rust 代码
- `__recording__` 作为占位 path 常量，在 `App.tsx` 和 `useJournal.ts` 中共享（可提取为常量）
- `addConvertingItem` / `addQueuedItem` 均需幂等（重复调用不产生重复 item）
- `ai-processing: queued` 事件可能在前端插入 item 之前或之后到达，两种情况均需正确处理（去重逻辑）
