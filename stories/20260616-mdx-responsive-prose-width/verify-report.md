---
story: ./story.md
design: ./design.md
date: 2026-06-16
round: 1
result: fail
scope: "src/styles/globals.css, src/styles/markdown.css, src/styles/mdx.css, src/styles/journal-blocks.css, src/tests/light-theme-unit.test.ts, src/tests/MdxComponentDesign.test.ts, src/tests/journalBlockStyles.test.ts, stories/20260616-mdx-responsive-prose-width/verify-report.md"
---

# 验收报告 — MDX 预览宽屏阅读栏自适应

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 宽屏正文栏自适应展开 | ✅ pass | AC 要求普通段落、标题、引用块在宽屏随可用宽度合理变宽且不固定窄栏（`story.md:51`-`story.md:55`）。实现把共享 token 改为 `clamp(46rem, 72vw, 80rem)`（`src/styles/globals.css:162`-`src/styles/globals.css:165`），并让 `.md-content.mdx-content` 的段落/标题/引用等使用 `width: min(100%, var(--journal-prose-max))`、左对齐（`src/styles/markdown.css:25`-`src/styles/markdown.css:31`）；`.mdx-section` / degraded block 内正文也同样使用该 token（`src/styles/mdx.css:45`-`src/styles/mdx.css:53`）。浏览器 computed-style 检查输出：宽屏 `frame=1200`、`heading=1036.796875`、`para=1036.796875`、`quote=1036.796875`、`paraMax="1036.8px"`、`wideProseGreaterThanOld46rem=true`。测试 `npx vitest run src/tests/light-theme-unit.test.ts -t "Journal content frame contract"` 输出 `1 passed (1), Tests 5 passed | 38 skipped`。 |
| AC-2 窄屏与左对齐不回退 | ✅ pass | AC 要求窄屏/普通窗口下标题、段落、引用块、符号开头行同一左边缘且行首符号不外突（`story.md:57`-`story.md:62`）。`.md-content` 设置 `text-align: left`、`hanging-punctuation: none`（`src/styles/markdown.css:4`-`src/styles/markdown.css:13`），正文块设置 `margin-left: 0` / `margin-right: auto` / `text-align: left`（`src/styles/markdown.css:16`-`src/styles/markdown.css:23`，`src/styles/markdown.css:25`-`src/styles/markdown.css:31`）；列表保留内侧缩进（`src/styles/markdown.css:86`-`src/styles/markdown.css:93`）。`.mdx-content` 同样设置 `text-align: left`、`hanging-punctuation: none`（`src/styles/mdx.css:17`-`src/styles/mdx.css:22`）。浏览器 computed-style 检查输出：窄屏 `frame=342`、`heading=342`、`para=342`、`quote=342`、`paraOverflow=false`、`quoteOverflow=false`、`paraMarginLeft="0px"`、`narrowNoOverflow=true`。测试断言覆盖 `text-align: left`、`hanging-punctuation: none`、`margin-left: 0`（`src/tests/light-theme-unit.test.ts:250`-`src/tests/light-theme-unit.test.ts:263`；`src/tests/MdxComponentDesign.test.ts:43`-`src/tests/MdxComponentDesign.test.ts:49`）。 |
| AC-3 复杂块仍使用可用宽度 | ✅ pass | AC 要求代码块、表格、图片或复杂 MDX 组件不被新的正文宽度上限压窄（`story.md:63`-`story.md:68`）。普通 markdown 的 `pre/table/img` 不走 prose 上限，直接 `max-width: 100%`（`src/styles/markdown.css:43`-`src/styles/markdown.css:45`），其中 table 为 `width: 100%`（`src/styles/markdown.css:162`-`src/styles/markdown.css:167`），code block 可横向滚动（`src/styles/markdown.css:110`-`src/styles/markdown.css:116`），image 为 `max-width: 100%`（`src/styles/markdown.css:207`-`src/styles/markdown.css:211`）。MDX 复杂组件集合 `.mdx-chart` / `.mdx-table-wrap` / `.mdx-image` 等设置 `width: 100%; max-width: 100%`（`src/styles/mdx.css:55`-`src/styles/mdx.css:74`），`.mdx-table` 为 `width: 100%`（`src/styles/mdx.css:556`-`src/styles/mdx.css:568`），`.mdx-image img` 为 `max-width: 100%`（`src/styles/mdx.css:1059`-`src/styles/mdx.css:1068`）。journal block 分层保留 prose/content/wide 三档（`src/styles/journal-blocks.css:1`-`src/styles/journal-blocks.css:18`）。浏览器 computed-style 检查输出：宽屏 `para=1036.796875`，`pre=1200`、`wide=1200`、`table=1200`、`image=1200`，`wideComplexBlocksGreaterThanProse=true`。测试 `npx vitest run src/tests/MdxComponentDesign.test.ts src/tests/journalBlockStyles.test.ts` 输出 `2 passed (2), Tests 19 passed (19)`；相关断言在 `src/tests/MdxComponentDesign.test.ts:20`-`src/tests/MdxComponentDesign.test.ts:23`、`src/tests/journalBlockStyles.test.ts:29`-`src/tests/journalBlockStyles.test.ts:32`。 |

不倚检查：三条 AC 均有实现和测试/浏览器证据；命令 `rg -n "TODO|FIXME|stub|not implemented|throw new Error" src/styles/globals.css src/styles/markdown.css src/styles/mdx.css src/styles/journal-blocks.css src/tests/light-theme-unit.test.ts src/tests/MdxComponentDesign.test.ts src/tests/journalBlockStyles.test.ts` 无输出，未发现占位或静默降级。

## 范围完整性（不少，对照 story.md 范围）

- ✅ 用户行为变化覆盖：正文栏自适应展开、右侧空白减少、仍保留最大可读宽度分别由 `--journal-prose-max: clamp(46rem, 72vw, 80rem)`（`src/styles/globals.css:162`-`src/styles/globals.css:165`）、正文块 `width: min(100%, var(--journal-prose-max))`（`src/styles/markdown.css:16`-`src/styles/markdown.css:31`）、浏览器输出 `para=1036.796875` 且 `paraMax="1036.8px"` 支撑。
- ✅ 交棒清单覆盖：普通正文宽度 token 为 `--journal-prose-max`（`src/styles/globals.css:162`-`src/styles/globals.css:165`）；正文随容器增长但有限制由 `clamp(...)` + `min(100%, ...)` 实现（`src/styles/markdown.css:16`-`src/styles/markdown.css:31`）；复杂 MDX 块通过 `width: 100%; max-width: 100%` 保持全宽（`src/styles/mdx.css:55`-`src/styles/mdx.css:74`）；测试覆盖宽屏 token、左对齐、行首符号、复杂块分层（`src/tests/light-theme-unit.test.ts:227`-`src/tests/light-theme-unit.test.ts:263`，`src/tests/MdxComponentDesign.test.ts:14`-`src/tests/MdxComponentDesign.test.ts:23`，`src/tests/journalBlockStyles.test.ts:29`-`src/tests/journalBlockStyles.test.ts:32`）。

## 方案落实（不偏，对照 design.md）

- ✅ 方案 1：`--journal-prose-max` 已从固定/全宽式值改为响应式 `clamp(46rem, 72vw, 80rem)`（`design.md:14`；`src/styles/globals.css:162`-`src/styles/globals.css:165`）。
- ✅ 方案 2：`.md-content` / `.mdx-content` 均保留左对齐，且 `hanging-punctuation: none`（`design.md:15`；`src/styles/markdown.css:4`-`src/styles/markdown.css:13`；`src/styles/mdx.css:17`-`src/styles/mdx.css:22`）。
- ✅ 方案 3：代码块、表格、图片和复杂 MDX 组件仍走全宽或 content/wide 分层（`design.md:16`；`src/styles/markdown.css:43`-`src/styles/markdown.css:45`；`src/styles/mdx.css:55`-`src/styles/mdx.css:74`；`src/styles/journal-blocks.css:1`-`src/styles/journal-blocks.css:18`）。
- ✅ 方案 4：样式契约测试明确 `clamp(...)`、不用 `ch`、`hanging-punctuation: none`、复杂组件宽度分层（`design.md:17`；`src/tests/light-theme-unit.test.ts:227`-`src/tests/light-theme-unit.test.ts:263`；`src/tests/MdxComponentDesign.test.ts:14`-`src/tests/MdxComponentDesign.test.ts:23`；`src/tests/MdxComponentDesign.test.ts:43`-`src/tests/MdxComponentDesign.test.ts:49`）。
- ✅ 方案 5：真实 CSS cascade 下的浏览器布局检查已执行（读取 `globals.css`、`markdown.css`、`mdx.css`、`journal-blocks.css`，Chrome headless）。输出摘要：宽屏 `frame=1200`、`para=1036.796875`、`pre/table/image/wide=1200`，窄屏 `frame=342`、`para=342`、`quote=342`、`paraOverflow=false`、`quoteOverflow=false`，checks 全为 `true`。
- ✅ NFR/依赖：真实入口 `MdxRenderer` 输出 `.md-content mdx-content`（`src/components/MdxRenderer.tsx:420`-`src/components/MdxRenderer.tsx:432`），与 story 所述 cascade 链路一致（`story.md:30`）。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ❌ fail / 待用户裁决：当前核对范围内的 `src/styles/globals.css` diff 包含 `ideas-workbench` / quick-add 相关样式改动，无法归属到本 story 的 AC、design 影响面中的 MDX/markdown/journal block 宽度方案，且 story 明确“不调整源码编辑模式、列表页卡片、聊天面板或非日志详情的布局”（`story.md:69`-`story.md:73`）。证据：`git diff -- src/styles/globals.css` 输出显示删除 `.ideas-workbench-header` 的 grid 布局、删除 `.ideas-workbench-summary max-width: 470px`，并新增 `.ideas-workbench-quick-add` / `.ideas-workbench-quick-input` / `.ideas-workbench-quick-submit`；当前文件位置为 `src/styles/globals.css:1284`-`src/styles/globals.css:1317`、`src/styles/globals.css:1619`-`src/styles/globals.css:1682`。鉴于工作树可能混有其他任务改动，本报告不修改或归因这些代码；但在本轮给定核对范围内，保守计为越界/待裁决。

## 冗余（不重，对照 story.md）

- ✅ pass：未发现同一 AC 的多套并行宽度实现。共享宽度 token 只在 `:root` 定义一次：命令 `rg -n -- "--journal-prose-max:|--journal-readable-max:|--journal-content-max:" src/styles/globals.css src/styles/markdown.css src/styles/mdx.css src/styles/journal-blocks.css` 输出仅包含 `src/styles/globals.css:163`、`src/styles/globals.css:164`、`src/styles/globals.css:165`；各渲染层消费同一 token/分层（`src/styles/markdown.css:16`-`src/styles/markdown.css:31`，`src/styles/mdx.css:29`-`src/styles/mdx.css:74`，`src/styles/journal-blocks.css:1`-`src/styles/journal-blocks.css:18`）。

## 结论

result: fail。

三条 AC、范围完整性、方案落实、冗余和不倚检查均有证据通过；失败来自“不多”：本轮核对范围中存在一组无法归入该 story 契约的 `ideas-workbench` 样式改动。按六字标准，含待用户裁决项时保守计 fail。

修复/处置建议（按风险排序）：

1. 若 `ideas-workbench` 改动属于其他 story 或其他智能体工作，请从本 story 的验收范围/提交中排除，或在独立 story 的验收报告中处理。
2. 若这些改动实际要随本 story 一起交付，请先回写对应契约（影响“要什么”回 story；影响“怎么做”回 design），再重新验收。

## 待用户裁决

1. `src/styles/globals.css` 中 `ideas-workbench` / quick-add 样式改动是否纳入本 story？
   - 接受纳入的代价：需要扩展 story/design，因为当前契约只覆盖 MDX 预览正文宽度，不覆盖 ideas workbench 或 quick-add 布局。
   - 不接受纳入的代价：需要把这组改动从本 story 的核对范围/提交中分离，否则本 story 不能按“不多”通过。
