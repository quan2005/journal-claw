---
story: /Users/yanwu/Projects/github/journal/stories/20260625-ts-daemon-agent-runtime-migration/story.md
design: /Users/yanwu/Projects/github/journal/stories/20260625-ts-daemon-agent-runtime-migration/design.md
date: 2026-06-26
round: 1
result: fail
scope: git diff --name-only master...HEAD; git diff master...HEAD; apps/daemon/**; apps/web/src/components/AgentRunPanel.tsx; apps/web/src/hooks/useAgentRun.ts; apps/web/src/lib/agentRuns.ts; packages/contracts/**; docs/final-state.md; stories/20260625-*/story.md
---

# 验收报告：TypeScript daemon 与 Coding Agent Runtime 迁移

## 0. 取证范围与命令

本轮只依据契约与代码取证，不采用实现者说明。

- 意图契约：`stories/20260625-ts-daemon-agent-runtime-migration/story.md`
  - `status: approved`：`stories/20260625-ts-daemon-agent-runtime-migration/story.md:4`
  - frontmatter 声明 `design: ./design.md`：`stories/20260625-ts-daemon-agent-runtime-migration/story.md:8`
  - 总契约限制：“本 story 只作为总契约和迁移边界，不直接承载业务代码开发。实现必须拆到更小的 approved child stories 后再派发。”：`stories/20260625-ts-daemon-agent-runtime-migration/story.md:25`
- 方案契约核实命令：
  - `test -f stories/20260625-ts-daemon-agent-runtime-migration/design.md && sed -n '1,320p' stories/20260625-ts-daemon-agent-runtime-migration/design.md || echo 'DESIGN_MISSING'`
  - 输出：`DESIGN_MISSING`
- 目标文档：`docs/final-state.md`
  - 进展源以 story frontmatter 为准：`docs/final-state.md:297`
- 六字标准：已读取 `.agents/skills/verification-gate/references/six-criteria.md`，按不漏 / 不重 / 不偏 / 不倚 / 不多 / 不少核对。
- diff 范围命令：
  - `git diff --name-only master...HEAD`
  - `git diff master...HEAD`
  - `git diff --stat master...HEAD` 输出摘要：`621 files changed, 20282 insertions(+), 10956 deletions(-)`
- 关键测试命令：
  - `pnpm --filter @journal/contracts test`：通过，输出 `Test Files  4 passed (4)`、`Tests  16 passed (16)`
  - `pnpm --filter @journal/daemon test`：通过，输出 `Test Files  30 passed (30)`、`Tests  178 passed (178)`
  - `pnpm --filter @journal/contracts typecheck && pnpm --filter @journal/daemon typecheck && pnpm --filter @journal/web typecheck`：通过，三个包均执行 `tsc --noEmit`
  - `pnpm --filter @journal/web test -- src/tests/AgentRunPanel.test.tsx src/tests/httpRuntimeClient.test.ts src/tests/runtimeClient.test.ts src/tests/App.test.tsx src/hooks/useConversation.test.ts`：失败，输出 `Test Files  1 failed | 4 passed (5)`、`Tests  8 failed | 35 passed (43)`，失败均在 `src/tests/App.test.tsx`
- 补充现实检查命令：
  - `ls -la resources/views/ || ls -la *.html`：`resources/views/` 不存在，根目录存在 `visual-companion-explained.html`
  - `./qa-playwright-capture.sh http://localhost:8000 public/qa-screenshots`：输出 `zsh: no such file or directory: ./qa-playwright-capture.sh`
  - `ls -la public/qa-screenshots/ && cat public/qa-screenshots/test-results.json || true`：输出 `ls: public/qa-screenshots/: No such file or directory`

## 1. AC 核对

| AC   | 契约摘要                                                                                                                                                                            |                      结论 | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| AC-1 | 迁移保持本地优先、跨平台；默认路径不依赖 Apple Speech / Whisper / ffmpeg / 系统 Trash / 平台 API；覆盖能力不长期保留 Rust 并行实现。                                                |                      fail | 本地 daemon 绑定 loopback：`apps/daemon/src/server.ts:364`-`apps/daemon/src/server.ts:368`；但方案契约缺失，`story.md` 声明 `design: ./design.md`：`stories/20260625-ts-daemon-agent-runtime-migration/story.md:8`，核实命令输出 `DESIGN_MISSING`。Rust 删除退出条件尚未满足，ADR 明确任何 Rust-only 用户可见能力都会阻塞删除：`docs/adr/rust-removal-acceptance.md:37`。                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| AC-2 | Claude Code / Codex CLI / OpenCode 三类 CLI 只在 adapter 层存在差异；产品层看到统一 AgentRun event / ChangeSet / AuthorizationMode。Gemini、Cursor、ACP 不纳入首批。                |                      fail | 契约要求三类 CLI：`stories/20260625-ts-daemon-agent-runtime-migration/story.md:72`；目标 G11 要求 `Claude Code / Codex CLI / OpenCode`：`docs/final-state.md:173`-`docs/final-state.md:176`；ADR 第一批也列三者：`docs/adr/ts-daemon-agent-runtime-migration.md:128`-`docs/adr/ts-daemon-agent-runtime-migration.md:132`。代码 registry 只注册 `claudeAgentDef` 和 `codexAgentDef`：`apps/daemon/src/runtimes/registry.ts:9`-`apps/daemon/src/runtimes/registry.ts:12`。命令 `find apps/daemon/src/runtimes/defs -maxdepth 1 -type f -print                                                                                                                                                                                                                                                                                                    | sort`只列出`claude.ts`、`codex.ts` 与测试文件；`test -f apps/daemon/src/runtimes/defs/opencode.ts |                                                                                                                                                                                                                       | echo OPENCODE_DEF_MISSING`输出`OPENCODE_DEF_MISSING`。 |
| AC-3 | 默认 `wide_with_audit`；工具调用与文件变更可追踪、可审计；后续支持 read_only / workspace_write / full_access。                                                                      |          fail（含待裁决） | umbrella story 写明默认 `wide_with_audit`：`stories/20260625-ts-daemon-agent-runtime-migration/story.md:79`；ADR 也写 `wide_with_audit` 是迁移期默认：`docs/adr/ts-daemon-agent-runtime-migration.md:171`。实现默认是 `workspace_write`：`apps/daemon/src/runs/service.ts:62`、`apps/daemon/src/server.ts:175`-`apps/daemon/src/server.ts:179`、`apps/web/src/components/AgentRunPanel.tsx:37`；web 可选模式只含 `read_only / workspace_write / full_access`，缺 `wide_with_audit`：`apps/web/src/hooks/useAgentRun.ts:151`。实际 CLI 文件变更未接入 ChangeSet：`rg -n "recordChangeSet\\(                                                                                                                                                                                                                                                     | new ChangeSetService                                                                              | listChangeSets\\(" apps/daemon/src`显示`recordChangeSet`仅在 service 与测试中出现，server 只调用`listChangeSets`：`apps/daemon/src/server.ts:215`、`apps/daemon/src/server.ts:292`、`apps/daemon/src/server.ts:358`。 |
| AC-4 | Run 面板沿用现有视觉层级与 block 风格，聚焦结构化 run / status / ChangeSet，不做大改版。                                                                                            |                      fail | 结构化面板文件存在并显示 Timeline / Output / File changes / Sources / Artifacts / Memory：`apps/web/src/components/AgentRunPanel.tsx:101`-`apps/web/src/components/AgentRunPanel.tsx:160`。但 App 集成测试失败，无法证明入口真实可用；命令 `pnpm --filter @journal/web test -- src/tests/AgentRunPanel.test.tsx src/tests/httpRuntimeClient.test.ts src/tests/runtimeClient.test.ts src/tests/App.test.tsx src/hooks/useConversation.test.ts` 输出 `8 failed`，其中 G13 相关测试 `renders the Chat/Agent Run mode toggle and defaults to chat` 与 `switching to Agent Run renders the structured run surface` 超时，对应测试定义：`apps/web/src/tests/App.test.tsx:710`、`apps/web/src/tests/App.test.tsx:722`。                                                                                                                               |
| AC-5 | Rust 退出条件必须有独立 checklist，覆盖 host/runtime、API parity、AgentRun、3 CLI、ChangeSet、自动沉淀、数据迁移、测试、真实任务、rollback。                                        | pass（仅 checklist 存在） | 独立 checklist 文件存在并明确“不只是 daemon 能启动”：`docs/adr/rust-removal-acceptance.md:9`-`docs/adr/rust-removal-acceptance.md:15`；覆盖 host/runtime：`docs/adr/rust-removal-acceptance.md:41`-`docs/adr/rust-removal-acceptance.md:47`；API parity：`docs/adr/rust-removal-acceptance.md:55`-`docs/adr/rust-removal-acceptance.md:80`；三 CLI：`docs/adr/rust-removal-acceptance.md:98`-`docs/adr/rust-removal-acceptance.md:123`；自动沉淀：`docs/adr/rust-removal-acceptance.md:142`-`docs/adr/rust-removal-acceptance.md:160`；veto 清单：`docs/adr/rust-removal-acceptance.md:234`-`docs/adr/rust-removal-acceptance.md:247`。                                                                                                                                                                                                        |
| AC-6 | Run 结束后自动写 run summary Markdown、artifact index、memory/rule records；沉淀记录带 source run / evidence / ChangeSet 或 artifact id；用户可 review / edit / reject / rollback。 |                      fail | server 在 run 成功后调用 sediment 并追加 `sedimentation_recorded`：`apps/daemon/src/server.ts:199`-`apps/daemon/src/server.ts:218`；但 `SedimentService` 只在内存 Map 里生成 `MemoryRecord`，没有 Markdown 文件写入、没有 ChangeSet 写入、没有 review/edit/reject/rollback API：`apps/daemon/src/sediment/service.ts:36`-`apps/daemon/src/sediment/service.ts:81`。memory 路由只有 GET：`apps/daemon/src/server.ts:306`-`apps/daemon/src/server.ts:315`。`MemoryRecord` 类型只有 id/kind/text/evidence/sourceArtifactIds，没有 path/status/reject/revert 字段：`packages/contracts/src/memory.ts:19`-`packages/contracts/src/memory.ts:33`。ADR Gate F 明确要求 summary Markdown、sediment 走 ChangeSet/AuthorizationMode、可 review/edit/reject/revert：`docs/adr/rust-removal-acceptance.md:148`-`docs/adr/rust-removal-acceptance.md:153`。 |

## 2. final-state 目标核对

### 2.1 G1-G15

| 目标 | 目标文档声明                                                                                    |         结论 | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | ----------------------------------------------------------------------------------------------- | -----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1   | pnpm monorepo + daemon / contracts / web 拆包，现有测试脚本保持可用。                           | partial/fail | workspace 配置存在：`pnpm-workspace.yaml:1`-`pnpm-workspace.yaml:3`；root scripts 存在：`package.json:7`-`package.json:16`；但目标要求现有测试仍可用：`docs/final-state.md:115`-`docs/final-state.md:118`，当前 web 重点测试命令失败，输出 `Test Files 1 failed                                                                                                                                                                                                                                                                                                                                                                                                                                              | 4 passed`、`Tests 8 failed | 35 passed`。                                                                                                                                                                                               |
| G2   | TypeScript daemon skeleton：localhost HTTP/SSE、health/workspace/events、可启动可测试。         |         pass | daemon package scripts 存在：`apps/daemon/package.json:5`-`apps/daemon/package.json:12`；server health/workspace/events 路由：`apps/daemon/src/server.ts:89`-`apps/daemon/src/server.ts:153`；daemon 测试通过，命令输出 `Test Files 30 passed`、`Tests 178 passed`。                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| G3   | AgentRun contract：Run、Event、Step、status、类型守卫，供 web/daemon 共享。                     | partial/fail | contracts 定义 AgentRun：`packages/contracts/src/index.ts:32`-`packages/contracts/src/index.ts:45`；Event type：`packages/contracts/src/index.ts:50`-`packages/contracts/src/index.ts:72`；但 `isAgentRunEvent` 只校验 `type` 是 string，不校验枚举值：`packages/contracts/src/index.ts:110`-`packages/contracts/src/index.ts:119`。web 仍维护本地镜像而非直接复用 contracts，并注明“kept as a local mirror”：`apps/web/src/types/agentRun.ts:1`-`apps/web/src/types/agentRun.ts:5`；web `AgentRun` 缺 `parentRunId`，与 contracts `AgentRun` 不一致：`apps/web/src/types/agentRun.ts:25`-`apps/web/src/types/agentRun.ts:36` vs `packages/contracts/src/index.ts:32`-`packages/contracts/src/index.ts:42`。 |
| G4   | AgentRunService：创建 run、状态机、事件追加、订阅、取消、持久化事件流。                         | partial/fail | create/append/subscribe/listChildRuns 存在：`apps/daemon/src/runs/service.ts:53`-`apps/daemon/src/runs/service.ts:150`；JSONL store 存在：`apps/daemon/src/runs/store.ts:28`-`apps/daemon/src/runs/store.ts:58`。但 cancel 只改 run 状态：`apps/daemon/src/runs/service.ts:106`-`apps/daemon/src/runs/service.ts:114`；HTTP cancel 只调用 service：`apps/daemon/src/server.ts:279`-`apps/daemon/src/server.ts:288`；runner 虽支持 `AbortSignal`：`apps/daemon/src/runtimes/runner.ts:160`-`apps/daemon/src/runtimes/runner.ts:169`，server 调用 `executeRun` 未传 signal：`apps/daemon/src/server.ts:198`、`apps/daemon/src/server.ts:349`。                                                                 |
| G5   | HTTP RuntimeClient pilot：前端可在 Tauri runtime 与 HTTP daemon 间切换，至少订阅事件链路解耦。  |      partial | RuntimeClient 选择逻辑存在：`apps/web/src/lib/runtimeClient.ts:61`-`apps/web/src/lib/runtimeClient.ts:98`；HttpRuntimeClient `subscribe` 走 `/events`：`apps/web/src/lib/httpRuntimeClient.ts:70`-`apps/web/src/lib/httpRuntimeClient.ts:88`；`useConversation` 的订阅使用 runtime client：`apps/web/src/hooks/useConversation.ts:141`-`apps/web/src/hooks/useConversation.ts:148`。但 create/send/cancel 等仍直接从 Tauri helper 引入：`apps/web/src/hooks/useConversation.ts:5`-`apps/web/src/hooks/useConversation.ts:14`，只能证明事件链路 pilot，不能证明完整 runtime 替换。                                                                                                                            |
| G6   | SourceBinding：Run 可声明读过哪些 source/block/span，最终支持 evidence chain。                  | partial/fail | SourceBinding contract 存在：`packages/contracts/src/source.ts:12`-`packages/contracts/src/source.ts:27`；service 捕获 tool_call 生成 source binding：`apps/daemon/src/sources/service.ts:81`-`apps/daemon/src/sources/service.ts:114`。但没有对应 20260625 child story；命令 `find stories -maxdepth 2 -path 'stories/20260625-\*' -name 'story.md' -print                                                                                                                                                                                                                                                                                                                                                  | sort                       | sed 's#stories/20260625-##; s#/story.md##'`未列出 source-binding 类 story。service 未填`excerpt`：`apps/daemon/src/sources/service.ts:103`-`apps/daemon/src/sources/service.ts:109`，evidence chain 仍弱。 |
| G7   | ArtifactIndex：run 产物索引。                                                                   | pass/partial | Artifact contract：`packages/contracts/src/artifact.ts:21`-`packages/contracts/src/artifact.ts:49`；ArtifactIndexService 记录/list run artifacts：`apps/daemon/src/artifacts/index.ts:30`-`apps/daemon/src/artifacts/index.ts:67`；server 路由：`apps/daemon/src/server.ts:295`-`apps/daemon/src/server.ts:304`。但 artifact capture 依赖 `<artifact>` 标签扫描：`apps/daemon/src/artifacts/index.ts:75`-`apps/daemon/src/artifacts/index.ts:96`，不是通用 CLI 产物协议。                                                                                                                                                                                                                                    |
| G8   | ChangeSet：结构化记录 add/modify/remove/move。                                                  | partial/fail | ChangeSet contract：`packages/contracts/src/index.ts:84`-`packages/contracts/src/index.ts:106`；ChangeSetService 存在：`apps/daemon/src/changeset/service.ts:55`-`apps/daemon/src/changeset/service.ts:108`。但实际 runner/adapter 未把 CLI 文件变更接入 `recordChangeSet`；`rg -n "recordChangeSet\\(" apps/daemon/src` 只命中 service 与测试。                                                                                                                                                                                                                                                                                                                                                             |
| G9   | AuthorizationMode：read_only / workspace_write / full_access / wide_with_audit 约束 ChangeSet。 |         fail | AuthorizationMode 类型包含四种：`packages/contracts/src/index.ts:76`-`packages/contracts/src/index.ts:80`；daemon authorization helper 有路径判定：`apps/daemon/src/changeset/authorization.ts:30`-`apps/daemon/src/changeset/authorization.ts:52`。但 `ChangeSetService.recordChangeSet` 对 remove/move 会先 mutate 文件系统，再设置 blocked/applied 状态：`apps/daemon/src/changeset/service.ts:64`、`apps/daemon/src/changeset/service.ts:73`-`apps/daemon/src/changeset/service.ts:78`、`apps/daemon/src/changeset/service.ts:97`，read_only 下 remove/move 仍可能造成文件变更。                                                                                                                         |
| G10  | RuntimeAgentDef / registry：声明 agent 能力、命令、auth probe、availability。                   |      partial | RuntimeAgentDef 类型：`packages/contracts/src/runtime.ts:50`-`packages/contracts/src/runtime.ts:70`；registry 去重注册/list：`apps/daemon/src/runtimes/registry.ts:16`-`apps/daemon/src/runtimes/registry.ts:39`。但内置只有 Claude/Codex，无 OpenCode：`apps/daemon/src/runtimes/registry.ts:9`-`apps/daemon/src/runtimes/registry.ts:12`。                                                                                                                                                                                                                                                                                                                                                                 |
| G11  | Claude Code / Codex CLI / OpenCode 三个 adapters。                                              |         fail | Claude adapter 存在：`apps/daemon/src/runtimes/defs/claude.ts:20`-`apps/daemon/src/runtimes/defs/claude.ts:41`；Codex adapter 存在：`apps/daemon/src/runtimes/defs/codex.ts:24`-`apps/daemon/src/runtimes/defs/codex.ts:44`；OpenCode adapter 缺失，命令输出 `OPENCODE_DEF_MISSING`。Codex `authProbe` 使用空 args：`apps/daemon/src/runtimes/defs/codex.ts:29`，而 server `detectAuth` 直接执行 probe args 并尝试解析 JSON：`apps/daemon/src/server.ts:55`-`apps/daemon/src/server.ts:70`，无证据证明 Codex auth probe 可返回契约所需状态。                                                                                                                                                                 |
| G12  | Run timeline UI：右侧面板显示 run 状态、步骤、tool call、输出。                                 | partial/fail | AgentRunPanel 展示 Timeline / Output / tool call 文本：`apps/web/src/components/AgentRunPanel.tsx:101`-`apps/web/src/components/AgentRunPanel.tsx:117`；hook 处理 `tool_call/tool_result/text_delta/thinking_delta`：`apps/web/src/hooks/useAgentRun.ts:84`-`apps/web/src/hooks/useAgentRun.ts:135`。但 App 集成测试失败，无法证明真实入口可见：`apps/web/src/tests/App.test.tsx:710`、`apps/web/src/tests/App.test.tsx:722`，命令输出 `8 failed`。                                                                                                                                                                                                                                                          |
| G13  | ChangeSet preview UI：按文件展示 proposed/applied/reverted/blocked，进入原有详情或外部 diff。   | partial/fail | File changes 区域存在：`apps/web/src/components/AgentRunPanel.tsx:119`-`apps/web/src/components/AgentRunPanel.tsx:128`。但无外部 diff / 详情入口证据；App 集成测试失败，G13 相关测试超时：`apps/web/src/tests/App.test.tsx:710`、`apps/web/src/tests/App.test.tsx:722`。                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| G14  | Auto-sedimentation：run 完成后生成 memory/rule 候选，带来源和证据，可接受/拒绝。                |         fail | `SedimentService` 会生成 memory：`apps/daemon/src/sediment/service.ts:44`-`apps/daemon/src/sediment/service.ts:81`；但无 approved child story，且无 accept/reject/edit/rollback API，server memory 路由只有 GET：`apps/daemon/src/server.ts:306`-`apps/daemon/src/server.ts:315`。ADR 要求 review/edit/reject/revert：`docs/adr/rust-removal-acceptance.md:151`-`docs/adr/rust-removal-acceptance.md:153`。                                                                                                                                                                                                                                                                                                  |
| G15  | workspace metadata：workspace goals/profile/default agent prefs；切 workspace 切换上下文。      | partial/fail | WorkspaceMeta contract：`packages/contracts/src/workspace.ts:12`-`packages/contracts/src/workspace.ts:26`；WorkspaceService 持久化 `.journal/workspace.json`：`apps/daemon/src/workspace/service.ts:1`-`apps/daemon/src/workspace/service.ts:17`；server meta/goals/sources 路由：`apps/daemon/src/server.ts:100`-`apps/daemon/src/server.ts:135`。但无 approved child story；目标要求切 workspace 切换上下文：`docs/final-state.md:199`-`docs/final-state.md:202`，代码未见 workspace 切换验证或测试证据。                                                                                                                                                                                                  |

### 2.2 五个一等对象

- Workspace：partial。contract 与 service 存在：`packages/contracts/src/workspace.ts:12`-`packages/contracts/src/workspace.ts:26`、`apps/daemon/src/workspace/service.ts:23`-`apps/daemon/src/workspace/service.ts:67`；但缺 workspace 切换验收证据。
- Sources：partial。contract 与 capture service 存在：`packages/contracts/src/source.ts:12`-`packages/contracts/src/source.ts:27`、`apps/daemon/src/sources/service.ts:81`-`apps/daemon/src/sources/service.ts:114`；但无 source-binding child story，evidence chain 不完整。
- Artifacts：partial/pass。contract、service、routes 存在：`packages/contracts/src/artifact.ts:21`-`packages/contracts/src/artifact.ts:49`、`apps/daemon/src/artifacts/index.ts:30`-`apps/daemon/src/artifacts/index.ts:67`、`apps/daemon/src/server.ts:295`-`apps/daemon/src/server.ts:304`。
- Runs：partial。AgentRunService 与 event store 存在：`apps/daemon/src/runs/service.ts:53`-`apps/daemon/src/runs/service.ts:150`、`apps/daemon/src/runs/store.ts:28`-`apps/daemon/src/runs/store.ts:58`；cancel 未真正中止 runner。
- Rules/Memory：fail/partial。MemoryRecord 存在：`packages/contracts/src/memory.ts:19`-`packages/contracts/src/memory.ts:33`；sediment 只生成内存记录：`apps/daemon/src/sediment/service.ts:36`-`apps/daemon/src/sediment/service.ts:81`，无规则记录、无 Markdown、无 review/edit/reject/rollback。

### 2.3 核心循环

目标循环是 sources → run → artifacts → auto sediment → rules/memory → 下次 run 自动带上下文：`docs/final-state.md:23`-`docs/final-state.md:27`。

结论：fail/partial。

证据：

- context assembly 能带 workspace goals、active sources、durable memory：`apps/daemon/src/context/assemble.ts:18`-`apps/daemon/src/context/assemble.ts:54`。
- server 启动 run 后会 capture artifacts/source bindings/list changesets/sediment：`apps/daemon/src/server.ts:199`-`apps/daemon/src/server.ts:218`。
- 但 ChangeSet 未接入真实 CLI 文件变更，`recordChangeSet` 只在 service 与测试中出现；sediment 不写 Markdown、不走 ChangeSet、不提供接受/拒绝；因此核心循环不是完整可审计闭环。

### 2.4 多 Agent 能力

目标文档声称 context assembly + multi-agent delegation 已具备本地多 Agent 工作空间雏形：`docs/final-state.md:511`-`docs/final-state.md:542`。

结论：fail/partial。

证据：

- child run route 存在：`apps/daemon/src/server.ts:322`-`apps/daemon/src/server.ts:362`。
- `AgentRun` contract 支持 `parentRunId`：`packages/contracts/src/index.ts:41`-`packages/contracts/src/index.ts:42`。
- 但 registry 只有 Claude/Codex：`apps/daemon/src/runtimes/registry.ts:9`-`apps/daemon/src/runtimes/registry.ts:12`；OpenCode 缺失。web 本地 `AgentRun` 类型缺 `parentRunId`：`apps/web/src/types/agentRun.ts:25`-`apps/web/src/types/agentRun.ts:36`。没有 20260625 multi-agent child story；命令列出的 child stories 不含 multi-agent。

## 3. 六字标准核对

### 3.1 不漏

结论：fail。

- AC-2/G11 漏 OpenCode adapter。证据同 AC-2。
- AC-6/G14 漏 run summary Markdown、沉淀 review/edit/reject/rollback。证据同 AC-6。
- G6/G14/G15/multi-agent 没有对应 approved child story。命令 `find stories -maxdepth 2 -path 'stories/20260625-*' -name 'story.md' -print | sort | sed 's#stories/20260625-##; s#/story.md##'` 输出仅包含：`agent-run-panel-integration`、`agent-run-service`、`agent-runtime-contract-docs`、`artifact-index`、`changeset-authorization`、`coding-agent-adapters`、`http-runtime-client-pilot`、`monorepo-daemon-skeleton`、`runtime-client-protection`、`ts-daemon-agent-runtime-migration`。

### 3.2 不重

结论：fail。

- web 没有直接复用 `packages/contracts` 的 AgentRun 类型，而是维护本地镜像：`apps/web/src/types/agentRun.ts:1`-`apps/web/src/types/agentRun.ts:5`。
- 本地镜像已经与 contracts drift：contracts `AgentRun` 有 `parentRunId`：`packages/contracts/src/index.ts:41`-`packages/contracts/src/index.ts:42`；web `AgentRun` 无该字段：`apps/web/src/types/agentRun.ts:25`-`apps/web/src/types/agentRun.ts:36`。

### 3.3 不偏

结论：fail。

- umbrella 与 ADR 要求默认 `wide_with_audit`：`stories/20260625-ts-daemon-agent-runtime-migration/story.md:79`、`docs/adr/ts-daemon-agent-runtime-migration.md:171`；实现偏为 `workspace_write`：`apps/daemon/src/runs/service.ts:62`、`apps/daemon/src/server.ts:178`、`apps/web/src/components/AgentRunPanel.tsx:37`。
- story 要求产品层统一看到 AgentRun event / ChangeSet / AuthorizationMode：`stories/20260625-ts-daemon-agent-runtime-migration/story.md:72`-`stories/20260625-ts-daemon-agent-runtime-migration/story.md:73`；实现中的 ChangeSet 还没有接入真实 CLI 变更。

### 3.4 不倚

结论：fail。

- 不能只凭 `docs/final-state.md` 的“已落地”声明判定通过，因为该文档自己声明进展源以 story frontmatter 为准：`docs/final-state.md:297`。
- 当前多个相关 child stories 仍为 `approved` 而非 `verified`。命令 `find stories -maxdepth 2 -path 'stories/20260625-*/story.md' -print | sort | xargs -I{} sh -c 'printf "%s " "{}"; grep -m1 "^status:" "{}" || true'` 输出包括 `stories/20260625-agent-run-service/story.md status: approved`、`stories/20260625-coding-agent-adapters/story.md status: approved`、`stories/20260625-http-runtime-client-pilot/story.md status: approved`、`stories/20260625-changeset-authorization/story.md status: approved`、`stories/20260625-artifact-index/story.md status: approved`、`stories/20260625-agent-run-panel-integration/story.md status: approved`。

### 3.5 不多

结论：fail。

- umbrella story 明确“不直接承载业务代码开发，必须拆到更小的 approved child stories”：`stories/20260625-ts-daemon-agent-runtime-migration/story.md:25`。
- diff 范围远超已批准 child story 可覆盖内容。命令 `git diff --name-only master...HEAD | awk 'BEGIN{FS="/"} { if ($1=="apps" || $1=="packages" || $1=="stories" || $1=="docs") print $1"/"$2; else print $1 }' | sort | uniq -c` 输出包括 `491 apps/web`、`35 apps/daemon`、`11 packages/contracts`，并包含 `.agents`、`.claude`、`.codex`、`.od-skills`、多个 `stories/20260616-*` 等非本 story 重点范围条目。
- G6/G14/G15/multi-agent 实现迹象存在，但无相应 20260625 child story 覆盖，按契约属于越界风险。

### 3.6 不少

结论：fail。

- 三 CLI 不少未达成：OpenCode 缺失。
- 自动沉淀不少未达成：缺 Markdown、ChangeSet、review/edit/reject/rollback。
- Run panel 集成不少未达成：App 测试中 Agent Run toggle 和面板入口相关测试失败。

## 4. 方案落实

结论：fail。

方案契约缺失。`story.md` frontmatter 声明 `design: ./design.md`：`stories/20260625-ts-daemon-agent-runtime-migration/story.md:8`，但核实命令输出 `DESIGN_MISSING`。本报告不能用 ADR 或 `docs/final-state.md` 自行补全缺失的 design 契约，只能记录缺失。

## 5. 越界检查

结论：fail。

- umbrella story 约束实现必须拆到 approved child stories：`stories/20260625-ts-daemon-agent-runtime-migration/story.md:25`。
- 当前 diff 包含大量非本验收重点文件与较早 story 目录，命令输出显示 `491 apps/web`、`.agents`、`.claude`、`.codex`、`.od-skills`、多个 `stories/20260616-*` 等。
- G6/G14/G15/multi-agent 没有对应 child story，但代码与 final-state 已出现相关实现/声明，不能按本契约直接认证通过。

## 6. 冗余与一致性

结论：fail。

- web AgentRun 类型镜像重复且已 drift：`apps/web/src/types/agentRun.ts:1`-`apps/web/src/types/agentRun.ts:5`、`apps/web/src/types/agentRun.ts:25`-`apps/web/src/types/agentRun.ts:36`、`packages/contracts/src/index.ts:32`-`packages/contracts/src/index.ts:42`。
- AgentRunEvent 契约与 ADR 不完全一致。ADR 最小事件集包含 `step_finished`：`docs/adr/ts-daemon-agent-runtime-migration.md:96`-`docs/adr/ts-daemon-agent-runtime-migration.md:109`；contracts 的 `AgentRunEventType` 未包含 `step_finished`，但增加了 `thinking_delta`、`change_proposed`、`artifact_created`、`sedimentation_started`、`sedimentation_recorded`：`packages/contracts/src/index.ts:50`-`packages/contracts/src/index.ts:63`。
- `isAgentRunEvent` 类型守卫过宽，只校验 `type` 为 string：`packages/contracts/src/index.ts:110`-`packages/contracts/src/index.ts:119`，无法防止 drift。

## 7. 待用户裁决

1. AuthorizationMode 默认值冲突。
   - 证据 A：umbrella story 要求默认 `wide_with_audit`：`stories/20260625-ts-daemon-agent-runtime-migration/story.md:79`；ADR 也写迁移期默认 `wide_with_audit`：`docs/adr/ts-daemon-agent-runtime-migration.md:171`。
   - 证据 B：child story / final-state 方向偏向 `workspace_write`。changeset story 写默认 `workspace_write`：`stories/20260625-changeset-authorization/story.md:34`；final-state G8/G9 段落写 `workspace_write` 是更保守默认：`docs/final-state.md:370`。
   - 当前实现：daemon/service/server/panel 默认均为 `workspace_write`：`apps/daemon/src/runs/service.ts:62`、`apps/daemon/src/server.ts:178`、`apps/web/src/components/AgentRunPanel.tsx:37`。
   - 若以 umbrella/ADR 为准，需改实现与 UI，补 `wide_with_audit` 入口和测试。
   - 若以 child story/final-state 为准，需更新 umbrella story/ADR，避免上层契约继续要求 `wide_with_audit`。
   - 保守结论：在契约未统一前，此项按 fail 计。

## 8. 结论

result: fail

fail 项数：12

待裁决项数：1

必须修复或澄清后再进入下一轮验收：

1. 补齐或明确缺失的 `design.md` 方案契约。
2. 统一 AuthorizationMode 默认值契约。
3. 补齐 OpenCode adapter，并证明三 CLI registry / auth probe / parser 可用。
4. 将真实 CLI 文件变更接入 ChangeSet，修复 read_only 下 remove/move 仍会 mutate 的问题。
5. 修复 App 级 Agent Run 面板集成测试失败。
6. 将自动沉淀补到契约要求的 summary Markdown、artifact/memory/rule evidence、ChangeSet/Authorization、review/edit/reject/rollback。
7. 处理 web 本地 AgentRun 类型与 contracts 的重复和 drift。
8. 对 G6/G14/G15/multi-agent 补 approved child stories 或移出本次验收范围。
