---
title: 开发架构
description: JournalClaw 当前 Electron + TypeScript daemon 架构说明。
---

# 开发架构

## 总览

```
apps/web (React)
  -> lib/tauri.ts compatibility shim
  -> runtimeClient / httpRuntimeClient
  -> apps/daemon (HTTP + SSE)

apps/web hostBridge
  -> Electron preload whitelist
  -> apps/desktop main process
```

业务语义只放在 daemon。Electron host 只处理窗口、菜单、文件选择、系统打开、webview zoom/theme 与 daemon 子进程生命周期。

## Runtime Client

`apps/web/src/lib/runtimeClient.ts` 定义 `JournalRuntimeClient`：

- `invoke(command, args)`：兼容旧 command 风格调用，实际映射到 daemon route。
- `subscribe(event, handler)`：订阅 daemon SSE 事件，返回同步 unsubscribe。

`apps/web/src/lib/tauri.ts` 保留旧函数名是为了降低迁移成本，不代表存在旧 native runtime。

## Daemon

`apps/daemon/src/server.ts` 暴露 HTTP/SSE routes。业务拆在 service 目录中：

- `journal/`, `todos/`, `topics/`, `identity/`, `materials/`
- `settings/`, `config/`, `workspace/`, `files/`
- `runs/`, `engine/`, `runtimes/`, `changeset/`, `sediment/`
- `automation/`, `work_queue/`, `ai_processor/`

## Electron Host

`apps/desktop` 负责：

- 创建窗口并加载 Vite/renderer。
- 管理 daemon 子进程生命周期。
- 暴露最小 preload API：Reveal、Open、Pick folder、dialog、zoom、theme、file drop。

Host API 入口是 `apps/web/src/lib/hostBridge.ts`；组件不得直接使用 raw Electron IPC。

## Agent Run

Agent Run 是 AI 主路径：

1. 前端通过 `agentRuns.ts` 或 runtime client 创建 run。
2. daemon 在 `runs/` 中登记状态与事件。
3. `engine/` 运行 pi 内建引擎，或 `runtimes/` 调用 CLI adapter。
4. 事件以 SSE 推给前端，并落盘支持 cursor 恢复。
5. 文件变更通过 ChangeSet 记录，可查看和恢复。

## 数据约束

- workspace 文件格式保持可读。
- 新元数据写入跨平台 workspace 路径或用户配置目录。
- 删除和恢复走 ChangeSet / 项目内恢复路径，不依赖系统回收站。
- 默认 build/test 不依赖平台专属二进制。
