---
title: 后端开发
description: JournalClaw daemon 开发指南，包括 services、routes、Agent Run、ChangeSet 与测试。
---

# 后端开发

JournalClaw 的业务后端是 `apps/daemon` TypeScript 进程，通过 HTTP + SSE 服务前端和 Electron host。

## 目录

| 目录                                          | 职责                                   |
| --------------------------------------------- | -------------------------------------- |
| `server.ts`                                   | Express routes 与 SSE 入口             |
| `engine/`                                     | pi 内建引擎封装、事件映射、prompt 组装 |
| `runs/`                                       | Agent Run 生命周期、事件存储、cancel   |
| `changeset/`                                  | 文件变更记录、diff/hash、revert        |
| `journal/`, `todos/`, `topics/`, `identity/`  | 本地知识库 CRUD                        |
| `settings/`, `config/`, `workspace/`          | 工作区与应用配置                       |
| `automation/`, `work_queue/`, `ai_processor/` | 自动化、队列与 AI 处理                 |

## 新增业务能力

1. 在对应 service 中实现纯业务逻辑，并写 vitest。
2. 在 `server.ts` 暴露 route，必要时补 route test。
3. 在 `apps/web/src/lib/httpRuntimeClient.ts` 增加旧 command 名到 HTTP route 的映射。
4. 前端通过 `runtimeClient` / `hostBridge` 调用，不绕过统一入口。

## Agent Run

Agent Run 的主路径是：

```
POST /runs
GET /runs/:id/events
POST /runs/:id/cancel
```

事件统一为 `AgentRunEvent`，由 daemon 内建的唯一 pi 引擎生成并归一化。前端只消费统一事件，不感知引擎内部事件格式。

## ChangeSet

Agent 发起的用户资产写入、移动、删除必须生成 ChangeSet，并保留 revert 所需信息。用户直接编辑和系统元数据走各自受控写入通道；不得为了复用 ChangeSet 而伪造 Agent 语义。`read_only`、`workspace_write`、`full_access` 的授权语义在 daemon 层执行。

## 测试

```bash
cd apps/daemon
bunx vitest run
bunx tsc --noEmit
```
