# Web-side Report: 移除外部 CLI 引擎选择相关 UI/hook/IPC

**Story**: 20260708-remove-cli-engines
**Scope**: web 侧（apps/web/src），不动 apps/daemon/*

---

## Step 1 — 删除的文件（10 个）

| 文件 | 说明 |
|------|------|
| `components/EngineSwitcher.tsx` | 引擎切换 chip 组件（已删） |
| `tests/EngineSwitcher.test.tsx` | EngineSwitcher 单测（已删） |
| `hooks/useAgentEngine.ts` | 引擎选择持久化 hook（已删） |
| `tests/useAgentEngine.test.tsx` | useAgentEngine 单测（已删） |
| `settings/components/SectionLocalAgents.tsx` | 设置 → 本地 Agent 引擎面板（已删） |
| `tests/SectionLocalAgents.test.tsx` | SectionLocalAgents 单测（已删） |
| `components/AgentDiagnosticRow.tsx` | Agent 诊断行组件（已删） |
| `tests/AgentDiagnosticRow.test.tsx` | AgentDiagnosticRow 单测（已删） |
| `styles/engine-switcher.css` | EngineSwitcher 专用样式（dead CSS，唯一 importer 是已删的 EngineSwitcher.tsx） |
| `lib/localAgents.ts` | GET /agents 检测客户端（dead lib，删除全部 consumer 后无 importer） |

> `engine-switcher.css` 和 `localAgents.ts` 不在 task Step 1 的 8 文件清单里，但删除后它们变成 0 importer 的死代码（不留"未来重新接入"的抽象占位），与 story 边界一致，一并删除。

## Step 2 — 清理引用

### `components/UnifiedChatShell.tsx`（重写）
- 删除 import：`useAgentEngine`, `useAgentRun`, `EngineSwitcher`, `AuthModeToggle`, `RunStreamEntries`, `useTranslation`, `listLocalAgents`, `selectRuntimeClient`, `AgentInfo`, `EngineConfig`, `AuthorizationMode`, `getEngineConfig`。
- 删除 state：`engine`/`agentId`/`agents`/`rescanning`/`authMode`/`builtinModel`。
- 删除逻辑：agent 检测 effect、builtin model 解析 effect、"stillKnown" effect、CLI run fusion（`streamExtras`/`composerExtras`/`inputPlaceholder`）、`handleSend` 中的 CLI 分支。
- 删除渲染：`<EngineSwitcher>` chip。
- 组件简化为纯 chat passthrough（header + ChatPanel）。

### `components/WorkspaceView.tsx`（WorkspaceChatShell 部分）
- 删除 import：`useAgentEngine`, `useAgentRun`, `EngineSwitcher`, `AuthModeToggle`, `RunStreamEntries`, `listLocalAgents`, `AuthorizationMode`, `AgentInfo`, `EngineConfig`, `getEngineConfig`。
- 删除 state：`engine`/`agentId`/`agents`/`rescanning`/`authMode`/`builtinModel`。
- 删除逻辑：agent 检测 effect、builtin model effect、"stillKnown" effect、CLI run 融合块（`hasRunOutput`/`RunStreamEntries`）、CLI 发送分支。
- `handleSend` 简化为 `onSend(text)`（纯 chat）。
- `canSend` 不再检查 `agentRun.isRunning`。
- 删除渲染：footer 中的 `<EngineSwitcher>` + `<AuthModeToggle>`、body 中的 `RunStreamEntries` 块。
- textarea placeholder 固定为 `'Ask me anything'`。

### `settings/SettingsLayout.tsx`
- 删除 `import SectionLocalAgents`、`Terminal` icon import。
- 删除 `case 'localAgents'` render 分支。
- 删除 NAV_ITEMS 中的 `{ id: 'localAgents', ... }` 条目。

### `settings/navigation.ts`
- 从 `NavId` 类型和 `ALL_NAV_IDS` 数组中移除 `'localAgents'`。

### `styles/auth-mode-toggle.css` + `components/AuthModeToggle.tsx`
- 清理引用了已删 EngineSwitcher 的注释文案（纯注释，无功能影响）。

## Step 3 — `lib/httpRuntimeClient.ts`

- 删除 `case 'get_agent_engine'`（约 8 行）和 `case 'set_agent_engine'`（约 10 行）整个 case 块。
- 删除 `WorkspaceSettings` 接口中的 `agent_engine?: string` 和 `agent_id?: string | null` 字段及其注释。

## Step 4 — `types/agentRun.ts` 类型收窄 + 消费方修复

- `RunEngine` 从 `'builtin' | 'cli'` 收窄为 `'builtin'`（字段保留，因为 run 记录序列化仍可能带它）。
- `lib/agentRuns.ts`：`createRun` 不再有 `input.engine === 'builtin' ? 'builtin' : 'cli'` 三元，固定 `engine: 'builtin'`；`agentId` 默认从 `'claude'` 改为 `'builtin'`。
- `components/AgentRunPanel.tsx`：`engine` prop 默认值从 `'cli'` 改为 `'builtin'`；`agentId` fallback 从 `'claude'` 改为 `'builtin'`；`RunStreamEntries` chip 的 `run.agentId ?? agentId ?? 'claude'` 改为 `?? 'builtin'`。

## Step 5 — 清理文案

### zh.ts / en.ts 各删除 38 个 key

**engineSwitcher\*（11 个）**：`engineSwitcherLabel`, `engineSwitcherBuiltin`, `engineSwitcherBuiltinShort`, `engineSwitcherCli`, `engineSwitcherCliShort`, `engineSwitcherModeLabel`, `engineSwitcherAgentLabel`, `engineSwitcherNoAgent`, `engineSwitcherNoAgents`, `engineSwitcherBuiltinHint`, `engineSwitcherModelDefault`。

**localAgents / agent / diag（27 个）**：`localAgents`, `localAgentsSubtitle`, `rescan`, `rescanning`, `agentAvailable`, `agentUnavailable`, `agentVersionLabel`, `agentAuthStatus`, `agentPathLabel`, `agentAuthOk`, `agentAuthMissing`, `agentAuthUnknown`, `agentAuthNotProbed`, `agentInstall`, `agentDocs`, `agentSetEnv`, `agentClearEnv`, `agentSetEnvHint`, `agentClearEnvHint`, `localAgentsEmpty`, `localAgentsLoadFailed`, `localAgentsSearchedDirs`, `diagNotOnPath`, `diagNotExecutable`, `diagShimBroken`, `diagConfiguredBinInvalid`, `diagAuthMissing`, `diagAuthUnknown`。

> 每个 key 在删除前都用 grep 确认只被已删组件使用。
> **保留的 key**：`agentRunGoalPlaceholder`（AgentRunPanel.tsx 仍用）、`agentRunAuthLabel`（AgentRunPanel.tsx + AuthModeToggle.tsx 仍用）、`agentRunStart`（AgentRunPanel.tsx 仍用）。

## Step 6 — 清理测试断言

- `tests/ipc-contract.test.ts`：删除 `get/set agent_engine is a partial settings patch` 用例。
- `tests/App.test.tsx`：删除 `defaultInvoke` 中的 `get_agent_engine`/`set_agent_engine` 分支；删除 `listLocalAgents` mock；删除 `openRightPanel` helper 及两个 engine-switcher 集成测试。
- `tests/httpRuntimeClient.test.ts`：删除 `invoke maps agent engine reads...` 和 `invoke maps agent engine writes...` 两个用例。
- `tests/UnifiedChatShell.test.tsx`：重写——原测试全部围绕 engine 切换，改为测试简化后的纯 chat surface（渲染消息、header history control）。
- `tests/WorkspaceView.test.tsx`：删除 `useAgentEngine`/`useAgentRun`/`listLocalAgents` mock；简化 `runtimeClient` mock（去掉 `get_engine_config` 分支）。

## Step 7 — 测试验证

```
$ cd apps/web && bunx tsc --noEmit
(no output — 0 errors)

$ cd apps/web && bunx eslint "src/**/*.{ts,tsx}"
✖ 9 problems (0 errors, 9 warnings)
（9 warnings 均为 pre-existing，与本次改动无关）

$ cd apps/web && bunx vitest run

 RUN  v4.1.9 /Users/yanwu/Projects/github/journal_claw/apps/web

 Test Files  54 passed (54)
      Tests  387 passed (387)
   Duration  55.68s
```

## 遗留/不确定项

无。所有删除决策都有 grep 确认。`RunEngine` 字段保留（值恒 `'builtin'`）因为 run 记录序列化仍带它，daemon 侧负责处理。

SUMMARY: result=pass | steps_done=7/7
