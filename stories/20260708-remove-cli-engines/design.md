---
story: ./story.md
status: approved
created: 2026-07-08
---

# Design: 移除外部 Coding Agent 引擎支持

复用现成事实：daemon 已经有一条纯内置引擎的执行路径 `executeBuiltinRun`（`apps/daemon/src/engine/run.ts`），`server.ts` 目前用 `engine === 'builtin' ? executeBuiltinRun(...) : executeRun(...)` 的三元表达式在两条路径间二选一。删除方案就是把这个三元表达式坍缩成只剩 builtin 分支，然后删掉整个 `runtimes/` 目录（已核实：`apps/daemon/src/engine/*` 不 import 任何 `runtimes/*`，删除不影响内置引擎）。

## 范围确认（已读代码核实，非推测）

### 删除：`apps/daemon/src/runtimes/` 整个目录

含：`defs/{claude,codex,opencode}.ts`（+ `.test.ts`）、`stream/{claudeStream,codexStream,opencodeStream}.ts`（+ `.test.ts`）、`registry.ts`（+ `.test.ts`）、`detection.ts`（+ `.test.ts`）、`auth.ts`、`executables.ts`、`paths.ts`、`launch.ts`、`runner.ts`（+ `.test.ts`）、`diagnostics.ts`、`routes.test.ts`。全部只服务外部 CLI adapter，`executeRun`/`getAgentDef`/`detectAgents` 无任何 builtin 引擎调用方。

### 修改：`apps/daemon/src/server.ts`

1. 删 `import { getAgentDef } from './runtimes/registry.js'`、`import { detectAgents } from './runtimes/detection.js'`、`import { executeRun } from './runtimes/runner.js'`（L14-16）。
2. `POST /runs`（约 L1680-1770）：删 `engine`/`agentId`/`def` 的 cli 分支判断，`agentId` 固定为 `'builtin'`，`runChangeSetService` 固定为 `workspaceChangeSets()`，`execution` 固定调用 `executeBuiltinRun(...)`，删掉 `: executeRun(...)` 分支。
3. `GET /agents`（约 L1846-1858，调 `detectAgents`）：整个路由删除。前端不再有引擎探测入口。
4. `POST /runs/:id/subtasks`（约 L2025-2060，多智能体委派/子任务）：目前**无条件**用 `getAgentDef`/`executeRun`（默认 agentId `'claude'`），需要改成和主 run 创建一致的 builtin 路径——调 `executeBuiltinRun(...)`，`agentId` 固定 `'builtin'`，删 `getAgentDef` 校验分支。这是本次删除范围里唯一一处"改造成 builtin-only"而非单纯删除的调用点，需要仔细核对 `executeBuiltinRun` 的入参形状（对照 L1748-1765 的调用示例，含 `configService`、`workspaceRoot()`、`authorizationMode`、`skillsService()`）与子任务场景所需字段是否都能取到（子任务当前没有单独的 `authorizationMode`/`model` 参数，用调用处已有的默认值：`authorizationMode: 'workspace_write'`，不传 `model`）。
5. 检索 `server.ts` 内其余 `agentId`/`engine` 字段（run 记录序列化、事件 payload 等）：若只是透传存储的字符串值（不做 cli 专属逻辑分支），保留字段但确认默认值恒为 `'builtin'`，不需要额外改动。

### 修改：`apps/daemon/src/settings/service.ts` + `service.test.ts`

`agent_engine`/`agent_id` 目前走 `[key: string]: unknown` 通用透传，没有专属 schema/校验代码，本身不用改。只删 `service.test.ts` 里断言 `agent_engine: 'cli'` 语义的用例（若有），因为 `'cli'` 值不再有意义（不强制迁移旧配置文件，读到旧值当作未知字段透传即可，符合 story 的"容错忽略，无过渡期"边界）。

### 删除（web）

`apps/web/src/components/EngineSwitcher.tsx`（+ test）、`apps/web/src/hooks/useAgentEngine.ts`（+ test）、`apps/web/src/settings/components/SectionLocalAgents.tsx`（+ test）、`apps/web/src/components/AgentDiagnosticRow.tsx`（+ test）。

### 修改（web）

- `apps/web/src/components/UnifiedChatShell.tsx`：删掉 `<EngineSwitcher>` 的引用与相关 import、state。
- `apps/web/src/components/ChatPanel.tsx`：删掉引擎/agentId 选择的分支逻辑（若有引用 `useAgentEngine`）。
- `apps/web/src/types/agentRun.ts`：`engine`/`agentId` 的联合类型收窄为只剩 `'builtin'`（不删字段本身，因为 run 记录序列化仍可能带这个字段，只是恒为 builtin）。
- `apps/web/src/lib/httpRuntimeClient.ts`：删 `case 'get_agent_engine'`、`case 'set_agent_engine'`，删 `agent_engine?: string` 相关字段/注释（L34-35, L156-168 一带）。
- `apps/web/src/locales/zh.ts` / `en.ts`：删 codex/claude code/opencode CLI 相关文案 key（先 grep 确认哪些 key 只在被删组件里用到，避免删了还在用的 key）。
- `apps/web/src/tests/ipc-contract.test.ts`、`apps/web/src/tests/App.test.tsx`：删对应断言。

### 待核实后再删（design 阶段标记，实现时先读代码确认再动）

`apps/daemon/src/runs/service.test.ts`、`apps/daemon/src/automation/store.ts`、`apps/daemon/src/automation/runner.ts` 中出现的 `agentId`/`engine` 字段——先读代码确认是否只是字段透传（保留，不改）还是真的有 cli 专属分支（若有，同样收窄为 builtin-only）。不要在没读代码的情况下删除这三个文件里的任何逻辑。

### 文档同步（docs-maintenance 范围，实现完成后处理）

`docs/ARCH.md`：
- 铁律表格行 `| Agent 引擎 | pi 内建引擎 + Claude/Codex/OpenCode CLI adapters |` → 改成 `| Agent 引擎 | pi 内建引擎（唯一） |`
- 流程描述 `2. daemon 选择 pi 内建引擎或 CLI adapter。` → 改成 `2. daemon 统一走 pi 内建引擎。`

## 验证命令

```bash
bun run lint
npm run build
cd apps/daemon && bunx vitest run
cd apps/web && bunx vitest run
grep -rli "codex\|opencode\|claude code\|claude-code" apps/daemon/src apps/web/src --include="*.ts" --include="*.tsx" | grep -v "opencode-subagent\|codex:rescue"
```
（最后一条 grep 用于核实 AC-3"代码库不再包含外部引擎实现"；预期应只剩与本次删除无关的误命中如 `codex` 开发工具插件引用，若有则人工核对排除。）

## 边界重申（继承 story.md Won't，不重复展开）

不做迁移/兼容层、不留过渡开关、不留"未来重新接入"的抽象占位、不改内置引擎能力本身、不动开发工作流用的 codex/opencode CLI 工具本身（那是维护者工具链，与产品代码无关，不在此次 grep/删除范围内）。
