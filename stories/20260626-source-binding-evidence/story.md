---
id: STORY-20260626-source-binding-evidence
title: "Source Binding evidence chain (G6)"
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

# Source Binding evidence chain (G6)

> 一句话：**让 Agent Run 清楚记录读过哪些本地资料，形成 Sources → Run → Artifact/Memory 的证据链输入侧。**

## 用户故事

作为使用本地知识工作台整理资料的知识工作者，
当我让 Agent 读取本地文件、搜索材料并生成结论时，
我希望 Run 能显示它引用过哪些 source，
以便我回看结论时能追到依据，而不是只看到一段模型输出。

## 背景与失败模式

上一轮验收发现代码已有 `SourceBinding` 与捕获服务，但没有对应 approved child story，且 evidence 片段不足，导致 G6 不能被认证通过。

## 验收标准

### AC-1 — Run 可列出 source bindings
- **Given** 一个 run 产生了 read/search/tool_call 事件
- **When** 用户请求 `GET /runs/:id/sources`
- **Then** 返回该 run 的 source bindings
- **And** 每条包含 `runId`、`path`、`kind`、`createdAt`

### AC-2 — source binding 去重且忽略非文件工具
- **Given** 同一个 run 多次读取同一路径，或调用非文件工具
- **When** source capture 执行
- **Then** 同一路径不会重复记录
- **And** 非文件工具不会产生 source binding

### AC-3 — evidence chain 至少包含可展示证据
- **Given** 工具调用输入或结果中包含可用路径/片段
- **When** source binding 被记录
- **Then** binding 尽量填充 `excerpt` 或 `range`
- **And** 前端 Source section 能展示可读来源

## 不做项

- 不实现全文引用切片检索。
- 不做跨 workspace 的 source graph。
- 不把普通 artifact 反向推断为 source。

## 验收方式

- `pnpm --filter @journal/contracts test`
- `pnpm --filter @journal/daemon test -- sources`
- `curl GET /runs/:id/sources` live smoke
