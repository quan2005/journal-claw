---
story: ./story.md
design: ./design.md
date: 2026-07-01
round: 1
result: fail
scope: git diff 覆盖 apps/web/src/App.tsx、apps/web/src/main.tsx；新增文件 apps/web/src/components/WorkspaceView.tsx、apps/web/src/styles/workspace.css、apps/web/src/tests/WorkspaceView.test.tsx
---

# 验收报告 — 在谨迹中复刻 Momo 工作空间 UI，作为桌面端 Workspace 入口视图

## AC 核对（对照 story.md）

| AC                                        | 结论       | 证据                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 — Workspace 作为 Topics 分类的新视图 | ✅ pass    | `apps/web/src/App.tsx:1117-1118`：当 `activeCategory === 'topics'` 且未选中具体文件（`!treeSelection \|\| treeSelection.type === 'topic'`）时渲染 `<WorkspaceView />`，选中 `topic-file` 时仍回退到 `DetailView`；`App.test.tsx` 现有 Topics 相关用例通过。                                                                                                                                                     |
| AC-2 — 文件树与 Workspace 结构            | ⚠️ partial | `App.tsx:1058-1080` 复用现有 `TreeSidebar`，Topics 导航可用。但 story 要求「顶部可显示『Workspace』标题与搜索/视图图标」，且 `design.md` §2 明确列出内部子组件 `WorkspaceHeader`；实现中 `WorkspaceView.tsx:138-149` 仅渲染 `QuickStart` + `RecentlyViewed`，无标题栏/搜索/视图图标。                                                                                                                           |
| AC-3 — Quick Start 操作区                 | ✅ pass    | `WorkspaceView.tsx:151-179` 实现 `New File`、`New Folder`、`Import` 三卡片，图标与文案一致；点击通过 `placeholderAction` 派发 toast，不调用后端。`WorkspaceView.test.tsx:10-15`、`31-35` 通过。                                                                                                                                                                                                                 |
| AC-4 — Recently Viewed 列表               | ✅ pass    | `WorkspaceView.tsx:181-250` 渲染表头 Name / Contributors / Viewed，含文件图标、文件名、路径副标题、贡献者头像、相对时间；`Show more` 可展开更多行。`WorkspaceView.test.tsx:17-29` 通过。注：mock 数据为 8 条，与 design.md §4.2 写的「5 条展开到 10 条」不一致。                                                                                                                                                |
| AC-5 — 右侧 AI Chat 面板                  | ⚠️ partial | `WorkspaceView.tsx:254-379` + `App.tsx:1198-1200` 实现 `WorkspaceChatShell`，含 New Chat 头部、Plus/Copy/Pin 操作、输入框、附件按钮、模型选择器（Sonnet 4.6 / 1M Medium）、语音按钮、发送按钮；回车仅本地追加消息；空输入时发送按钮禁用。`WorkspaceView.test.tsx:39-57` 通过。但空状态问候区渲染了 🌟 emoji 头像（`WorkspaceView.tsx:307-310`），与 story「不放置吉祥物头像」及 design 决策「纯文字问候」冲突。 |
| AC-6 — 视觉还原度（浅色模式）             | ✅ pass    | `workspace.css` 使用 `--bg`、`--text-primary`、`--divider`、`--radius-lg/md`、`--focus-ring`、`--font-display`、`--font-body`、`--font-mono` 等 token；卡片无边框阴影；间距落在 8pt 网格；唯一 accent 为 `--record-btn`（#FF5701），无第二交互色。                                                                                                                                                              |
| AC-7 — 暗色主题可用性                     | ✅ pass    | 颜色自动随 CSS 变量切换；`apps/web/src/styles/globals.css:309` 暗色下 `--record-btn: #ff7a33`，满足 story 对信号橙暗色版的要求；文字/悬停/聚焦环均使用现有暗色 token。                                                                                                                                                                                                                                          |

## 范围完整性（对照 story.md 范围）

- Workspace 仅绑定 Topics 分类：`App.tsx:1117` 明确限制为 `activeCategory === 'topics'`。
- 选中 Topics 文件后仍进入原有详情视图：`App.tsx:1119-1155` 回退 `DetailView`。
- 移动端/平板未做额外适配，未新增多语言 key。
- 未接入真实文件系统、AI 后端、协同贡献者数据、搜索排序。

## 方案落实（对照 design.md）

- **App.tsx 中心渲染分支**：`App.tsx:1117-1118` 与 design.md §3.1 方案一致。
- **左侧 TreeSidebar**：直接复用，未修改，符合 design.md §3.2。
- **右侧 Chat**：在 Topics 分类下使用独立 `WorkspaceChatShell` 占位，不接入 `useConversation`，符合 design.md §3.3 的决策。
- **组件自包含/mock 数据**：`WorkspaceView` 无外部 props，内部 mock，符合 design.md §4.1。
- **样式文件与 token**：新增 `workspace.css` 并在 `main.tsx:4` 引入；token 消费与 design.md §5 基本一致。个别 token 选择有偏差：design.md §5.2 建议 Quick Start 卡片 hover 使用 `--workbench-btn-primary-bg`，实现使用 `--item-hover-bg` + `--divider-hover`，不影响可用性。
- **暗色主题**：依赖现有 CSS 变量，符合 design.md §6。
- **测试策略**：新增 `WorkspaceView.test.tsx`，覆盖 Quick Start、Recently Viewed、Show more、占位动作、Chat 输入，符合 design.md §9。

## 越界检查（对照 story 非目标 + design 范围）

- ❌ `apps/web/src/styles/workspace.css:419-545` 存在一整段 `.workspace-sidebar` 样式，但 `WorkspaceView.tsx` 中并无对应组件，属于死代码/过度实现，应删除。
- ❌ `App.tsx` diff 中除了 Workspace 分支外，还删除了左右分栏的 toggle 按钮（`ChevronLeft`/`ChevronRight`），并新增了 `needsSidebar` memo。这些改动未在 `story.md`/`design.md` 的本故事范围内描述，且与当前目录下另一个未合入故事 `20260701-hide-sidebar-for-fullscreen-workspaces` 的方向疑似重合，存在范围串扰。建议确认是否应由本故事携带。

## 冗余（对照 story.md）

- 未发现同一 AC 的重复实现。
- `.workspace-sidebar` CSS 可视为未使用的冗余样式。

## 结论

**结果：fail。**

主要偏差：

1. AC-2 未实现 `WorkspaceHeader`（Workspace 标题 + 搜索/视图图标）。
2. AC-5 问候区放置了 🌟 emoji 头像，违反「不放置吉祥物头像/纯文字问候」的明确要求。
3. `workspace.css` 中存在与实现无关的 `.workspace-sidebar` 死代码。
4. `App.tsx` 中夹杂了属于其他潜在需求的侧边栏 toggle 移除改动，需剥离或明确归属。
5. mock 数据条数（8 条）与 design.md 所述（5 条/10 条）不一致，建议对齐或更新 design。

按风险排序的修复建议：

1. 移除 `WorkspaceChatShell` 中的 `workspace-chat__avatar` emoji，改为纯文字问候并垂直居中。
2. 在 `WorkspaceView` 顶部补 `WorkspaceHeader`（标题 + 搜索/视图图标占位）。
3. 删除 `workspace.css` 中 `.workspace-sidebar` 全部未使用样式。
4. 将 `App.tsx` 中 sidebar toggle 移除的改动移回其所属故事；本故事仅保留 Workspace 渲染分支与 `WorkspaceChatShell` 替换逻辑。
5. 调整 `MOCK_RECENT` 为 5/10 条或同步更新 design.md。

修复后建议进行 Round 2 复验。
