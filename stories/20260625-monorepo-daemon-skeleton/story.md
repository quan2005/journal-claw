---
id: STORY-20260625-monorepo-daemon-skeleton
title: "pnpm monorepo 化 + daemon 骨架 + 共享契约"
status: verified
source: orchestrator
level: L2
hypothesis_basis: reference
created: 2026-06-25
parent: ../20260625-ts-daemon-agent-runtime-migration/story.md
related:
  - docs/final-state.md
  - docs/adr/ts-daemon-agent-runtime-migration.md
---

# pnpm monorepo 化 + daemon 骨架 + 共享契约

> 一句话：**把 journal 从单包迁成 pnpm monorepo（apps/web + apps/daemon + packages/contracts），对齐 open-design 结构，为 AgentRun 一等化和多 CLI adapter 铺路。**

## 背景

迁移 Phase 1 完成后（前端 runtime client 已 verified），下一步需要 TS daemon 作为旁路运行时。单包结构无法支持 daemon 与前端独立构建 + 共享类型，必须先 monorepo 化。

参考实现：`~/Projects/github/open-design`（pnpm workspace，apps/daemon 用 Express + tsc + node-pty）。

## 范围（已落地）

### G1 · pnpm monorepo 化
- 单包 → pnpm workspace：`apps/web` + `apps/daemon` + `packages/contracts`
- `src/` → `apps/web/src/`，`src-tauri/` → `apps/web/src-tauri/`，`scripts/` → `apps/web/scripts/`
- 根 package.json → workspace 根；前端依赖继承到 apps/web
- npm → pnpm（package-lock.json 删除）

### G2 · daemon 最小骨架（Express + tsc）
- `apps/daemon/src/server.ts`：Express，`GET /health` + `GET /workspace` + `GET /events`(SSE)
- `apps/daemon/src/cli.ts`：入口，子命令路由形态（参照 open-design）
- 不接管默认 Tauri 生产路径（旁路）

### G3 · 共享契约（packages/contracts）
- `AgentRun` / `AgentStep` / `AgentRunEvent`（12 种事件类型）
- `AuthorizationMode` / `ChangeSet`
- 类型守卫 `isAgentRunEvent` + 测试

## 验收标准（Given-When-Then）

### AC-1 · monorepo 结构成立
- **Given** journal 仓库
- **When** `pnpm install`
- **Then** workspace 建立，三包可独立解析，无依赖错误

### AC-2 · web 包不回退
- **Given** 前端整体迁到 apps/web
- **When** `pnpm --filter @journal/web typecheck` + `pnpm --filter @journal/web test`
- **Then** typecheck exit 0；test 通过数与搬迁前基线一致（547 passed / 13 failed，失败集 1:1）

### AC-3 · daemon 可独立启动并响应
- **Given** apps/daemon 骨架
- **When** `pnpm --filter @journal/daemon build` + `node dist/cli.js`
- **Then** `/health` 返回 `{status:ok}`；`/workspace` 返回路径；`/events` 推送 SSE 事件

### AC-4 · contracts 类型可被两端共享
- **Given** packages/contracts
- **When** `pnpm --filter @journal/contracts typecheck` + `test`
- **Then** typecheck exit 0；3 tests passed；类型可被 apps/web 和 apps/daemon import

### AC-5 · 配置与 CI 同步更新
- **Given** CI / release-please / .gitignore
- **When** 检查路径引用
- **Then** ci.yml/release.yml 用 pnpm 命令 + apps/web 路径；release-please 指向新路径；.gitignore 覆盖 apps/web/src-tauri/swift-cli/.build/

## 不做项

- 不实现真实 AgentRunService（G4）
- 不接入 Coding Agent CLI（G11）
- 不接前端 HttpRuntimeClient 试点（G5）
- 不改 Rust 后端逻辑
- 不重写前端任何组件

## 验证证据（编排者自测）

- pnpm install：662 包成功
- @journal/web typecheck：exit 0
- @journal/web test：547 passed / 13 failed（基线一致）
- @journal/contracts typecheck + 3 tests passed
- @journal/daemon typecheck exit 0，build exit 0
- daemon 端到端冒烟：/health /workspace /events 全部正常响应

## 风险

- **既有 13 个测试失败**：属 C2 snapshot 的进行中 UI 改动，非本 phase 引入。
- **swift-cli/.build 误提交**：已 amend 清理（955 文件从索引移除，.gitignore 更新）。
- **路径配置脆弱**：tauri.conf.json 的相对路径因 src-tauri 和前端同在 apps/web 而自洽，未改动。
