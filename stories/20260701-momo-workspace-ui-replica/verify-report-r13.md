---
story: ./story.md
design: ./design.md
date: 2026-07-02
round: 13
result: pass
scope: "apps/web/src/App.tsx, apps/web/src/components/WorkspaceView.tsx, apps/web/src/styles/workspace.css, apps/web/src/tests/WorkspaceView.test.tsx, apps/web/src/main.tsx, apps/web/src/components/TreeSidebar.tsx, stories/20260701-momo-workspace-ui-replica/story.md, stories/20260701-momo-workspace-ui-replica/design.md"
---

# 验收报告 — 在谨迹中复刻 Momo 工作空间 UI，作为桌面端 Workspace 入口视图

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 Workspace 作为 Topics 分类的新视图 | ✅ pass | `App.tsx:1166-1168` 在 `activeCategory === 'topics' && (!treeSelection \|\| treeSelection.type === 'topic')` 时渲染 `<WorkspaceView />`，否则渲染 `DetailView`；`TreeSidebar.tsx:575-627` 复用现有 Topics 树；右侧面板由 `rightPanelOpen` 控制，`App.tsx:702-722` 在内容切换且无流式任务时自动收起 |
| AC-2 文件树与 Workspace 结构 | ✅ pass | `TreeSidebar.tsx:575-627` 在 `category === 'topics'` 时显示「Workspace」标题与搜索/视图图标；Topics 树形结构沿用现有实现 |
| AC-3 Quick Start 操作区 | ✅ pass | `WorkspaceView.tsx:246-274` 渲染「Quick Start」标题与 New File/New Folder/Import 三卡片；点击触发 `placeholderAction` 派发 `show-toast`，不调用后端 |
| AC-4 Recently Viewed 列表 | ✅ pass | `WorkspaceView.tsx:276-359` 渲染「Recently Viewed」表头 Name/Contributors/Viewed；`buildRecentItems` (`WorkspaceView.tsx:187-226`) 优先使用真实 topic 文件，不足 5 条补 mock，最多 10 条；底部「Show more」展开/收起 |
| AC-5 右侧 AI Chat 面板 | ✅ pass | `WorkspaceChatShell` (`WorkspaceView.tsx:563-861`) 集成 `useAgentEngine`/`useAgentRun`，保留发送/取消/重试；`SessionDropdown` (`WorkspaceView.tsx:363-559`) 使用聊天图标 +「New Chat」下拉，支持历史会话搜索/切换/删除及独立「+」新建按钮；输入框底部融合 `EngineSwitcher`/`AuthModeToggle`；`ToolCapsule` (`WorkspaceView.tsx:911-951`) 单行胶囊默认收起、点击展开；空状态为纯文字「闫戍's momo」(`WorkspaceView.tsx:752`)，无 Continue 按钮；`WorkspaceView.test.tsx:117` 断言问候语 |
| AC-6 视觉还原度（浅色模式） | ✅ pass | 颜色、圆角、阴影、聚焦环均消费 token，无第二 accent 色；字体栈正确使用 (`workspace.css:8,26,649,714` 等)；第 12 轮 fail 的 3 处间距已修复：`workspace.css:242` 改为 `top: calc(100% + 8px)`，`workspace.css:279` 改为 `padding: 4px 0`，`TreeSidebar.tsx:581` 改为 `padding: 12px 8px 8px`；经逐行核对 `workspace.css` 与 TreeSidebar Workspace 头部新增样式，所有 `padding`/`gap`/`margin` 均为 4 的倍数 |
| AC-7 暗色主题可用性 | ✅ pass | 全部通过 CSS 变量自动切换；`globals.css:309` 定义暗色 `--record-btn: #FF7A33`，与 AC-7 一致 |

## 范围完整性（不少，对照 story.md 范围）

- ✅ Workspace 绑定 Topics 分类，未选中文件时显示 hub，选中文件后进入 `DetailView`：`App.tsx:1166-1168`
- ✅ 不实现拖拽/resize：三栏宽度使用现有状态/预设值
- ✅ New File/New Folder/Import 仅前端占位反馈：`WorkspaceView.tsx:179-185`
- ✅ 复用现有 `useConversation`/`useAgentRun` 真实聊天能力：`WorkspaceView.tsx:579-580`, `WorkspaceView.tsx:686-702`
- ✅ Contributors/Recently Viewed 使用 mock/真实 topic 文件混合：`WorkspaceView.tsx:187-226`
- ✅ 搜索图标占位：`TreeSidebar.tsx:589-606`
- ✅ 不强制全局右侧面板默认收起，Workspace 入口场景通过 `App.tsx:702-722` 的 content-key 变化自动收起
- ✅ 不迁移单条消息编辑、历史消息重发、pending 单独移除、独立 Continue 按钮：`WorkspaceChatShellProps` 已 `Omit<ConversationSlice, 'onContinue'>` (`WorkspaceView.tsx:60`)，`App.tsx:1262-1278` 未传入 `onContinue`

## 方案落实（不偏，对照 design.md）

| design.md 条目 | 结论 | 证据 |
|---|---|---|
| 新增 `WorkspaceView.tsx` | ✅ | `apps/web/src/components/WorkspaceView.tsx` 存在 |
| 新增 `workspace.css` 并在 `main.tsx` import | ✅ | `apps/web/src/styles/workspace.css` 存在；`main.tsx:4` import |
| 修改 `App.tsx` 中心渲染分支 | ✅ | `App.tsx:1166-1168` |
| 新增 `WorkspaceView.test.tsx` | ✅ | `apps/web/src/tests/WorkspaceView.test.tsx` 存在，9 个测试全部通过 |
| `WorkspaceChatShell` 真实能力集成 | ✅ | `WorkspaceView.tsx:563-861` 集成 `useAgentEngine`/`useAgentRun` |
| `SessionDropdown` 历史/新建/切换/删除 | ✅ | `WorkspaceView.tsx:363-559` |
| 引擎/权限选择器位于输入框底部 | ✅ | `WorkspaceView.tsx:843-856` 位于 `workspace-chat__input-box` 内底部 |
| 工具调用胶囊默认收起、点击展开 | ✅ | `ToolCapsule` (`WorkspaceView.tsx:911-951`) + `.workspace-chat__tool*` CSS |
| 颜色/圆角/阴影/聚焦环 token 消费 | ✅ | `workspace.css` 中无硬编码色值，圆角均使用 `--radius-*`，菜单使用 `--shadow-overlay`/`--border-menu`，聚焦环使用 `--focus-ring` |
| 8pt/4px 网格间距 | ✅ | 见 AC-6；第 12 轮识别的非 4 倍数间距已修复，新增/修改样式全部落在 4px 网格 |

## 越界检查（不多，对照 story 非目标 + design.md 范围）

- ✅ 未接入真实文件系统：Quick Start 仅触发 toast
- ✅ 未新增独立 AI 聊天实现：复用现有 hooks
- ✅ 未实现真实协同/权限/贡献者数据
- ✅ 未实现真实搜索
- ✅ 未引入第二 accent 色
- ✅ 无无法归属的功能性改动

## 冗余（不重，对照 story.md）

- ✅ 无同一 AC 的多套并行实现；`UnifiedChatShell` 仍保留在代码库中供其他调用方使用，`WorkspaceChatShell` 仅用于 `App.tsx` 的右侧面板，二者场景不同

## 结论

`result: pass`，0 个 fail 项，0 个待裁决项。

第 12 轮唯一 fail 项 **AC-6 部分间距未落在 4px 网格** 已修复：

- `workspace.css:242`：`top: calc(100% + 8px)`（由 6px 改为 8px）
- `workspace.css:279`：`.workspace-session-dropdown__list { padding: 4px 0; }`（由 2px 改为 4px）
- `TreeSidebar.tsx:581`：Workspace 头部 `padding: 12px 8px 8px`（由 `14px 8px 10px` 改为 4 的倍数）

经验证，本次改动范围内的全部间距/间隙/内边距均为 4 的倍数，颜色、圆角、阴影、聚焦环、字体栈均按契约消费 token，测试与构建均无回归。

## 测试/构建证据

```bash
cd /Users/yanwu/Projects/github/journal/apps/web
npx vitest run src/tests/WorkspaceView.test.tsx   # 9 tests passed
npx vitest run                                     # 387 tests passed
npx tsc --noEmit                                   # passed
npm run build                                      # passed
```

## 契约状态备注

- `story.md` frontmatter 状态为 `approved`，`design.md` 内联注释写「status: verified」，两份契约状态表述不一致。翻状态是主对话职责，验收侧未修改任何契约。

## 待用户裁决

无。
