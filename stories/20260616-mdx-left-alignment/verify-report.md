---
story: ./story.md
design: ./design.md
date: 2026-06-16
round: 1
result: fail
scope: '核对范围：src/styles/globals.css 中 Journal page frame token 相关变更；src/styles/markdown.css；src/styles/mdx.css；src/tests/light-theme-unit.test.ts；src/tests/MdxComponentDesign.test.ts；本 story/design'
---

# 验收报告 — MDX 预览正文左对齐与阅读排版修复

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC   | 结论              | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | ✅ pass           | 契约要求标题、段落、引用、分割线从同一阅读栏左边缘开始（`stories/20260616-mdx-left-alignment/story.md:46`）。实现对 `.md-content.mdx-content > :where(p, ul, ol, blockquote, h1, h2, h3, h4, h5, h6, hr)` 设置 `width: min(100%, var(--journal-prose-max))`、`margin-left: 0`、`margin-right: auto`、`text-align: left`（`src/styles/markdown.css:24`-`src/styles/markdown.css:31`）；独立浏览器 computed style 命令输出 `proseAligned: true`，且 `h1/p1/quote/hr/p2.left` 均为 `0`。                                                                                                                                                                                                                                               |
| AC-2 | ❌ fail           | 契约要求段落、列表与标题保持稳定行宽，不出现忽宽忽窄（`stories/20260616-mdx-left-alignment/story.md:47`）。实现把 `--journal-prose-max` 定义为 `74ch`（`src/styles/globals.css:163`），但 `ch` 会按元素自身字体/字号计算；标题使用 `var(--font-display)`（`src/styles/markdown.css:52`-`src/styles/markdown.css:55`），MDX callout 使用 `var(--text-sm)`（`src/styles/mdx.css:740`-`src/styles/mdx.css:746`），MDX quote 使用 `var(--font-serif)`（`src/styles/mdx.css:784`-`src/styles/mdx.css:793`）。独立浏览器 computed style 命令输出：普通段落宽 `746`，`h1` 宽 `888`；第二条命令输出：普通段落宽 `746`，`.mdx-callout` 宽 `653`，`.mdx-quote` 宽 `592`。左边缘一致，但阅读栏实际像素宽度仍会随块类型变化，未满足“稳定行宽”。 |
| AC-3 | ✅ pass           | 契约要求代码块、表格、图片或复杂 MDX 组件可用可用宽度，且不带偏后续普通正文（`stories/20260616-mdx-left-alignment/story.md:48`）。Markdown 媒体块 `pre/table/img` 保持 `max-width: 100%`（`src/styles/markdown.css:42`-`src/styles/markdown.css:45`）；MDX 复杂块组设置 `width: 100%`、`max-width: 100%`（`src/styles/mdx.css:55`-`src/styles/mdx.css:74`）。独立浏览器 computed style 命令输出 `wideFull: true`、`followingUnaffected: true`，且 `pre/table/chart.width` 均为 `1000`，后续 `p2.left` 为 `0`、宽 `746`。                                                                                                                                                                                                            |
| AC-4 | ✅ pass（范围内） | 契约要求深色主题保持现有 Modern · Bold · Agentic 基调，不引入新的装饰色（`stories/20260616-mdx-left-alignment/story.md:49`）。本次 MDX 根 accent 仍来自 `--record-btn` 与 `--record-highlight`（`src/styles/mdx.css:13`-`src/styles/mdx.css:14`），深色主题 record orange 定义仍在 `--record-btn`/`--record-btn-hover`（`src/styles/globals.css:485`-`src/styles/globals.css:486`）。`git diff -- src/styles/mdx.css` 显示本轮 MDX 改动为 radius token、左对齐、宽度分层相关，未新增独立装饰色。                                                                                                                                                                                                                                    |

## 范围完整性（不少，对照 story.md 范围）

- ✅ 常规正文块已覆盖标题、段落、列表、引用、分割线：组合选择器覆盖 `p, ul, ol, blockquote, h1-h6, hr`（`src/styles/markdown.css:24`-`src/styles/markdown.css:31`）。
- ✅ 代码块、表格、图片已保持可用宽度：`pre/table/img` 为 `max-width: 100%`（`src/styles/markdown.css:42`-`src/styles/markdown.css:45`），表格自身 `width: 100%`（`src/styles/markdown.css:160`-`src/styles/markdown.css:166`），图片 `max-width: 100%`（`src/styles/markdown.css:206`-`src/styles/markdown.css:211`）。
- ✅ `.md-content.mdx-content` 真实组合容器有专门规则：`src/styles/markdown.css:24`-`src/styles/markdown.css:31`。
- ❌ 与左对齐直接相关的“稳定行宽”未完整满足：computed style 显示标题、callout、quote 与普通段落宽度不同，见 AC-2 证据。
- ✅ 红/绿测试已覆盖关键 CSS 约束：`light-theme-unit.test.ts` 断言 `--journal-prose-max: 74ch`、组合选择器、MDX 宽块规则与 detail frame（`src/tests/light-theme-unit.test.ts:227`-`src/tests/light-theme-unit.test.ts:268`）；`MdxComponentDesign.test.ts` 断言 MDX specialized prose/content/wide 三档宽度和 radius token（`src/tests/MdxComponentDesign.test.ts:13`-`src/tests/MdxComponentDesign.test.ts:18`，`src/tests/MdxComponentDesign.test.ts:37`-`src/tests/MdxComponentDesign.test.ts:40`）。

## 方案落实（不偏，对照 design.md）

- ✅ 方案 1：在 `.md-content.mdx-content` 组合容器下建立左对齐规则。证据：`src/styles/markdown.css:24`-`src/styles/markdown.css:31`，独立浏览器 computed style 输出 `proseAligned: true`。
- ❌ 方案 2/3：正文块与复杂块已分层，但正文块实际像素行宽不稳定。方案要求正文块共享 `--journal-prose-max`、统一段落/标题/引用/分割线节奏以避免横向漂移（`stories/20260616-mdx-left-alignment/design.md:15`-`stories/20260616-mdx-left-alignment/design.md:16`）；实现使用 `74ch`（`src/styles/globals.css:163`），在不同字体/字号块上 computed width 不一致：`p=746`、`h1=888`、`.mdx-callout=653`、`.mdx-quote=592`。
- ✅ 方案 4：CSS 级测试已补充。证据：`src/tests/light-theme-unit.test.ts:227`-`src/tests/light-theme-unit.test.ts:268`、`src/tests/MdxComponentDesign.test.ts:13`-`src/tests/MdxComponentDesign.test.ts:18`。
- ✅ 方案 5：本轮验收独立运行了浏览器 computed style 烟测。可复现命令：`node - <<'NODE' ... chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }) ...`，输出包含 `proseAligned: true`、`wideFull: true`、`followingUnaffected: true`，同时暴露 AC-2 的宽度偏差。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ 范围内 MDX/Markdown 样式改动可归属到 AC-1、AC-2、AC-3 或 design 方案：`git diff -- src/styles/markdown.css src/styles/mdx.css src/tests/light-theme-unit.test.ts src/tests/MdxComponentDesign.test.ts` 显示改动集中在正文宽度、左对齐、阅读节奏、radius token 与 CSS 断言。
- ✅ 未发现修改 MDX 编译、组件注册、块级渲染架构、新增 MDX 组件 API、日志内容/frontmatter/标签/文件数据的证据；对应非目标见 `stories/20260616-mdx-left-alignment/story.md:36`-`stories/20260616-mdx-left-alignment/story.md:42`。
- ⚠️ 本工作区 `git diff -- src/styles/globals.css` 同时包含 `ideas-workbench` / quick add 相关改动；用户给定范围明确限定为 `globals.css` 中 Journal page frame token 相关变更，因此本报告未裁判这些同文件非 MDX 改动。若这些改动计划随本 story 一起提交，需要另行归属到对应 story 或由用户裁决。

## 冗余（不重，对照 story.md）

- ✅ 未发现同一 AC 存在两套互相独立、行为重复且无必要性的实现。`src/styles/markdown.css:15`-`src/styles/markdown.css:31` 中普通 `.md-content` 与组合 `.md-content.mdx-content` 规则相近，但组合规则可归属到 handoff 中“避免 markdown.css 与 mdx.css 加载顺序让修复失效”的要求（`stories/20260616-mdx-left-alignment/story.md:59`-`stories/20260616-mdx-left-alignment/story.md:61`）。

## 测试与命令证据

- ✅ `npx vitest run src/tests/light-theme-unit.test.ts -t "Journal content frame contract"`：输出 `Test Files 1 passed (1)`，`Tests 5 passed | 38 skipped (43)`。
- ✅ `npx vitest run src/tests/MdxComponentDesign.test.ts -t "specialized MDX component design language"`：输出 `Test Files 1 passed (1)`，`Tests 4 passed (4)`。
- ⚠️ `npx vitest run src/tests/light-theme-unit.test.ts src/tests/MdxComponentDesign.test.ts`：输出 `Test Files 1 failed | 1 passed (2)`，`Tests 2 failed | 45 passed (47)`。失败点为 `src/tests/light-theme-unit.test.ts:97` 的 dark theme `--record-btn-icon` 快照不一致，以及 `src/tests/light-theme-unit.test.ts:353` 的 Ideas workbench `box-shadow` 断言；二者不直接映射到本 story 的 MDX 左对齐 AC，但会影响完整测试文件绿灯。
- ✅ 独立浏览器 computed style 烟测：使用系统 Chrome 与真实 `globals.css + markdown.css + mdx.css` cascade，`.md-content.mdx-content` 中普通正文左边缘一致，复杂块全宽，后续正文未被带偏；同一输出显示 AC-2 宽度偏差。

## 结论

result: fail。阻断 fail 1 项：AC-2 / design 方案 2-3 同源失败。当前实现解决了左边缘对齐和复杂块不污染后续正文，但没有真正保证“稳定行宽”：`--journal-prose-max: 74ch` 会随标题字体、callout 字号、quote 字体变化而产生不同像素宽度。

修复建议：把阅读栏宽度改为字体无关的长度 token（例如 rem/px/clamp 形式），或引入一个在容器上解析的固定 inline-size，再让标题、段落、列表、引用、MDX prose 组件消费同一实际宽度；同时增加一个 computed-style 红/绿测试，明确比较 `.md-content.mdx-content` 下 `h1/p/blockquote/hr/.mdx-callout/.mdx-quote` 的实际宽度与左边缘。

## 待用户裁决

- 是否将同文件但非本 scope 的 `ideas-workbench` / quick add diff，以及完整测试文件中与 MDX 左对齐无直接映射的失败，纳入本 story 的验收阻塞。接受纳入则需要回写对应 story/design 或拆分到相关 story；不纳入则按本报告维持 MDX story 的单项阻断 fail。
