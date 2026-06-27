---
status: verified
phase: M6
created: 2026-06-27
---

# M6 · Automation / routines（建于 pi 引擎 + M5 session）

## 背景
M5 conversation 已走 pi 引擎。M6 迁移 automation（routines CRUD + runner/store/schedule/templates）。Rust：automation_commands.rs(10) + automation_runner/store/schedule/templates/types。

## 范围（读 Rust 源对齐）
1. **routines CRUD**：list/create/update/delete/pause/resume/run-now + list_runs + get_run（automation_commands.rs 10 命令）。
2. **store**：routine 定义持久化（对齐 Rust 格式，Gate G）。
3. **schedule**：触发调度（频率/时间，对齐 Rust；daemon 侧用定时器或事件驱动，说明机制）。
4. **runner**：执行 routine → 走 pi 引擎（engine builtin，经 AgentRunService/ConversationService，复用 M5 session 能力）。
5. **templates**：list_automation_templates。

## 约束
- 复用 ME 引擎 + M5 ConversationService/AgentRunService，不另起引擎/Run 存储。
- routine 持久化对齐 Rust（Gate G）。
- 前端 tauri.ts 对应封装经 runtime flag。
- 测试用 faux provider。
- 只动 apps/daemon + 前端 tauri.ts；不删 Rust；不碰范围外 dirty；勿装包。

## 验收（Given-When-Then）
- routines CRUD：create→list→update→pause/resume→delete 状态正确，持久化对齐 Rust。
- run-now：触发 routine → 经 pi 引擎执行（faux）→ 产出 run 记录。
- schedule：按配置触发（测试用可控时间断言）。
- daemon tsc clean；vitest ≥421 passed 无新失败；web tsc clean。
