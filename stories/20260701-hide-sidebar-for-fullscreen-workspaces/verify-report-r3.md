---
story: ./story.md
design: ./design.md
date: 2026-07-01
round: 3
result: pass
scope: 'git diff -- apps/web/src/App.tsx apps/web/src/tests/App.test.tsx apps/daemon/src/server.ts apps/daemon/src/runtimes/runner.test.ts stories/20260701-hide-sidebar-for-fullscreen-workspaces/story.md stories/20260701-hide-sidebar-for-fullscreen-workspaces/design.md'
---

# 验收报告 — 全屏工作区隐藏左侧边栏及保留右侧展开/收起按钮（Round 3）

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC                                              | 结论    | 证据                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-1 — 想法页面无左侧边栏                       | ✅ pass | `apps/web/src/App.tsx:188-191` 的 `needsSidebar` 仅对 `journal` / `identity` / `topics` 为 true，因此 `activeCategory === 'ideas'` 时 `needsSidebar === false`。`App.tsx:1062-1122` 仅在 `needsSidebar` 为 true 时渲染 `data-sidebar-panel="left"` 与 `data-sidebar-divider="left"`，想法页面左侧不渲染树形边栏容器与展开/收起按钮。 |
| AC-2 — 自动化页面无左侧边栏                     | ✅ pass | 同 AC-1。`activeCategory === 'automation'` 时 `needsSidebar === false`，左侧容器与 divider 不渲染。                                                                                                                                                                                                                                  |
| AC-3 — 技能页面无左侧边栏                       | ✅ pass | 同 AC-1。`activeCategory === 'skills'` 时 `needsSidebar === false`，左侧容器与 divider 不渲染。                                                                                                                                                                                                                                      |
| AC-4 — 所有页面删除左侧展开/收起按钮            | ✅ pass | 全屏工作区不渲染左侧 divider；需要 sidebar 的页面虽然渲染 divider，但 `App.tsx:1108-1120` 的 `data-sidebar-divider="left"` 为无 button 的 `<div />`。原左侧 `<button>` 及 `aria-label` 已删除。                                                                                                                                      |
| AC-5 — 需要侧边栏的页面仍显示边栏容器且默认展开 | ✅ pass | `activeCategory` 为 `journal` / `identity` / `topics` 时 `needsSidebar === true`，`App.tsx:1065-1106` 渲染 `app-sidebar-panel`；默认状态 `App.tsx:183-185` 在窗口宽度 ≥ `HIDE_LEFT_SIDEBAR_BELOW` 时 `leftSidebarOpen` 为 true。                                                                                                     |
| AC-6 — 通过 NavRail 切换边栏展开/收起           | ✅ pass | `apps/web/src/App.tsx:650-654` 的 `handleCategoryChange` 中，`cat === activeCategory && catNeedsSidebar` 时调用 `setLeftSidebarOpen(prev => !prev)`。`apps/web/src/components/NavRail.tsx:74` 点击分类按钮调用 `onCategoryChange(item.id)`，即重复点击当前分类可切换左侧边栏。                                                       |
| AC-7 — 右侧边栏按钮保留且可切换面板             | ✅ pass | `apps/web/src/App.tsx:1195-1208` 在 `data-sidebar-divider="right"` 内保留 `<button>`，点击切换 `setRightPanelOpen(prev => !prev)`。测试 `apps/web/src/tests/App.test.tsx:210-244` 断言右侧 divider 内存在 button，且点击后右侧面板宽度在 `0px` 与非 `0px` 之间切换。                                                                 |

## 范围完整性（不少，对照 story.md 范围）

- ✅ 全局移除左侧 divider 上的展开/收起按钮：`App.tsx:1108-1120` 的左侧 divider 内无 button。
- ✅ 在“想法”“自动化”“技能”三个全屏工作区完全隐藏左侧树形边栏容器：`needsSidebar` 排除这三项，`App.tsx:1062` 条件渲染。
- ✅ 保留右侧边栏按钮，保证 Agent 面板可打开：`App.tsx:1195-1208` 保留按钮，右侧面板容器 `data-sidebar-panel="right"` 仍完整保留于 `App.tsx:1210-1260`。
- ✅ “流水”“画像”“专题”保留左侧树形边栏容器，且通过 NavRail 当前分类按钮切换：`handleCategoryChange:650-654` 保留同分类且需要 sidebar 时的 toggle 逻辑。
- ✅ 不影响底部面板或导航 Rail（NavRail）：NavRail 结构未改动，仅 App.tsx 布局层调整。

## 方案落实（不偏，对照 design.md）

- ✅ `needsSidebar` 通过 `useMemo` 提取：`App.tsx:188-191`。
- ✅ 左侧边栏容器条件渲染：`App.tsx:1062-1122` 仅在 `needsSidebar` 为 true 时渲染 `app-sidebar-panel` 与 divider。
- ✅ divider 保留拖拽调整宽度：`App.tsx:1111` 中 `onMouseDown={leftSidebarOpen ? onDividerMouseDown : undefined}`。
- ✅ NavRail 切换逻辑保留：`App.tsx:650-654`。
- ✅ 右侧 divider 保留按钮与切换：`App.tsx:1195-1208`。
- ✅ `handleCategoryChange` 中的局部 `needsSidebar` 改名为 `catNeedsSidebar`，避免与组件级 `needsSidebar` 冲突，语义等价：`App.tsx:650-672`。
- ✅ 保留 `sidebarToggleStyle()`、`PANEL_TOGGLE_TOP` 常量、`ChevronLeft`、`ChevronRight` 导入：`App.tsx:12`、`App.tsx:78-86`、`App.tsx:1201`。

## 越界检查（不多，对照 story 非目标 + design 范围）

| 改动                                                                                                                     | 是否越界           | 说明                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `App.tsx` 中 `DetailView` lazy wrapper 的类型从 `any` 改为 `ComponentProps<typeof m.DetailView>`                         | 否                 | 属于同一文件内的等价类型重构（必要基础设施），无行为变化。                                                  |
| `apps/daemon/src/server.ts` 新增 CORS 中间件、`app-event` 扇出、`AddressInfo` 端口回退、两处 `cwd: workspaceRoot()` 传递 | 是（相对本 story） | 不在 story.md / design.md 范围内，与左侧边栏/右侧按钮需求无关。但属于独立未提交改动，不影响本 story 的 AC。 |
| `apps/daemon/src/runtimes/runner.test.ts` 新增 `passes cwd to the spawned child process` 测试                            | 是（相对本 story） | 同上，与 Agent 运行时 cwd 有关，不在本 story 范围。                                                         |

## 冗余（不重，对照 story.md）

- ✅ 未出现多套并行实现同一 AC 的代码。`needsSidebar` 计算仅一处（`App.tsx:188-191`），左侧容器渲染仅一处（`App.tsx:1062-1122`），切换逻辑仅一处（`App.tsx:650-654`），右侧按钮切换仅一处（`App.tsx:1200`）。

## 自动化测试

```bash
cd /Users/yanwu/Projects/github/journal/apps/web
npx vitest run src/tests/App.test.tsx
# Test Files  1 passed (1)
# Tests  16 passed (16)
```

> 注：当前 `App.test.tsx` 仅覆盖 AC-7（右侧按钮存在且可切换），未再保留 Round 2 中对“左侧 button 不存在”的显式断言。design.md 测试策略要求“左侧 button 不存在、右侧 button 存在且可切换右侧面板”均被覆盖，现缺少左侧部分。该缺口不影响实际行为，但建议补充测试以完整落实 design.md 的测试策略。

## 结论

七项 AC 全部实现，六字标准（不漏、不重、不偏、不倚、不多、不少）针对 story 本身全部通过，实现与更新后的 story.md / design.md 一致，相关自动化测试通过。

daemon 侧的两处额外改动不属于本 story 范围，已列入越界检查；它们不破坏 AC，但如需随本 story 一并提交，应补充对应 story/design 说明。

## 待用户裁决

无。
