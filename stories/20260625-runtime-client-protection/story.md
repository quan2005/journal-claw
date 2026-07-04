---
id: STORY-20260625-runtime-client-protection
title: '前端运行时保护层'
status: verified
source: gate
level: L2
hypothesis_basis: intuition
design: ./design.md
created: 2026-06-25
parent: ../20260625-ts-daemon-agent-runtime-migration/story.md
related:
  - stories/20260625-agent-runtime-contract-docs/story.md
  - docs/adr/ts-daemon-agent-runtime-migration.md
  - src/lib/tauri.ts
  - src/hooks/useConversation.ts
  - src/types.ts
---

# 前端运行时保护层

> 一句话概括：**为需要逐步迁移运行时的维护者，解决前端对 Tauri invoke/event 细节直接绑定、后续无法安全试点 TS daemon 的问题。**

## 用户故事（Connextra）

作为 **维护 Journal 本地知识 Agent 工作台运行时迁移的开发者**，
当我 **准备在不打断现有 Tauri 默认路径的情况下引入 TS daemon 旁路**，
我希望 **前端先通过统一 runtime client 使用 invoke 和事件订阅**，
以便 **后续可以替换底层运行时，而当前用户的对话、设置和文件操作行为保持不变**。

## 真实用户问题（背景，讲故事）

`src/lib/tauri.ts` 已经是前端到 Rust 的单一入口，但 `src/hooks/useConversation.ts` 仍直接从 Tauri event API 监听 `conversation-stream`。[证据：src/lib/tauri.ts；src/hooks/useConversation.ts] 如果直接接入 HTTP/SSE daemon，会让组件同时感知 Tauri 与 daemon 两套通道，后续迁移和回退都更难。

当前工作树里 `src/lib/tauri.ts` 和 `src/types.ts` 已有未提交改动，说明本任务必须小范围、单 agent、严禁顺手重构。[证据：git status]

### 现状失败模式

- **事件绑定外泄**：conversation hook 直接绑定 Tauri event name，后续 TS daemon SSE 接入会重复写一套订阅逻辑。
- **迁移缺少回退**：如果没有统一 runtime client，daemon 试点容易改坏默认 Tauri 路径。
- **冲突热点集中**：`src/lib/tauri.ts`、`src/hooks/useConversation.ts`、`src/types.ts` 是并发修改热点，必须独占派发。

## 成功标准（脊柱 Q4）

### 用户行为变化

做完后，维护者会：

- **先保护默认路径**：从组件直接关心 Tauri event，变成组件经由 runtime client 订阅事件。
- **安全开启后续试点**：从无法低风险接入 daemon，变成后续可增加 HttpRuntimeClient 而不重写组件 API。
- **保持用户体验不变**：从迁移第一步就可能影响对话，变成现有对话创建、发送、取消、重试和加载行为可继续工作。

假设依据：以上基于 handoff design 草稿和当前代码结构判断（intuition）。验证方式是前端测试和对 conversation hook 的导入/行为检查。

## 验收标准（Given-When-Then）

### AC-1 — 现有对话路径保持可用

- **Given** 用户仍在使用当前 Tauri/Rust 默认运行时
- **When** 用户创建会话、发送消息、取消或重试
- **Then** 前端行为和现有事件处理保持一致
- **And** 不要求启动 TS daemon

### AC-2 — 组件不再直接绑定 Tauri event 订阅

- **Given** 维护者需要后续接入 HTTP/SSE daemon
- **When** 检查 conversation hook 的事件订阅
- **Then** `useConversation` 通过统一 runtime client 订阅 `conversation-stream`
- **And** 底层默认实现仍走 Tauri

### AC-3 — 外部 API 不破坏

- **Given** 现有组件和 hooks 已经使用 `src/lib/tauri.ts` 的导出函数
- **When** 本 story 完成
- **Then** `src/lib/tauri.ts` 对外导出的既有函数签名保持兼容
- **And** 不引入 HTTP daemon 作为默认路径

### AC-4 — 小范围独占修改

- **Given** 运行时入口文件是冲突热点
- **When** Claude 执行本 story
- **Then** 允许修改范围限于 `src/lib/runtimeClient.ts`、`src/lib/tauri.ts`、`src/hooks/useConversation.ts` 和必要测试
- **And** 不修改 Rust 后端、不新增 daemon、不修改 `ChatPanel` 视觉和业务结构

## 三类边界（脊柱 Q5 · Won't · 输出闸必填）

- **不为哪些用户做**：不直接为最终用户新增功能；本 story 是迁移保护层。
- **不在哪些场景出现**：不启用 HTTP daemon 默认路径，不新增 TS daemon，不接入 CLI adapter。
- **不解决哪些相关但不同的问题**：不实现 AgentRunEvent、ChangeSet、AuthorizationMode、自动沉淀；不重写 ChatPanel；不删除 Rust。

## 交棒清单（移交 design.md 的实现层问题）

- [ ] `JournalRuntimeClient` 的具体接口如何放置和导出？
- [ ] Tauri event `listen` 的 async unlisten 如何包成统一 unsubscribe？
- [ ] 测试应覆盖 hook 订阅路径还是 runtime client wrapper？
- [ ] 如何避免格式化或重排现有 `src/lib/tauri.ts` 大文件？

## 待确认（意图层）

| #   | 问题                                                               | 当前默认值                  | 状态   |
| --- | ------------------------------------------------------------------ | --------------------------- | ------ |
| Q1  | Phase 1 是否只做 TauriRuntimeClient 包装，不接 HTTP daemon？       | 是                          | 已决策 |
| Q2  | 是否允许 Claude 独占修改 `src/lib/tauri.ts` 与 `useConversation`？ | 是，但只能在本 story 范围内 | 已决策 |

## INVEST 自检（输出闸记录）

- [x] **I** Independent：可在 ADR 后独立完成
- [x] **N** Negotiable：runtime client 接口可按现有导出微调
- [x] **V** Valuable：降低后续 daemon 试点风险
- [x] **E** Estimable：触点明确，默认路径不变
- [x] **S** Small：只处理前端运行时保护层
- [x] **T** Testable：可用前端测试和导入检查验证

## 门禁记录

| 轮次 | 日期       | Readiness | 主要缺口                                                       |
| ---- | ---------- | --------- | -------------------------------------------------------------- |
| 1    | 2026-06-25 | 可开发    | 用户要求拆小并分发落地；本 story 需等待契约文档/ADR 落仓后派发 |
