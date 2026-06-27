---
id: STORY-20260626-workspace-context-boundary
title: "Workspace context boundary (G15)"
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

# Workspace context boundary (G15)

> 一句话：**把 workspace 从一个文件夹路径升级为带目标、来源和偏好的上下文边界，并在 Agent Run 前组装进 prompt。**

## 用户故事

作为同时处理多个项目/专题的知识工作者，
当我切换或配置当前 workspace 时，
我希望 Agent 明白当前工作的名称、目标、活跃资料和长期记忆，
以便每次 run 都从正确上下文开始，而不是只知道一个目录路径。

## 背景与失败模式

上一轮验收发现已有 `WorkspaceMeta` 和 `WorkspaceService`，但缺 approved child story，也缺“切换 workspace 切换上下文”的验收证据。

## 验收标准

### AC-1 — workspace metadata 可持久化
- **Given** 用户设置 workspace name/type/goals/activeSources
- **When** daemon 重启或再次读取 metadata
- **Then** `GET /workspace/meta` 返回一致内容

### AC-2 — Run 前组装 workspace 上下文
- **Given** workspace 有 goals、activeSources 和 durable memory
- **When** 用户创建 run
- **Then** agent prompt 中包含 workspace metadata 和可用 memory

### AC-3 — activeSources 可更新并影响下一次 run
- **Given** 用户新增或移除 active source
- **When** 下一次 run 创建
- **Then** prompt 中的 source context 与最新 workspace metadata 一致

## 不做项

- 不实现多 workspace UI。
- 不做云同步。
- 不迁移现有 Rust workspace 设置存储。

## 验收方式

- `pnpm --filter @journal/daemon test -- workspace context`
- live smoke：`PUT /workspace/meta` 后 `POST /runs`，检查 run prompt/事件证据
