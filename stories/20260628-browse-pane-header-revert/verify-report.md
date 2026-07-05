---
story: ./story.md
design: N/A
date: 2026-06-28
round: 1
result: pass
scope: 'git diff -- apps/web/src/components/TreeSidebar.tsx apps/web/src/components/BrowsePaneHeader.tsx apps/web/src/styles/globals.css apps/web/src/locales/en.ts apps/web/src/locales/zh.ts apps/web/src/tests/TreeSidebar.test.tsx apps/web/src/tests/light-theme-unit.test.ts docs/DESIGN.md'
---

# 验收报告 — Revert Browse Pane Headers

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC                                 | 结论    | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 — 三个 Browse pane 回到裸列表 | ✅ pass | `apps/web/src/components/TreeSidebar.tsx:582`、`:656`、`:782` 三个分支当前直接进入 journal / identity / topics 列表内容；`apps/web/src/components/TreeSidebar.tsx:584`、`:658`、`:784` 后没有页眉 JSX。原列表行为仍在：分组/排序在 `apps/web/src/components/TreeSidebar.tsx:418`-`:432`、`:445`-`:482`；选择在 `apps/web/src/components/TreeSidebar.tsx:401`-`:413`；上下文菜单在 `apps/web/src/components/TreeSidebar.tsx:511`-`:530`、`:959`-`:975`。测试 `apps/web/src/tests/TreeSidebar.test.tsx:114`-`:127` 覆盖三个 pane 仍渲染原列表内容。 |
| AC-2 — 页眉实现痕迹被移除          | ✅ pass | `test ! -e apps/web/src/components/BrowsePaneHeader.tsx` 输出 `ABSENT apps/web/src/components/BrowsePaneHeader.tsx`；`rg -n "BrowsePaneHeader                                                                                                                                                                                                                                                                                                                                                                                                     | browse-pane-header | browseTopicsLabel | browseProfilesLabel | browseTimelineLabel" apps/web/src docs stories/20260628-browse-pane-header-revert`只命中`stories/20260628-browse-pane-header-revert/story.md:3`、`:41`，未命中运行时代码、样式、测试或文档。当前 import 列表无 `BrowsePaneHeader`/ lucide header icon /`useTranslation`：`apps/web/src/components/TreeSidebar.tsx:1`-`:10`。locale 已无三个 key，且 zh 仍以 `Strings` 对齐 en：`apps/web/src/locales/en.ts:1`-`:12`、`apps/web/src/locales/zh.ts:1`-`:14`。样式段从 drag-region 后直接进入 Ideas workbench：`apps/web/src/styles/globals.css:1245`-`:1254`。文档中 `BrowsePaneHeader`/ Browse 页眉段无命中，且保留`--workbench-btn-primary-\*` 与对比度内容：`docs/DESIGN.md:180`、`:239`。 |
| AC-3 — 回归检查                    | ✅ pass | `npm run build` 退出码 0，输出包含 `apps/web build: ✓ built in 1.60s` 与各 workspace `Done`；仅有 Electron signing / chunk size 等构建警告。`npm test` 退出码 0，输出 `packages/contracts` 4 files / 20 tests passed、`apps/desktop` 3 files / 15 tests passed、`apps/daemon` 86 files / 522 tests passed、`apps/web` 47 files / 337 tests passed；没有 `HistoryFloatingButton` / `SandboxPreview` 或新增失败。                                                                                                                                   |

## 范围完整性（不少，对照 story.md 范围）

- ✅ 三个目标 Browse pane 均覆盖：journal / Timeline 分支在 `apps/web/src/components/TreeSidebar.tsx:582`-`:653`，identity / 画像分支在 `apps/web/src/components/TreeSidebar.tsx:656`-`:779`，topics / 专题分支在 `apps/web/src/components/TreeSidebar.tsx:782`-`:952`。
- ✅ 交棒清单中 en/zh 类型对齐已保留：`apps/web/src/locales/zh.ts:1`-`:3` 继续以 `Strings` 约束 `zh`，`apps/web/src/locales/en.ts:1` 为 `Strings` 来源。
- ✅ 交棒清单中文档仅删除 Browse 页眉相关描述，未删除 `--workbench-btn-primary-*` 与对比度内容：`docs/DESIGN.md:180`、`:239`；`git diff --stat -- ...` 显示 `docs/DESIGN.md` 仅 6 行删除。

## 方案落实（不偏，对照 design.md）

N/A。本任务无 design.md。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ diff 块均可归属到 AC-1 / AC-2 或交棒清单：删除 `BrowsePaneHeader` 组件、TreeSidebar 三处调用、对应 CSS、locale key、测试断言和设计文档描述；`git diff --stat -- ...` 输出 8 个文件、`8 insertions(+), 134 deletions(-)`，新增仅为 TreeSidebar 测试改成裸列表内容断言。
- ✅ 未改 Hub、Ideas、Skills、NavRail、详情页或其它非 Browse 页眉运行时代码。核对范围内唯一非 Browse 运行时代码相关文件是 `docs/DESIGN.md` 与样式测试；`apps/web/src/styles/globals.css:1253` 起仍是 Ideas workbench 原段落，未新增相关功能。
- ✅ 未改列表密度、颜色、字体、分组逻辑、空态或主题 token。分组/排序代码仍在 `apps/web/src/components/TreeSidebar.tsx:418`-`:482`；结构化 token 文档仍在 `docs/DESIGN.md:172`-`:180`。

## 冗余（不重，对照 story.md）

- ✅ 未发现同一 AC 的并行实现。`rg -n "BrowsePaneHeader|browse-pane-header|browseTopicsLabel|browseProfilesLabel|browseTimelineLabel" apps/web/src docs stories/20260628-browse-pane-header-revert` 除 story 自身外无命中；删除后的实现路径只有 TreeSidebar 原列表渲染。

## 结论

全部六项通过。实现与 story.md 的三条 AC、三类边界和交棒清单一致；本轮验收可判定 `result: pass`。

## 待用户裁决

无。
