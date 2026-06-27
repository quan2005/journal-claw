---
title: 前端开发
description: JournalClaw 前端开发指南，包括组件、Hooks、runtime client 与宿主桥接。
---

# 前端开发

## 分层

| 层 | 说明 |
|---|---|
| `components/` | 纯 UI 与用户交互 |
| `hooks/` | 业务状态、数据加载、事件订阅 |
| `contexts/` | UI、i18n、toast、todos 等跨组件状态 |
| `lib/tauri.ts` | 兼容 shim：保留旧函数名，内部委托 runtime/host bridge |
| `lib/runtimeClient.ts` | daemon runtime client 抽象 |
| `lib/httpRuntimeClient.ts` | HTTP + SSE transport |
| `lib/hostBridge.ts` | Electron preload host 能力 |

## 业务调用

组件不要直接拼 daemon URL。新增业务能力时：

1. 在 daemon service + route 中实现能力。
2. 在 `HttpRuntimeClient` 增加 command 映射。
3. 如需兼容旧调用点，在 `lib/tauri.ts` 增加封装。
4. 在 hook/component 中调用封装函数或 runtime client。

## 宿主调用

文件选择、系统打开、Reveal、窗口缩放/主题等宿主能力走 `hostBridge.ts`。组件不得直接使用 raw Electron IPC；所有 preload 能力必须在 `apps/desktop/src/preload.cts` 白名单中显式暴露。

## 事件

daemon 业务事件通过 SSE 进入 runtime client；宿主本地事件通过 `hostBridge.subscribeHostEvent()`。React effect cleanup 必须同步释放订阅。

## 测试

前端测试使用 vitest + Testing Library。业务调用优先 mock `../lib/tauri` 或 runtime client；宿主能力优先 mock `../lib/hostBridge`。
