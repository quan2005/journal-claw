---
story: ./story.md
design: ./design.md
date: 2026-07-02
round: 7
result: fail
scope: "git diff HEAD -- apps/web/src/App.tsx apps/web/src/components/WorkspaceView.tsx apps/web/src/components/TreeSidebar.tsx apps/web/src/styles/workspace.css apps/web/src/main.tsx apps/web/src/tests/WorkspaceView.test.tsx stories/20260701-momo-workspace-ui-replica/story.md stories/20260701-momo-workspace-ui-replica/design.md"
---

# 验收报告 — 在谨迹中复刻 Momo 工作空间 UI，作为桌面端 Workspace 入口视图（Round 7）

## 复核说明

本轮重点核对第 6 轮报告中 3 个「待用户裁决」项的处置情况：

1. **右侧面板全局默认值**：`story.md` 边界已更新为「不强制右侧面板全局默认收起：Workspace 入口场景（切换到 Topics 且未选中文件）下右侧面板会收起；全局 `rightPanelOpen` 初始值保持既有行为不变」。
2. **空 Topics 数据时的中心态**：`story.md` 边界已更新为「Recently Viewed 优先使用真实 topic 文件，不足 5 条时补充写死的 mock 数据（Topics 为空时亦展示 mock）」。
3. **Chat 辅助能力范围**：`story.md` 边界已新增「不补齐原 Chat 面板的所有辅助能力：单条消息编辑、历史消息重发、pending 项单独移除等未在 AC-5 明确要求的能力本次不迁移，保留核心发送/取消/继续/重试」。

实现代码相对第 6 轮无变更；契约更新已覆盖上述三项，因此本轮不再将其列为待裁决。但按六字标准重新全量核对后，发现 `workspace.css` 中存在圆角未消费设计 token 的情况，导致 `AC-6` 未通过。

## 质量 gate 结果（六字标准）

| 六字标准 | 结论 | 关键证据 |
|---|---|---|
| **不漏** | ✅ pass | AC-1 ~ AC-7 均能在代码中定位到实现位置，见下表。 |
| **不重** | ✅ pass | Workspace hub 能力集中在 `WorkspaceView.tsx`；`WorkspaceChatShell` 已替换 `UnifiedChatShell` 在 `App.tsx` 中的使用，无并行实现同一 AC 的情况。 |
| **不偏** | ❌ fail | `AC-6` 中 `workspace.css` 存在 6 处圆角未消费 `--radius-*` token（`workspace.css:266/296/319/350/716/744`）。 |
| **不倚** | ✅ pass | 无 TODO / stub / 静默降级；Quick Start、Recently Viewed、Chat shell 均完整实现。 |
| **不多** | ✅ pass | diff 中所有改动可归入 AC、design 范围或必要基础设施；无新增越界功能。 |
| **不少** | ✅ pass | `WorkspaceView` 组件、`workspace.css`、`App.tsx` 分支、`TreeSidebar` 标题区、`main.tsx` 引入、测试文件均已落实。 |

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| **AC-1** Workspace 作为 Topics 分类的新视图 | ✅ pass | `App.tsx:1166-1167` 在 `activeCategory === 'topics' && (!treeSelection \|\| treeSelection.type === 'topic')` 时渲染 `<WorkspaceView onOpenRecent={handleOpenRecent} />`；左侧 Topics 树仍由 `TreeSidebar.tsx:836-1003` 渲染；`App.tsx:703-712` 的 auto-collapse effect 在内容 key 变化时关闭右侧面板，`UIContext.tsx:204` 保持全局 `rightPanelOpen` 既有初始值 `true`。 |
| **AC-2** 文件树与 Workspace 结构 | ✅ pass | `TreeSidebar.tsx:575-627` 在 `category === 'topics'` 时渲染「Workspace」标题与 Search / LayoutGrid 占位图标；文件夹展开/折叠与文件选择仍由 `TopicTree` 提供（`TreeSidebar.tsx:881-891` / `:971+`）。 |
| **AC-3** Quick Start 操作区 | ✅ pass | `WorkspaceView.tsx:245-272` 渲染 New File / New Folder / Import 三卡片；点击调用 `placeholderAction`（`WorkspaceView.tsx:178-184`）派发 `show-toast` 占位事件，不调用后端。 |
| **AC-4** Recently Viewed 列表 | ✅ pass | `WorkspaceView.tsx:275-358` 渲染 Name / Contributors / Viewed 表头、文件图标、副标题、contributor 字母头像、相对时间与 Show more；`buildRecentItems`（`WorkspaceView.tsx:186-225`）优先消费 `useTopics` 真实文件、不足 5 条补 mock、最多 10 条；行点击通过 `onOpenRecent` 进入 `DetailView`。`WorkspaceView.test.tsx:91-110` 覆盖 Show more 与行点击回调。 |
| **AC-5** 右侧 AI Chat 面板 | ✅ pass | `App.tsx:1262-1279` 将 `WorkspaceChatShell` 注入 `useConversation` 的真实 `sessionId`、`messages`、`isStreaming`、`send`、`cancel`、`retry`、`onContinue` 等；`WorkspaceView.tsx:562-865` 的 `WorkspaceChatShell` 内部集成 `useAgentEngine` / `useAgentRun` / `EngineSwitcher` / `AuthModeToggle` / `MarkdownRenderer` / `RunStreamEntries`；`SessionDropdown`（`WorkspaceView.tsx:362-558`）提供顶部「New Chat」下拉框，支持搜索/切换/删除会话；空状态为纯文字问候 `闫戍's momo`（`WorkspaceView.tsx:752`），无吉祥物。 |
| **AC-6** 视觉还原度（浅色模式） | ❌ fail | 颜色无 `#` 硬编码、阴影走 `--shadow-overlay`、菜单边框走 `--border-menu`、聚焦环走 `--focus-ring`、标题/正文/代码字体栈正确。但 `workspace.css` 中仍有 6 处圆角未消费 `--radius-*` token：`workspace.css:266`（会话搜索框 `6px`）、`:296`（下拉项 `6px`）、`:319`（新建项顶部圆角 `6px`）、`:350`（删除按钮 `4px`）、`:716`（流式指示器 `50%`）、`:744`（取消停止块 `2px`）。 |
| **AC-7** 暗色主题可用性 | ✅ pass | 全部表面使用 CSS 变量（`--bg`、`--text-primary`、`--item-hover-bg`、`--focus-ring`）；暗色模式下 `--record-btn` 映射为 `#FF7A33`（`globals.css:309`），`--item-hover-bg` 映射为 `rgba(255,255,255,0.04)`（`globals.css:320`）；无硬编码暗色值。 |

## 范围完整性（不少，对照 story.md 范围）

- ✅ Workspace hub 绑定 Topics 分类：`App.tsx:1166-1167`。
- ✅ 选中 Topics 文件进入原有详情：`App.tsx:1166-1167` 条件分支在 `treeSelection.type === 'topic-file'` 时进入 `DetailView`。
- ✅ 不做拖拽 resize：未新增 resizer。
- ✅ 不接入真实文件系统：Quick Start 仅 placeholder toast。
- ✅ 不做真实协同/贡献者数据：contributor 头像为字母圆圈 + `--record-btn` 背景色。
- ✅ 搜索图标仅占位：`TreeSidebar.tsx:589-606` 无点击 handler。
- ✅ 桌面端 ≥1280px：未添加小屏规则。
- ✅ 不新增翻译：文案硬编码，沿用现有 i18n 但不新增 key。
- ✅ 右侧面板全局默认值保持既有：story.md 边界已明确，`UIContext.tsx:204` 未修改。
- ✅ 空 Topics 仍展示 mock：`buildRecentItems`（`WorkspaceView.tsx:186-225`）在真实文件不足 5 条时补充 mock。
- ✅ 不迁移未明确要求的能力：`WorkspaceChatShell` 未实现消息编辑/历史重发/pending 移除，与 story.md 边界一致。

## 方案落实（不偏，对照 design.md）

| design 条目 | 结论 | 证据 |
|---|---|---|
| §2 组件拆分（单文件） | ✅ pass | `WorkspaceView.tsx` 内含 `QuickStart` / `RecentlyViewed` / `SessionDropdown` / `WorkspaceChatShell` / `ChatMessage`。 |
| §3.1 App.tsx 分支 | ✅ pass | `App.tsx:1166-1167` 与 design 示例一致。 |
| §3.2 TreeSidebar | ✅ 合理偏差 | design 原话「无需修改」，但为 AC-2 添加了 Workspace 标题与占位图标（`TreeSidebar.tsx:575-627`），属于满足 AC 的最小偏差。 |
| §3.3 右侧面板使用 WorkspaceChatShell | ✅ pass | `App.tsx:1262-1279` 已用 `WorkspaceChatShell` 替换 `UnifiedChatShell`。 |
| §4.1 组件 props | ✅ pass | `WorkspaceView` 接收 `onOpenRecent`（`WorkspaceView.tsx:54-56`）；`WorkspaceChatShell` 接收 `ConversationSlice` + `onNewChat` + `onSelectSession` + `activeSessionId`（`WorkspaceView.tsx:59-66`）。 |
| §4.2 Mock 数据结构 | ✅ pass | `buildRecentItems`（`WorkspaceView.tsx:186-225`）优先消费真实 topic 文件，不足 5 条补 mock，最多 10 条。 |
| §5.1 样式文件 | ✅ pass | `apps/web/src/styles/workspace.css` 存在，`main.tsx:4` 引入，组件内 `WorkspaceView.tsx:40` 也引入。 |
| §5.2 token 消费 | ❌ 部分未落实 | 颜色/字体/阴影/菜单边框/聚焦环均走 token，但圆角存在 6 处硬编码，详见 AC-6 fail 证据。 |
| §6 暗色主题 | ✅ pass | 全部使用变量，无硬编码暗色值。 |
| §7 交互行为 | ✅ pass | Quick Start placeholder toast、Recently Viewed 行打开文件、Chat 输入框真实发送/取消/继续、会话下拉切换/删除均实现。 |
| §9 测试策略 | ✅ pass | `WorkspaceView.test.tsx` 覆盖 Quick Start、表头、Show more、placeholder、onOpenRecent、WorkspaceChatShell 问候/输入/发送/禁用/New Chat。 |

**注**：design.md §8 提到「Topics 数据为空时中心显示空状态提示」，与 story.md 已更新边界（空 Topics 亦展示 mock）冲突。实现已按意图层（story.md）执行，本报告将其视为 story 覆盖 design 的合理冲突，不记为 fail。

## 越界检查（不多，对照 story 非目标 + design 范围）

- `App.tsx` 中新增 `handleOpenRecent` 是为 AC-4 的必要回调。
- `App.tsx` 中 `needsSidebar` → `catNeedsSidebar` 为变量重命名，行为等价。
- `App.tsx` 中 `DetailView` lazy 的类型调整（`ComponentProps`）为等价类型修复，属必要基础设施。
- `TreeSidebar.tsx` 的 Workspace 标题属于满足 AC-2 的最小偏差，未改变其他分类行为。
- `UnifiedChatShell` 不再被 `App.tsx` 使用，但仍保留在代码库中供既有调用方使用，未删除。
- 无命中 story 非目标（真实文件系统 / 真实协同 / 搜索排序 / 额外 Chat 实现）的改动。

## 冗余（不重，对照 story.md）

无同一 AC 的多套并行实现。`workspace.css` 同时在 `main.tsx:4` 与 `WorkspaceView.tsx:40` 引入，属于 CSS 重复导入，不会导致样式重复生效，可忽略。

## 测试与类型检查结果

```text
$ cd /Users/yanwu/Projects/github/journal/apps/web && npx tsc --noEmit
# exit 0 — no TypeScript errors

$ npx vitest run src/tests/WorkspaceView.test.tsx
Test Files  1 passed (1)
     Tests  9 passed (9)
  Duration  ~1.0s

$ npx vitest run src/tests/App.test.tsx
Test Files  1 passed (1)
     Tests  16 passed (16)
  Duration  ~3.2s

$ cd /Users/yanwu/Projects/github/journal/apps/web && npm run build
# tsc + vite build 成功，无新增报错

$ npx eslint src/App.tsx src/components/WorkspaceView.tsx src/components/TreeSidebar.tsx src/tests/WorkspaceView.test.tsx
# 0 errors；1 个既有 react-hooks/exhaustive-deps 警告（与本次改动无关）
```

## 结论

当前实现与 `story.md` 的 AC 在行为层面基本对齐，第 6 轮的 3 个待裁决项已通过契约更新得到明确。但 `AC-6` 因 `workspace.css` 中圆角未全部消费 `--radius-*` token 而未通过，故本轮总结果：**result: fail**。

按风险排序的修复建议：

1. **低风险的 6px/50% 硬编码**：将 `workspace.css:266/296/319` 的 `6px` 替换为 `var(--radius-md)`；将 `:716` 的 `50%` 替换为 `var(--radius-pill)`。这些值与 token 定义完全等价，改动无副作用。
2. **需要设计决策的 4px/2px 硬编码**：`workspace.css:350` 删除按钮的 `4px` 与 `:744` 取消停止块的 `2px` 没有对应 token。可选方案：
   - 引入新的 `--radius-xs`（如 4px）/ `--radius-xxs`（如 2px）token 并同步更新 `design.md` 与 `globals.css`；
   - 或回写 `story.md` / `design.md`，明确允许微小装饰元素使用不超过 4px 的硬编码圆角。
3. 修复后重新运行 `npx vitest run src/tests/WorkspaceView.test.tsx` 与 `npm run build` 确认无回归。

## 待用户裁决

无。第 6 轮遗留的 3 项已通过契约更新明确，不再作为灰色地带。
