---
status: verified
phase: M7-b
created: 2026-06-27
---

# M7-b · 前端默认走 daemon（runtime flag 翻默认 + 事件切 SSE）

## 背景

M7-a Electron 骨架就绪。M7-b 让前端默认走 daemon（Gate A 核心：前端不再以 Tauri 为默认路径）。现状：runtimeClient 默认 'tauri'，flag JOURNAL_RUNTIME=http 才切 daemon；31 文件 import @tauri-apps；事件用 Tauri listen。

## 目标

1. **runtime 默认翻 daemon**：selectRuntimeClient 默认返回 HttpRuntimeClient（而非 Tauri）；JOURNAL_RUNTIME=tauri 仅作 fallback/测试。
2. **事件层切 SSE**：appEventBus / App.tsx / SessionList 等的 Tauri listen → daemon SSE 订阅（GET /events 或既有 SSE 通道）；保持事件语义一致。
3. **tauri.ts 降为 shim**：保留文件作兼容入口，但内部默认指向 HttpRuntimeClient；纯系统命令（reveal_in_file_manager/open_with_system/open_settings/open_privacy_settings）标记为 host 层，经 Electron shell 或 noop（M7-a desktop 提供），不阻塞。
4. daemon 未覆盖的子系统命令（list_models/feishu/pinned_items）在 shim 中返回合理默认或标注 TODO，不阻塞默认路径切换。

## 范围

- apps/web/src/lib/runtimeClient.ts（默认翻 daemon）、tauri.ts（降 shim）、httpRuntimeClient.ts（补 SSE 事件）。
- apps/web/src/shared/events/appEventBus.ts、App.tsx、SessionList.tsx（listen→SSE）。
- 测试更新（mock SSE 替代 Tauri listen）。
- 不删 src-tauri（M8）；不强求所有命令都有 daemon 实现（host 层/默认值兜底）。

## 约束

- 不破坏现有功能语义（事件仍能收到、命令仍能调）。
- Tauri 路径保留作 fallback（flag=tauri 仍可用），不回退已切 daemon 的能力。
- 只动 apps/web；不动 apps/daemon 现有（除非补 SSE 事件路由）。

## 验收（Given-When-Then）

- Given 默认启动（无 flag），When 前端调命令/订阅事件，Then 走 daemon（HttpRuntimeClient + SSE），不经 Tauri。
- Given JOURNAL_RUNTIME=tauri，When 启动，Then 仍走 Tauri（fallback 可用）。
- web tsc clean；vitest 不新增失败（基线对比）。
- 事件订阅经 SSE 收到（测试 mock）。
