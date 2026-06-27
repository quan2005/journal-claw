---
title: 后端开发
description: JournalClaw daemon 开发指南，包括 services、routes、Agent Run、ChangeSet 与测试。
---

# 后端开发

JournalClaw 的业务后端是 `apps/daemon` TypeScript 进程，通过 HTTP + SSE 服务前端和 Electron host。

## 目录

| 目录 | 职责 |
|---|---|
| `server.ts` | Express routes 与 SSE 入口 |
| `engine/` | pi 内建引擎封装、事件映射、prompt 组装 |
| `runs/` | Agent Run 生命周期、事件存储、cancel |
| `runtimes/` | Claude Code、Codex CLI、OpenCode adapters |
| `changeset/` | 文件变更记录、diff/hash、revert |
| `journal/`, `todos/`, `topics/`, `identity/` | 本地知识库 CRUD |
| `settings/`, `config/`, `workspace/` | 工作区与应用配置 |
| `automation/`, `work_queue/`, `ai_processor/` | 自动化、队列与 AI 处理 |

## 新增业务能力

1. 在对应 service 中实现纯业务逻辑，并写 vitest。
2. 在 `server.ts` 暴露 route，必要时补 route test。
3. 在 `apps/web/src/lib/httpRuntimeClient.ts` 增加旧 command 名到 HTTP route 的映射。
4. 前端通过 `runtimeClient` / `lib/tauri.ts` 调用，不绕过统一入口。

## Agent Run

Agent Run 的主路径是：

```
POST /runs
GET /runs/:id/events
POST /runs/:id/cancel
```

事件统一为 `AgentRunEvent`，由 daemon 负责把 pi engine 或 CLI adapter 输出归一化。前端只消费统一事件，不感知具体 adapter 原始格式。

## ChangeSet

所有文件写入、移动、删除都应生成 ChangeSet，并保留 revert 所需信息。`read_only`、`workspace_write`、`full_access` 的授权语义在 daemon 层执行。

## 测试

```bash
cd apps/daemon
npx vitest run
npx tsc --noEmit
```
