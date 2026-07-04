---
story: ./story.md
design: ./design.md
date: 2026-06-16
round: 1
result: pass
scope: 'src/styles/markdown.css; src/styles/mdx.css; src/tests/light-theme-unit.test.ts; src/tests/MdxComponentDesign.test.ts; src/tests/journalBlockStyles.test.ts; renderer class wiring for md-content/mdx-content'
---

# 验收报告 — MDX 预览行首符号左对齐修复

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC                            | 结论 | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 — 行首符号不突出阅读栏   | PASS | `src/styles/markdown.css:4`-`13` 在 `.md-content` 上保留阅读容器宽度并显式 `hanging-punctuation: none`；`src/styles/mdx.css:4`-`22` 在 `.mdx-content` 上同样显式 `hanging-punctuation: none`。`rg -n "hanging-punctuation" src` 只找到两处运行时声明，均为 `none`，测试中还断言不包含 `first`。`src/components/MarkdownRenderer.tsx:406`、`src/components/MarkdownRenderer.tsx:499` 使用 `.md-content`，`src/components/MdxRenderer.tsx:421`、`src/components/MdxRenderer.tsx:431` 使用 `.md-content.mdx-content`，覆盖 Markdown 与 MDX 真实容器。headless Chrome 内联真实 CSS 检查结果：Markdown 普通段落与 `【...】` 段落 `mdLeftDelta: 0`，MDX 普通段落与 `【...】` 段落 `mdxLeftDelta: 0`。                      |
| AC-2 — 既有阅读栏分层保持不变 | PASS | `src/styles/markdown.css:16`-`32` 保留普通正文块 `width: min(100%, var(--journal-prose-max))`、`max-width: var(--journal-prose-max)`、`margin-left: 0`；`src/styles/markdown.css:43`-`46` 让 `pre/table/img` 保持 `max-width: 100%`。`src/styles/mdx.css:29`-`44` 将 prose 类 MDX 块约束到 `--journal-prose-max`，`src/styles/mdx.css:45`-`74` 将 chart/html preview/table/device/grid 等复杂块保持 `width: 100%`、`max-width: 100%`。测试 `src/tests/light-theme-unit.test.ts:250`-`263` 覆盖 Markdown/MDX/read-mode 容器与 wide 规则，`src/tests/MdxComponentDesign.test.ts:14`-`18` 覆盖 MDX prose/content/wide 三档，`src/tests/journalBlockStyles.test.ts:29`-`33` 覆盖 journal block prose/content/wide 三档。 |

## 范围完整性（不少，对照 story.md 范围）

- PASS: story 要求覆盖以 `【`、`[`、引号、括号等符号开头的正文行；实现选择禁用容器级 `hanging-punctuation`，覆盖所有行首悬挂标点类别，不需要逐字符列举。
- PASS: story 要求 `.md-content` 与 `.mdx-content` 都明确禁用悬挂标点或等效实现；两个容器都有显式声明。
- PASS: story 要求普通正文与复杂块宽度分层不被破坏；源码和测试均保留 prose/content/wide 三档。

## 方案落实（不偏，对照 design.md）

- PASS: design 方案 1 落实：`.md-content` / `.mdx-content` 阅读容器均禁用行首悬挂标点。
- PASS: design 方案 2 落实：普通正文块继续走 `--journal-prose-max`，复杂 MDX 块与表格/媒体继续使用可用宽度。
- PASS: design 方案 3 落实：新增/更新 CSS 级测试守住 `hanging-punctuation: none`、`.md-content.mdx-content` prose 宽度和 MDX wide 规则。
- PASS: design 方案 4 已执行浏览器检查。环境内 Playwright bundled Chromium 未安装，本机 Chrome 在提升权限后可 headless 运行；实际几何结果显示 Markdown 与 MDX 中普通段落和 `【...】` 段落左边缘 delta 均为 `0`。Chrome 对 `hanging-punctuation` 的 computed property 返回空字符串，因此该属性值以源码声明和测试断言为直接证据，几何结果作为真实渲染补充证据。

## 越界检查（不多，对照 story 非目标 + design 范围）

- PASS: 未发现本次核查范围内有编辑器输入行为、源码模式、日志内容、列表缩进、引用块重设计或 MDX 渲染架构改动。
- PASS: 当前工作树存在大量其他未提交改动；本报告仅核查用户指定文件与真实容器链路，未修改、清理或 revert 任何无关改动。
- NOTE: 目标文件 diff 中也包含更宽的阅读排版/节奏调整；这些与已 verified 的相关 story `stories/20260616-mdx-left-alignment/story.md` 范围一致，本轮未将其计为行首符号 story 的阻塞越界。

## 冗余（不重，对照 story.md）

- PASS: `.md-content` 与 `.mdx-content` 两处声明不是重复实现，而是 design 明确要求的 Markdown/MDX 双容器覆盖；未发现同一行为的多套并行逻辑。

## 实际检查的文件与命令

- 读取契约：`stories/20260616-leading-punctuation-alignment/story.md`、`stories/20260616-leading-punctuation-alignment/design.md`、`.agents/skills/verification-gate/assets/verify-report-template.md`、`.agents/skills/verification-gate/references/six-criteria.md`。
- 检查实现/测试：`src/styles/markdown.css`、`src/styles/mdx.css`、`src/tests/light-theme-unit.test.ts`、`src/tests/MdxComponentDesign.test.ts`、`src/tests/journalBlockStyles.test.ts`，并核对 `src/components/MarkdownRenderer.tsx`、`src/components/MdxRenderer.tsx` 的真实 class wiring。
- `npx vitest run src/tests/light-theme-unit.test.ts -t "Journal content frame contract"`：1 个测试文件通过；5 passed，38 skipped。
- `npx vitest run src/tests/MdxComponentDesign.test.ts src/tests/journalBlockStyles.test.ts`：2 个测试文件通过；18 passed。
- `rg -n "hanging-punctuation" src`：运行时 CSS 仅 `.md-content` 与 `.mdx-content` 两处声明，均为 `none`；测试断言覆盖 `none` 且不包含 `first`。
- Headless Chrome computed/geometry check：用真实 `markdown.css` + `mdx.css` 内联渲染 `.md-content` 与 `.md-content.mdx-content`，输出 `mdLeftDelta: 0`、`mdxLeftDelta: 0`、wide block `maxWidth: "100%"`。

## 结论

PASS。AC-1 与 AC-2 均有源码、测试和浏览器几何证据支撑；未发现阻塞项。

剩余风险：本次未启动完整 Tauri 窗口做截图比对；浏览器检查使用真实 CSS 与真实容器 class，但不是完整应用数据流。Chrome 当前对 `hanging-punctuation` computed value 返回空字符串，因此该属性值仍主要依赖源码/测试断言，实际左边缘一致由几何检查补充确认。

## 待用户裁决

无。
