---
story: ./story.md
design: ./design.md
date: 2026-06-16
round: 1
result: pass
scope: "核对范围：story/design 契约；src/styles/globals.css 的 :root Journal page frame token；src/styles/markdown.css 的 .md-content / .md-content > :where(...) / .md-content.mdx-content > :where(...) / pre-table-img 宽度、左对齐、hanging punctuation；src/styles/mdx.css 的 .mdx-content 与 prose/content/wide 宽度、左对齐、hanging punctuation；src/styles/journal-blocks.css 的 prose/content/wide 三档宽度；src/tests/light-theme-unit.test.ts、src/tests/MdxComponentDesign.test.ts、src/tests/journalBlockStyles.test.ts 的相关断言。当前工作树其他任务改动不在本轮裁决范围。"
---

# 验收报告 — MDX 全屏预览正文宽度跟随窗口

## 契约提取

- story.md 的 GWT AC：AC-1 全屏正文使用内容区宽度（`story.md:49-53`）；AC-2 左对齐与行首符号不回退（`story.md:55-59`）；AC-3 复杂块宽度分层保持可用（`story.md:61-65`）。
- story.md 三类边界：不为固定出版式长文行宽偏好用户做；不调整源码模式、聊天面板、列表页卡片或 Ideas 工作台布局；不新增阅读宽度设置、不重做详情页信息架构、不改变 MDX 组件语义（`story.md:67-71`）。
- design.md 方案范围：沿真实渲染链路修正 `--journal-prose-max`、保留左对齐与 `hanging-punctuation: none`、保留复杂块全宽规则、更新样式契约测试、做真实 CSS cascade 下的浏览器几何检查（`design.md:12-18`）；影响面限于 4 个样式文件和测试（`design.md:20-26`）。
- design.md NFR/依赖落实要求：全屏长行更长是本次优先取舍；共享 `--journal-prose-max` 必须让 `.md-content`、`.mdx-content` 和 journal block prose 一起生效；复杂块和符号对齐不能回退（`design.md:28-32`）。

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 | pass | `--journal-prose-max` 跟随 `--journal-readable-max`，且 readable/content 都是内容区契约：`src/styles/globals.css:162-165`。Markdown/MDX 普通正文、标题、引用块选择器使用 `width: min(100%, var(--journal-prose-max))` 和 `max-width: var(--journal-prose-max)`：`src/styles/markdown.css:16-31`、`src/styles/mdx.css:29-53`。浏览器几何检查（Chrome headless，加载 `globals.css -> markdown.css -> mdx.css -> journal-blocks.css`）输出宽屏 `contentWidth: 1344`，`heading/para/quote.width: 1344`，`leftDelta: 0`。相关断言覆盖 token 无固定 `ch`/`clamp` 上限：`src/tests/light-theme-unit.test.ts:227-232`、`src/tests/MdxComponentDesign.test.ts:15-18`。 |
| AC-2 | pass | `.md-content` 明确 `text-align: left` 与 `hanging-punctuation: none`：`src/styles/markdown.css:4-13`；Markdown/MDX 正文块 `margin-left: 0`、`margin-right: auto`、`text-align: left`：`src/styles/markdown.css:16-31`；`.mdx-content` 同样左对齐且关闭 hanging punctuation：`src/styles/mdx.css:17-21`，MDX prose 规则保持左边缘：`src/styles/mdx.css:38-53`、`src/styles/mdx.css:1723-1729`。测试断言覆盖 left/hanging：`src/tests/light-theme-unit.test.ts:251-263`、`src/tests/MdxComponentDesign.test.ts:44-50`。浏览器几何检查输出宽屏 `heading/para/quote.leftDelta: 0`，窄屏 `paraLeftDelta: 0`。 |
| AC-3 | pass | Markdown 复杂块 `pre/table/img` 不被 prose 宽度额外缩窄：`src/styles/markdown.css:43-46`；`pre` 可横向滚动：`src/styles/markdown.css:110-116`；table `width: 100%`：`src/styles/markdown.css:161-167`；img `max-width: 100%`：`src/styles/markdown.css:207-211`。MDX 复杂块组（chart/html/mac/diagram/math/kanban/table/device/grid/split/stat/cards/media/image）为 `width: 100%; max-width: 100%`：`src/styles/mdx.css:55-74`。MDX specialized prose/content/wide 三档为 prose/content/100%：`src/styles/mdx.css:1723-1738`；journal block 三档同样存在：`src/styles/journal-blocks.css:1-17`。测试覆盖 MDX 与 journal block 三档：`src/tests/MdxComponentDesign.test.ts:21-24`、`src/tests/journalBlockStyles.test.ts:29-32`。浏览器几何检查输出宽屏 `pre/table/chart/blockprose/blockcontent/blockwide.width: 1344`，img 受自身 1200px intrinsic 宽度限制但 `leftDelta: 0` 且未溢出；窄屏 `scrollWidth: 390`、`clientWidth: 390`。 |

## 范围完整性（不少，对照 story.md 范围）

- 用户行为变化三项均有证据：正文最大宽度截断改为内容区宽度（`src/styles/globals.css:162-165`、`src/styles/markdown.css:16-31`、`src/styles/mdx.css:29-53`）；全屏提前换行减少由 `--journal-prose-max` 不再是固定 `rem/ch/clamp` 上限保障（`src/tests/light-theme-unit.test.ts:227-232`、`src/tests/MdxComponentDesign.test.ts:15-18`）；左对齐与符号对齐由 left/hanging 规则保障（`src/styles/markdown.css:11-12`、`src/styles/mdx.css:19-21`）。
- story 交棒清单三项均闭合：限制普通正文宽度的共享 token 已定位并改为 readable frame（`src/styles/globals.css:162-165`）；普通正文跟随 `--journal-readable-max` 且不破坏左对齐（`src/styles/markdown.css:16-31`、`src/styles/mdx.css:38-53`）；复杂块和行首符号对齐有样式与测试覆盖（`src/styles/markdown.css:43-46`、`src/styles/mdx.css:55-74`、`src/tests/light-theme-unit.test.ts:251-263`）。
- 最小相关测试已通过：`npx vitest run src/tests/light-theme-unit.test.ts -t "Journal content frame contract"` 输出 `Test Files 1 passed (1)`、`Tests 5 passed | 38 skipped (43)`；`npx vitest run src/tests/MdxComponentDesign.test.ts src/tests/journalBlockStyles.test.ts` 输出 `Test Files 2 passed (2)`、`Tests 19 passed (19)`。

## 方案落实（不偏，对照 design.md）

- 方案 1 已落实：`--journal-prose-max: var(--journal-readable-max)`，`--journal-readable-max: 100%`，`--journal-content-max: var(--journal-readable-max)`（`src/styles/globals.css:162-165`）。
- 方案 2 已落实：Markdown 与 MDX 容器均左对齐并关闭 hanging punctuation（`src/styles/markdown.css:4-13`、`src/styles/mdx.css:17-21`），相关 prose 块也显式左对齐（`src/styles/markdown.css:16-31`、`src/styles/mdx.css:38-53`）。
- 方案 3 已落实：代码块、表格、图片和复杂 MDX 组件保留可用宽度规则（`src/styles/markdown.css:43-46`、`src/styles/markdown.css:110-116`、`src/styles/markdown.css:161-167`、`src/styles/markdown.css:207-211`、`src/styles/mdx.css:55-74`）。
- 方案 4 已落实：样式契约测试新增/覆盖正文宽度不再使用固定 `ch` / `clamp` 上限、MDX 三档宽度、hanging punctuation 和 journal block 三档宽度（`src/tests/light-theme-unit.test.ts:227-263`、`src/tests/MdxComponentDesign.test.ts:15-24`、`src/tests/MdxComponentDesign.test.ts:44-50`、`src/tests/journalBlockStyles.test.ts:29-32`）。
- 方案 5 已落实：独立验收执行了真实浏览器几何检查，按真实 CSS 顺序加载 `src/styles/globals.css`、`src/styles/markdown.css`、`src/styles/mdx.css`、`src/styles/journal-blocks.css`；宽屏输出 `contentWidth: 1344`，`heading/para/quote/pre/table/chart/blockprose/blockcontent/blockwide.width: 1344` 且 `leftDelta: 0`；窄屏输出 `viewport: 390`、`scrollWidth: 390`、`clientWidth: 390`、`paraWidth: 294`、`paraLeftDelta: 0`。
- 真实渲染链路依赖可追踪：`globals.css` 由入口加载（`src/main.tsx:1`），Markdown/MDX/journal blocks 分别由 renderer/component 加载（`src/components/MarkdownRenderer.tsx:12`、`src/components/mdx/typography.tsx:1`、`src/components/journal-blocks/JournalBlockRenderer.tsx:3`）。

## 越界检查（不多，对照 story 非目标 + design 范围）

- pass：本 story 相关核对范围内，每处规则均可归属到 AC 或 design 影响面：Journal frame token（`src/styles/globals.css:162-165`）归 AC-1/方案 1；Markdown/MDX prose 左对齐和 hanging punctuation（`src/styles/markdown.css:4-31`、`src/styles/mdx.css:17-53`）归 AC-1/AC-2/方案 2；复杂块规则（`src/styles/markdown.css:43-46`、`src/styles/mdx.css:55-74`）归 AC-3/方案 3；三档宽度规则（`src/styles/mdx.css:1723-1738`、`src/styles/journal-blocks.css:1-17`）归 AC-3/方案 3；测试断言归方案 4。
- pass：未发现本 story 相关范围内新增阅读宽度设置、详情页信息架构重做或 MDX 组件语义改变；核对到的是 CSS 宽度/对齐契约与测试断言（`story.md:67-71`、`design.md:20-26`）。
- 说明：当前工作树存在其他任务改动；本报告按用户输入只核对本 story 相关范围，不对同工作树的非本 story diff 作通过或失败裁决。

## 冗余（不重，对照 story.md）

- pass：宽度行为由共享 token `--journal-prose-max -> --journal-readable-max` 统一驱动，而不是多套固定宽度并行实现（`src/styles/globals.css:162-165`）。
- pass：Markdown、MDX、journal block 的重叠选择器属于真实渲染链路下的级联覆盖，且都消费同一 token/三档契约；未发现同一 AC 的另一套独立硬编码宽度实现。证据：Markdown prose 使用 `var(--journal-prose-max)`（`src/styles/markdown.css:16-31`），MDX prose/content/wide 使用同一三档（`src/styles/mdx.css:1723-1738`），journal block prose/content/wide 使用同一三档（`src/styles/journal-blocks.css:8-17`），测试断言禁止 `--journal-prose-max` 回到 `ch`/`clamp` 固定上限（`src/tests/light-theme-unit.test.ts:227-232`、`src/tests/MdxComponentDesign.test.ts:15-18`）。

## 结论

result: pass。

六字标准结论：不漏 pass；不重 pass；不偏 pass；不倚 pass；不多 pass；不少 pass。失败项 0 个。

已验证 AC-1/AC-2/AC-3 均有代码证据、测试证据和浏览器几何证据；design.md 的方案范围、NFR/依赖要求均已落实。未修改 story.md、design.md、status、源码或测试。

## 待用户裁决

无。
