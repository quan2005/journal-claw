---
title: 环境搭建
description: JournalClaw 开发环境搭建指南，包括依赖安装、开发模式、调试方法。
---

# 环境搭建

## 系统要求

- Node.js 20+
- bun 1.1+（仓库声明为 `bun@1.3.14`）
- macOS / Windows / Linux 桌面开发环境

默认开发与测试不需要 Rust toolchain、Xcode、Swift sidecar、WhisperKit 或 ffmpeg。

## 安装依赖

```bash
git clone https://github.com/quan2005/journal.git
cd journal
bun install
```

## 开发模式

```bash
# 桌面开发：Vite + Electron
bun run desktop:dev

# 仅前端：Vite at localhost:1420
bun run dev

# daemon CLI
bun run daemon:dev
```

`bun run desktop:dev` 会先构建 Electron main/preload，再并行启动 Vite 与 Electron。业务 API 由 daemon 提供，Electron 只负责宿主能力。

## 运行测试

```bash
# 全 workspace 测试
bun run test

# 前端 watch
bun run --filter @journal/web test:watch

# daemon 测试
bun run --filter @journal/daemon test

# desktop 测试
bun run --filter @journal/desktop test

# E2E 测试
bun run test:e2e
```

## 代码检查

```bash
bun run lint
bun run format:check
bun run --filter @journal/web typecheck
bun run --filter @journal/daemon typecheck
bun run --filter @journal/desktop typecheck
```

## 调试

### 前端

Electron DevTools 与普通浏览器 DevTools 均可调试 Vite 页面。UI 调试优先使用 `bun run dev`，宿主能力调试使用 `bun run desktop:dev`。

### Daemon

daemon 是普通 Node.js 进程。routes 在 `apps/daemon/src/server.ts`，业务逻辑在各 service 目录。可通过 vitest 单测或 `bun run daemon:dev` 调试。

### Electron Host

宿主能力通过 `apps/web/src/lib/hostBridge.ts` 调用 `window.electronAPI`。主进程白名单在 `apps/desktop/src/hostIpc.ts` 和 `apps/desktop/src/preload.cts`。
