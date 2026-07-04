---
id: SPEC-20260615-panel-auto-toggle
title: '左右栏自动开关逻辑（默认收起 · @ 展开 · 切换内容时无任务则收起 · pin 粘性）'
status: approved
source: gate
level: L2
created: 2026-06-15
related:
  - src/contexts/UIContext.tsx # rightPanelOpen / rightPanelWidth 现状，将新增 rightPanelPinned
  - src/App.tsx # leftSidebarOpen 状态、onAtRef、handleCategoryChange、内容键
  - src/components/RightPanel.tsx # 右栏壳
  - src/components/ChatPanel.tsx # isStreaming / pendingQueue 来源（经 useChat）
  - docs/ARCH.md:30-53 # 面板分层
---

# 左右栏自动开关逻辑

## 1. 背景与问题

**谁**：JournalClaw 用户（知识工作者，核心动作是「高效浏览 + 沉浸阅读」）。

**场景**：当前左栏（TreeSidebar）与右栏（RightPanel→ChatPanel）默认**展开** [证据: `UIContext.tsx:161` `rightPanelOpen` 初值 `true`；`App.tsx:208` `leftSidebarOpen` 初值 `true`]。默认展开挤占了中间阅读区，违背「打开即平静 / 阅读时忘记工具」的情感期望 [证据: AGENTS.md 用户画像]。

**@ 的现状**：点击树条目上的 `@` 已会展开右栏并插入 `@path` [证据: `App.tsx:1028-1031` `onAtRef` → `setRightPanelOpen(true)` + dispatch `chat-append-text`]。即需求 ② 已部分实现，本 spec 不改其行为。

**缺口**：切换阅读内容时，右栏不会自动收起；用户需手动 Cmd+T 关闭，割裂阅读流。

**目标行为（用户已逐项确认）**：

1. 左右栏**默认关闭**。
2. 点击 `@` 时右栏**自动展开**（沿用现状）。
3. 切换内容时，若右栏**无进行中任务**且**未被 pin**，自动收起。

## 2. 目标与假设

通过「默认收起 + pin 粘性 + 切换时按任务状态收起」影响右栏生命周期，预期：

- 冷启动：左右栏均收起，中间阅读区最大化。
- 点击 NavRail 列表类（journal/identity/topics）→ 左栏展开（沿用 `handleCategoryChange` [证据: `App.tsx:695`]）。
- 点击 `@` / Cmd+T / Cmd+N → 右栏展开，**默认 unpinned**。
- 切换内容（条目/树选/类别）瞬间，右栏在「无任务且未 pin」时收起。

**假设（可证伪）**：

- `isStreaming || pendingQueue.length > 0` 足以代表「右栏有进行中任务」——若用户日常依赖草稿/未发送文本判断，假设不成立，需回到待确认 Q。
- 用户主要工作流是「浏览 → 偶尔 @ 提问」，不需要常驻右栏；需常驻时用 pin。若多数用户实际需要常驻，默认 unpinned 反成负担。

## 3. 范围（In Scope）

- 翻转 `rightPanelOpen`（`UIContext.tsx:161`）与 `leftSidebarOpen`（`App.tsx:208`）初值为 `false`。
- 新增 `rightPanelPinned` 状态 + `localStorage` 持久化（key `journal_right_panel_pinned`，初值 `false`），经 `UIContext` 暴露。
- 在 `App.tsx` 新增内容键 effect：内容键（`${activeCategory}:${selectedEntry?.path ?? treeSelection?.path ?? ''}`）变化时，若 `!rightPanelPinned && !isStreaming && pendingQueue.length === 0` → `setRightPanelOpen(false)`。
- 展开/收起按钮与 pin 按钮放在 **TitleBar 右侧**（紧邻 ThemeToggle），不再渲染在分隔栏上。删除 `App.tsx` 中 `PanelDividerToggle` 在右分隔栏的实例及组件定义；分隔栏退化为纯拖拽条。

## 4. 非目标（Out of Scope）

- 不改 `@` 的插入行为（已实现，保持）。
- 不改小视口自动收起逻辑（`App.tsx:217-224`，保持，优先级最高）。
- 不改左栏的自动展开/收起（`handleCategoryChange` 既有逻辑保留）。
- 不改 `rightPanelOpen` 的持久化策略（仍是纯 React state，不落盘；只有 pin 落盘）。
- 不引入「流式结束后延迟收起」——仅切换瞬间判定（用户已确认）。
- 不为左栏加 pin（左栏生命周期由 category 驱动，无需粘性）。
- 不改 Cmd+N / openChatPanel 为 auto-pin（用户确认保持当前设计：所有打开路径默认 unpinned）。

## 5. 验收标准（Acceptance Criteria）

- **AC-1**（默认收起）：当应用冷启动（无 localStorage 既有 `journal_right_panel_pinned` 或其为 `false`），进入主界面，应左栏与右栏均处于**收起**状态（宽度 0 / `aria-hidden=true`）。
- **AC-2**（@ 展开）：当右栏处于收起状态，点击树条目上的 `@`，应右栏**展开**，且输入框插入 `@<path>`，且 `rightPanelPinned` 仍为 `false`（@ 不自动 pin）。
- **AC-3**（切换收起 · 无任务）：当右栏展开且 `rightPanelPinned=false` 且 `isStreaming=false` 且 `pendingQueue.length===0`，切换中间区阅读内容（打开另一条目 / 切换树选 / 切换类别任一），应右栏**自动收起**。
- **AC-4**（切换不收起 · 有任务）：当右栏展开且 `isStreaming=true`（或 `pendingQueue.length>0`），切换内容，应右栏**保持展开**（切换瞬间不收起；不实现延迟收起）。
- **AC-5**（pin 粘性）：当点击右栏分隔栏的 pin 按钮，应 `rightPanelPinned` 切换且持久化（刷新后保持）；当 `rightPanelPinned=true`，切换内容（无论任务状态）应右栏**保持展开**。
- **AC-6**（手动展开不自动 pin）：当通过 Cmd+T / chevron / Cmd+N / `@` 任一路径展开右栏，应 `rightPanelPinned` 保持**当前值不变**（这些路径不修改 pin；pin 仅由 pin 按钮改变）。
- **AC-7**（小视口优先）：当 `viewportWidth < 960`，应右栏收起，且上述自动展开/收起逻辑不应让右栏在窄屏重新展开（既有 `App.tsx:217` 效果不被绕过）。
- **AC-8**（@ 不自我折叠）：当点击 `@`（不改变内容键），右栏展开后，应**不会**因同一动作立即触发 AC-3 收起（@ 不构成内容切换）。
- **AC-9**（控件位置与可达性）：右栏的展开-收起按钮与 pin 按钮位于 **TitleBar 右侧**（在 ThemeToggle 之后）；左栏无开合控件（由 NavRail category 驱动）；分隔栏上无任何按钮（纯拖拽条）。pin 按钮应具备 `aria-pressed`（反映 pinned 态）与可点击键盘可达，与 ThemeToggle 视觉风格一致。pin 按钮仅当右栏展开时可点击（关闭态 pin 无可观察意义）。

## 6. 非功能需求（NFR）

| 维度          | 要求                                                                                                                                       | 备注 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 性能          | 内容键 effect 仅在内容键变化时触发一次比较，无轮询、无 setInterval。                                                                       | O(1) |
| 安全 / 权限   | N/A — 纯前端 UI 状态，无后端调用。                                                                                                         | —    |
| 数据 / 隐私   | `journal_right_panel_pinned` 存 localStorage（boolean），无 PII。与既有 `journal_right_panel_width` 同级 [证据: `UIContext.tsx:162-175`]。 | —    |
| 可靠性 / 降级 | 若 localStorage 读取失败（隐私模式），pin 退化为 session 内 `false`，不影响展开/收起主逻辑。                                               | —    |
| 可观测性      | N/A — 无需埋点；行为可直接观察。                                                                                                           | —    |
| 回滚策略      | 翻转两个初值 + 删除 effect + 删除 pin 按钮 + 移除 `rightPanelPinned`。无数据迁移。                                                         | —    |

## 7. 依赖与影响面

**依赖**：

- `isStreaming` / `pendingQueue`：由 `useChat`（chat hook）返回，已在 `App.tsx` 作用域内消费（传入 RightPanel/ChatPanel 的 props）。[证据: agent 探索报告 §4，待实现时核对实际变量名]

**影响面**：

- `UIContext.tsx`：新增 state + context value 字段；所有 `useUI()` 消费者类型变化（仅新增可选字段，不破坏既有）。
- `App.tsx`：新增 effect + pin 按钮 JSX；`leftSidebarOpen`/`rightPanelOpen` 初值翻转。
- 视觉一致性约束 [证据: AGENTS.md 关键约束 1]：本变更仅触及右栏分隔控件，不涉及 JournalList↔IdentityList 对称性，无连带改动。

**与历史结论冲突**：无。`rightPanelOpen` 当前不持久化 [证据: `UIContext.tsx:161` 纯 useState]，本 spec 仅新增独立的 `rightPanelPinned` 持久化，不改 `rightPanelOpen` 持久化策略。

## 8. 风险与待人类决策的问题

- **[推测]** 切换瞬间收起，若用户「切换后立刻想继续聊」需再次点 `@` 重开。已由用户确认接受（不实现延迟收起）。
- **[推测]** `isStreaming || pendingQueue>0` 的「任务」定义可能遗漏「输入框有未发送草稿」的情境。已列入假设 §2；如用户反馈丢失草稿感，回到 Q 扩展定义。当前用户已选「Streaming + pending queue」。
- **[证据]** `useChat` 的实际导出名（`isStreaming`/`pendingQueue`）来自 agent 探索报告，实现时需在 `App.tsx` 核对真实变量名，若不同则按真实名接线。

## 9. 待确认

| #   | 问题                                       | 当前默认值                        | 状态       |
| --- | ------------------------------------------ | --------------------------------- | ---------- |
| Q1  | 「进行中任务」是否需包含输入框未发送草稿？ | 否（仅 streaming + pendingQueue） | 用户已确认 |
| Q2  | Cmd+N / openChatPanel 是否 auto-pin？      | 否（保持 unpinned）               | 用户已确认 |
| Q3  | 是否需要流式结束后延迟收起？               | 否（仅切换瞬间）                  | 用户已确认 |

三项均已在设计澄清阶段由用户显式确认，无遗留。

## 10. 门禁记录

| 轮次 | 日期       | Readiness | 主要缺口                                                                                                                     |
| ---- | ---------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1    | 2026-06-15 | 可开发    | 无遗留待确认；实现时核对 `useChat` 真实变量名（见 §8）                                                                       |
| 2    | 2026-06-15 | 可开发    | 增量变更（用户追加）：展开/收起 + pin 按钮从分隔栏迁至 TitleBar 右侧与 ThemeToggle 同组，分隔栏退化为纯拖拽条；AC-9 同步更新 |
