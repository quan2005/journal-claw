---
story: ./story.md
design: ./design.md
date: 2026-06-16
round: 2
result: pass
scope: "核对范围：src/styles/globals.css 中 Journal page frame token 相关变更；src/styles/markdown.css；src/styles/mdx.css；src/tests/light-theme-unit.test.ts；src/tests/MdxComponentDesign.test.ts；本 story/design；上一轮报告 verify-report.md"
---

# 验收报告 — MDX 预览正文左对齐与阅读排版修复

## 上一轮阻断复查

- pass：上一轮 AC-2 失败点是 `--journal-prose-max: 74ch` 会随元素字体/字号解析成不同像素宽，导致 `p=746`、`h1=888`、`.mdx-callout=653`、`.mdx-quote=592`（`stories/20260616-mdx-left-alignment/verify-report.md:17`，`stories/20260616-mdx-left-alignment/verify-report.md:55`）。本轮实现改为字体无关的 `--journal-prose-max: 46rem`（`src/styles/globals.css:162`-`src/styles/globals.css:165`），测试断言禁止 `ch` 结尾（`src/tests/light-theme-unit.test.ts:227`-`src/tests/light-theme-unit.test.ts:230`）。
- pass：独立 computed-style 烟测使用 `globals.css + markdown.css + mdx.css` 与 `.md-content.mdx-content`，输出 `rootProseMax: "46rem"`、`desktopProseStable: true`、`desktopLeftAligned: true`；`h1/p/list/blockquote/hr/callout/mdxquote/p2.width` 均为 `736`，窄容器 `nh1/np/ncallout.width` 均为 `620`。复现命令见「测试与命令证据」。

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC | 结论 | 证据 |
|---|---|---|
| AC-1 | pass | 契约要求标题、段落、引用、分割线从同一阅读栏左边缘开始（`stories/20260616-mdx-left-alignment/story.md:46`）。真实 MDX 容器使用 `className="md-content mdx-content"`（`src/components/MdxRenderer.tsx:420`-`src/components/MdxRenderer.tsx:431`）；组合选择器对 `p/ul/ol/blockquote/h1-h6/hr` 设置 `width: min(100%, var(--journal-prose-max))`、`margin-left: 0`、`margin-right: auto`、`text-align: left`（`src/styles/markdown.css:24`-`src/styles/markdown.css:31`）。computed-style 输出 `desktopLeftAligned: true`，且 `h1/p1/quote/hr.left` 均为 `0`。 |
| AC-2 | pass | 契约要求长篇中文正文中段落、列表与标题保持稳定行宽和舒适间距（`stories/20260616-mdx-left-alignment/story.md:47`）。本轮将阅读栏 token 固定为 `46rem`（`src/styles/globals.css:162`-`src/styles/globals.css:165`），测试断言该 token 不是 `ch` 单位（`src/tests/light-theme-unit.test.ts:227`-`src/tests/light-theme-unit.test.ts:230`）。正文块共享同一宽度规则（`src/styles/markdown.css:15`-`src/styles/markdown.css:31`），并统一正文 `font-size/line-height`、标题/段落/列表/引用/分割线间距（`src/styles/markdown.css:7`-`src/styles/markdown.css:9`，`src/styles/markdown.css:47`-`src/styles/markdown.css:89`，`src/styles/markdown.css:127`-`src/styles/markdown.css:143`）。computed-style 输出 `desktopProseStable: true`，`h1/p1/list/quote/hr/callout/mdxquote/p2.width` 均为 `736`。 |
| AC-3 | pass | 契约要求代码块、表格、图片和复杂 MDX 组件可用可用宽度，且不带偏后续普通正文（`stories/20260616-mdx-left-alignment/story.md:48`）。`pre/table/img` 保持 `max-width: 100%`（`src/styles/markdown.css:42`-`src/styles/markdown.css:45`），表格自身 `width: 100%`（`src/styles/markdown.css:160`-`src/styles/markdown.css:166`），图片 `max-width: 100%`（`src/styles/markdown.css:206`-`src/styles/markdown.css:211`）；复杂 MDX 块组设置 `width: 100%`、`max-width: 100%`（`src/styles/mdx.css:55`-`src/styles/mdx.css:74`）。computed-style 输出 `wideFull: true`，`pre/table/chart.width` 均为 `1000`，且 `followingUnaffected: true`。 |
| AC-4 | pass | 契约要求深色主题保持现有基调，信号橙只用于强调与交互，不引入新装饰色（`stories/20260616-mdx-left-alignment/story.md:49`）。MDX accent 仍由 `--record-btn` 与 `--record-highlight` 派生（`src/styles/mdx.css:13`-`src/styles/mdx.css:14`），深色主题对应橙色变量仍为 `--record-btn`、`--record-btn-hover`、`--record-highlight`（`src/styles/globals.css:485`-`src/styles/globals.css:493`）。`git diff -- src/styles/mdx.css` 的本轮相关变更集中在 radius token、左对齐和宽度分层，未出现新增颜色字面量。 |

## 范围完整性（不少，对照 story.md 范围）

- pass：常规正文排版覆盖标题、段落、列表、引用和分割线；证据为 `.md-content` 与 `.md-content.mdx-content` 下 `p/ul/ol/blockquote/h1-h6/hr` 的共享宽度与左对齐规则（`src/styles/markdown.css:15`-`src/styles/markdown.css:31`），对应范围条目（`stories/20260616-mdx-left-alignment/story.md:31`）。
- pass：代码块、表格、图片保持可用宽度；证据为 `pre/table/img` 的 `max-width: 100%`、表格 `width: 100%`、图片 `max-width: 100%`（`src/styles/markdown.css:42`-`src/styles/markdown.css:45`，`src/styles/markdown.css:160`-`src/styles/markdown.css:166`，`src/styles/markdown.css:206`-`src/styles/markdown.css:211`），对应范围条目（`stories/20260616-mdx-left-alignment/story.md:31`）。
- pass：真实组合容器 `.md-content.mdx-content` 有专门规则，且 `MdxRenderer` 实际输出该组合 class；证据为 `src/styles/markdown.css:24`-`src/styles/markdown.css:31` 与 `src/components/MdxRenderer.tsx:420`-`src/components/MdxRenderer.tsx:431`，对应范围条目（`stories/20260616-mdx-left-alignment/story.md:32`）。
- pass：与左对齐相关的阅读节奏已覆盖行宽、段落/标题/引用/分割线间距；证据为 `src/styles/globals.css:162`-`src/styles/globals.css:165`、`src/styles/markdown.css:47`-`src/styles/markdown.css:89`、`src/styles/markdown.css:127`-`src/styles/markdown.css:143`，对应范围条目（`stories/20260616-mdx-left-alignment/story.md:33`）。
- pass：红/绿测试已覆盖共享 frame token、真实组合选择器、MDX 宽块和 radius token；证据为 `src/tests/light-theme-unit.test.ts:227`-`src/tests/light-theme-unit.test.ts:269` 与 `src/tests/MdxComponentDesign.test.ts:13`-`src/tests/MdxComponentDesign.test.ts:18`、`src/tests/MdxComponentDesign.test.ts:37`-`src/tests/MdxComponentDesign.test.ts:40`，对应范围条目（`stories/20260616-mdx-left-alignment/story.md:34`）。

## 方案落实（不偏，对照 design.md）

- pass：方案 1 要求在 `.md-content.mdx-content` 组合容器上建立明确左对齐规则（`stories/20260616-mdx-left-alignment/design.md:14`）；实现证据为 `src/styles/markdown.css:24`-`src/styles/markdown.css:31`，computed-style 输出 `desktopLeftAligned: true`。
- pass：方案 2 要求常规正文块共享 `--journal-prose-max`，复杂块保持可用宽度（`stories/20260616-mdx-left-alignment/design.md:15`）；实现证据为常规正文规则（`src/styles/markdown.css:15`-`src/styles/markdown.css:31`）、MDX prose 组件规则（`src/styles/mdx.css:29`-`src/styles/mdx.css:44`，`src/styles/mdx.css:1722`-`src/styles/mdx.css:1739`）和复杂块全宽规则（`src/styles/mdx.css:55`-`src/styles/mdx.css:74`）。
- pass：方案 3 要求统一段落、标题、引用和分割线节奏，避免横向漂移（`stories/20260616-mdx-left-alignment/design.md:16`）；实现证据为 `46rem` 阅读栏 token（`src/styles/globals.css:162`-`src/styles/globals.css:165`）和 markdown 节奏规则（`src/styles/markdown.css:47`-`src/styles/markdown.css:89`，`src/styles/markdown.css:127`-`src/styles/markdown.css:143`），computed-style 输出 `desktopProseStable: true`。
- pass：方案 4 要求增加 CSS 级红/绿测试（`stories/20260616-mdx-left-alignment/design.md:17`）；实现证据为 `src/tests/light-theme-unit.test.ts:227`-`src/tests/light-theme-unit.test.ts:269` 与 `src/tests/MdxComponentDesign.test.ts:13`-`src/tests/MdxComponentDesign.test.ts:18`。
- pass：方案 5 要求用浏览器检查真实预览 DOM 与 computed style（`stories/20260616-mdx-left-alignment/design.md:18`）；本轮复现命令输出 `desktopProseStable: true`、`desktopLeftAligned: true`、`wideFull: true`、`followingUnaffected: true`、`narrowFitsContainer: true`。

## 越界检查（不多，对照 story 非目标 + design 范围）

- pass：本轮核对范围内的 MDX/Markdown 样式变更均可归属到 AC-1、AC-2、AC-3 或 design 方案；证据为 `git diff -- src/styles/markdown.css src/styles/mdx.css src/tests/light-theme-unit.test.ts src/tests/MdxComponentDesign.test.ts`，输出变更集中在 `text-align: left`、`width: min(100%, var(--journal-prose-max))`、`max-width` 分层、radius token 与测试断言。
- pass：`src/styles/globals.css` 的本轮裁判仅限用户指定的 Journal page frame token；证据为 `--journal-prose-max: 46rem` 位于 Journal page frame token 区块（`src/styles/globals.css:162`-`src/styles/globals.css:165`），且该 token 被真实链路中的 journal block prose/hero/callout 消费（`src/styles/journal-blocks.css:8`-`src/styles/journal-blocks.css:10`，`src/styles/journal-blocks.css:48`-`src/styles/journal-blocks.css:58`，`src/styles/journal-blocks.css:1431`-`src/styles/journal-blocks.css:1433`）。
- pass：未发现命中非目标的证据。非目标排除 MDX 编译、组件注册、块级渲染架构、日志数据、全应用主题重设计和新增 MDX 组件 API（`stories/20260616-mdx-left-alignment/story.md:36`-`stories/20260616-mdx-left-alignment/story.md:42`）；本轮被裁判 diff 不涉及对应代码路径，`git diff -- stories/20260616-mdx-left-alignment/story.md stories/20260616-mdx-left-alignment/design.md` 输出为空。
- 说明：`git diff -- src/styles/globals.css` 仍包含 `ideas-workbench` / quick add 相关改动；上一轮报告已将其列为可能需用户裁决的同文件非 MDX diff（`stories/20260616-mdx-left-alignment/verify-report.md:40`，`stories/20260616-mdx-left-alignment/verify-report.md:59`-`stories/20260616-mdx-left-alignment/verify-report.md:61`）。本轮用户输入把 `globals.css` 限定为 Journal page frame token 相关变更，因此该同文件 diff 不计入本 story 的越界裁判。

## 冗余（不重，对照 story.md）

- pass：未发现同一 AC 存在两套无原因的并行实现。普通 `.md-content`、组合 `.md-content.mdx-content` 与 `.md-section` 的相近规则分别覆盖普通 markdown、真实 MDX 组合容器和 chunked section（`src/styles/markdown.css:15`-`src/styles/markdown.css:40`），可归属到交棒清单中“哪些选择器属于普通正文”和“避免 markdown.css 与 mdx.css 加载顺序让修复失效”（`stories/20260616-mdx-left-alignment/story.md:57`-`stories/20260616-mdx-left-alignment/story.md:62`）。

## 测试与命令证据

- pass：`npx vitest run src/tests/light-theme-unit.test.ts -t "Journal content frame contract"` 输出 `Test Files 1 passed (1)`，`Tests 5 passed | 38 skipped (43)`。
- pass：`npx vitest run src/tests/MdxComponentDesign.test.ts -t "specialized MDX component design language"` 输出 `Test Files 1 passed (1)`，`Tests 4 passed (4)`。
- 非阻断说明：`npx vitest run src/tests/light-theme-unit.test.ts src/tests/MdxComponentDesign.test.ts` 输出 `Test Files 1 failed | 1 passed (2)`、`Tests 2 failed | 45 passed (47)`；失败点仍为 `src/tests/light-theme-unit.test.ts:97` 的 `--record-btn-icon` 深色主题快照，以及 `src/tests/light-theme-unit.test.ts:354` 的 Ideas workbench `box-shadow` 断言。上一轮报告已记录同两类失败且说明不直接映射到本 story 的 MDX 左对齐 AC（`stories/20260616-mdx-left-alignment/verify-report.md:48`-`stories/20260616-mdx-left-alignment/verify-report.md:50`），本轮不计为本 story 阻断项。
- pass：computed-style 烟测复现命令为 `node --input-type=module - <<'NODE' ... chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }) ...`，加载 `src/styles/globals.css`、`src/styles/markdown.css`、`src/styles/mdx.css` 后输出：`rootProseMax: "46rem"`、`desktopProseStable: true`、`desktopLeftAligned: true`、`wideFull: true`、`followingUnaffected: true`、`narrowFitsContainer: true`；关键宽度为 `h1/p1/list/quote/hr/callout/mdxquote/p2.width = 736`，`pre/table/chart.width = 1000`，`nh1/np/ncallout.width = 620`。

## 结论

result: pass。第 2 轮确认上一轮阻断项 AC-2 / 稳定行宽已修复：阅读栏 token 从字体相关的 `ch` 改为 `46rem`，真实 cascade computed style 显示标题、段落、列表、引用、分割线、MDX callout、MDX quote 与复杂块后的正文共享同一实际宽度；复杂块继续全宽且不会带偏后续正文。

保留说明：完整运行两个测试文件仍有 2 个非本 story 失败，与上一轮报告记录一致；本轮仅按用户指定范围裁判 MDX 左对齐与阅读排版契约，不修改 story/design status。

## 待用户裁决

无。证据：本轮 AC、范围完整性、方案落实、越界与冗余均有通过证据；上一轮唯一阻断项 AC-2 已由 `src/styles/globals.css:162`-`src/styles/globals.css:165`、`src/tests/light-theme-unit.test.ts:227`-`src/tests/light-theme-unit.test.ts:230` 和 computed-style 输出闭环。
