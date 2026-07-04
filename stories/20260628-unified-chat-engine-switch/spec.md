---
status: verified
slug: 20260628-unified-chat-engine-switch
phase: P2（open-design 复刻 · 对话面统一 + 引擎切换）
owner: 对抗落地（opencode 开发 / codex 把关 / 我判优合并）
reference_repo: /Users/yanwu/Projects/github/open-design
depends_on: P1 本地 Agent 检测（已并主干，提供 GET /agents 可用 agent 列表）
---

# P2：统一对话面 + 顶栏引擎切换（复刻 open-design）

## 用户故事

作为一名想随手在「内置 pi 引擎」和「本地外部 agent（Claude Code/Codex/OpenCode…）」之间切换的用户，
我希望右侧只有**一个对话面**、顶栏有个**常驻引擎切换器**，而不是 Chat / Agent Run 两个割裂的 tab、输入框还没法选引擎，
以便我像 open-design 那样：一个对话框，选引擎/模型，它既能聊也能带工具干活。

## 背景

[证据] 现状右侧是 `App.tsx:1249-1267` 的 Chat / Agent Run 两 tab：Chat=`ChatPanel`(`useConversation`→`/conversation`)，Agent Run=`AgentRunPanel`(`useAgentRun`→`POST /runs`)。引擎选择对用户完全不可见。
[证据] open-design 的做法（务必研读）：一个 `ChatPane`，无 tab；顶栏常驻 `InlineModelSwitcher` chip（`../open-design/apps/web/src/components/InlineModelSwitcher.tsx`）单行显示「ExecMode(本地CLI/BYOK)+agent/provider+model」并 popover 切换；composer（`ChatComposer.tsx` 的 `composer-row` 区，含 `SessionModeToggle`）。
[证据] journal 后端已具备双引擎：`/conversation`（内置 pi 对话）与 `POST /runs {engine:'builtin'|'cli', agentId, authorizationMode}`（`server.ts:1659+`）。P1 已提供 `GET /agents` 返回可用 agent 列表。

## 成功标准（GWT 验收）

- **AC-1（删 tab，统一面）** Given 用户打开右侧面板，When 渲染，Then **不再有 Chat / Agent Run 两个 tab**；只有一个统一对话面。原 Agent Run 的目标执行能力（授权、执行 timeline）折叠进该面，不再单列 tab。
- **AC-2（顶栏引擎切换 chip）** Given 统一对话面，When 看顶栏，Then 有一个常驻 chip，单行显示当前引擎（内置 pi / 外部 agent 名）+ 当前模型；点击开 popover 可切换：引擎在「内置 pi」与「外部 CLI agent」之间切，外部时**仅列 P1 检测为 available 的 agent**（不可用的灰显/带原因，复用 P1 的 AgentInfo.diagnostics）。仿 `InlineModelSwitcher` 的交互。
- **AC-3（路由正确）** Given 用户选定引擎并发消息，When 发送，Then 内置 pi → 走 `/conversation`；外部 agent → 走 `POST /runs {engine:'cli', agentId, authorizationMode}`；两种都在同一对话面里连续渲染（对话消息 + 工具/执行步骤 timeline）。
- **AC-4（授权内联）** Given 引擎=外部 agent，When 准备发送/执行，Then 授权选项（read_only / workspace_write / full_access / wide_with_audit）作为内联控件出现（复用现有 AUTHORIZATION_MODES + 文案 i18n），内置 pi 时不显示。
- **AC-5（不回退/绿）** Given 改动完成，When `npm run build` + `npm test` + `cd apps/daemon && npx vitest run`，Then 全绿（HistoryFloatingButton/SandboxPreview 的 pre-existing 失败豁免）；引擎切换、路由、tab 移除均有测试覆盖。
- **AC-6（执行面深度融合 · 用户选「完整版」2026-06-28）** Given 引擎=外部 agent 且发起一次带工具的执行，When 执行进行/完成，Then 目标输入、授权状态、执行步骤、**改动集 / diff（changeset）** 全部内联渲染在同一对话面的消息流里（复用现 AgentRunPanel 的 changeset/timeline 渲染逻辑，不另开面板/不另开 tab），做到「聊天 ↔ 带工具干活」在一个对话面里连续无缝——对标 open-design 一个 ChatPane 同时承载对话与执行。授权策略切换、运行中/完成态、改动集展开均可用且有测试覆盖。

## 边界（Won't）

- 不做 BYOK `api` 直连模式的完整 provider 管理（沿用现有设置里的 provider/model 配置；本期引擎二选一=内置 pi / 外部 CLI agent）。
- 不做 ACP/AG-UI 流式协议替换（P3）；沿用 journal 现有 `/conversation` 与 `/runs` SSE。
- 不做 open-design 的 design-canvas / 并行 sessions / 多 ChatPane。
- 不重写 ChatPanel/AgentRunPanel 的底层数据 hook，尽量复用 `useConversation` + `useAgentRun`，只统一外壳 + 加引擎切换 + 路由。
- 模型 live-listing（从 CLI 拉模型）可选，非必须。

## 实现参考（opencode 必读 ../open-design）

| 复刻对象                | open-design 源                                                                             | journal 落点                                               |
| ----------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| 顶栏引擎/模型 chip      | `apps/web/src/components/InlineModelSwitcher.tsx`、`AgentIcon.tsx`、`utils/agentLabels.ts` | 统一对话面顶栏新 chip 组件                                 |
| 统一对话面（无 tab）    | `apps/web/src/components/ChatPane.tsx`                                                     | 改 `App.tsx` 右栏：删 tab，渲一个面                        |
| composer 控制条         | `ChatComposer.tsx` 的 `composer-row` + `SessionModeToggle`                                 | 复用现有 ChatPanel composer + 折叠 Agent Run 控件          |
| ExecMode/agent 选择模型 | `AgentPicker.tsx`、`components/agentModelSelection.ts`                                     | 引擎切换状态（持久化走 runtime client，不用 localStorage） |

复用 journal 现有 `useConversation` / `useAgentRun` / `GET /agents`（P1）；引擎选择持久化走 runtimeClient（AGENTS.md：不用 localStorage）；视觉走谨迹设计系统（`--record-btn` 橙、结构化 token、字体三栈），不照搬 open-design 配色；文案 zh/en 对齐零 hardcode。
