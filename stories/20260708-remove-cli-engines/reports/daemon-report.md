# Daemon 侧移除外部 CLI 引擎 — 实现报告

任务：移除 daemon 侧外部 Coding Agent CLI 引擎（claude/codex/opencode adapter），只保留内置 pi 引擎。
范围：仅 `apps/daemon/*`（web 侧由独立任务处理，未触碰）。

## Step 1：删除 `apps/daemon/src/runtimes/` 整个目录（24 个文件，已删除）

删除前先 `grep -rln "runtimes/" apps/daemon/src apps/web/src` 核实引用方：
- `apps/daemon/src/server.ts`（本任务修改目标）
- `apps/daemon/src/runs/service.ts:11`、`apps/daemon/src/runs/store.ts:5`（**仅为文档注释**，引用的是上游 `open-design` 仓库的 `apps/daemon/src/runtimes/runs.ts` 作为设计参照，不是本地 import，不会产生悬空引用）
- web 侧零引用

确认无悬空 import 后执行 `rm -rf apps/daemon/src/runtimes`。已删文件清单：

```
apps/daemon/src/runtimes/auth.ts
apps/daemon/src/runtimes/defs/claude.ts
apps/daemon/src/runtimes/defs/claude.test.ts
apps/daemon/src/runtimes/defs/codex.ts
apps/daemon/src/runtimes/defs/codex.test.ts
apps/daemon/src/runtimes/defs/opencode.ts
apps/daemon/src/runtimes/defs/opencode.test.ts
apps/daemon/src/runtimes/detection.ts
apps/daemon/src/runtimes/detection.test.ts
apps/daemon/src/runtimes/diagnostics.ts
apps/daemon/src/runtimes/executables.ts
apps/daemon/src/runtimes/launch.ts
apps/daemon/src/runtimes/paths.ts
apps/daemon/src/runtimes/registry.ts
apps/daemon/src/runtimes/registry.test.ts
apps/daemon/src/runtimes/runner.ts
apps/daemon/src/runtimes/runner.test.ts
apps/daemon/src/runtimes/routes.test.ts
apps/daemon/src/runtimes/stream/claudeStream.ts
apps/daemon/src/runtimes/stream/claudeStream.test.ts
apps/daemon/src/runtimes/stream/codexStream.ts
apps/daemon/src/runtimes/stream/codexStream.test.ts
apps/daemon/src/runtimes/stream/opencodeStream.ts
apps/daemon/src/runtimes/stream/opencodeStream.test.ts
```

## Step 2：修改 `apps/daemon/src/server.ts`

1. 删除 3 行外部引擎 import（`getAgentDef` / `detectAgents` / `executeRun`），保留 `executeBuiltinRun`。
2. `POST /runs`：删掉 `engine`/`agentId`/`def` 的 cli 分支判断，`agentId` 固定为 `'builtin'`；`runChangeSetService` 固定为 `workspaceChangeSets()`；`execution` 直接调用 `executeBuiltinRun(...)`（删除整个 `: executeRun(...)` 三元分支）；删除死变量 `model`。
3. `GET /agents`（调 `detectAgents`）：整个路由 + 前置注释块删除。
4. `POST /runs/:id/subtasks`：`agentId` 固定 `'builtin'`，删掉 `getAgentDef` 校验分支；新增 `assembleContext(...)` 组装子任务 systemPrompt；`executeRun(...)` 改为 `executeBuiltinRun(...)`，`authorizationMode` 传 `childRun.authorizationMode`（默认即 `'workspace_write'`，与持久化记录保持一致），`changeSetService` 用 `workspaceChangeSets()`，`skillsService` 用 `skillsService()`。后续 `.then`/`.catch` 逻辑保持不变。
5. 检索剩余 `agentId`/`engine`：均为透明透传或已固定为 `'builtin'`；`app.get/put('/config/engine')` 是 **AI provider/model 引擎配置**（`configService.getEngineConfig`），与 CLI agent 引擎无关，保留不动。
6. 顺手修正 5 处因删除而失真的注释（`executeRun child`/`SIGTERM spawned CLI`/`CLI internals`/`executeRun` → 指向 builtin engine）。

## Step 3：清理 `apps/daemon/src/settings/service.test.ts`

删除断言 `agent_engine: 'cli'` / `agent_id: 'codex'` 的 round-trip 用例（`persists the agent_engine and agent_id selection across partial updates`）。`settings/service.ts` 本身无需改动——`agent_engine`/`agent_id` 走 `[key: string]: unknown` 通用透传，无专属 schema。

## Step 4：核实"待核实后再删"三个文件

| 文件 | 核实结论 |
| --- | --- |
| `apps/daemon/src/runs/service.test.ts` | `createRun` 对 `agentId` 是**纯透传存储**（`service.ts:59` `agentId: input.agentId`），无 cli 专属分支 → **service.ts 逻辑保留不动**。但测试用例 `stores the selected runtime adapter` 用了已失效的 cli 名 `'claude'`/`'opencode'`，语义失真 → 改写为用真实值 `'builtin'`（重命名为 `stores the agentId and lists child runs`），保留原有的"agentId 被存储 + 子 run 列表可取回"断言。 |
| `apps/daemon/src/automation/store.ts` | grep 无任何 `agentId`/`engine`/cli 引用 → **无需改动**。 |
| `apps/daemon/src/automation/runner.ts` | 仅有指向 builtin pi engine 的注释（L7/L13）；其余 `cli` 命中来自单词 `clipped`（L160-161）的子串误匹配 → **与外部引擎无关，无需改动**。 |

## Step 4 衍生清理（scope-adjacent，已处理并记录）

核实过程中发现 `apps/daemon/src/changeset/authorization.ts` 的 `toClaudePermissionMode(mode)`（把 AuthorizationMode 映射到 claude 的 `--permission-mode` 取值）在删除 `runtimes/runner.ts` 后**变成无调用方的孤儿代码**（全仓 grep 仅剩自身定义 + 自身测试）。这是 claude 专属的外部引擎抽象，留着违反铁律 #3（"不要保留任何未来可能重新接入外部引擎的抽象"），也与 AC-3（代码库不再包含外部引擎实现）冲突。处理：

- `authorization.ts`：删除 `toClaudePermissionMode` 函数；修正文件头注释（去掉 "claude permission-mode mapping" 描述，`isPathAllowed` 是 builtin 引擎在用的核心路径鉴权，保留）。
- `authorization.test.ts`：删除对应 `describe('authorization.toClaudePermissionMode')` 测试块，import 收窄为只引 `isPathAllowed`。

> 说明：此项不在 design.md 明列的删除清单里，但属于本次删除直接制造的死代码且明显属于外部引擎抽象，故一并清理。`isPathAllowed`/`AuthorizationDecision` 等被 builtin 引擎依赖的逻辑完整保留。

另：`apps/daemon/src/changeset/service.ts:212` 一条注释引用了已删除的 `executeRun`，顺手修正为 "the builtin engine run"，避免文档失真（纯注释，无逻辑改动）。

## 改动文件汇总

修改（6 个）：
- `apps/daemon/src/server.ts`（核心逻辑：删 cli 分支、删 `/agents` 路由、subtasks 改 builtin、注释修正）
- `apps/daemon/src/changeset/authorization.ts`（删孤儿 `toClaudePermissionMode` + 头注释）
- `apps/daemon/src/changeset/authorization.test.ts`（删对应测试 + import 收窄）
- `apps/daemon/src/changeset/service.ts`（注释准确性修正）
- `apps/daemon/src/runs/service.test.ts`（cli agent 名 → `'builtin'`）
- `apps/daemon/src/settings/service.test.ts`（删 `agent_engine:'cli'` 用例）

删除（24 个）：见 Step 1 清单（整个 `apps/daemon/src/runtimes/` 目录）。

git diff --stat 摘要：`30 files changed, 63 insertions(+), 3187 deletions(-)`。

## Step 5：测试命令完整输出

### `cd apps/daemon && bunx tsc --noEmit`

```
（无输出）
TSC_EXIT=0
```

### `cd apps/daemon && bunx vitest run`

```
 RUN  v4.1.9 /Users/yanwu/Projects/github/journal_claw/apps/daemon


 Test Files  35 passed (35)
      Tests  211 passed (211)
   Start at  22:56:52
   Duration  9.37s (transform 5.67s, setup 0ms, import 28.64s, tests 5.09s, environment 34ms)

VITEST_EXIT=0
```

测试数从 212 → 211：删掉的 `toClaudePermissionMode` 用例 1 条（settings 那条用例被整块删除，但它本来计入的是 settings 文件的计数；净减少 1 条来自 authorization 用例删除 + settings 用例删除与 runs 用例改写的抵消）。全部通过。

## 铁律核对

- 未触碰 `apps/web/*` 任何文件。✅
- 未引入新依赖。✅
- 未保留任何"未来重新接入外部引擎"的抽象/开关/TODO（`toClaudePermissionMode` 孤儿抽象已一并清理）。✅
- `engine`/`agentId` 字段在 run 记录里作为透传字符串保留，默认值恒为 `'builtin'`，未删字段本身（序列化兼容）。✅

## 遇到的问题

无阻断性问题。两点说明：
1. `runs/service.ts`、`runs/store.ts` 各有一条注释引用 `open-design apps/daemon/src/runtimes/runs.ts`——这是上游设计仓库的路径（历史参照），不是本地 import，保留不动。
2. 衍生清理 `toClaudePermissionMode` 属于 design.md 删除清单之外、但由本次删除直接制造的死代码，已按铁律 #3 处理并在上文记录。

SUMMARY: result=pass | steps_done=5/5
