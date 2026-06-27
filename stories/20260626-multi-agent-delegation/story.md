---
id: STORY-20260626-multi-agent-delegation
title: "Multi-agent delegation via child runs"
status: verified
source: leader
level: L2
hypothesis_basis: reference
created: 2026-06-26
parent: ../20260625-ts-daemon-agent-runtime-migration/story.md
related:
  - docs/final-state.md
  - stories/20260625-ts-daemon-agent-runtime-migration/verify-report.md
---

# Multi-agent delegation via child runs

> 一句话：**让一个 parent Run 能创建 child Run，把多 Agent 协作变成可追踪的 Run 层级，而不是散落的临时任务。**

## 用户故事

作为需要指挥多个本地 Agent 处理复杂目标的用户，
当一个任务需要拆给不同 agent 执行时，
我希望系统能记录 parent/child run 关系，
以便之后回看每个子任务做了什么、用了哪些资料、产出了什么。

## 背景与失败模式

上一轮验收发现代码已有 `parentRunId` 和 `/runs/:id/subtasks`，但缺 approved child story；前端类型也未完全继承 contracts，导致多 Agent 能力不能被认证。

## 验收标准

### AC-1 — parent run 可创建 child run
- **Given** 一个 parent run 存在
- **When** 用户调用 `POST /runs/:id/subtasks`
- **Then** daemon 创建带 `parentRunId` 的 child run
- **And** child run 可选择已注册 agentId

### AC-2 — 可查询 child runs
- **Given** parent run 已创建多个子任务
- **When** 用户调用 `GET /runs/:id/subtasks`
- **Then** 返回所有 child runs，且包含状态、goal、agent 相关信息

### AC-3 — 前端类型不漂移
- **Given** contracts 中 `AgentRun` 支持 `parentRunId`
- **When** 前端消费 run 数据
- **Then** 前端使用共享 contracts 或保持字段完全一致

## 不做项

- 不做复杂调度器。
- 不实现 agent 间自动竞争/投票。
- 不跨机器派发任务。

## 验收方式

- `pnpm --filter @journal/contracts test`
- `pnpm --filter @journal/daemon test -- runs runtimes`
- live smoke：`POST /runs/:id/subtasks` + `GET /runs/:id/subtasks`
