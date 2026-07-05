---
id: STORY-20260625-http-runtime-client-pilot
title: 'HttpRuntimeClient + 前端 Run 试点'
status: verified
source: orchestrator
level: L2
hypothesis_basis: reference
created: 2026-06-25
parent: ../20260625-ts-daemon-agent-runtime-migration/story.md
related:
  - docs/final-state.md
  - docs/verification-standard.md
  - stories/20260625-agent-run-service/story.md
---

# HttpRuntimeClient + 前端 Run 试点（G5 · 草稿）

> 一句话：**新增 HttpRuntimeClient（runtime client 的第二实现），feature flag 开启后 conversation 走 TS daemon；Tauri 仍可 fallback。让前端第一次真正消费 daemon 的 AgentRun。**

## 服务对象

**Runs**（前端接入层）。G4 让 daemon 能产 AgentRun，G5 让前端能消费它。

## 前置依赖

- ✅ G1-G3（monorepo + contracts + daemon 骨架）
- 🔄 G4（AgentRunService）—— 必须先 verified

## 范围

### 实现内容

1. **`apps/web/src/lib/httpRuntimeClient.ts`** — JournalRuntimeClient 的 HTTP 实现
   - `invoke` → fetch daemon HTTP API
   - `subscribe` → EventSource (SSE) 订阅 daemon 事件流
   - 满足同一 `JournalRuntimeClient` 接口（Phase 1 已定义）
2. **feature flag** — `JOURNAL_RUNTIME=tauri|http`（默认 tauri）
   - 切换点在 runtimeClient.ts 的 `defaultRuntimeClient` 选择逻辑
3. **useConversation 试点** — flag=http 时，conversation create/send/events 走 daemon
   - stream reducer 不绑 Tauri 事件名（解耦）
4. **mock daemon 消息** — ChatPanel 在 flag=http 下能完成一轮 mock 消息

### 独占文件

- `apps/web/src/lib/httpRuntimeClient.ts`（新增）
- `apps/web/src/lib/httpRuntimeClient.test.ts`（新增）
- `apps/web/src/lib/runtimeClient.ts`（改：加 flag 选择）
- `apps/web/src/hooks/useConversation.ts`（改：stream reducer 解耦）
- 对应测试

## 验收标准（草稿，G4 verified 后细化）

### AC-1 · HttpRuntimeClient 实现接口

- **检查**：`httpRuntimeClient.ts` 导出的对象满足 `JournalRuntimeClient` 接口；`invoke` 用 fetch，`subscribe` 用 EventSource

### AC-2 · feature flag 默认 tauri

- **检查**：无 flag 时 `defaultRuntimeClient` 是 TauriRuntimeClient；现有行为零回退

### AC-3 · flag=http 走 daemon

- **检查**：`JOURNAL_RUNTIME=http` 时，useConversation 的 subscribe 走 HttpRuntimeClient 的 EventSource

### AC-4 · stream reducer 不绑 Tauri 事件名

- **检查**：grep useConversation 确认 reducer 逻辑不 hardcode `conversation-stream` Tauri event name（走 client.subscribe 抽象）

### AC-5 · Tauri fallback 可用

- **检查**：flag 切回 tauri，现有对话行为不回退（ChatPanel.test 全绿）

### AC-6 · 不回退 + diff 卫生

- **检查**：`git diff --name-only` 仅允许范围；`pnpm --filter @journal/web typecheck + test` 不回退

## 不做项

- 不删除 TauriRuntimeClient（它是 fallback）
- 不让 http 成为默认（默认仍 tauri，保护生产路径）
- 不实现完整 Agent Run Workbench UI（G7/G12）
- 不接真实 Coding Agent CLI（G11）

## 验收方式

遵循 `docs/verification-standard.md`：Codex workspace-write + git diff 越界核查。

## 待定（G4 verified 后决定）

- AC-3 的 mock daemon 消息：要不要在 G5 里建一个 mock daemon fixture，还是用真实 G4 daemon？倾向真实 daemon（G4 已能跑），但需要 web 测试环境能启动 daemon。
- feature flag 放哪：环境变量 vs localStorage vs workspace_settings？倾向 workspace_settings（和 theme 一致，Tauri 持久化）。
