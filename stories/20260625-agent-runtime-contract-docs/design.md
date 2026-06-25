# Agent Runtime 迁移契约文档落仓设计

日期：2026-06-25

对应 story：`stories/20260625-agent-runtime-contract-docs/story.md`

## 目标

把 handoff 外部目录中的迁移共识收进 `journal` 仓库，形成后续 coding agent 派发时可直接引用的契约。这个任务只处理文档契约，不修改业务代码。

## 输入来源

- `stories/20260625-ts-daemon-agent-runtime-migration/story.md`：umbrella 总契约。
- `handoff/tasks/design-draft.md`：迁移设计草稿。
- `handoff/docs/adr/2026-06-25-ts-daemon-agent-runtime-migration.md`：ADR 草稿。
- `handoff/docs/rust-removal-acceptance.md`：Rust 删除前验收清单草稿。
- `handoff/tasks/conflict-management.md`：冲突热点与派发顺序。
- `handoff/tasks/coding-agent-tasks.md`：后续 Claude 任务拆分。

## 输出文件

本 story 完成后应存在：

- `stories/20260625-agent-runtime-contract-docs/design.md`
- `stories/20260625-ts-daemon-agent-runtime-migration/story.md`：收缩为总契约，不直接承载业务代码
- `stories/20260625-runtime-client-protection/story.md`：首个代码型 child story
- `docs/adr/ts-daemon-agent-runtime-migration.md`
- `docs/adr/rust-removal-acceptance.md`

允许同步更新 handoff 账本，但不要求。

## 拆分后的任务边界

### Phase 0：契约文档

目标：把迁移边界、ADR、Rust 删除 gate 落仓。

允许修改：

- `stories/20260625-agent-runtime-contract-docs/**`
- `stories/20260625-ts-daemon-agent-runtime-migration/story.md`
- `stories/20260625-runtime-client-protection/story.md`
- `docs/adr/ts-daemon-agent-runtime-migration.md`
- `docs/adr/rust-removal-acceptance.md`
- handoff 账本

不允许修改：

- `src/**`
- `src-tauri/**`
- `package.json`
- workspace 配置
- 测试文件

### Phase 1：前端运行时保护层

对应 story：`stories/20260625-runtime-client-protection/story.md`

目标：新增 `JournalRuntimeClient`，让现有 Tauri invoke/listen 先被统一客户端包起来。默认路径仍走 Tauri，不接 HTTP daemon。

允许修改：

- `src/lib/runtimeClient.ts`
- `src/lib/tauri.ts`
- `src/hooks/useConversation.ts`
- 必要的前端测试

硬约束：

- `src/lib/tauri.ts` 对外导出的既有函数签名保持兼容。
- `useConversation` 不再直接 import `@tauri-apps/api/event`，但仍订阅同一个 `conversation-stream` 语义。
- 不新增 daemon，不改 Rust，不重写 `ChatPanel`。

### Phase 2：TypeScript daemon 骨架

目标：新增旁路 daemon，不接管生产默认路径。

建议目录：优先 `apps/daemon`，因为它接近 `open-design` 的结构，也便于未来与 desktop host 并列。

最小能力：

- `GET /health`
- `GET /workspace`
- `GET /events`
- SSE helper
- JSONL event log helper

约束：

- 使用跨平台 Node API。
- 不依赖 Apple Speech、Whisper、ffmpeg、系统 Trash 或平台专属二进制。
- 不改 Rust 默认启动路径。

### Phase 3：Coding Agent adapter registry

目标：先支持 Claude Code、Codex CLI、OpenCode 三家 CLI 的 detect/version/auth/run 基础骨架。

约束：

- adapter 只处理 CLI 差异，不承载产品 UI 语义。
- 统一输出 `AgentRunEvent`。
- Gemini、Cursor、ACP 等其它 CLI 不进入首批。

### Phase 4：AgentRun、ChangeSet、AuthorizationMode

目标：让高权限 Agent 的运行、文件变更和权限模式变成可审计的一等对象。

最小契约：

- `AgentRunEvent`
- `ChangeSet`
- `AuthorizationMode = wide_with_audit | read_only | workspace_write | full_access`
- 删除走项目内恢复路径或 run snapshot，不走系统 Trash。

### Phase 5：Workbench 数据接入与自动沉淀

目标：把 Run 面板从聊天流逐步升级为 Agent 工作现场，复用现有视觉优先级。

约束：

- 不重做 Run 面板视觉层级。
- 自动沉淀是 run lifecycle 的默认尾声，不是 UI 里的手动保存按钮。
- 沉淀记录必须带 source run、证据片段、ChangeSet 或 artifact id。

## 冲突热点

一次只允许一个 coding agent 修改：

- `src/lib/tauri.ts`
- `src/hooks/useConversation.ts`
- `src/components/ChatPanel.tsx`
- `src/types.ts`
- `src-tauri/src/conversation.rs`
- `src-tauri/src/llm/tool_loop.rs`
- 根 `package.json`
- workspace 配置

当前 Phase 0 不触碰这些文件。

## Claude 派发规则

每次只派一个目标，并在 prompt 中写明：

- 必读文件。
- 允许改动路径。
- 禁止改动路径。
- 需要运行或无法运行的验证。
- 不允许顺手重构。

Phase 1 示例 prompt：

```text
/goal 在 /Users/yanwu/Projects/github/journal 中阅读 AGENTS.md、stories/20260625-runtime-client-protection/story.md、docs/adr/ts-daemon-agent-runtime-migration.md、src/lib/tauri.ts、src/hooks/useConversation.ts。
实现前端运行时保护层。允许改动：src/lib/runtimeClient.ts、src/lib/tauri.ts、src/hooks/useConversation.ts、必要测试。
验收标准：1) 新增 JournalRuntimeClient/TauriRuntimeClient；2) src/lib/tauri.ts 对外函数签名保持兼容；3) useConversation 通过 runtime client 订阅 conversation-stream；4) 默认仍走 Tauri，不接 HTTP daemon；5) 不改 Rust、不改 ChatPanel 视觉、不改 package；6) 跑相关前端测试并报告结果。
```

## 验收

- `stories/20260625-agent-runtime-contract-docs/design.md` 存在。
- `docs/adr/ts-daemon-agent-runtime-migration.md` 存在。
- `docs/adr/rust-removal-acceptance.md` 存在。
- `stories/20260625-ts-daemon-agent-runtime-migration/story.md` 明确只作为总契约。
- `stories/20260625-runtime-client-protection/story.md` 存在，作为 Phase 1 child story。
- `git diff --name-only` 不包含 `src/`、`src-tauri/`、`package.json` 或测试文件。
- 不把 umbrella story 直接当作业务代码任务派发。
