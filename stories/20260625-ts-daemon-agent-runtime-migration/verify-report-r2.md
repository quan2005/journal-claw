---
story: /Users/yanwu/Projects/github/journal/stories/20260625-ts-daemon-agent-runtime-migration/story.md
design: /Users/yanwu/Projects/github/journal/stories/20260625-ts-daemon-agent-runtime-migration/design.md
date: 2026-06-26
round: 2
result: fail
scope: git status --short; git diff HEAD -- .; untracked files（apps/daemon/src/runtimes/defs/opencode.ts, apps/daemon/src/runtimes/stream/opencodeStream.ts, apps/daemon/src/workspace/context-assembly.test.ts, stories/20260626-{source-binding-evidence,run-sedimentation-review,workspace-context-boundary,multi-agent-delegation}/, design.md）。重点核对 verify-report.md（round 1）的 8 条 fail 项。
---

# 验收报告 R2 — TypeScript daemon 与 Coding Agent Runtime 迁移

> 本轮为 round 2。先核对 round 1 的 fail 项是否修复，并复查修复是否引入新越界。结论只能来自契约与代码。

## 0. 取证范围与命令

- 意图契约：`stories/20260625-ts-daemon-agent-runtime-migration/story.md`（`status: approved`，frontmatter `design: ./design.md`）。
- 方案契约：`stories/20260625-ts-daemon-agent-runtime-migration/design.md`（本轮 **新建，已存在**，`status` 由 round 1 的 `DESIGN_MISSING` → 现存 57 行）。
- diff 范围命令（本轮以工作区 vs HEAD 为准）：
  - `git status --short`：23 modified + 13 untracked，共 36 项；`git diff --stat HEAD -- . | tail -1` → `23 files changed, 1672 insertions(+), 262 deletions(-)`。
- 测试命令（本轮实跑）：
  - `pnpm --filter @journal/contracts typecheck && pnpm --filter @journal/contracts test` → 通过，`Test Files 4 passed (4)`、`Tests 20 passed (20)`（round 1 为 16）。
  - `pnpm --filter @journal/daemon typecheck` → 通过；`pnpm --filter @journal/daemon test` → 通过，`Test Files 36 passed (36)`、`Tests 262 passed (262)`（round 1 为 178）。
  - `pnpm --filter @journal/web typecheck` → 通过。
  - `pnpm --filter @journal/web test -- src/tests/AgentRunPanel.test.tsx src/tests/httpRuntimeClient.test.ts src/tests/runtimeClient.test.ts src/tests/App.test.tsx src/hooks/useConversation.test.ts` → **`Test Files 1 failed | 4 passed (5)`、`Tests 2 failed | 45 passed (47)`**（round 1 为 8 failed）。2 个失败均在 `src/tests/App.test.tsx`：`places sidebar collapse controls on the panel dividers`、`preserves readable detail width by closing sidebars at narrow window sizes`。
- 六字标准：已读 `.agents/skills/verification-gate/references/six-criteria.md`，逐项核对。

## 1. Round 1 fail 项修复核对

| # | Round 1 fail | 本轮结论 | 证据 |
|---|---|---:|---|
| 1 | `design.md` 缺失（DESIGN_MISSING） | **fixed** | `test -f stories/20260625-ts-daemon-agent-runtime-migration/design.md` 存在；内容 57 行，含设计边界、Child Story 映射（G1–G15 + multi-agent）、验收失败项收口、验证矩阵、不做项。`stories/20260625-ts-daemon-agent-runtime-migration/story.md:8` 声明的 `design: ./design.md` 已兑现。 |
| 2 | OpenCode adapter 缺失（AC-2/G11） | **fixed** | `apps/daemon/src/runtimes/defs/opencode.ts:9`-`opencode.ts:36`（`opencodeAgentDef`，`run --format json`、`promptViaStdin`、`streamFormat: 'opencode-json'`）；stream parser `apps/daemon/src/runtimes/stream/opencodeStream.ts:46`-`opencodeStream.ts:162`（step_start/text/tool_use/step_finish/finish/error → AgentRunEvent，含 `step_finished` `opencodeStream.ts:134`）；registry 注册三家 `apps/daemon/src/runtimes/registry.ts:13`；测试 `apps/daemon/src/runtimes/defs/opencode.test.ts:1`-`opencode.test.ts:29` 通过（含入 262 daemon tests）。 |
| 3 | Codex authProbe 空 args | **fixed** | `apps/daemon/src/runtimes/defs/codex.ts:36` → `authProbe: { args: ['login', 'status'], timeoutMs: 5000 }`（round 1 为空 args）；与 `server.ts:55`-`server.ts:70` 的 `detectAuth`（解析 `loggedIn/authMethod/apiProvider`）匹配。 |
| 4 | ChangeSet 未接入真实 CLI 变更（G8） | **fixed** | `apps/daemon/src/server.ts:226` 运行前 `snapshotWorkspace()`；`server.ts:242`-`server.ts:248` 运行后 `captureSnapshotDiff(before, after, mode)`；`apps/daemon/src/changeset/service.ts:184`-`service.ts:264` 实现快照 diff（create/edit/remove）并逐条 `recordChangeSet`。不拦截 CLI 内部、只观测 workspace 边界净效果。 |
| 5 | `read_only` 下 remove/move 仍 mutate（G9） | **fixed** | `apps/daemon/src/changeset/service.ts:85`-`service.ts:108`：`if (!decision.allowed)` 在 **任何 fs mutation 之前** 返回 `status: 'blocked'` 记录，不 stash、不 rename、不写盘。`isPathAllowed` 判定在 `service.ts:77` 先于所有副作用。 |
| 6 | App 级 Agent Run 面板集成测试失败（G12/G13） | **partial（核心 fixed，2 项无关残留）** | round 1 失败的 G13 测试 `renders the Chat/Agent Run mode toggle`、`switching to Agent Run renders the structured run surface` 本轮 **通过**（`pnpm --filter @journal/web test -- src/tests/App.test.tsx` 输出 17 tests 中仅 2 failed，且这 2 项与 Agent Run 无关，见下文待裁决 B）。AgentRunPanel.test 全通过。 |
| 7 | 自动沉淀不完整（AC-6/G14，缺 Markdown / review-edit-reject-rollback） | **daemon 侧 fixed，前端侧未接入** | daemon：`apps/daemon/src/sediment/service.ts:180`-`service.ts:191` 写 `<workspace>/.journal/runs/<runId>/summary.md`；`MemoryRecord` 增 `changeSetIds/path/status(MemoryRecordStatus)/updatedAt`（`packages/contracts/src/memory.ts:42`-`memory.ts:49`）；review lifecycle `editRecord/rejectRecord/restoreRecord`（`sediment/service.ts:120`-`service.ts:146`）；server 路由 `GET/PATCH /memory/:id`、`POST /memory/:id/reject`、`POST /memory/:id/restore`、`POST /runs/:id/changesets/:csId/revert`（`apps/daemon/src/server.ts:417`-`server.ts:469`）；rejected 记录被 `assembleContext` 排除（`apps/daemon/src/context/assemble.ts:45`）。**前端：** `apps/web/src/lib/agentRuns.ts:81` 仅 `GET /runs/:id/memory`，无 edit/reject/restore/revert 调用；`AgentRunPanel.tsx:166`-`AgentRunPanel.tsx:172` 仅静态渲染 Memory 列表，无 review UI；web `MemoryRecord` 类型仍缺 `changeSetIds/path/status/updatedAt`（见 fail-2）。 |
| 8 | web `AgentRun` 类型缺 `parentRunId`（不重 drift） | **fixed（部分）** | `apps/web/src/types/agentRun.ts:47` 补 `parentRunId?: string`，与 `packages/contracts/src/index.ts:42` 对齐；`AgentStep.parentStepId` 同步补齐（`agentRun.ts:33`）。**残留：** web `MemoryRecord`（`apps/web/src/types/agentRun.ts:124`-`agentRun.ts:133`）仍缺 `changeSetIds / path / status / updatedAt`，与 `packages/contracts/src/memory.ts:42`-`memory.ts:49` drift。该文件头注释自称追踪 MemoryRecord parity（`agentRun.ts:13`），实际未同步。 |

### 附带修复（round 1 六字标准项）

| 项 | 结论 | 证据 |
|---|---|---|
| `isAgentRunEvent` 类型守卫过宽 | **fixed** | `packages/contracts/src/index.ts:75`-`index.ts:89` 显式 `AGENT_RUN_EVENT_TYPES` allow-list；`index.ts:138`-`index.ts:149` 守卫增 `AGENT_RUN_EVENT_TYPE_SET.has(v.type)`；测试 `packages/contracts/src/index.test.ts:22`-`index.test.ts:49` 验证 unknown type 被拒。 |
| contracts 缺 `step_finished`（与 ADR 不一致） | **fixed** | `packages/contracts/src/index.ts:53`、`index.ts:78`；opencode stream 发射 `step_finished`（`opencodeStream.ts:134`）。 |
| cancel 未真正中止 runner（G4） | **fixed** | `apps/daemon/src/server.ts:229`-`server.ts:234` 每 run 一个 `AbortController`，`{ signal }` 传入 `executeRun`；cancel 路由 `server.ts:365`-`server.ts:373` 调 `controller.abort()`；`apps/daemon/src/runtimes/runner.ts:205`-`runner.ts:214` `signal.addEventListener('abort')` → `child.kill('SIGTERM')`。 |
| G6/G14/G15/multi-agent 无 approved child story（不漏/不多） | **fixed** | 4 个 child story 均新建且 `status: approved`：`stories/20260626-source-binding-evidence`、`stories/20260626-run-sedimentation-review`、`stories/20260626-workspace-context-boundary`、`stories/20260626-multi-agent-delegation`，与 `design.md:21`-`design.md:33` Child Story 映射一一对应。 |
| rejected 记录是否排除出 durable context | **fixed** | `apps/daemon/src/context/assemble.ts:45` 增 `&& m.status !== 'rejected'`；`sediment/service.ts:168`-`service.ts:172` `listDurable()` 排除 rejected 与 note。 |

## 2. AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

> umbrella story 自我声明「只作为总契约和迁移边界，不直接承载业务代码开发。实现必须拆到更小的 approved child stories 后再派发」（`story.md:25`）。因此 AC 既描述迁移终态，也以「是否已拆解到 approved child story + 边界 + 退出条件」为 umbrella 层验收点。

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 本地优先 / 多平台 / 平台专属 API 不入默认路径 | **pass（umbrella 层）** | daemon 绑 loopback：`apps/daemon/src/server.ts:532` `app.listen(opts.port, '127.0.0.1', ...)`；snapshot/changeset/sediment 全用 Node 跨平台 API（`node:fs`/`node:crypto`/`node:child_process`），未见 Apple Speech/Whisper/ffmpeg/系统 Trash 引用；Rust 删除退出条件 ADR 存在（`docs/adr/rust-removal-acceptance.md`，round 1 已 pass）。 |
| AC-2 三家 CLI 收敛到 adapter；产品层只看统一 AgentRun event / ChangeSet / AuthorizationMode | **pass（umbrella 层）** | 三家 def + parser 全齐（见 R1#2）；产品层契约统一：`AgentRunEvent`/`ChangeSet`/`AuthorizationMode` 在 `packages/contracts/src/index.ts`；`coding-agent-adapters` child story 已扩到三家（`stories/20260625-coding-agent-adapters/story.md:1`-`story.md:46`，AC-2/AC-6 改为 claude+codex+opencode）。 |
| AC-3 授权策略符合用户取向 | **见待裁决 A** | 契约层冲突已通过回写消除：`story.md:79`-`story.md:82`（AC-3 Then 改为「默认 `workspace_write`…`wide_with_audit` 仅作显式迁移/审计模式」）、`docs/adr/ts-daemon-agent-runtime-migration.md:23`、`adr:171`-`adr:174` 同步；实现默认 `workspace_write`（`apps/daemon/src/server.ts:203`、`apps/daemon/src/runs/service.ts`、`apps/web/src/components/AgentRunPanel.tsx`）。因属意图层（story.md AC）被改动，需用户确认（见 §7-A）。 |
| AC-4 Run 面板不重做视觉，聚焦结构化数据接入 | **pass** | `apps/web/src/components/AgentRunPanel.tsx` 仅做格式化（statusMeta 回退修复 `AgentRunPanel.tsx:54`-`AgentRunPanel.tsx:57`、`wide_with_audit` 标签 `AgentRunPanel.tsx:31`），无视觉重做；G13 Agent Run toggle / 结构化面板测试本轮通过（见 R1#6）。 |
| AC-5 Rust 退出条件独立 checklist | **pass** | round 1 已 pass；本轮无回退。 |
| AC-6 自动沉淀 + review/edit/reject/rollback | **partial（daemon 侧 pass，前端侧未接入）** | daemon 侧全齐（见 R1#7）；但「**用户**可以事后回看、编辑、拒绝或回滚」要求用户面：web 无 review/edit/reject/restore/revert 调用（`apps/web/src/lib/agentRuns.ts:81` 仅 GET），AgentRunPanel 无 review UI（`AgentRunPanel.tsx:166`-`AgentRunPanel.tsx:172`）。前端 review UI 属 `20260626-run-sedimentation-review` child story 范围（已 approved，未实现）。umbrella 层已正确拆解；终态未达成。 |

## 3. 范围完整性（不少，对照 story.md 范围）

- umbrella 范围条目（边界 / child story 拆解 / 退出条件 / ADR）：**全部落实**。`design.md` Child Story 映射 G1–G15 + multi-agent 全部有对应 approved story。
- 终态范围（依赖 child story 实现）：AC-6 前端 review UI、G13 ChangeSet preview 外部 diff 入口等仍属未完成终态，但已正确委托给 approved child story。umbrella 自身不直接承载，符合 `story.md:25`。

## 4. 方案落实（不偏，对照 design.md）

- design §设计边界、§不做项、§Child Story 映射：**落实**。
- design §验证矩阵（`design.md:53`-`design.md:57`）：
  - `contracts/daemon typecheck+test` → pass。
  - `web typecheck` → pass。
  - 「Agent Run 聚焦测试」含 `src/tests/App.test.tsx` → **未全绿（2 failed）**。见待裁决 B：失败项为 App shell 侧栏折叠/响应式布局，非本迁移引入（`App.test.tsx`/`App.tsx` 本轮 **未修改**，`git diff HEAD -- apps/web/src/tests/App.test.tsx apps/web/src/App.tsx | wc -l` = 0；最后触动 commit 为 `cd1556c`），与 8 个 AC 无因果。
  - daemon live smoke（`GET /health`…`GET /runs/:id/sources`）：路由全在（`server.ts:93`-`server.ts:474`），未逐一实跑 live（无运行中 daemon），但路由 + service 单测覆盖。

## 5. 越界检查（不多，对照 story 非目标 + design 范围）

**pass（无新越界）。**

- diff 紧贴 design Child Story 映射：contracts(memory/index/test)、daemon(changeset/context/codex/registry/runner/sediment/server + 新 opencode def/stream + workspace context-assembly test)、web(AgentRunPanel/useAgentRun/types/AgentRunPanel.test)、docs(ADR/final-state)、stories(coding-agent-adapters + 4 新 child story + design.md)。每块均能归属到 G6/G8/G9/G10/G11/G14/G15/multi-agent 或契约一致性修复。
- round 1 「G6/G14/G15/multi-agent 无 child story」的越界风险已消除（4 个 approved child story 补齐）。
- 无命中 story §三类边界（云端协作 / 平台专属 API / 重做 Run 面板视觉 / 首批以外 CLI）的改动。

## 6. 冗余与一致性（不重，对照 story.md）

**fail（残留 1 项，低危）。**

- ✅ `AgentRun.parentRunId` / `AgentStep.parentStepId` web 镜像已对齐 contracts（R1#8）。
- ✅ `isAgentRunEvent` 严格化、`step_finished` 补齐，contracts 与 ADR 一致。
- ❌ **web `MemoryRecord` 镜像仍 drift**：`apps/web/src/types/agentRun.ts:124`-`agentRun.ts:133` 缺 `changeSetIds`、`path`、`status`、`updatedAt`，而 `packages/contracts/src/memory.ts:42`-`memory.ts:49` 已有。文件头注释（`agentRun.ts:11`-`agentRun.ts:14`）自称「Fields tracked for parity: … MemoryRecord …」，实际未同步。后果：即便接前端 review UI，web 类型也无法表达 review lifecycle（status/path），与 AC-6 终态冲突。

## 7. 待用户裁决

### A. AuthorizationMode 默认值：意图层（story.md AC-3）被回写翻转

- round 1 列此项为待裁决，保守计 fail。本轮发现 **上层契约被回写**：
  - `stories/20260625-ts-daemon-agent-runtime-migration/story.md:79`-`story.md:82`（AC-3）由「默认 `wide_with_audit`」改为「默认 `workspace_write`…`wide_with_audit` 仅作显式迁移/审计模式」。
  - `docs/adr/ts-daemon-agent-runtime-migration.md:23`、`adr:171`-`adr:174` 同步翻转。
  - 实现侧一直是 `workspace_write`（`server.ts:203` 等）。
- gate 规则：待裁决项经用户接受并回写契约后视为通过。回写已发生且消除了契约冲突。
- **但仍需用户表态**：AC-3 是意图层（用户要什么），把默认授权从 `wide_with_audit` 收紧为 `workspace_write` 是安全相关意向决策。无法从代码判定是「用户已接受→回写」还是「实现者自行改上层契约以对齐实现」。
- 两边代价：
  - 接受 → AC-3 pass；需同步检查 story §三类边界 / 风险表（R4 `docs/...`）是否还残留旧表述。
  - 不接受 → 改回 `wide_with_audit` 为默认，调整 daemon 默认值 + web UI + 测试。
- 保守结论：用户确认前，AC-3 不计入硬通过。

### B. `App.test.tsx` 2 个失败：是否阻塞 umbrella

- 失败项：`places sidebar collapse controls on the panel dividers`（`App.test.tsx:249`）、`preserves readable detail width by closing sidebars at narrow window sizes`（`App.test.tsx:300`）。均为 App shell 侧栏折叠/响应式布局（`data-sidebar-panel`/`data-sidebar-divider`/panel `width` 断言）。
- 证据其为 **预先存在、与本迁移无关**：
  - `App.test.tsx`、`App.tsx` 本轮未修改（`git diff HEAD -- … | wc -l` = 0）。
  - 失败测试不导入/不渲染本轮改动的 Agent Run 路径（AgentRunPanel 仅在 Agent Run mode 挂载；这 2 测试处于默认 chat 布局）。
  - round 1 的 G13 Agent Run toggle 失败已修复且本轮通过。
- design.md §验证矩阵 把 `src/tests/App.test.tsx` 列入「Agent Run 聚焦测试」必须通过项 → 严格按 design，此项不绿。
- 两边代价：
  - 视为阻塞 → umbrella fail，需先修 shell 折叠 bug（与本 story 无关，应另开 story）。
  - 视为 out-of-scope 预先存在 → 从 design 验证矩阵剔除或标注「G13 相关用例通过即可」，AC-4/AC 无影响。
- 保守结论：在 design 验证矩阵未调整前，此项按 fail 计（低危，非回归）。

## 8. 结论

**result: fail**

**fail 项数：2**（均为低危/边界性）

1. 不重 — web `MemoryRecord` 类型镜像 drift（缺 `changeSetIds/path/status/updatedAt`），与 contracts 不一致，阻碍 AC-6 前端 review UI 终态。证据 `apps/web/src/types/agentRun.ts:124`-`agentRun.ts:133` vs `packages/contracts/src/memory.ts:42`-`memory.ts:49`。
2. 不偏（vs design 验证矩阵）— `App.test.tsx` 2 个侧栏布局测试失败，design.md §验证矩阵 将其列为必过项。证据 `pnpm --filter @journal/web test -- src/tests/App.test.tsx` → `2 failed`，失败为预先存在且与 8 个 AC 无因果。

**待裁决项数：2**（A 授权默认翻转确认；B App.test.tsx 是否属本 story 范围）

**总评**：round 1 的 **8 条 fail 全部被处理**（7 fixed + 1 核心固定/前端待 child story）。umbrella 自身的边界交付物——`design.md`、4 个 approved child story、ADR 退出条件、契约冲突消除——均已就绪。剩余 2 个 fail 均为低危且非本迁移回归；AC-6 前端 review UI 与 G13 终态正确委托给 approved child story（`20260626-run-sedimentation-review` 等），后续按 child story 验收。

**建议（按风险）**：
1. 用户裁决 A、B。
2. 同步 web `MemoryRecord` 镜像（4 字段）以消除断言 #1。
3. 若接受 B 为 out-of-scope，回写 `design.md` §验证矩阵（剔除或限定 App.test.tsx 的 G13 子集）。
