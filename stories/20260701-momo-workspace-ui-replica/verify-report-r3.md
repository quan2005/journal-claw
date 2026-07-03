---
story: ./story.md
design: ./design.md
date: 2026-07-01
round: 3
result: fail
scope: "git diff HEAD -- apps/web/src/App.tsx apps/web/src/components/WorkspaceView.tsx apps/web/src/components/TreeSidebar.tsx apps/web/src/styles/workspace.css apps/web/src/main.tsx apps/web/src/tests/WorkspaceView.test.tsx apps/web/src/tests/App.test.tsx"
---

# 验收报告 — 在谨迹中复刻 Momo 工作空间 UI，作为桌面端 Workspace 入口视图（Round 3）

## 复核说明

本轮重点核对 Round 2 的 4 项 fail / over-implementation：

1. Recently Viewed 行未打开文件 —— 已修复。
2. Chat 历史图标错误 —— 已修复。
3. workspace.css 硬编码 `#fff` / `12px` —— 已修复。
4. 全局移除左右 divider toggle 按钮 —— 不再只移除按钮，而是把整个左侧边栏 + divider 用 `needsSidebar` 条件渲染，影响 ideas / automation / skills 三个分类的显示行为。

Round 3 在修复旧问题的同时引入了新的越界与视觉 token 违规，因此结论仍为 **fail**。

## 质量 gate 结果

| 六字标准 | 结论 | 关键证据 |
|---|---|---|
| 不漏 | ✅ pass | 7 条 AC 均能在代码中找到对应实现位置（见下表）。 |
| 不重 | ✅ pass | Workspace 相关组件仅在 `WorkspaceView.tsx` 中实现，无并行实现。 |
| 不偏 | ❌ fail | AC-6 使用硬编码 `#818cf8` 作为 contributor 头像色，违反"无第二 accent 色"；AC-4 使用真实 topic 文件作为 Recently Viewed 数据源，与 story 边界"全部使用 mock"冲突。 |
| 不倚 | ⚠️ partial | AC-4 / AC-5 / AC-6 存在未按契约实现或测试未覆盖的细化点（详见 AC 核对）。 |
| 不多 | ❌ fail | `App.tsx:190-194` 引入 `needsSidebar`，将左侧边栏隐藏逻辑扩展到 ideas / automation / skills，超出 story / design 范围。 |
| 不少 | ✅ pass | design.md 中组件拆分、App.tsx 分支、样式文件、暗色变量、`prefers-reduced-motion`、测试文件均已落实。 |

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| **AC-1** Workspace 作为 Topics 分类的新视图 | ✅ pass | `App.tsx:1180-1181` 在 `activeCategory === 'topics' && (!treeSelection \|\| treeSelection.type === 'topic')` 时渲染 `<WorkspaceView onOpenRecent={handleOpenRecent} />`；右侧面板仍由现有 `rightPanelOpen` 状态控制，默认收起。 |
| **AC-2** 文件树与 Workspace 结构 | ✅ pass | `TreeSidebar.tsx:575-627` 在 `category === 'topics'` 时渲染 "Workspace" 标题与 Search / LayoutGrid 占位图标；原有 Topics 树仍在 `TreeSidebar.tsx:971` 渲染。 |
| **AC-3** Quick Start 操作区 | ✅ pass | `WorkspaceView.tsx:220-247` 渲染 New File / New Folder / Import 三卡片；点击调用 `placeholderAction` 派发 `show-toast` 占位事件，不调用后端。 |
| **AC-4** Recently Viewed 列表 | ⚠️ partial | `WorkspaceView.tsx:250-333` 已正确渲染 Name / Contributors / Viewed 表头、文件图标、副标题、contributor 头像、相对时间与 Show more；行点击通过 `onOpenRecent` 进入 `DetailView`（`App.tsx:651-667`）。**偏差：** `WorkspaceView.tsx:161-200` 的 `buildRecentItems` 优先从 `useTopics` 读取真实 topic 文件，仅在真实文件不足 5 条时才补 mock，违反 story 边界 "Contributors / recently viewed 数据全部使用 mock"。 |
| **AC-5** 右侧 AI Chat 面板 | ✅ pass | `WorkspaceChatShell`（`WorkspaceView.tsx:337-451`）在 `App.tsx:1276-1277` 接入右侧面板；含 New Chat 头部、问候语 "闫戍's momo"、输入框、附件、模型选择器 Sonnet 4.6 / 1M Medium、语音、发送按钮；回车仅本地追加用户消息。Round 2 的 `Copy` 历史图标已在 `WorkspaceView.tsx:381` 修复为 `History`。 |
| **AC-6** 视觉还原度（浅色模式） | ❌ fail | 大部分颜色、圆角、字体、阴影均使用 token（`workspace.css` 已无可检出硬编码色值）。**违规：** `WorkspaceView.tsx:52,61,70,79,88,97,106,115,124,133,182` 共 11 处将 contributor 头像背景硬编码为 `#818cf8`（靛蓝），引入第二 accent 色，违反 "颜色仅使用谨迹设计 token（白/暖白/墨文字/信号橙），无第二 accent 色"。 |
| **AC-7** 暗色主题可用性 | ✅ pass（未做真实窗口目视） | 全部表面使用 CSS 变量（`--bg`、`--text-primary`、`--item-hover-bg`、`--focus-ring`）；`--record-btn` 在暗色下映射为 `#FF7A33`。无硬编码暗色值。 |

## 范围完整性（不少，对照 story.md 范围）

story 范围 / design 范围条目核对：

- ✅ Workspace hub 绑定 Topics 分类：`App.tsx:1180-1181`。
- ✅ 选中 Topics 文件进入原有详情：`App.tsx:1180-1181` 条件分支。
- ✅ 不做拖拽 resize：未新增 resizer。
- ✅ 不接入真实文件系统：Quick Start 仅 placeholder toast。
- ✅ 不接入真实 AI 聊天：`WorkspaceChatShell` 本地 state，无 `useConversation`。
- ✅ 不做真实协同/贡献者数据：contributor 头像为字母圆圈（但数据源部分使用了真实 topic 文件，见 AC-4 / 越界检查）。
- ✅ 搜索图标仅占位：`TreeSidebar.tsx:589-606` 无点击 handler。
- ✅ 桌面端 ≥1280px：未添加小屏规则。
- ✅ 不新增翻译：文案硬编码，沿用现有 i18n 但不新增 key。

## 方案落实（不偏，对照 design.md）

| design 条目 | 结论 | 证据 |
|---|---|---|
| §2 组件拆分（单文件） | ✅ pass | `WorkspaceView.tsx` 内含 QuickStart / RecentlyViewed / WorkspaceChatShell 子组件。 |
| §3.1 App.tsx 分支 | ✅ pass | `App.tsx:1180-1181` 与 design 示例一致。 |
| §3.2 TreeSidebar | ✅ pass（合理偏差） | design 原话 "无需修改"，但为 AC-2 添加了 Workspace 标题与占位图标，属于满足 AC 的最小偏差。 |
| §3.3 右侧面板使用 WorkspaceChatShell | ✅ pass | `App.tsx:1276-1277` 在 Topics 分类下替换 `UnifiedChatShell`。 |
| §4.2 Mock 数据结构 | ❌ fail | design 要求 Recently Viewed 使用写死 5 条 mock 并展开到 10 条；实现优先使用真实 topic 条目（`WorkspaceView.tsx:161-200`）。 |
| §5.1 样式文件 | ✅ pass | `apps/web/src/styles/workspace.css` 存在，`main.tsx:4` 引入。 |
| §5.2 token 消费 | ❌ fail | `#818cf8` 硬编码色未走 token。 |
| §6 暗色主题 | ✅ pass | 全部使用变量，无硬编码暗色值。 |
| §7 交互行为（Recently Viewed 行打开文件） | ✅ pass | `handleOpenRecent`（`App.tsx:651-667`）设置 `treeSelection` 为 `topic-file` 并切回主视图。 |
| §9 测试策略 | ⚠️ partial | `WorkspaceView.test.tsx` 覆盖 Quick Start、表头、Show more、本地 Chat 发送；**未覆盖** `onOpenRecent` 被调用。 |

## 越界检查（不多，对照 story 非目标 + design 范围）

1. **左侧边栏全局隐藏逻辑**（越界）
   - `App.tsx:190-194` 新增 `needsSidebar`，将左侧边栏 + divider 的渲染限制在 `journal / identity / topics`；`handleCategoryChange`（`App.tsx:669-690`）也引入 `catNeedsSidebar`。
   - 原应用对所有分类都渲染左侧边栏；本次改动使 ideas / automation / skills 不再渲染左侧边栏容器与 toggle 按钮，属于全局行为变更，超出 "在 Topics 下新增 Workspace hub" 的范围。
   - 新增测试 `App.test.tsx`（"does not render left sidebar container or toggle button in fullscreen workspaces"）进一步证明这是独立功能行为，而非 Workspace 必要基础设施。

2. **Recently Viewed 使用真实 topic 文件数据**（边界冲突 / 越界）
   - 见 AC-4。story 边界明确要求 "Contributors / recently viewed 数据全部使用 mock"，`buildRecentItems` 却优先读取 `useTopics` 的真实目录条目。该行为虽让"Workspace 内直接点击打开"更真实，但已越过契约边界。

无其他无法归属到 AC / design / 必要基础设施的改动。

## 冗余（不重，对照 story.md）

无同一 AC 的多套并行实现。

## 测试与类型检查结果

```text
$ cd /Users/yanwu/Projects/github/journal/apps/web && npx tsc --noEmit
# exit 0 — no TypeScript errors

$ npx vitest run src/tests/WorkspaceView.test.tsx src/tests/App.test.tsx
Test Files  2 passed (2)
     Tests  24 passed (24)
  Duration  3.71s

$ cd /Users/yanwu/Projects/github/journal && npm run lint
apps/web lint: ✖ 9 problems (0 errors, 9 warnings)
# 9 warnings均为既有问题（含 App.tsx:908 的 useMemo 依赖等），无新增错误；WorkspaceView.tsx / workspace.css 无 lint 报错。
```

## 结论

Round 3 修复了 Round 2 的 3 项核心缺陷（Recently Viewed 可打开文件、历史图标、硬编码色值/圆角），但引入了新的越界与 token 违规，因此 **result: fail**。

按风险排序的修复建议：

1. **移除或隔离全局 sidebar 隐藏逻辑**（风险最高）：`App.tsx:190-194` 的 `needsSidebar` 与 `catNeedsSidebar` 不在本 story 范围内，应回退到原有 "始终渲染左侧边栏" 行为，或将该能力作为独立 story 提交。
2. **统一 contributor 头像色为谨迹 token**：将 `WorkspaceView.tsx:52-182` 的 `#818cf8` 替换为设计 token（如 `--record-btn` / `--badge-doc-*` / 或新增 `--avatar-bg`），消除第二 accent 色。
3. **明确 Recently Viewed 数据源**：要么按 story 边界改为纯 mock（设计 §4.2），要么将 "使用真实 topic 文件" 作为范围变更回写 story.md 与 design.md 并经用户确认。
4. **补测试**：在 `WorkspaceView.test.tsx` 中增加 `onOpenRecent` 回调断言，覆盖 design §9 要求的 "点击 Recently Viewed 行触发 onSelectFile" 行为。

## 待用户裁决

| # | 问题 | 当前实现 | 契约要求 | 两边代价 | 保守结论 |
|---|---|---|---|---|---|
| 1 | Recently Viewed 数据源 | `buildRecentItems` 优先使用真实 topic 文件，不足时补 mock | story 边界："Contributors / recently viewed 数据全部使用 mock" | 保留真实数据：满足"Workspace 内直接点击打开"的成功标准，但与边界冲突；改为纯 mock：符合边界与 design §4.2，但行点击要么跳转不存在的 mock 路径，要么只能 placeholder | 按保守计为 **fail**，需用户确认是否接受真实数据并回写契约 |
| 2 | 全局 sidebar 隐藏 | ideas / automation / skills 不再渲染左侧边栏 | story / design 均未提及该行为 | 保留：可能改善全屏工作区体验，但属于独立功能变更；回退：不影响 Workspace 功能，保持仅修改 Topics 视图的最小范围 | 按保守计为 **fail / 越界**，需用户确认是否作为独立变更保留并补 story |

---

**最终摘要**：`result fail + 2 fail 项 + 2 待裁决项`。
