---
status: verified
slug: 20260629-unified-chat-layout-polish
phase: P2 polish（对话面布局修复 · 对抗落地）
owner: 对抗落地（opencode 开发 / codex 把关 / 我判优合并）
depends_on: 20260628-unified-chat-engine-switch（已 verified 并主干）
reference_repo: /Users/yanwu/Projects/github/open-design
---

# P2 polish：统一对话面布局修复（重叠 + 权限选择器重设计）

## 用户故事

作为一名刚用上统一对话面的用户，
我希望顶栏引擎切换器**不和历史会话控件打架**，授权选择器**像一个正经的紧凑控件**而不是一个塞在输入框里的全宽下拉，
以便我像 open-design 那样：composer 下面一行干净的控件条，引擎/授权都是小 pill，不抢对话区的空间。

## 背景（Leader 已诊断）

[证据] 实机截图反馈两个问题：

1. **历史会话控件重叠**：`HistoryFloatingButton` 用 `position:absolute; top:8; left:8; zIndex:20`（`apps/web/src/components/HistoryFloatingButton.tsx:137-140`），锚定最近 positioned 祖先。P2 的 `UnifiedChatShell` 的 `contentStyle`/`shellStyle` 没有 `position:relative`（`UnifiedChatShell.tsx:230-251`），导致历史按钮锚定到更高祖先，叠到了顶栏 `EngineSwitcher` chip 上。
2. **授权选择器设计怪异**：当前是一个原生 `<select>`（`authSelectStyle` 带 `flex:1`，`UnifiedChatShell.tsx:164-173,264-273`），塞在 composer 输入框的 bordered box 顶部（`ChatPanel.tsx` composerExtras 渲染处），全宽、原生样式、与输入框抢空间。

[证据] open-design 的正确做法（务必研读）：

- composer 下面一条 **`.composer-row`**（`apps/web/src/styles/chat.css:1340-1416`）：`display:flex; align-items:center; gap:6px; border-top`，左侧工具 → `<span className="composer-spacer">` 把后续推到右 → 紧凑 pill 控件 → 发送键。
- **`SessionModeToggle`**（`apps/web/src/components/SessionModeToggle.tsx:158-230`）：一个紧凑 `<button className="session-mode-toggle__trigger">` = 图标 + 标签 + chevron-down；点开 `__popover` 菜单（`role="menu"`，`menuitemradio`），每项图标+标签+勾选；不是原生 select。

## 成功标准（GWT 验收）

- **AC-1（修复重叠）** Given 统一对话面渲染，When 历史 floating button 与顶栏 chip 同时存在，Then HistoryFloatingButton **不再叠在 EngineSwitcher 上**；它锚定在对话内容区内（顶栏之下）。给 UnifiedChatShell 的内容容器加 `position:relative`（或等价手段）恢复锚定上下文，不挪动 HistoryFloatingButton 自身定位逻辑。
- **AC-2（授权选择器重设计为紧凑 pill+popover）** Given 引擎=外部 agent，When 看 composer，Then 授权选择是一个**紧凑 pill 按钮**（图标/色点 + 当前授权模式名 + chevron，仿 SessionModeToggle 的 trigger），点开 popover 列 4 个授权模式（read_only/workspace_write/full_access/wide_with_audit，复用现有 AUTHORIZATION_MODES + i18n），当前项带勾选；**不是原生 `<select>`、不是全宽**。pill 坐落在 composer 控件行（textarea 下方一行，右对齐，参考 composer-row），不在输入框 bordered box 内部。
- **AC-3（内置 pi 时隐藏）** Given 引擎=内置 pi，When 渲染 composer，Then 授权 pill 不出现（pi 无授权概念）。
- **AC-4（视觉走谨迹 token）** Given pill 与 popover，When 渲染，Then 走结构化 token：圆角 `--radius-*`、浮层阴影 `--shadow-overlay`、菜单边框 `--border-menu`、聚焦环 `--focus-ring`、交互橙用 `--record-btn`（非 `--accent`）；字体三栈；popover 有进出场动效（参考 open-design 的 pop-in keyframe）。不照搬 open-design 配色。
- **AC-5（不回退/绿）** Given 改动，When `npm run build` + `npm test` + `cd apps/daemon && npx vitest run`，Then 全绿（HistoryFloatingButton/SandboxPreview 的 pre-existing 失败豁免——若迁移 WIP 已修则更佳）；重叠修复 + pill 重设计 + popover 交互均有测试覆盖。

## 边界（Won't）

- 不改 EngineSwitcher chip 本身的交互（只修它和历史按钮的布局关系）。
- 不改 HistoryFloatingButton 的内部定位数值（只修锚定上下文）。
- 不重做整个 composer（只把授权选择器从输入框内移出到控件行 + 改 pill）。
- 不引入 open-design 的 SessionModeToggle 组件代码（参考设计，用谨迹 token 重写一个 AuthModeToggle）。

## 实现参考

| 复刻对象                 | open-design 源                                      | journal 落点                             |
| ------------------------ | --------------------------------------------------- | ---------------------------------------- |
| composer 控件行布局      | `styles/chat.css` `.composer-row`（1340-1416）      | ChatPanel composer 下方控件行            |
| 紧凑 pill + popover 控件 | `SessionModeToggle.tsx`（158-230）trigger + popover | 新 `AuthModeToggle.tsx`（授权模式 pill） |
| popover 进场动效         | `chat.css` `composer-toolbox-pop-in` keyframe       | AuthModeToggle popover 动效              |

引擎/模型 chip 持久化、渲染层融合（AC-6）等 P2 已交付项不动。
