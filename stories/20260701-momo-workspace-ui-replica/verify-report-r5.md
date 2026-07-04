---
story: ./story.md
design: ./design.md
date: 2026-07-01
round: 5
result: pass
scope: 'git diff HEAD -- apps/web/src/App.tsx apps/web/src/components/WorkspaceView.tsx apps/web/src/components/TreeSidebar.tsx apps/web/src/styles/workspace.css apps/web/src/main.tsx apps/web/src/tests/WorkspaceView.test.tsx apps/web/src/tests/App.test.tsx stories/20260701-momo-workspace-ui-replica/story.md stories/20260701-momo-workspace-ui-replica/design.md'
---

# 验收报告 — 在谨迹中复刻 Momo 工作空间 UI，作为桌面端 Workspace 入口视图（Round 5）

## 复核说明

本轮在 r4 基础上，重新独立核对当前工作区与 `story.md` / `design.md` 的对齐情况。`story.md`、`design.md` 相对 `HEAD` 无变更；`WorkspaceView.tsx`、`workspace.css`、`WorkspaceView.test.tsx` 为新增未跟踪文件，`App.tsx`、`TreeSidebar.tsx`、`main.tsx` 仍为已修改状态。

## 质量 gate 结果（六字标准）

| 六字标准 | 结论    | 关键证据                                                                                                 |
| -------- | ------- | -------------------------------------------------------------------------------------------------------- |
| **不漏** | ✅ pass | AC-1 ~ AC-7 均能在代码中定位到实现位置，见下表。                                                         |
| **不重** | ✅ pass | Workspace hub 能力集中在 `WorkspaceView.tsx`，无并行实现。                                               |
| **不偏** | ✅ pass | 各 AC 的 Then 子句均能在代码/测试中找到对应行为；与 design 方案一致。                                    |
| **不倚** | ✅ pass | 无 TODO / stub / 静默降级；Quick Start、Recently Viewed、Chat 占位均完整实现。                           |
| **不多** | ✅ pass | diff 中所有改动可归入 AC、design 范围或必要基础设施；无新增越界功能。                                    |
| **不少** | ✅ pass | design.md 要求的组件拆分、App.tsx 分支、样式文件、暗色变量、`prefers-reduced-motion`、测试文件均已落实。 |

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC                                          | 结论    | 证据                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC-1** Workspace 作为 Topics 分类的新视图 | ✅ pass | `App.tsx:1170-1171` 在 `activeCategory === 'topics' && (!treeSelection \|\| treeSelection.type === 'topic')` 时渲染 `<WorkspaceView onOpenRecent={handleOpenRecent} />`；左侧 Topics 树仍由 `TreeSidebar.tsx:836-1003` 渲染；右侧面板收起/展开由 `App.tsx:1225-1238` 的现有 toggle 控制，切换内容时 `App.tsx:706-717` 的 auto-collapse effect 会关闭右侧面板。 |
| **AC-2** 文件树与 Workspace 结构            | ✅ pass | `TreeSidebar.tsx:575-627` 在 `category === 'topics'` 时渲染 "Workspace" 标题与 Search / LayoutGrid 占位图标；原有 Topics 树仍在 `TreeSidebar.tsx:971-1001` 渲染，文件夹展开/折叠行为不变。                                                                                                                                                                     |
| **AC-3** Quick Start 操作区                 | ✅ pass | `WorkspaceView.tsx:220-247` 渲染 New File / New Folder / Import 三卡片；点击调用 `placeholderAction`（`WorkspaceView.tsx:153-159`）派发 `show-toast` 占位事件，不调用后端。                                                                                                                                                                                    |
| **AC-4** Recently Viewed 列表               | ✅ pass | `WorkspaceView.tsx:250-333` 渲染 Name / Contributors / Viewed 表头、文件图标、副标题、contributor 头像、相对时间与 Show more；行点击通过 `onOpenRecent` 进入 `DetailView`；`buildRecentItems`（`WorkspaceView.tsx:161-200`）优先消费 `useTopics` 真实文件、不足 5 条补 mock，与 story 边界一致。`WorkspaceView.test.tsx:46-53` 新增点击行回调断言。            |
| **AC-5** 右侧 AI Chat 面板                  | ✅ pass | `App.tsx:1263-1288` 复用现有 `RightPanel` + `UnifiedChatShell`，保留 agent 选择、历史会话选择、真实发送等既有能力；进入 Topics 不丢失 Chat 功能。`WorkspaceChatShell` 虽保留在 `WorkspaceView.tsx:337-451` 但未在 App 中使用，符合 design §3.3 "供后续启用" 的说明。                                                                                           |
| **AC-6** 视觉还原度（浅色模式）             | ✅ pass | `workspace.css` 全部颜色/圆角/字体/阴影均使用 token；`workspace.css` 中无 `#` 硬编码色；contributor 头像、发送按钮、Star 等 accent 均走 `var(--record-btn)`；标题使用 `var(--font-display)`（`workspace.css:26`）；正文使用 `var(--font-body)`（`workspace.css:8`）；聚焦环使用 `var(--focus-ring)`；卡片无装饰阴影。                                          |
| **AC-7** 暗色主题可用性                     | ✅ pass | 全部表面使用 CSS 变量（`--bg`、`--text-primary`、`--item-hover-bg`、`--focus-ring`）；暗色模式下 `--record-btn` 映射为 `#FF7A33`（`globals.css:309`）；无硬编码暗色值。                                                                                                                                                                                        |

## 范围完整性（不少，对照 story.md 范围）

- ✅ Workspace hub 绑定 Topics 分类：`App.tsx:1170-1171`。
- ✅ 选中 Topics 文件进入原有详情：`App.tsx:1170-1171` 条件分支。
- ✅ 不做拖拽 resize：未新增 resizer。
- ✅ 不接入真实文件系统：Quick Start 仅 placeholder toast。
- ✅ 不接入真实 AI 聊天：`WorkspaceChatShell` 本地 state，App 中未替换真实 `UnifiedChatShell`。
- ✅ 不做真实协同/贡献者数据：contributor 头像为字母圆圈 + 单一 token 色。
- ✅ 搜索图标仅占位：`TreeSidebar.tsx:589-606` 无点击 handler。
- ✅ 桌面端 ≥1280px：未添加小屏规则。
- ✅ 不新增翻译：文案硬编码，沿用现有 i18n 但不新增 key。

## 方案落实（不偏，对照 design.md）

| design 条目                               | 结论                | 证据                                                                                                         |
| ----------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| §2 组件拆分（单文件）                     | ✅ pass             | `WorkspaceView.tsx` 内含 QuickStart / RecentlyViewed / WorkspaceChatShell 子组件。                           |
| §3.1 App.tsx 分支                         | ✅ pass             | `App.tsx:1170-1171` 与 design 示例一致。                                                                     |
| §3.2 TreeSidebar                          | ✅ pass（合理偏差） | design 原话 "无需修改"，但为 AC-2 添加了 Workspace 标题与占位图标，属于满足 AC 的最小偏差。                  |
| §3.3 右侧面板使用 UnifiedChatShell        | ✅ pass             | `App.tsx:1263-1288` 在所有分类继续使用 `UnifiedChatShell`。                                                  |
| §4.2 Mock 数据结构                        | ✅ pass             | `buildRecentItems`（`WorkspaceView.tsx:161-200`）优先消费真实 topic 文件，不足 5 条补 mock，与 design 一致。 |
| §5.1 样式文件                             | ✅ pass             | `apps/web/src/styles/workspace.css` 存在，`main.tsx:4` 引入。                                                |
| §5.2 token 消费                           | ✅ pass             | 无 `#818cf8` 等硬编码；accent 均走 `var(--record-btn)`。                                                     |
| §6 暗色主题                               | ✅ pass             | 全部使用变量，无硬编码暗色值。                                                                               |
| §7 交互行为（Recently Viewed 行打开文件） | ✅ pass             | `handleOpenRecent`（`App.tsx:645-661`）设置 `treeSelection` 为 `topic-file` 并切回主视图。                   |
| §9 测试策略                               | ✅ pass             | `WorkspaceView.test.tsx` 覆盖 Quick Start、表头、Show more、本地 Chat 发送、onOpenRecent 回调。              |

## 越界检查（不多，对照 story 非目标 + design 范围）

本轮 diff 未引入新的越界功能：

- `App.tsx` 中 `needsSidebar` → `catNeedsSidebar` 仅为变量重命名，行为与 `HEAD` 一致。
- `App.tsx` 中 `DetailView` lazy 的类型调整（`ComponentProps`）为等价类型修复，行为未变，属必要基础设施。
- `TreeSidebar.tsx` 的 Workspace 标题属于满足 AC-2 的最小偏差，未改变其他分类行为。
- 无命中 story 非目标（真实文件系统 / 真实 AI / 协同权限 / 搜索排序）的改动。

## 冗余（不重，对照 story.md）

无同一 AC 的多套并行实现。`workspace.css` 同时在 `main.tsx:4` 与 `WorkspaceView.tsx:19` 引入，属于 CSS 重复导入，不会导致样式重复生效，可忽略。

## 测试与类型检查结果

```text
$ cd /Users/yanwu/Projects/github/journal/apps/web && npx tsc --noEmit
# exit 0 — no TypeScript errors

$ npx vitest run src/tests/WorkspaceView.test.tsx src/tests/App.test.tsx
Test Files  2 passed (2)
     Tests  24 passed (24)
  Duration  3.28s

$ cd /Users/yanwu/Projects/github/journal/apps/web && npm run build
# tsc + vite build 成功，无新增报错

$ cd /Users/yanwu/Projects/github/journal && npm run lint
apps/web lint: ✖ 9 problems (0 errors, 9 warnings)
# 9 warnings 均为既有问题；WorkspaceView.tsx / workspace.css / App.tsx 本次改动部分无新增 lint 报错。
```

## 结论

当前实现与 `story.md`、`design.md` 对齐，六字标准全部通过，**result: pass**。

## 待用户裁决

| #   | 问题               | 当前实现                                                                                                                                                                                    | 契约要求                                      | 两边代价                                                                                                                                                                                                                     | 保守结论                                                                                                          |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | 右侧面板全局默认值 | `UIContext.tsx:204` 中 `rightPanelOpen` 初始为 `true`；在 AC-1 的「切换到 Topics」场景下，`App.tsx:706-717` 的 auto-collapse effect 会在内容 key 变化时关闭右侧面板，因此该场景下满足收起。 | story.md 多处描述为「右侧 Chat 面板默认收起」 | 保持现状：切换进 Workspace 时会收起，与 AC-1 的 GWT 场景一致；但冷启动且已持久化 `activeCategory === 'topics'` 时，右侧面板会默认展开。改为 `useState(false)`：全局默认收起，更符合 story 字面，但会影响所有分类的初始状态。 | AC-1 的 Given-When-Then 场景通过；作为灰色地带建议用户确认是否要将全局默认值改为 `false` 或仅对 Topics 默认收起。 |
