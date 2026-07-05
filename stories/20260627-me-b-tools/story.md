---
status: verified
phase: ME-b
created: 2026-06-27
---

# ME-b · pi 引擎工具 + 授权钩子

## 背景

ME-a 已把 pi 引擎骨架接好（EngineService + vendor 配置 + faux 测试）。ME-b 给引擎装上工具与授权门。Rust 内建引擎工具见 apps/web/src-tauri/src/llm/tool_loop.rs（bash / fs / subtask）。pi 工具接口 AgentTool（name/parameters/execute，见 pi-agent-core README + .d.ts）。

## 目标

为 pi 引擎定义 AgentTool 集合 + 授权钩子：

1. **bash 工具**：执行 shell；受 AuthorizationMode 约束（read_only 拒绝）。
2. **fs 工具**：read_file / write_file / edit_file / move / delete —— 写类操作经 ChangeSetService（apps/daemon/src/changeset/service.ts）记录 ChangeSet（beforeHash/afterHash/diff、delete→.journal-trash）。
3. **subtask 工具**：spawn 子 agent（对齐现有 AgentRunService 子任务/Agent Team 概念）。
4. **授权钩子**：beforeToolCall → 按 AuthorizationMode（read_only/workspace_write/full_access）判定，拒绝越权（写/删/bash）；afterToolCall → 记录 ChangeSet/审计。复用 isPathAllowed（changeset/authorization.ts）。

## 范围

- apps/daemon/src/engine/tools/\*.ts：bash、fs、subtask 的 AgentTool 定义 + 测试。
- engine/service.ts 接入 tools + beforeToolCall/afterToolCall 钩子。
- 不接 AgentRunService 事件映射、不接前端（留 ME-c）。

## 约束

- 复用现有 ChangeSetService + isPathAllowed，不另起授权/变更逻辑。
- bash/fs 越权用结构化拒绝（pi beforeToolCall 返回 block）。
- 只动 apps/daemon/src/engine/；不删 Rust；不碰范围外 dirty。

## 验收（Given-When-Then）

- Given read_only，When agent 调 write_file/bash，Then beforeToolCall 阻止（结构化）。
- Given workspace_write，When write_file 在 root 内，Then 成功并记录 ChangeSet；root 外被拒。
- Given delete_file，Then 进 .journal-trash 可 revert。
- Given faux provider 模拟工具调用，Then 工具执行 + 钩子行为正确（测试用 faux 触发 toolCall）。
- daemon tsc clean；vitest ≥396 passed 无新失败。
