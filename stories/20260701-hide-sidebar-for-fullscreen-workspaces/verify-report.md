---
story: ./story.md
design: ./design.md
date: 2026-07-01
round: 1
result: pass
scope: "git diff -- apps/web/src/App.tsx apps/web/src/tests/App.test.tsx"
---

# 验收报告 — 全屏工作区隐藏左侧边栏及展开/收起按钮

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 — 想法页面无左侧边栏 | ✅ pass | `apps/web/src/App.tsx:187-190` 计算 `needsSidebar` 时仅 `journal` / `identity` / `topics` 为 true；`activeCategory === 'ideas'` 时 `needsSidebar === false`。`apps/web/src/App.tsx:1061-1121` 仅在 `needsSidebar` 为 true 时渲染 `app-sidebar-panel` 与 `data-sidebar-divider="left"`，因此想法页面左侧不渲染树形边栏容器与展开/收起按钮。 |
| AC-2 — 自动化页面无左侧边栏 | ✅ pass | 同上。`activeCategory === 'automation'` 时 `needsSidebar === false`，左侧容器与 divider 不渲染。 |
| AC-3 — 技能页面无左侧边栏 | ✅ pass | 同上。`activeCategory === 'skills'` 时 `needsSidebar === false`，左侧容器与 divider 不渲染。 |
| AC-4 — 所有页面删除展开/收起按钮 | ✅ pass | `apps/web/src/App.tsx:1061-1121` 渲染 divider 时内部已无 `<button>`；全屏工作区连 divider 都不渲染。原左侧 `<button>` 及相关 `ChevronLeft`/`ChevronRight` 切换逻辑已删除。测试 `apps/web/src/tests/App.test.tsx:221` 断言 `screen.queryByRole('button', { name: '折叠左侧栏' })` 为 null。 |
| AC-5 — 需要侧边栏的页面仍显示边栏容器且默认展开 | ✅ pass | `activeCategory` 为 `journal` / `identity` / `topics` 时 `needsSidebar === true`，`apps/web/src/App.tsx:1064-1105` 渲染 `app-sidebar-panel`；默认状态 `apps/web/src/App.tsx:182-184` `leftSidebarOpen` 在窗口宽度 ≥ `HIDE_LEFT_SIDEBAR_BELOW` 时为 true。 |
| AC-6 — 通过 NavRail 切换边栏展开/收起 | ✅ pass | `apps/web/src/App.tsx:647-676` `handleCategoryChange` 中 `catNeedsSidebar` 判断与 `activeCategory` 相同且需要 sidebar 时调用 `setLeftSidebarOpen(prev => !prev)`。`apps/web/src/components/NavRail.tsx:63-78` 点击分类按钮调用 `onCategoryChange(item.id)`，即重复点击当前分类可切换左侧边栏。 |

## 范围完整性（不少，对照 story.md 范围）

- ✅ 全局移除左侧 divider 上的展开/收起按钮：`App.tsx:1061-1121` 中 divider 内无 button。
- ✅ 想法 / 自动化 / 技能三个全屏工作区完全隐藏左侧树形边栏容器：`needsSidebar` 排除这三项，容器条件渲染。
- ✅ 流水 / 画像 / 专题保留左侧树形边栏容器，且通过 NavRail 当前分类按钮切换：`handleCategoryChange` 保留同分类且需要 sidebar 时的 toggle 逻辑。
- ✅ 不影响右侧 divider / 按钮：右侧 toggle 仍在 `App.tsx:1200` 使用 `sidebarToggleStyle()`；`ChevronLeft`/`ChevronRight` 导入保留供右侧使用。

## 方案落实（不偏，对照 design.md）

- ✅ `needsSidebar` 通过 `useMemo` 提取：`App.tsx:187-190`。
- ✅ 左侧边栏容器条件渲染：`App.tsx:1061-1121` 仅在 `needsSidebar` 为 true 时渲染 `app-sidebar-panel` 与 divider。
- ✅ divider 保留拖拽调整宽度：`App.tsx:1108-1119` 中 `onMouseDown={leftSidebarOpen ? onDividerMouseDown : undefined}`。
- ✅ NavRail 切换逻辑保留：`App.tsx:647-676`。
- ✅ 不改动右侧面板：`App.tsx:1180-1200` 区域未变更，右侧按钮与样式保持原样。
- ✅ `handleCategoryChange` 中的局部 `needsSidebar` 改名为 `catNeedsSidebar`，避免与组件级 `needsSidebar` 冲突，语义等价。

## 越界检查（不多，对照 story 非目标 + design 范围）

| 改动 | 是否越界 | 说明 |
|---|---|---|
| `App.tsx` 中 `DetailView` lazy wrapper 的类型从 `any` 改为 `ComponentProps<typeof m.DetailView>` | 否 | 属于同一文件内的等价类型重构（必要基础设施），无行为变化。 |
| `App.test.tsx` 移除左侧 toggle 相关断言、保留右侧断言 | 否 | 因左侧按钮被删除而必须同步更新的测试，属于必要测试维护。 |
| `ChevronLeft` / `ChevronRight` 导入保留 | 否 | design.md §5 明确右侧按钮仍在使用。 |
| 未触碰 `TreeSidebar.tsx` / NavRail 结构 / 响应式断点 / localStorage | 否 | 符合 story 三类边界。 |

## 冗余（不重，对照 story.md）

- ✅ 未出现多套并行实现同一 AC 的代码。`needsSidebar` 计算仅一处，左侧容器渲染仅一处，切换逻辑仅一处。

## 自动化测试

```bash
cd /Users/yanwu/Projects/github/journal/apps/web
npx vitest run src/tests/App.test.tsx
# Test Files  1 passed (1)
# Tests  16 passed (16)
```

## 结论

六项核对（不漏、不重、不偏、不倚、不多、不少）全部通过，实现与 story.md / design.md 一致，测试全部通过。

## 待用户裁决

无。
