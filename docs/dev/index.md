---
title: 开发概览
description: JournalClaw 的开发指南入口，涵盖项目架构、环境搭建、前端和后端开发、构建发布。
---

# 开发指南

谨迹是一个 Electron 桌面应用：`apps/web` 提供 React 19 + TypeScript 前端，`apps/daemon` 提供本地业务后端与 Agent 引擎，`apps/desktop` 提供窗口、菜单和 daemon 生命周期。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面宿主 | Electron |
| 前端 | React 19 + TypeScript + Vite 7 |
| 样式 | 纯 CSS（CSS 变量 + tokens） |
| 后端 | TypeScript daemon（HTTP + SSE） |
| Agent 引擎 | pi 内建引擎 + CLI adapters |
| 本地文件 | daemon services + ChangeSet |
| 测试 | vitest + Playwright |

## 目录结构

```
apps/web/src/              # React 前端
  components/              # 业务组件
  hooks/                   # journal/todos/conversation/theme 等 hooks
  lib/runtimeClient.ts     # daemon runtime client 抽象
  lib/httpRuntimeClient.ts # HTTP + SSE transport
  lib/hostBridge.ts        # Electron preload host 能力

apps/daemon/src/           # TypeScript daemon
  server.ts                # HTTP/SSE routes
  engine/                  # pi 内建引擎适配
  runs/                    # Agent Run 生命周期与事件
  changeset/               # 文件变更记录与恢复
  journal/ todos/ topics/ identity/ ...

apps/desktop/src/          # Electron 主进程 / preload
  main.ts                  # 窗口与应用生命周期
  daemon.ts                # daemon 子进程生命周期
  hostIpc.ts               # preload 白名单 IPC
  preload.cts              # window.electronAPI
```

## 快速导航

- [架构全景](/docs/dev/architecture) — runtime client、daemon、Electron host 分层
- [环境搭建](/docs/dev/setup) — 依赖安装、开发模式、调试
- [前端开发](/docs/dev/frontend) — React 组件、Hooks、runtime/host bridge
- [后端开发](/docs/dev/backend) — daemon services、routes、Agent Run
- [构建与发布](/docs/dev/building) — Electron 构建、CI、Release
