# TypeScript daemon 与 Coding Agent Runtime 迁移设计

日期：2026-06-26

对应 story：`stories/20260625-ts-daemon-agent-runtime-migration/story.md`

## 目标

本 design 是 umbrella story 的方案契约。它不直接授权大块业务代码开发，而是把迁移拆成可独立验收的 child story，并明确验收失败项的收口顺序。

## 设计边界

- 运行时仍为本地优先：daemon 监听 loopback，默认不引入云端执行路径。
- 前端默认路径仍可回退到 Tauri/Rust，TS daemon 在覆盖验收前不删除 Rust 后端。
- Coding Agent 差异只落在 adapter 层；产品层只面对 `AgentRunEvent`、`ChangeSet`、`AuthorizationMode`、`Artifact`、`SourceBinding`、`MemoryRecord`。
- 首批 adapter 必须覆盖 Claude Code、Codex CLI、OpenCode。
- 授权默认值统一为 `workspace_write`，因为它比 `wide_with_audit` 更保守；`wide_with_audit` 保留为显式审计/迁移模式。

## Child Story 映射

| G           | Story                                              | 范围                                           |
| ----------- | -------------------------------------------------- | ---------------------------------------------- |
| G1-G3       | `../20260625-monorepo-daemon-skeleton/story.md`    | monorepo、daemon 骨架、基础 contracts          |
| G4          | `../20260625-agent-run-service/story.md`           | AgentRunService、JSONL、SSE、cancel            |
| G5          | `../20260625-http-runtime-client-pilot/story.md`   | HttpRuntimeClient 与前端运行时试点             |
| G6          | `../20260626-source-binding-evidence/story.md`     | SourceBinding 与证据链                         |
| G7          | `../20260625-artifact-index/story.md`              | Artifact index                                 |
| G8-G9       | `../20260625-changeset-authorization/story.md`     | ChangeSet 与 AuthorizationMode                 |
| G10-G11     | `../20260625-coding-agent-adapters/story.md`       | RuntimeAgentDef registry 与三家 adapter        |
| G12-G13     | `../20260625-agent-run-panel-integration/story.md` | Agent Run panel 与右侧入口                     |
| G14         | `../20260626-run-sedimentation-review/story.md`    | 自动沉淀、summary、review/edit/reject/rollback |
| G15         | `../20260626-workspace-context-boundary/story.md`  | Workspace metadata 与上下文组装                |
| Multi-agent | `../20260626-multi-agent-delegation/story.md`      | parent/child run 与子任务委托                  |

## 验收失败项收口

1. 契约缺口：补齐本文件、G6/G14/G15/multi-agent child stories，并让 child stories 处于 `status: approved`。
2. 授权默认值冲突：story / ADR / final-state / 实现统一为默认 `workspace_write`，保留 `wide_with_audit` 可选模式。
3. 三家 CLI：补齐 OpenCode adapter 与 JSON stream parser；Codex auth probe 使用真实 `login status`。
4. ChangeSet 安全：`read_only` 在任何文件 mutation 前拒绝；真实 run 后至少能捕获 workspace diff 并生成 ChangeSet。
5. 自动沉淀：run 完成后生成 summary Markdown 与 memory/rule 记录，并提供 review/edit/reject/rollback API。
6. 前端一致性：Agent Run panel 复用 contracts 类型，App 级入口测试可稳定通过。

## 不做项

- 不在本轮删除 Rust 后端。
- 不把 HTTP daemon 设为用户默认生产路径。
- 不新增首批三家以外的 Coding Agent CLI。
- 不重做 Run 面板视觉优先级，只修复数据接入、类型一致性和入口可用性。

## 验证矩阵

- `pnpm --filter @journal/contracts typecheck && pnpm --filter @journal/contracts test`
- `pnpm --filter @journal/daemon typecheck && pnpm --filter @journal/daemon test`
- `pnpm --filter @journal/web typecheck`
- Agent Run 聚焦测试：`pnpm --filter @journal/web test -- src/tests/AgentRunPanel.test.tsx src/tests/App.test.tsx src/tests/httpRuntimeClient.test.ts src/tests/runtimeClient.test.ts src/hooks/useConversation.test.ts`
- daemon live smoke：`GET /health`、`GET /agents`、`POST /runs`、`GET /runs/:id/events`、`GET /runs/:id/changesets`、`GET /runs/:id/memory`、`GET /runs/:id/sources`
