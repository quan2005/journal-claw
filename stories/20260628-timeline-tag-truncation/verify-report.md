---
story: ./story.md
design: N/A
date: 2026-06-28
round: 1
result: pass
scope: 'git diff -- apps/web/src/components/TreeItem.tsx apps/web/src/tests/TreeItem.test.tsx'
---

# 验收报告 — Timeline 标签溢出裁切修复（codex 批次）

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC                | 结论    | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 标签不裁切   | ✅ pass | story 要求长 tag 在空间不足时完整显示、ellipsis 或折叠为 `+N`，且不能被右边缘生切（`story.md:23`）。实现对 journal tag 只保留首个可见 tag 并计算隐藏数量（`apps/web/src/components/TreeItem.tsx:194`-`apps/web/src/components/TreeItem.tsx:196`）；tag 容器限制宽度并隐藏溢出（`apps/web/src/components/TreeItem.tsx:320`-`apps/web/src/components/TreeItem.tsx:331`）；单个 tag 设置 `minWidth: 0`、`maxWidth: '100%'`、`overflow: hidden`、`textOverflow: ellipsis`（`apps/web/src/components/TreeItem.tsx:333`-`apps/web/src/components/TreeItem.tsx:351`）；额外 tag 折叠为 `+N` 气泡（`apps/web/src/components/TreeItem.tsx:356`-`apps/web/src/components/TreeItem.tsx:372`）。测试用长 tag 断言 ellipsis 样式和 `+2` 折叠（`apps/web/src/tests/TreeItem.test.tsx:7`-`apps/web/src/tests/TreeItem.test.tsx:55`）。 |
| AC-2 标题安全截断 | ✅ pass | story 要求长标题用 line-clamp/ellipsis 截断，不溢出、不重叠 tag、不撑破行高（`story.md:24`）。标题 flex 项设置 `flexShrink: 1`、journal 下 `flexBasis: 0`、`minWidth: 0`、`maxWidth: '100%'`、`whiteSpace: nowrap`、`overflow: hidden`、`textOverflow: ellipsis`，并固定 `lineHeight: 1.4`（`apps/web/src/components/TreeItem.tsx:297`-`apps/web/src/components/TreeItem.tsx:314`）。测试断言长标题具备这些截断样式（`apps/web/src/tests/TreeItem.test.tsx:36`-`apps/web/src/tests/TreeItem.test.tsx:41`）。                                                                                                                                                                                                                                                                                                            |
| AC-3 红/绿测试    | ✅ pass | story 要求存在一条针对长 tag / 长标题不裁切溢出的单测（`story.md:25`）。新增测试名为 `keeps timeline journal titles and tags from hard-clipping when text is long`，同时构造长标题、长 tag，并断言标题/tag 的 ellipsis 样式和 `+2` 折叠（`apps/web/src/tests/TreeItem.test.tsx:7`-`apps/web/src/tests/TreeItem.test.tsx:55`）。可复现命令 `cd apps/web && npx vitest run src/tests/TreeItem.test.tsx` 输出：`Test Files  1 passed (1)`、`Tests  4 passed (4)`。红测依据：`git diff -- apps/web/src/components/TreeItem.tsx apps/web/src/tests/TreeItem.test.tsx` 的 pre-image 中 tag 直接 `tags.map` 且 `flexShrink: 0`，没有 `+N` 气泡和 tag ellipsis；该新增测试的 `+2` 与样式断言在 pre-image 下无对应实现。                                                                                                         |

## 范围完整性（不少，对照 story.md 范围）

- ✅ Timeline 列表项范围已覆盖：journal 分类在 Timeline 中渲染为 `TreeItem itemType="journal"`（`apps/web/src/components/TreeSidebar.tsx:582`-`apps/web/src/components/TreeSidebar.tsx:624`），本次 diff 修改的就是 `TreeItem` 的 journal tag/title 渲染路径（`apps/web/src/components/TreeItem.tsx:194`-`apps/web/src/components/TreeItem.tsx:196`，`apps/web/src/components/TreeItem.tsx:297`-`apps/web/src/components/TreeItem.tsx:372`）。
- ✅ story 提到的标题失败模式已覆盖：标题从原有普通 ellipsis 补强为可在同一 flex 行内安全收缩的 journal title（`apps/web/src/components/TreeItem.tsx:297`-`apps/web/src/components/TreeItem.tsx:314`）。
- ✅ story 提到的 tag 失败模式已覆盖：长 tag 通过单 chip ellipsis，多个 tag 通过 `+N` 气泡表达隐藏数量（`apps/web/src/components/TreeItem.tsx:333`-`apps/web/src/components/TreeItem.tsx:372`）。

## 方案落实（不偏，对照 design.md）

N/A。本任务无 design.md。story 的交棒说明要求以真实 Timeline 列表项 component 与 computed style 核对 `max-width` / `flex` / `overflow` / `text-overflow`；实现与测试均集中在 `TreeItem` 的 inline style 和 computed style 断言（`apps/web/src/components/TreeItem.tsx:297`-`apps/web/src/components/TreeItem.tsx:372`，`apps/web/src/tests/TreeItem.test.tsx:36`-`apps/web/src/tests/TreeItem.test.tsx:49`）。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ 未改 tag 取值：`getDisplayTags` 仍通过 `pickDisplayTags(entry.tags, Infinity).map((t) => t.label)` 取原标签 label（`apps/web/src/components/TreeItem.tsx:63`-`apps/web/src/components/TreeItem.tsx:65`），本次 diff 只改变显示数量与溢出样式（`apps/web/src/components/TreeItem.tsx:194`-`apps/web/src/components/TreeItem.tsx:196`，`apps/web/src/components/TreeItem.tsx:333`-`apps/web/src/components/TreeItem.tsx:372`）。
- ✅ 未改 tag 配色：tag 与 `+N` 气泡仍使用 `background: 'var(--tag-bg)'` 和 `color: 'var(--item-meta)'`（`apps/web/src/components/TreeItem.tsx:339`-`apps/web/src/components/TreeItem.tsx:344`，`apps/web/src/components/TreeItem.tsx:361`-`apps/web/src/components/TreeItem.tsx:365`）。
- ✅ 未改 tag 点击行为：本组件 tag chip 本身没有 click handler，本次 diff 也未触及 `handleAtClick` / `handleMoreClick` / row click 事件处理（`apps/web/src/components/TreeItem.tsx:217`-`apps/web/src/components/TreeItem.tsx:230`）。
- ✅ 未改 Timeline 日期分组、排序逻辑：核对范围 diff 只包含 `apps/web/src/components/TreeItem.tsx` 和 `apps/web/src/tests/TreeItem.test.tsx`；日期分组渲染仍在 `TreeSidebar` 的 `monthGroups.map` 路径（`apps/web/src/components/TreeSidebar.tsx:588`-`apps/web/src/components/TreeSidebar.tsx:625`），未出现在本次 diff。
- ✅ 未处理详情面板：核对范围 diff 不包含 `DetailView`，且 `git diff -- apps/web/src/components/TreeItem.tsx apps/web/src/tests/TreeItem.test.tsx` 仅显示 `TreeItem.tsx` 与 `TreeItem.test.tsx` 两个文件变更。

## 冗余（不重，对照 story.md）

- ✅ 未发现同一 AC 的多套并行实现。tag 溢出只有一条 journal 路径：`visibleTags = tags.slice(0, 1)` + `hiddenTagCount` + chip ellipsis / `+N`（`apps/web/src/components/TreeItem.tsx:194`-`apps/web/src/components/TreeItem.tsx:196`，`apps/web/src/components/TreeItem.tsx:320`-`apps/web/src/components/TreeItem.tsx:372`）。标题截断只有标题 flex item 的 inline style 一处实现（`apps/web/src/components/TreeItem.tsx:297`-`apps/web/src/components/TreeItem.tsx:314`）。

## 结论

全部通过。实现覆盖 AC-1、AC-2、AC-3，未发现 story 非目标命中项，未发现重复实现或半成品占位。

验证命令：

```bash
cd apps/web && npx vitest run src/tests/TreeItem.test.tsx
```

输出摘要：

```text
Test Files  1 passed (1)
Tests  4 passed (4)
```

注意：从仓库根目录直接执行 `npx vitest run apps/web/src/tests/TreeItem.test.tsx` 未加载 `apps/web/vite.config.ts` 的 jsdom 配置，会在 setup 阶段报 `ReferenceError: Range is not defined`，该命令未执行到测试用例；验收采用 web 包上下文命令作为有效测试证据。

## 待用户裁决

无。
