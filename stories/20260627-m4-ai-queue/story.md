---
status: verified
phase: M4
created: 2026-06-27
---

# M4 · AI 处理 + work queue（建于 pi 引擎）

## 背景
ME 引擎集成完成（pi 引擎经 engine=builtin 可用）。M4 把 ai_processor + work_queue 迁到 daemon，AI 执行走 pi 引擎。Rust：ai_processor.rs(7)+ai_plan、work_queue.rs(5)、digest/compact。

## 范围（读 Rust 源对齐）
1. **work_queue**（work_queue.rs）：enqueue / list / cancel / retry / dismiss —— 队列状态管理（与引擎解耦，纯 daemon service + 持久化，对齐 Rust 存储）。
2. **ai_processor**（ai_processor.rs + ai_plan.rs）：trigger_ai_processing / cancel_ai_processing / trigger_ai_prompt / ai_plan 等 —— AI 执行走 ME 的 pi 引擎（engine=builtin，经 AgentRunService）。对齐 Rust 的处理语义（输入/产出/事件）。
3. **digest / compact**：compact 可复用 pi transformContext；digest 对齐 Rust。

## 约束
- AI 执行复用 ME 引擎（engine/run.ts + AgentRunService），不另起引擎。
- work_queue 持久化格式对齐 Rust（Gate G）。
- 前端 tauri.ts 对应封装经 runtime flag。
- 测试用 faux provider（无需真 key）。
- 只动 apps/daemon + 前端 tauri.ts；不删 Rust；不碰范围外 dirty。

## 验收（Given-When-Then）
- work_queue：enqueue→list→cancel/retry/dismiss 状态机正确，持久化对齐 Rust。
- ai_processor：trigger → 经 pi 引擎执行（faux）→ 产出事件/结果；cancel 中断。
- daemon tsc clean；vitest ≥407 passed 无新失败。
- 越界：仅相关 daemon 模块 + server.ts + 前端 tauri.ts + 测试 + story。
