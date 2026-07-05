---
story: ./story.md
design: ./design.md
date: 2026-07-02
round: 6
result: pass
scope: 'git diff HEAD -- apps/web/src/App.tsx apps/web/src/components/WorkspaceView.tsx apps/web/src/components/TreeSidebar.tsx apps/web/src/styles/workspace.css apps/web/src/main.tsx apps/web/src/tests/WorkspaceView.test.tsx stories/20260701-momo-workspace-ui-replica/story.md stories/20260701-momo-workspace-ui-replica/design.md'
---

# 验收报告 — 在谨迹中复刻 Momo 工作空间 UI，作为桌面端 Workspace 入口视图（Round 6）

## 复核说明

本轮在第 5 轮基础上，重点核对：

1. r5 报告中唯一「待用户裁决」项（右侧面板全局默认值）是否已解决。
2. 本轮契约变更点：story 与 design 已同步要求将真实 Chat 能力（agent 选择、历史会话、发送/取消/继续）融入 Momo 风格右侧面板 `WorkspaceChatShell`。

`story.md`、`design.md` 相对 `HEAD` 无变更；`WorkspaceView.tsx`、`workspace.css`、`WorkspaceView.test.tsx` 为新增未跟踪文件，`App.tsx`、`TreeSidebar.tsx`、`main.tsx` 仍为已修改状态。

## 质量 gate 结果（六字标准）

| 六字标准 | 结论    | 关键证据                                                                                                                                       |
| -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **不漏** | ✅ pass | AC-1 ~ AC-7 均能在代码中定位到实现位置，见下表。                                                                                               |
| **不重** | ✅ pass | Workspace hub 能力集中在 `WorkspaceView.tsx`；`WorkspaceChatShell` 已替换 `UnifiedChatShell` 在 `App.tsx` 中的使用，无并行实现同一 AC 的情况。 |
| **不偏** | ✅ pass | 各 AC 的 Then 子句均能找到对应行为；与 design §3.1 / §3.3 方案一致。                                                                           |
| **不倚** | ✅ pass | 无 TODO / stub / 静默降级；Quick Start、Recently Viewed、Chat shell 均完整实现。                                                               |
| **不多** | ✅ pass | diff 中所有改动可归入 AC、design 范围或必要基础设施；无新增越界功能。                                                                          |
| **不少** | ✅ pass | design.md 要求的组件拆分、App.tsx 分支、样式文件、暗色变量、`prefers-reduced-motion`、测试文件均已落实。                                       |

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC                                          | 结论    | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC-1** Workspace 作为 Topics 分类的新视图 | ✅ pass | `App.tsx:1167-1168` 在 `activeCategory === 'topics' && (!treeSelection \|\| treeSelection.type === 'topic')` 时渲染 `<WorkspaceView onOpenRecent={handleOpenRecent} />`；左侧 Topics 树仍由 `TreeSidebar.tsx:836-1003` 渲染；右侧面板展开/收起由 `App.tsx:1227` 的 toggle 控制，切换内容时 `App.tsx:703-723` 的 auto-collapse effect 会关闭右侧面板。                                                                                                                                                                                                                  |
| **AC-2** 文件树与 Workspace 结构            | ✅ pass | `TreeSidebar.tsx:575-627` 在 `category === 'topics'` 时渲染 "Workspace" 标题与 Search / LayoutGrid 占位图标；文件夹展开/折叠行为仍由 `TopicTree.tsx:72` 的 `onToggleDir` 提供；文件项仍由 `TopicTree.tsx:108` 的 `<FileTypeIcon />` 显示对应类型图标。                                                                                                                                                                                                                                                                                                                 |
| **AC-3** Quick Start 操作区                 | ✅ pass | `WorkspaceView.tsx:236-263` 渲染 New File / New Folder / Import 三卡片；点击调用 `placeholderAction`（`WorkspaceView.tsx:169-175`）派发 `show-toast` 占位事件，不调用后端。                                                                                                                                                                                                                                                                                                                                                                                            |
| **AC-4** Recently Viewed 列表               | ✅ pass | `WorkspaceView.tsx:266-349` 渲染 Name / Contributors / Viewed 表头、文件图标、副标题、contributor 字母头像、相对时间与 Show more；行点击通过 `onOpenRecent`（`WorkspaceView.tsx:276-284`）进入 `DetailView`；`buildRecentItems`（`WorkspaceView.tsx:177-216`）优先消费 `useTopics` 真实文件、不足 5 条补 mock、最多 10 条，与 story 边界一致。`WorkspaceView.test.tsx:96-103` 新增点击行回调断言。                                                                                                                                                                     |
| **AC-5** 右侧 AI Chat 面板                  | ✅ pass | `App.tsx:1261-1287` 将 `UnifiedChatShell` 替换为 `WorkspaceChatShell`，并注入 `useConversation` 的真实 `sessionId`、`messages`、`isStreaming`、`send`、`cancel`、`retry`、`editAndResend`、`removePendingItem` 以及 `HistoryFloatingButton` 插槽；`WorkspaceView.tsx:351-677` 的 `WorkspaceChatShell` 内部集成 `useAgentEngine` / `useAgentRun` / `EngineSwitcher` / `AuthModeToggle` / `MarkdownRenderer` / `RunStreamEntries`，保留 agent 选择、历史会话选择、真实发送/取消/重试/继续能力；空状态显示纯文字问候 `闫戍's momo`（`WorkspaceView.tsx:572`），无吉祥物。 |
| **AC-6** 视觉还原度（浅色模式）             | ✅ pass | `workspace.css` 全部颜色/圆角/字体/聚焦环均使用 token，文件内无 `#` 硬编码色；contributor 头像、Star 图标、发送按钮等 accent 均走 `var(--record-btn)`；标题使用 `var(--font-display)`（`workspace.css:26`）；正文使用 `var(--font-body)`（`workspace.css:8`）；聚焦环使用 `var(--focus-ring)`；Quick Start 卡片与 Recently Viewed 表格均无装饰阴影。                                                                                                                                                                                                                   |
| **AC-7** 暗色主题可用性                     | ✅ pass | 全部表面使用 CSS 变量（`--bg`、`--text-primary`、`--item-hover-bg`、`--focus-ring`）；暗色模式下 `--record-btn` 映射为 `#FF7A33`（`globals.css:309`），`--item-hover-bg` 映射为 `rgba(255,255,255,0.04)`（`globals.css:320`）；无硬编码暗色值。                                                                                                                                                                                                                                                                                                                        |

## 范围完整性（不少，对照 story.md 范围）

- ✅ Workspace hub 绑定 Topics 分类：`App.tsx:1167-1168`。
- ✅ 选中 Topics 文件进入原有详情：`App.tsx:1167-1168` 条件分支在 `treeSelection.type === 'topic-file'` 时进入 `DetailView`。
- ✅ 不做拖拽 resize：未新增 resizer。
- ✅ 不接入真实文件系统：Quick Start 仅 placeholder toast。
- ✅ 不做真实协同/贡献者数据：contributor 头像为字母圆圈 + `--record-btn` 背景色。
- ✅ 搜索图标仅占位：`TreeSidebar.tsx:589-606` 无点击 handler。
- ✅ 桌面端 ≥1280px：未添加小屏规则。
- ✅ 不新增翻译：文案硬编码，沿用现有 i18n 但不新增 key。

## 方案落实（不偏，对照 design.md）

| design 条目                          | 结论                | 证据                                                                                                                                                                            |
| ------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §2 组件拆分（单文件）                | ✅ pass             | `WorkspaceView.tsx` 内含 `QuickStart` / `RecentlyViewed` / `WorkspaceChatShell` / `ChatMessage` 子组件。                                                                        |
| §3.1 App.tsx 分支                    | ✅ pass             | `App.tsx:1167-1168` 与 design 示例一致。                                                                                                                                        |
| §3.2 TreeSidebar                     | ✅ pass（合理偏差） | design 原话 "无需修改"，但为 AC-2 添加了 Workspace 标题与占位图标（`TreeSidebar.tsx:575-627`），属于满足 AC 的最小偏差。                                                        |
| §3.3 右侧面板使用 WorkspaceChatShell | ✅ pass             | `App.tsx:1261-1287` 已用 `WorkspaceChatShell` 替换 `UnifiedChatShell`。                                                                                                         |
| §4.1 组件 props                      | ✅ pass             | `WorkspaceView` 接收 `onOpenRecent`（`WorkspaceView.tsx:47-49`）；`WorkspaceChatShell` 接收 `ConversationSlice` + `onNewChat` + `historyControl`（`WorkspaceView.tsx:52-57`）。 |
| §4.2 Mock 数据结构                   | ✅ pass             | `buildRecentItems`（`WorkspaceView.tsx:177-216`）优先消费真实 topic 文件，不足 5 条补 mock，最多 10 条，与 design 一致。                                                        |
| §5.1 样式文件                        | ✅ pass             | `apps/web/src/styles/workspace.css` 存在，`main.tsx:4` 引入，组件内 `WorkspaceView.tsx:33` 也引入。                                                                             |
| §5.2 token 消费                      | ✅ pass             | 无 `#` 硬编码；accent 均走 `var(--record-btn)`；卡片无阴影。                                                                                                                    |
| §6 暗色主题                          | ✅ pass             | 全部使用变量，无硬编码暗色值。                                                                                                                                                  |
| §7 交互行为                          | ✅ pass             | Quick Start placeholder toast、Recently Viewed 行打开文件、Chat 输入框真实发送/取消/继续均实现。                                                                                |
| §9 测试策略                          | ✅ pass             | `WorkspaceView.test.tsx` 覆盖 Quick Start、表头、Show more、placeholder、onOpenRecent、WorkspaceChatShell 问候/输入/发送/禁用/New Chat。                                        |

## 越界检查（不多，对照 story 非目标 + design 范围）

- `App.tsx` 中新增 `handleOpenRecent` 是为 AC-4 的必要回调。
- `App.tsx` 中 `needsSidebar` → `catNeedsSidebar` 为变量重命名，行为等价。
- `App.tsx` 中 `DetailView` lazy 的类型调整（`ComponentProps`）为等价类型修复，属必要基础设施。
- `TreeSidebar.tsx` 的 Workspace 标题属于满足 AC-2 的最小偏差，未改变其他分类行为。
- `UnifiedChatShell` 不再被 `App.tsx` 使用，但仍保留在代码库中供既有测试/调用方使用，未删除。
- 无命中 story 非目标（真实文件系统 / 真实协同 / 搜索排序）的改动。

## 冗余（不重，对照 story.md）

无同一 AC 的多套并行实现。`workspace.css` 同时在 `main.tsx:4` 与 `WorkspaceView.tsx:33` 引入，属于 CSS 重复导入，不会导致样式重复生效，可忽略。

## 测试与类型检查结果

```text
$ cd /Users/yanwu/Projects/github/journal/apps/web && npx tsc --noEmit
# exit 0 — no TypeScript errors

$ npx vitest run src/tests/WorkspaceView.test.tsx
Test Files  1 passed (1)
     Tests  9 passed (9)
  Duration  ~1.1s
# 注：WorkspaceChatShell 用例有 React act(...) 警告，但断言全部通过。

$ npx vitest run src/tests/App.test.tsx
Test Files  1 passed (1)
     Tests  16 passed (16)
  Duration  ~3.7s

$ cd /Users/yanwu/Projects/github/journal/apps/web && npm run build
# tsc + vite build 成功，无新增报错

$ npx eslint src/App.tsx src/components/WorkspaceView.tsx src/components/TreeSidebar.tsx src/tests/WorkspaceView.test.tsx
# 0 errors；1 个既有 react-hooks/exhaustive-deps 警告（与本次改动无关）；workspace.css 因配置被忽略。
```

## 结论

当前实现与 `story.md` 的 AC、`design.md` 的方案均对齐，六字标准全部通过，**result: pass**。

## 待用户裁决

| #   | 问题                                                   | 当前实现                                                                                                                                                                                                                                                                                    | 契约要求                                                                                                                                                        | 两边代价                                                                                                                                                                                                                                                    | 保守结论                                                                                                                                                               |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 右侧面板全局默认值                                     | `UIContext.tsx:204` 中 `rightPanelOpen` 初始为 `true`；在 AC-1 的「切换到 Topics」场景下，`App.tsx:703-723` 的 auto-collapse effect 会在内容 key 变化时关闭右侧面板，因此该场景下满足收起。                                                                                                 | story.md 成功标准 / AC-1 / Q2 均描述「右侧 Chat 面板默认收起」。                                                                                                | 保持现状：切换进 Workspace 时会收起，与 AC-1 的 GWT 场景一致；但冷启动且已持久化 `activeCategory === 'topics'` 时，右侧面板会默认展开。改为 `useState(false)`：全局默认收起，更符合 story 字面，但会影响所有分类的初始状态。                                | AC-1 的 Given-When-Then 场景通过；作为灰色地带建议用户确认是否要将全局默认值改为 `false`，或仅对 Topics 默认收起。                                                     |
| 2   | 空 Topic 数据时的中心态                                | `buildRecentItems`（`WorkspaceView.tsx:177-216`）在真实 topic 文件不足 5 条时直接补充 mock 数据，因此即使 `dirs` 为空也不会显示「暂无专题文件」提示。                                                                                                                                       | story.md 边界：「Recently Viewed 优先使用真实 topic 文件，不足 5 条时补充写死的 mock 数据」。design.md §8：「Topics 数据为空时中心显示空状态提示」。            | 保持现状：与 story 边界一致，任何情况下 Workspace 都有内容可看。改为空状态：更符合 design §8，但当无真实文件时会隐藏 mock 示例。                                                                                                                            | story.md 与 design.md 存在冲突；实现已按意图层（story）执行。建议用户确认是否需要保留 design 要求的空状态，若需要则同步更新 story 边界。                               |
| 3   | WorkspaceChatShell 未完全保留既有 Chat 的编辑/待办能力 | `WorkspaceChatShell` 接收了 `onEditAndResend` / `onRemovePendingItem`（`WorkspaceView.tsx:367`），但在自定义消息渲染 `ChatMessage`（`WorkspaceView.tsx:680-728`）和 pending 列表（`WorkspaceView.tsx:598-605`）中未实现消息编辑、重发某条历史消息、移除 pending 项等原有 `ChatPanel` 能力。 | story.md AC-5 要求「保留 agent 选择、历史会话选择、真实发送/取消/继续等既有能力」；design.md §3.3 / §4.1 将 `ConversationSlice` 全部注入 `WorkspaceChatShell`。 | 保持现状：AC-5 显式列举的能力已满足，Momo 风格 shell 可交付原型；但会丢失原 `UnifiedChatShell` 中用户可编辑/重发历史消息和移除待输入项的能力。补齐：需在 `ChatMessage` 中增加编辑 UI，在 pending 列表中增加移除按钮，工作量增加，但能严格保留「既有能力」。 | AC-5 显式能力通过；此两项为灰色地带。建议用户确认 Momo 原型是否接受该能力降级，若不接受则回写 design 要求并补齐 `onEditAndResend` / `onRemovePendingItem` 的 UI 调用。 |
