---
story: ./story.md
design: ./design.md
date: 2026-07-02
round: 11
result: fail
scope: 'apps/web/src/App.tsx, apps/web/src/components/WorkspaceView.tsx, apps/web/src/styles/workspace.css, apps/web/src/tests/WorkspaceView.test.tsx, apps/web/src/main.tsx, apps/web/src/components/TreeSidebar.tsx, stories/20260701-momo-workspace-ui-replica/story.md, stories/20260701-momo-workspace-ui-replica/design.md'
---

# 验收报告 — 在谨迹中复刻 Momo 工作空间 UI，作为桌面端 Workspace 入口视图

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC                                      | 结论                | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 Workspace 作为 Topics 分类的新视图 | ✅ pass             | `App.tsx:1166` 在 `activeCategory === 'topics' && (!treeSelection \|\| treeSelection.type === 'topic')` 时渲染 `<WorkspaceView />`，否则渲染 `DetailView`；`TreeSidebar.tsx:836` 起复用现有 Topics 树；右侧面板由 `rightPanelOpen` 控制，内容切换时 `App.tsx:711` 在满足条件时自动收起                                                                                                                                                   |
| AC-2 文件树与 Workspace 结构            | ✅ pass             | `TreeSidebar.tsx:575-627` 在 `category === 'topics'` 时显示「Workspace」标题与搜索/视图图标；`TopicTree` 沿用现有 Topics 树形结构                                                                                                                                                                                                                                                                                                        |
| AC-3 Quick Start 操作区                 | ✅ pass             | `WorkspaceView.tsx:246-274` 渲染「Quick Start」标题与 New File/New Folder/Import 三卡片；点击触发 `placeholderAction` 派发 `show-toast`，不调用后端                                                                                                                                                                                                                                                                                      |
| AC-4 Recently Viewed 列表               | ✅ pass             | `WorkspaceView.tsx:276-359` 渲染「Recently Viewed」表头 Name/Contributors/Viewed；`buildRecentItems` (`WorkspaceView.tsx:187-226`) 优先使用真实 topic 文件，不足 5 条补 mock，最多 10 条；底部「Show more」展开/收起                                                                                                                                                                                                                     |
| AC-5 右侧 AI Chat 面板                  | ⚠️ partial / 待裁决 | `WorkspaceChatShell` (`WorkspaceView.tsx:563-861`) 集成 `useAgentEngine`/`useAgentRun`/`useConversation`，保留发送/取消/重试；`SessionDropdown` (`WorkspaceView.tsx:363-559`) 提供「New Chat」下拉与独立「+」按钮；输入框与 EngineSwitcher/AuthModeToggle 融为同一卡片；**本轮新增** `ToolCapsule` (`WorkspaceView.tsx:911-951`) 以单行胶囊展示工具调用，默认收起，有 output 时点击展开；空状态为纯文字「闫戍's momo」，无 Continue 按钮 |
| AC-6 视觉还原度（浅色模式）             | ❌ fail             | 圆角/阴影/菜单边框/聚焦环均走 token，无第二 accent 色，字体栈使用正确；但部分间距未落在 8pt 网格（4px 细粒度例外）上，详见「范围完整性」                                                                                                                                                                                                                                                                                                 |
| AC-7 暗色主题可用性                     | ✅ pass             | 全部通过 CSS token 自动切换；`globals.css:309` 定义暗色 `--record-btn: #FF7A33`，与 AC-7 一致                                                                                                                                                                                                                                                                                                                                            |

## 范围完整性（不少，对照 story.md 范围）

- ✅ Workspace 绑定 Topics 分类，未选中文件时显示 hub，选中文件后进入 `DetailView`：`App.tsx:1166-1168`
- ✅ 不实现拖拽/resize：三栏宽度使用现有状态/预设值
- ✅ New File/New Folder/Import 仅前端占位反馈：`WorkspaceView.tsx:179-185`
- ✅ 复用现有 `useConversation`/`useAgentRun` 真实聊天能力：`WorkspaceView.tsx:579-581`, `WorkspaceView.tsx:686-702`
- ✅ Contributors/Recently Viewed 使用 mock/真实 topic 文件混合：`WorkspaceView.tsx:187-226`
- ✅ 搜索图标占位：`TreeSidebar.tsx:589-606`
- ✅ 不强制全局右侧面板默认收起，Workspace 入口场景通过 `App.tsx:702-722` 的 content-key 变化自动收起
- ✅ 不迁移单条消息编辑、历史消息重发、pending 单独移除、独立 Continue 按钮：`WorkspaceChatShellProps` 已 `Omit<ConversationSlice, 'onContinue'>` (`WorkspaceView.tsx:60`)，`App.tsx:1273-1274` 未传入 `onContinue`

## 方案落实（不偏，对照 design.md）

| design.md 条目                              | 结论 | 证据                                                                                                                            |
| ------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| 新增 `WorkspaceView.tsx`                    | ✅   | `apps/web/src/components/WorkspaceView.tsx` 存在                                                                                |
| 新增 `workspace.css` 并在 `main.tsx` import | ✅   | `apps/web/src/styles/workspace.css` 存在；`main.tsx:4` import                                                                   |
| 修改 `App.tsx` 中心渲染分支                 | ✅   | `App.tsx:1166-1168`                                                                                                             |
| 新增 `WorkspaceView.test.tsx`               | ✅   | `apps/web/src/tests/WorkspaceView.test.tsx` 存在，9 个测试全部通过                                                              |
| `WorkspaceChatShell` 真实能力集成           | ✅   | `WorkspaceView.tsx:563-861` 集成 `useAgentEngine`/`useAgentRun`/`useConversation`                                               |
| `SessionDropdown` 历史/新建/切换/删除       | ✅   | `WorkspaceView.tsx:363-559`                                                                                                     |
| 引擎/权限选择器位于输入框底部               | ✅   | `WorkspaceView.tsx:843-856` 位于 `workspace-chat__input-box` 内底部                                                             |
| 工具调用胶囊默认收起、点击展开              | ✅   | `ToolCapsule` (`WorkspaceView.tsx:911-951`) + `.workspace-chat__tool*` CSS                                                      |
| 颜色/圆角/阴影/聚焦环 token 消费            | ✅   | `workspace.css` 中无硬编码色值，圆角均使用 `--radius-*`，菜单使用 `--shadow-overlay`/`--border-menu`，聚焦环使用 `--focus-ring` |
| 8pt 网格间距                                | ❌   | 见 AC-6 fail 项；`workspace.css` 中存在 `6px`、`10px`、`18px` 等非 4 倍数间距                                                   |

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

`result: fail`，共 1 个 fail 项，1 个待裁决项。

**Fail 项：AC-6 部分间距未落在 8pt 网格（4px 细粒度例外）上**

DESIGN.md 明确「8pt 间距网格（4px 细粒度例外）」，但 `workspace.css` 中存在以下非 4 倍数的间距/内边距：

- `workspace-card` padding: `16px 18px`（18px 不是 4 倍数）— `workspace.css:44`
- `workspace-recent__header` padding: `10px 20px`（10px 不是 4 倍数）— `workspace.css:94`
- `workspace-session-dropdown__item` padding: `6px 10px`（6px、10px 不是 4 倍数）— `workspace.css:294`
- `workspace-session-dropdown__search` padding: `8px 10px 4px`（10px 不是 4 倍数）— `workspace.css:258`
- `workspace-chat__tool` gap: `6px` — `workspace.css:656`
- `workspace-chat__tool-summary` padding: `6px 10px` — `workspace.css:682`
- `workspace-chat__tool-output` margin: `0 10px 6px` — `workspace.css:735`

修复建议（按风险排序）：

1. 将上述 `6px` 改为 `4px` 或 `8px`，`10px` 改为 `8px` 或 `12px`，`18px` 改为 `16px` 或 `20px`，使所有间距/内边距落在 8pt/4pt 网格上。
2. 运行 `npm run build` 与 `npm test` 验证无回归。

**待裁决项：AC-5 空状态问候语包含特定人名「闫戍's momo」**

- story.md 仅要求「纯文字问候（无吉祥物）」，未规定具体文字；当前实现是硬编码中文人名。
- 代价 A（保持现状）：与截图/用户个人偏好可能一致，但缺乏通用性，后续若多人使用或切换语言需调整。
- 代价 B（改为通用问候）：更通用、更易维护，但可能失去截图的个人化气质。
- 建议：若用户已在截图反馈中确认该文字，可接受；否则应改为通用问候（如「What can I help you with?」/「有什么可以帮你的？」）。

## 测试/构建证据

```bash
cd /Users/yanwu/Projects/github/journal/apps/web
npx vitest run src/tests/WorkspaceView.test.tsx   # 9 tests passed
npx vitest run                                     # 387 tests passed
npx tsc --noEmit                                   # passed
npm run build                                      # passed
```

## 契约状态备注（非 fail，但需主对话注意）

- `story.md` frontmatter 状态为 `approved`，`design.md` 内联注释写「status: verified」，两份契约状态表述不一致。翻状态是主对话职责，验收侧未修改任何契约。
