---
status: verified
slug: 20260628-browse-pane-header-revert
owner: codex
source: user-requested deterministic revert
level: L1
hypothesis_basis: data
created: 2026-06-28
related:
  - stories/20260628-browse-ideas-skills-polish/story.md
---

# Revert Browse Pane Headers

## 用户故事

作为一名在 Browse 三页中扫读日志、专题与画像的知识工作者，
当我切换到「专题」「画像」或「Timeline」列表时，
我希望列表顶部不再出现额外页眉，
以便视线直接进入裸列表内容，减少无信息增量的垂直占用。

## 背景与失败模式

[证据] `stories/20260628-browse-ideas-skills-polish/story.md` 的 AC-1 曾要求给三类 Browse 页加入紧凑页眉；用户现在明确要求「彻底移除 Browse 页眉（专题/画像/Timeline），回到无页眉的裸列表」，并给出精确删除范围。

现状失败模式：
- 用户现在进入三个 Browse pane 时先看到图标 + 标签页眉，再进入列表。
- 该页眉对已由 NavRail 表达的页面身份形成重复，并占用扫读列表的顶部空间。
- 用户已明确判定这是确定性 revert，不需要进一步视觉探索。

## 成功标准（Given-When-Then）

### AC-1 — 三个 Browse pane 回到裸列表
- **Given** 用户进入「专题」「画像」或「Timeline」Browse pane
- **When** 页面渲染
- **Then** 列表顶部不出现 Browse 页眉、页眉图标或页眉标签
- **And** 原列表内容、分组、排序、选择与上下文菜单行为保持不变

### AC-2 — 页眉实现痕迹被移除
- **Given** 开发者检索 Browse 页眉相关代码
- **When** 检索 `BrowsePaneHeader`、`browse-pane-header`、`browseTopicsLabel`、`browseProfilesLabel`、`browseTimelineLabel`
- **Then** 不再存在运行时代码、样式、测试或文档中对这些已删除页眉能力的有效引用

### AC-3 — 回归检查
- **Given** 本次 revert 已完成
- **When** 运行 `npm run build` 与 `npm test`
- **Then** 除用户标明的 pre-existing `HistoryFloatingButton` / `SandboxPreview` 失败外，不引入新的失败

## 三类边界（Won't）

- **不为哪些用户做**：不为需要 Browse 页顶部身份锚点的新用户做保留；本次以高频扫读用户的裸列表诉求为准。
- **不在哪些场景出现**：不改 Hub、Ideas、Skills、NavRail、详情页或其它非 Browse 页眉场景。
- **不解决哪些相关但不同的问题**：不改列表密度、颜色、字体、分组逻辑、空态、主题 token 或其它已提交优化。

## 交棒清单（移交实现层）

- [ ] 删除组件、样式、locale key 与测试断言时保持 en/zh 类型对齐。
- [ ] 文档只删除 Browse 页眉相关描述，保留 `--workbench-btn-primary-*` 与对比度内容。

## 待确认（意图层）

无。用户已给出精确改动清单，并明确「这是确定性 revert，请直接做完」。

## INVEST 自检（输出闸记录）

- [x] **I** Independent：仅撤回 Browse 页眉，不依赖其它故事。
- [x] **N** Negotiable：范围由用户精确限定，只删除页眉相关内容。
- [x] **V** Valuable：恢复裸列表，减少扫读干扰。
- [x] **E** Estimable：涉及文件与断言已明确列出。
- [x] **S** Small：单次 revert 可完成。
- [x] **T** Testable：AC 可由 DOM/检索/build/test 验证。

## 门禁记录

| 轮次 | 日期 | Readiness | 主要缺口 |
|---|---|---|---|
| 1 | 2026-06-28 | 可开发 | 无 |
