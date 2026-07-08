---
story: ./story.md
design: ./design.md
round: 1
verifier: independent-subagent (glm/glm-5.2)
date: 2026-07-08
result: pass
---

# Verify Report — 移除外部 Coding Agent 引擎支持

独立核对，结论仅来自契约与指定范围代码 + 命令实测输出。

## 验收标准逐条核对

### AC-1 — 界面上不再出现外部引擎 ✅ pass

范围文件实测（grep `codex|opencode|claude code|cli engine|external engine|agent_engine|EngineSwitcher|useAgentEngine|SectionLocalAgents|AgentDiagnosticRow|agentId.*claude|engine.*cli`）：

| 文件 | 证据 |
| --- | --- |
| `apps/web/src/components/UnifiedChatShell.tsx` | 无 EngineSwitcher 引用、无 useAgentEngine import；L1-8 注释明示「external CLI engine adapter has been removed ... no engine switcher, no CLI run fusion, no authorization selector」 |
| `apps/web/src/components/WorkspaceView.tsx` | grep clean |
| `apps/web/src/lib/httpRuntimeClient.ts` | 无 `get_agent_engine`/`set_agent_engine` case；残留的 `get_engine_config`/`set_engine_config`(L109-115) 是内置 pi 引擎 provider/model 配置入口，**非** CLI 引擎适配，属保留项 |
| `apps/web/src/lib/agentRuns.ts` | `createRun` 固定发送 `engine:'builtin'`、`agentId:'builtin'`（L52-53） |
| `apps/web/src/types/agentRun.ts` | `RunEngine = 'builtin'`（L21，单值联合），L16-20 注释说明字段保留仅为序列化兼容 |
| `apps/web/src/settings/SettingsLayout.tsx` | NAV_ITEMS = general / ai / permissions / automation / about，无 local-agents 入口 |
| `apps/web/src/settings/navigation.ts` | `NavId` 联合无 local-agents |

design.md 指定删除的 web 文件全部确认不存在：
```
gone: apps/web/src/components/EngineSwitcher.tsx
gone: apps/web/src/hooks/useAgentEngine.ts
gone: apps/web/src/settings/components/SectionLocalAgents.tsx
gone: apps/web/src/components/AgentDiagnosticRow.tsx
```
发起 Agent run 无引擎选择环节（agentRuns.ts 直接 builtin）。✅

### AC-2 — 内置引擎功能完好 ✅ pass

`apps/daemon/src/server.ts` 内置执行路径完整且为唯一路径：

| 调用点 | 证据 |
| --- | --- |
| 主 run `POST /runs` | L1691 `const agentId = 'builtin'`；L1726 `runChangeSetService = workspaceChangeSets()`；L1732 `executeBuiltinRun(...)`，无 `: executeRun(...)` 三元分支 |
| 子任务 `POST /runs/:id/subtasks` | L1984 `agentId = 'builtin'`；L1995 `executeBuiltinRun(...)`（design 标注的唯一「改造成 builtin-only」点，已落实） |
| work-queue run 回调 | L345 `agentId:'builtin'`、L348 `executeBuiltinRun(...)` |
| import 区 | 无 `./runtimes/registry.js`、`./runtimes/detection.js`、`./runtimes/runner.js` 任一 import（L1-42 核对） |

全量测试通过（见 AC-3 命令输出），builtin 发起/流式/结果展示链路无回归证据。✅

### AC-3 — 代码库不再包含外部引擎实现；全量测试与构建通过 ✅ pass

**实现残留**：
- `apps/daemon/src/runtimes/` 目录：`ls` → `No such file or directory`（整个目录已删）
- design.md 验证 grep `codex|opencode|claude code|claude-code`（排除 opencode-subagent / codex:rescue）命中仅：
  - `apps/daemon/src/automation/runner.ts`、`apps/daemon/src/automation/store.ts` → 实为 `.Codex/automations` **数据持久化目录名**（store.ts L20-31；runner.ts L233/L281-282 排除该目录），非 CLI adapter 实现（runner.ts L7 注释明示走 pi 引擎）。属误命中，排除。
  - 另有 `apps/daemon/src/runs/store.ts`、`runs/service.ts` 的注释引用旧设计路径 `open-design apps/daemon/src/runtimes/runs.ts`（仅文档性追溯），以及 `skills/service.ts`、`auto_lint/service.ts` 的 `.claude` 目录（Claude Code 维护工具自身，Won't 边界内）。均非引擎适配实现。
- 范围内 11 个文件逐个 grep：除 2 处文档性注释（UnifiedChatShell.tsx L5、agentRun.ts L17，均说明「已移除」）外，零实现残留。

**门禁命令实测**：
```
npm run lint        → 0 errors (9 pre-existing warnings, 与本故事无关)
apps/daemon vitest  → 35 files / 211 tests passed
apps/web vitest     → 54 files / 387 tests passed
npm run build       → contracts tsc + daemon tsc + vite + electron-builder DMG 全绿
```
✅

## 越界 / 偏差清单

无。范围内所有改动与 design.md 范围一致，未发现越界删除、未发现遗留 CLI 专属分支、未发现抽象占位（符合 Won't「不留未来重新接入占位」）。

## 排除的误命中（非违规，仅透明记录）

1. `automation/store.ts` / `runner.ts` 中的 `.Codex/automations`：产品自动化数据目录名，非 Codex CLI 引擎适配。
2. `skills/*`、`auto_lint/*` 中的 `.claude`：Claude Code 维护工具自身的 skill/lint 目录，Won't 边界明确不动。
3. `runs/store.ts`、`runs/service.ts` 注释里的 `open-design ... runtimes/runs.ts`：旧设计路径文档追溯，非代码引用。

## 待用户裁决项

| # | 项 | 说明 |
| --- | --- | --- |
| P1 | docs/ARCH.md 同步 | design.md「文档同步」节要求更新铁律 12（`pi 内建引擎 + Claude/Codex/OpenCode CLI adapters` → `pi 内建引擎（唯一）`）及流程描述第 2 步。该项 design 明确归 docs-maintenance 范围、实现完成后处理；本次代码核对范围不含 docs 文件。代码门禁已过，docs 同步是否已执行 / 是否另走 docs-maintenance 技能，请用户裁决。 |

**裁定（2026-07-08，主对话）：已补齐。** `docs/ARCH.md` 铁律表格行与流程描述第 2 步均已更新为"pi 内建引擎（唯一）"；`AGENTS.md` 铁律 #12 同步更新（CLAUDE.md 为软链自动生效）。P1 清零。

## SUMMARY

SUMMARY: result=pass | fail=0 | pending=0（docs/ARCH.md + AGENTS.md 同步已补齐）
