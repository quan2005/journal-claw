---
id: STORY-20260626-run-sedimentation-review
title: "Run sedimentation review pipeline (G14)"
status: verified
source: leader
level: L3
hypothesis_basis: reference
created: 2026-06-26
parent: ../20260625-ts-daemon-agent-runtime-migration/story.md
related:
  - docs/final-state.md
  - docs/adr/rust-removal-acceptance.md
  - stories/20260625-ts-daemon-agent-runtime-migration/verify-report.md
---

# Run sedimentation review pipeline (G14)

> 一句话：**Run 完成后把结果沉淀为可回看、可编辑、可拒绝、可回滚的长期资产，而不是只存在内存里。**

## 用户故事

作为长期依赖 Journal 管理个人知识资产的用户，
当一个 Agent Run 完成并产生结论、草稿或偏好时，
我希望系统自动生成 summary 和 memory/rule 候选，
以便有价值的结果能沉淀下来，同时我仍能审核、编辑、拒绝或回滚它们。

## 背景与失败模式

上一轮验收发现 `SedimentationService` 只生成内存 Map 记录，缺 summary Markdown、ChangeSet/Authorization 路径和 review/edit/reject/rollback API。

## 验收标准

### AC-1 — run 完成后生成 summary Markdown
- **Given** 一个 run 成功结束
- **When** sedimentation 执行
- **Then** daemon 在 `.journal/runs/<runId>/summary.md` 写入摘要
- **And** summary 路径可通过 memory/sedimentation 记录追溯

### AC-2 — memory/rule 记录可追溯
- **Given** run 输出包含偏好、项目事实、写作规则或工具规则
- **When** sedimentation 生成记录
- **Then** 每条记录包含 `sourceRunId`、`evidence`、`sourceArtifactIds` 或 `changeSetIds`

### AC-3 — 用户可 review/edit/reject/rollback
- **Given** run 已产生沉淀记录
- **When** 用户调用 review API
- **Then** 可列出、编辑、拒绝、恢复/回滚记录
- **And** 被拒绝记录不再作为 durable memory 注入下一次 run

### AC-4 — 沉淀写入受 AuthorizationMode/ChangeSet 约束
- **Given** 当前 run 是 `read_only`
- **When** sedimentation 尝试写 summary 或 memory 文件
- **Then** 返回结构化拒绝或 blocked ChangeSet
- **And** 不修改 workspace 文件

## 不做项

- 不做复杂向量记忆。
- 不做跨设备同步。
- 不自动删除用户已有笔记。

## 验收方式

- `pnpm --filter @journal/daemon test -- sediment`
- live run 后检查 `.journal/runs/<runId>/summary.md`
- `GET /runs/:id/memory`、`PATCH /memory/:id`、`POST /memory/:id/reject`、`POST /memory/:id/rollback`
