---
story: ./story.md
design: ./design.md
date: 2026-07-01
round: 1
verifier: opencode subagent (独立验收，与实现者无关)
result: fail
scope: "核对范围（来自主对话）：apps/web/src/styles/markdown.css；apps/web/src/components/MdxRenderer.tsx"
---

# 验收报告 — MDX 预览正文左对齐与阅读排版修复（opencode 独立验收）

## 核心结论（必读）

**result: fail —— 但 fail 的根因不是实现缺陷，而是验收范围本身已失效：本 story 修复的「MDX 预览」整条渲染链已在 2026-06-27 被后续 breaking change 整体删除。**

时间线证据：

| 事件 | 日期 | 证据 |
|---|---|---|
| 本 story 创建 | 2026-06-16 | `stories/20260616-mdx-left-alignment/story.md` frontmatter `created: 2026-06-16` |
| 本 story 第 2 轮验收 PASS | 2026-06-16 | `stories/20260616-mdx-left-alignment/verify-report-r2.md:6` `result: pass` |
| **MDX 整链被删除** | **2026-06-27** | `git show -s --format='%ci' 5020ca9` → `2026-06-27 15:30:36 +0800` |
| 本次验收 | 2026-07-01 | 今日 |

删除提交原文（`git show --stat 5020ca9`）：

> 彻底移除 MDX 支持（用户决策 b）。删 75 文件：MdxRenderer + components/mdx/\* (44) + journal-blocks/\* + lib/mdx/\* + mdxRuntime + mdx.css/mdx-errors.css

该提交删除的、与本 story 直接相关的文件（`git show --stat 5020ca9`）：

| 文件 | 删除行数 | 在本 story 中的角色 |
|---|---|---|
| `apps/web/src/components/MdxRenderer.tsx` | 454 | **验收范围第二项**；story/design 引用的真实链路入口（story.md:19,21） |
| `apps/web/src/styles/mdx.css` | 1829 | story.md:21、design.md「影响面」明确列出的修改对象 |
| `apps/web/src/components/journal-blocks/JournalBlockRenderer.tsx` | 98 | story.md:19 引用的链路节点 |
| `apps/web/src/tests/JournalBlockRenderer.test.tsx` | 591 | design 方案 4 要求的红/绿测试载体 |
| `apps/web/src/tests/MdxComponentDesign.test.ts` | 51 | r2 报告点名引用的测试（verify-report-r2.md:39,56） |
| `apps/web/src/tests/MdxRenderer.test.tsx` | 319 | MDX 渲染测试 |
| `apps/web/src/tests/MdxRendererSuspense.test.tsx` | 84 | MDX 渲染测试 |

## 验收范围有效性核对（铁律：找证据）

主对话指定核对范围 = `apps/web/src/styles/markdown.css` + `apps/web/src/components/MdxRenderer.tsx`。

| 范围项 | 是否存在 | 证据 |
|---|---|---|
| `apps/web/src/styles/markdown.css` | 存在 | `read` 成功，共 239 行 |
| `apps/web/src/components/MdxRenderer.tsx` | **不存在** | `read` 返回 `File not found`；`ls` 返回 `No such file or directory` |

**验收范围 50% 失效。** 后续 AC 核对只能在「幸存的 markdown.css」+「全仓 grep」上进行，无法对 story/design 明确指定的真实链路入口取证。

## AC 核对（对照 story.md §5，逐条找证据）

所有 AC 的主语都是「MDX 预览」。核对前提是该预览链存在。证据如下：

- `rg -n 'mdx-content|MdxRenderer|JournalBlockRenderer' apps/` 仅命中 2 处：
  1. `apps/web/src/styles/markdown.css:46` —— 一条 `.md-content.mdx-content` CSS 规则（**死规则**，见下）
  2. `apps/web/scripts/build-mdx-support-manual.mjs:386` —— 一个生成手册的脚本里对已删文件的字符串引用，非运行时渲染路径
- `rg -n 'className=.*mdx-content|class=.*mdx-content' apps/web/src` —— **零命中**。没有任何组件再输出 `mdx-content` class，即 markdown.css:46 的组合选择器匹配不到任何 DOM 节点。

### AC-1 — 标题/段落/引用/分割线从同一阅读栏左边缘开始

- **结论：fail（无证据）**
- 契约：story.md:46「当用户打开包含标题、段落、引用和分割线的 **MDX 预览** 时…」
- 证据缺口：MDX 预览入口 `MdxRenderer.tsx` 已删除（见上表），没有任何组件渲染 `mdx-content` 容器。markdown.css:46-50 残留的 `.md-content.mdx-content > :where(p, ul, ol, blockquote, h1..h6, hr) { text-align: left }` 是死规则，computed style 无从落地。
- 说明：plain Markdown 路径（`.md-content`）的 `text-align: left`（markdown.css:11）与 `:where(...)` 左对齐（markdown.css:40-44）仍在，但这是普通 Markdown，不是 AC 主语的「MDX 预览」。

### AC-2 — 长篇中文正文稳定行宽与舒适间距，无横向漂移

- **结论：fail（无证据）**
- 契约：story.md:47「当用户阅读长篇中文正文时，应看到段落、列表与标题保持稳定行宽…」
- 证据缺口：r2 报告的核心修复点是把 `--journal-prose-max` 从 `74ch` 改为字体无关的 `46rem`（verify-report-r2.md:14,22）。**该修复已被回退**：`apps/web/src/styles/globals.css:163` 现为 `--journal-prose-max: 100%`（不再是 `46rem`）。同时 MDX 预览容器不存在，AC 主语消失。
- 旁证：`apps/web/src/tests/light-theme-unit.test.ts:226-230` 仍断言 `--journal-prose-max` 为 `100%` 且不以 `ch` 结尾——这与当前 `100%` 一致，但该值是 MDX 下线后的回退态，不再承载「MDX 阅读栏稳定行宽」语义。

### AC-3 — 代码块/表格/图片/复杂 MDX 组件可用宽度且不带偏后续正文

- **结论：fail（无证据）**
- 契约：story.md:48「当用户查看代码块、表格、图片或 **MDX 复杂组件** 时…」
- 证据缺口：r2 报告引以为证的全宽规则载体 `src/styles/mdx.css:55-74`（verify-report-r2.md:23）已随 mdx.css 整体删除。「MDX 复杂组件」本身（JournalBlockRenderer + 44 个 components/mdx/\*）也已删除。
- 说明：markdown.css:58-61 对 `pre/table/img` 的 `max-width: 100%` 仍在，覆盖普通 Markdown，但 AC 主语的「MDX 复杂组件」已无。

### AC-4 — 深色主题保持基调，信号橙只用于强调，不引入新装饰色

- **结论：fail（无证据 / 待用户裁决）**
- 契约：story.md:49「当用户在深色主题预览 **MDX** 时…」
- 证据缺口：MDX 预览不存在，无法对「MDX 预览下的深色主题」取证。r2 报告引证对象 `src/styles/mdx.css:13-14`（MDX accent 派生）已删除。

## 三类边界核对

### 范围完整性（不漏 / 不少）

- story §3 范围（story.md:29-34）四条全部以「`.mdx` 预览里」「`.md-content.mdx-content` 真实组合容器」为前提。前提已不存在 → 整组范围在当前代码中无可核对对象。**不少：无遗漏，因为对象已整体消失。**

### 越界（不多 / 不偏）

- 未发现越界实现。唯一残留是 markdown.css:46-50 的死规则 `.md-content.mdx-content > :where(...)`，它不再匹配任何 DOM，属冗余残留而非越界改动。
- design.md「影响面」列出的 `mdx.css` 已删除；`markdown.css` 仍在但与本 story 相关的只有上述死规则；`src/tests/*` 中本 story 相关的测试（MdxComponentDesign / JournalBlockRenderer / MdxRenderer\*）已全部删除。

### 冗余（不重）

- markdown.css:46-50 的 `.md-content.mdx-content` 规则与 markdown.css:40-44 的 `.md-content` 规则现在功能重叠且前者为死规则，构成轻微冗余残留（非阻断，仅提示清理）。

## 与既有验收报告的关系

- `verify-report.md`（round 1, 2026-06-16）与 `verify-report-r2.md`（round 2, 2026-07-01）的 PASS 结论**在当时（MDX 链尚存）是成立的**——它们引用的 `MdxRenderer.tsx:420-431`、`mdx.css:55-74`、`globals.css:162-165`(46rem)、`MdxComponentDesign.test.ts` 在 2026-06-16 确实存在且通过 computed-style 烟测。
- 本次 fail 不推翻当时的结论，而是反映：**一个已 verified 的 story，其作用对象被后续 breaking change 删除**。这是 story 生命周期与代码演进之间的元问题，不是实现质量回退。

## 待用户裁决

| # | 问题 | 两边代价 | 本报告结论（保守原则） |
|---|---|---|---|
| R1 | **本 story 是否已被 M8-b「下线 MDX」（commit 5020ca9, 2026-06-27） supersede？** | (a) 判定 supersede：本 story 标记为 obsolete/随 MDX 下线归档，不再维护，AC fail 视为「对象不存在」而非缺陷；(b) 判定需重新落地：意味着要恢复 MDX 预览链（与 M8-b 用户决策 b「彻底移除 MDX」直接冲突），需新开 story 重新定义范围 | **保守计 fail**：当前代码无任何证据支持 4 条 AC（铁律：找不到证据 = fail）。但根因是 feature 被有意删除，非实现缺陷，故最终处置交用户裁决，不替用户翻 story status。 |
| R2 | markdown.css:46-50 的死规则 `.md-content.mdx-content > :where(...)` 是否清理？ | 清理：减少冗余、避免误导未来维护者；保留：零功能影响，留作历史痕迹 | 不阻断，仅提示。本验收不修改代码。 |

## 铁律遵守声明

- 每条 AC 结论均附证据（文件:行 / 命令输出 / git 提交），找不到证据者计 fail，未写「应该实现了」。
- 未修改任何代码。
- 未修改任何契约（包括 story.md / design.md 的 status——铁律规定翻状态是主对话在 pass 后的职责）。
- 拿不准的处置（R1）未替用户裁决，写入「待用户裁决」并给出两边代价，结论按保守原则计 fail。
- story.md 与 design.md 之间无冲突；冲突发生在「契约描述的 feature」与「当前代码」之间，已如实记录。

---

## 一行摘要（返回主对话）

**result: fail | fail 项数: 4（AC-1~AC-4 全部，根因=MDX 预览链被 5020ca9 删除而非实现缺陷）| 待裁决项数: 2（R1 story 是否 supersede；R2 死规则是否清理）**
