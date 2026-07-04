---
status: verified
slug: 20260628-local-agent-detection
phase: P1（open-design 复刻 · 第一阶段）
owner: 对抗落地（codex vs opencode，Leader 判优合并）
reference_repo: /Users/yanwu/Projects/github/open-design
---

# P1：复刻 open-design「本地 Agent 引擎检测」

## 用户故事

作为一名想用本地 CLI coding agent（Claude Code / Codex / OpenCode 等）驱动谨迹的知识工作者，
我希望谨迹能像 open-design 那样**丝滑地自动检测**我机器上装了哪些 agent、可用与否、版本、是否已登录，并在不可用时给出**一句原因 + 一个可点的修复动作**，
以便我不必手动配置就能选用本地引擎，遇到「检测不到/没装/没登录」时一眼知道怎么修。

## 背景

[证据] open-design 的检测分层在 `../open-design/apps/daemon/src/runtimes/`：`detection.ts`（`detectAgents` / `detectAgentsStream`）、`executables.ts`（PATH/bin 解析）、`diagnostics.ts`（构造 AgentDiagnostic）、`models.ts`、`types.ts`；契约在 `../open-design/packages/contracts/src/api/registry.ts`（`AgentInfo` / `AgentDiagnostic` / `AgentFixIntent`）；前端在 `../open-design/apps/web/src/components/AgentPicker.tsx` + `AgentDiagnosticRow.tsx` + `utils/agentLabels.ts`；端点 `GET /api/agents`（含流式渐进扫描）。
[证据] journal 现状：daemon `POST /runs` 已有 `engine='cli'` 经 `getAgentDef(agentId)` 跑外部 agent（`apps/daemon/src/server.ts:1659+`），但**没有检测/可用性/版本/诊断/UI**——agent 列表与可用性对用户不可见。

**本阶段只做「检测 + 展示」，不做对话面统一（P2）、不做 ACP/AG-UI 流式协议（P3）。**

## 成功标准（GWT 验收）

- **AC-1（检测）** Given 用户机器装了部分受支持 CLI agent，When daemon 执行 agent 检测，Then 对每个受支持 agent 产出 `AgentInfo{ id, name, bin, available, version, authStatus, path, diagnostics[] }`：在 PATH 上且可执行 → `available:true` + 解析出版本；不在 PATH → `available:false` 且 `diagnostics` 含 `reason:'not-on-path'` 与 `searchedDirs`。检测逻辑 1:1 参考 `runtimes/detection.ts` + `executables.ts`。
- **AC-2（诊断 + 修复意图）** Given 某 agent 不可用或未登录，When 产出 AgentInfo，Then `diagnostics[]` 每条带 `reason`（not-on-path / not-executable / shim-broken / configured-bin-invalid / auth-missing / auth-unknown 之一）、`severity`、一句话 `message`、以及 `fixActions[]`（openInstall / openDocs / rescan / setEnv{envKey} / clearEnv{envKey} 之一或多个）。契约 1:1 参考 `registry.ts` 的 `AgentDiagnostic` / `AgentFixIntent`（journal 侧 `launchOAuth` 可省略）。
- **AC-3（端点）** Given 前端请求，When 调用 journal daemon 的 `GET /agents`，Then 返回 `{ agents: AgentInfo[] }`；并提供「重新扫描」能力（重新检测、绕过缓存）。若实现流式渐进扫描（对标 `detectAgentsStream`）更佳，但非必须。
- **AC-4（设置页展示，丝滑）** Given 用户打开「设置 → 本地 Agent 引擎」新分区，When 渲染，Then 列出每个 agent 卡片：名称、可用状态、版本、登录状态；不可用卡片显示「一句原因 + 修复按钮」（按钮按 fixActions 渲染：跳安装/文档 URL、设置 bin 路径、重新扫描）；顶部有「重新扫描」按钮，点击触发重检测且有进行中态。视觉走谨迹设计系统（`--record-btn` 橙、结构化 token、`--font-body`），不照搬 open-design 配色。
- **AC-5（不回退/绿）** Given 改动完成，When 运行 `npm run build`、`cd apps/daemon && npx vitest run`、`npm test`，Then 全绿；新增检测逻辑与端点有单测（至少覆盖 not-on-path / available+version / auth-missing 三类）。

## 边界（Won't）

- 不做 P2 对话面统一、不删/不动现有 Chat / Agent Run tab。
- 不做 ACP/AG-UI 流式会话协议（P3）。
- 不做 BYOK `api` 直连模式、不做模型 live-listing（后续阶段）。
- 不照搬 open-design 的全部受支持 agent 清单；先覆盖 journal 已有 `getAgentDef` 能跑的那几个 + Claude Code / Codex / OpenCode，清单可在实现中合理收敛。
- 不引入 open-design 的 design-system / craft / plugin 等无关子系统。

## 实现参考（codex / opencode 必读 ../open-design 源码）

| 复刻对象       | open-design 源                                                                              | journal 落点                                         |
| -------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 检测逻辑       | `apps/daemon/src/runtimes/{detection,executables,diagnostics,types,models}.ts`              | `apps/daemon/src/agents/`（新建）或并入现有 agent 层 |
| 契约           | `packages/contracts/src/api/registry.ts`（AgentInfo/AgentDiagnostic/AgentFixIntent 子集）   | journal contracts / 类型定义处                       |
| 端点           | `GET /api/agents`（detectAgents）                                                           | journal daemon `GET /agents` + rescan                |
| 选择器/诊断 UI | `apps/web/src/components/AgentPicker.tsx`、`AgentDiagnosticRow.tsx`、`utils/agentLabels.ts` | 设置页新分区 + 可复用组件（P2 composer 复用）        |

复用 journal 现有 `getAgentDef` 与 daemon 结构；勿引第三方新依赖（CLAUDE.md Rule1）。文案走 `locales/zh.ts` + `en.ts` 对齐，勿留英文 hardcode。
