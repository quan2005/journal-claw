---
id: STORY-20260625-agent-run-service
title: 'AgentRunService — Run 一等化的服务层'
status: verified
source: orchestrator
level: L2
hypothesis_basis: reference
created: 2026-06-25
parent: ../20260625-ts-daemon-agent-runtime-migration/story.md
related:
  - docs/final-state.md
  - docs/verification-standard.md
  - docs/adr/ts-daemon-agent-runtime-migration.md
---

# AgentRunService — Run 一等化的服务层

> 一句话：**在 daemon 侧实现 AgentRunService，让一次 Agent 工作成为可创建、可流式订阅、可取消、可回看的一等对象——这是 Runs 对象的核心。**

## 服务对象

**Runs**（五个一等对象之一）。把 Run 从"对话流事件"升级为"可回看、可追踪、有生命周期的独立对象"。

## 背景

G3 已在 `packages/contracts` 定义了 `AgentRun` / `AgentRunEvent` 契约。G4 在 daemon 侧实现服务层，让这些类型真正运转。参照 open-design `apps/daemon/src/runtimes/runs.ts`（475 行）的 SSE run service + JSONL 事件日志形态。

## 范围

### 实现内容

1. **`apps/daemon/src/runs/service.ts`** — AgentRunService
   - `createRun(input): AgentRun` — 创建 run，状态 `queued`
   - `appendEvent(runId, event)` — 追加事件，驱动状态机
   - `getRun(runId): AgentRun | null`
   - `cancelRun(runId)` — 状态 → `canceled`
2. **`apps/daemon/src/runs/store.ts`** — 事件持久化
   - JSONL 落盘到 `<dataDir>/runs/<runId>.jsonl`
   - 每行一个 `AgentRunEvent`
   - 可按 runId 回放事件序列
3. **HTTP 路由**（挂到现有 server.ts）
   - `POST /runs` — 创建 run，返回 `{ id, status, ... }`
   - `GET /runs/:id/events` — SSE 流式推送该 run 的事件
   - `POST /runs/:id/cancel` — 取消 run
4. **状态机** — 事件驱动 run 状态流转
   - `run_started` → running
   - `run_finished` → succeeded
   - `run_failed` → failed
   - cancel → canceled

### 独占文件

- `apps/daemon/src/runs/service.ts`（新增）
- `apps/daemon/src/runs/store.ts`（新增）
- `apps/daemon/src/runs/service.test.ts`（新增）
- `apps/daemon/src/runs/store.test.ts`（新增）
- `apps/daemon/src/server.ts`（改：挂路由）

## 验收标准（Given-When-Then + 检查命令）

按 `docs/verification-standard.md`，每条附 Codex 可执行的检查命令。

### AC-1 · 创建 run 并返回结构化结果

- **Given** daemon 运行
- **When** `POST /runs` body `{ goal: "test", mode: "agent" }`
- **Then** 返回 `{ id, sessionId, goal, mode, status: "queued", createdAt, updatedAt }`，类型满足 `AgentRun`
- **检查**：`curl -X POST /runs -d '{"goal":"test","mode":"agent"}'` 输出含 `id` + `status:"queued"`

### AC-2 · SSE 事件流推送

- **Given** 一个已创建的 run
- **When** `GET /runs/:id/events`
- **Then** SSE 流推送该 run 的事件，每个事件 `data:` 行是 `AgentRunEvent` JSON
- **检查**：daemon 内部 `appendEvent` 后，SSE 客户端收到对应事件；事件类型在 G3 定义的 12 种内

### AC-3 · 取消 run

- **Given** 一个 running 的 run
- **When** `POST /runs/:id/cancel`
- **Then** run 状态变 `canceled`；后续 appendEvent 不再改变状态
- **检查**：`POST /cancel` 后 `GET /runs/:id`（或事件流）显示 `canceled`

### AC-4 · JSONL 持久化与回放

- **Given** run 产生了若干事件
- **When** 检查 `<dataDir>/runs/<runId>.jsonl`
- **Then** 文件存在，每行一个 `AgentRunEvent`；回放后事件序列与内存一致
- **检查**：`cat <dataDir>/runs/<runId>.jsonl | wc -l` = 事件数；每行 `JSON.parse` 成功且 `isAgentRunEvent` 返回 true

### AC-5 · 状态机正确流转

- **Given** 事件序列 `run_started → text_delta → run_finished`
- **When** 检查 run 状态
- **Then** 中态 `running`，终态 `succeeded`
- **检查**：`pnpm --filter @journal/daemon test` 含状态机测试（started→running, finished→succeeded, failed→failed, cancel→canceled）

### AC-6 · 不回退 + diff 卫生

- **Given** G4 改动
- **When** `git diff --name-only`
- **Then** 仅 `apps/daemon/src/runs/**` + `apps/daemon/src/server.ts`；不碰 web/contracts/Rust
- **检查**：`git diff --name-only | grep -vE "apps/daemon/(src/runs|src/server.ts)"` 应为空；`pnpm --filter @journal/daemon typecheck` exit 0

## 不做项

- 不接真实 Coding Agent CLI（G11）
- 不实现 ChangeSet / AuthorizationMode（G8/G9）
- 不做前端 HttpRuntimeClient 试点（G5）
- 不做 run summary / 自动沉淀（G14）
- 不改 contracts 类型（G3 已定）

## 验收方式

遵循 `docs/verification-standard.md`：

- 验收方 Codex `workspace-write` 沙盒
- 实现方先 commit，验收在干净 HEAD
- 验收后 `git diff` 越界核查
- AC-2/AC-4 的行为契约用 curl + 文件检查（Codex 能跑）

## 参考

- open-design `apps/daemon/src/runtimes/runs.ts`（SSE run service）
- `docs/adr/ts-daemon-agent-runtime-migration.md` §AgentRun
- `packages/contracts/src/index.ts`（AgentRun / AgentRunEvent 契约）
