---
story: STORY-20260616-mdx-left-alignment
verifier: opencode 独立 subAgent（r2 / 轮次 1）
date: 2026-07-01
scope: apps/web/src/components/MdxRenderer.tsx
result: fail
---

# 独立验收报告 · r2 / 轮次 1

## 0. 结论摘要（TL;DR）

- **result: fail**
- **核对范围文件 `apps/web/src/components/MdxRenderer.tsx` 不存在**——已于 2026-06-27 在 commit `5020ca9` "refactor(web)!: 下线 MDX — 删除 MDX 渲染链，改纯 Markdown" 中被整体删除（原 454 行）。
- 与此同时 `mdx.css`、`JournalBlockRenderer.tsx`、`components/journal-blocks/*`、`components/mdx/*` 等 MDX 整条链路（共 75 文件）一并下线。
- story.md 与 design.md 描述的"真实渲染链路 `MdxRenderer → .md-content.mdx-content → JournalBlockRenderer → journal-blocks.css`"已**全部消失**，AC-1～AC-4 描述的"MDX 预览"用户感知对象本身不再存在。
- 4 条 AC 全部按保守原则计为 fail；同时存在 1 处明确的越界偏差与 4 项待用户裁决。

## 1. 输入与核对范围

| 项 | 内容 | 状态 |
|---|---|---|
| story.md | `stories/20260616-mdx-left-alignment/story.md` | 可读，`status: verified` |
| design.md | `stories/20260616-mdx-left-alignment/design.md` | 可读，`status: verified` |
| 核对范围 | `apps/web/src/components/MdxRenderer.tsx` | **不存在（已删除）** |
| 报告输出 | `stories/20260616-mdx-left-alignment/verify-report-opencode-r2.md` | 本文件 |

## 2. AC 逐项核对

> 取证原则：找不到证据 = fail；核对范围文件不存在，按保守原则对相关 AC 计 fail。

### AC-1 · 正文块从同一阅读栏左边缘开始，不被居中或额外缩进 → **fail**

- 期望：MDX 预览中标题/段落/引用/分割线共享左边缘。
- 证据：
  - 核对范围文件 `apps/web/src/components/MdxRenderer.tsx` 不存在（commit `5020ca9` 删除，原 454 行）。
  - 当前唯一渲染入口是 `apps/web/src/components/MarkdownRenderer.tsx:302,393`，默认 className 为 `md-content`，**不会附加 `mdx-content` class**：
    ```
    className={className || 'md-content'}
    ```
  - 仅 `apps/web/src/components/ChatPanel.tsx:24` 使用 `md-content md-content--chat`（chat 变体，非 MDX 预览）。
  - `apps/web/src/styles/markdown.css:46` 的 `.md-content.mdx-content > :where(...)` 选择器因无组件渲染 `mdx-content` class 而**永不命中**（死代码）。
- 结论：MDX 预览本身已下线，AC-1 描述的感知对象不存在；按保守原则 fail。

### AC-2 · 段落/列表/标题稳定行宽、舒适间距，无横向漂移 → **fail**

- 期望：长篇中文正文行宽/间距稳定。
- 证据：
  - `apps/web/src/styles/markdown.css:6` 仍保留 `max-width: var(--journal-readable-max)`，`globals.css:163` 定义 `--journal-prose-max: 100%` / `--journal-readable-max: 100%`（实际上等同全宽）。
  - `apps/web/src/tests/light-theme-unit.test.ts:226-228` 明确断言 `--journal-prose-max` 必须是 `100%`，且 `not.toMatch(/ch$/)` / `not.toContain('clamp(')`——即**禁止任何字符宽或钳制宽度**。这与 design.md "正文块共享 `--journal-prose-max`" 字面相符，但 token 实际取值 100% 等于"无阅读栏约束"。
  - 核对范围文件不存在，design.md 描述的"在 `.md-content.mdx-content` 组合容器上建立明确的阅读栏左对齐规则"无载体承载。
- 结论：纯 Markdown 路径下文本容器 `text-align: left` 存在，但 AC-2 的对象是"长篇中文 MDX 正文"，该对象已不存在；按保守原则 fail。

### AC-3 · 代码块/表格/图片/复杂 MDX 组件可用全宽但不带偏后续正文左边缘 → **fail**

- 期望：复杂块全宽，普通正文不被带偏。
- 证据：
  - `apps/web/src/styles/markdown.css:58-61` 仍保留 `.md-content > :where(pre, table, img)` 的 `max-width: 100%`。
  - 但"复杂 MDX 组件"（JournalBlockRenderer / journal-blocks/* / conversion / enhanced / infographic / judgment / opening 等）已随 commit `5020ca9` 删除，commit message 明确："图表/mermaid/公式/callout 富内容块不再渲染"。
  - `apps/web/src/styles/journal-blocks.css` 文件存在（1525 行），但唯一引用方 `.journal-block-prose { max-width: var(--journal-prose-max) }` 已无渲染入口。
- 结论：AC-3 的核心对象"复杂 MDX 组件"已不存在；按保守原则 fail。

### AC-4 · 深色主题保持 Modern · Bold · Agentic 基调，信号橙仅用于强调，不引入新装饰色 → **fail**

- 期望：深色主题下基调与配色不变。
- 证据：
  - 由于 MDX 预览整体下线，"深色主题下 MDX 预览"这一具体观察对象已无法验证。
  - 现存 `apps/web/src/styles/markdown.css` 的颜色 token（`--md-link` / `--md-quote-bar` / `--md-pre-bg` 等）来自主题层，未见新增装饰色。
  - 但核对范围文件不存在，无法对照实现是否引入过新装饰色或破坏深色主题。
- 结论：按保守原则 fail（找不到证据）。

## 3. 越界 / 偏差清单

| # | 类型 | 描述 | 证据 |
|---|---|---|---|
| D-1 | 范围错配（任务 vs 设计） | 任务指定核对范围为 `apps/web/src/components/MdxRenderer.tsx`，但 design.md 第 21-23 行的影响面是 `markdown.css / mdx.css / src/tests/*`，**未列出 MdxRenderer.tsx**。任务与 design 不一致。 | design.md:21-23；任务提示词"核对范围"段 |
| D-2 | 设计契约文件不存在 | design.md 影响面列出的 `src/styles/mdx.css` 在仓库中不存在（glob 无结果）。已被 `5020ca9` 删除。 | commit `5020ca9` stat 列含 `mdx.css` |
| D-3 | 死代码 | `markdown.css:46` 的 `.md-content.mdx-content` 选择器无任何组件会渲染 `mdx-content` class 触发，属死代码。 | `rg "mdx-content" -g "*.tsx"` 无结果 |
| D-4 | story 与代码现状冲突 | story.md `status: verified`、design.md `status: verified`，但其描述的整条 MDX 渲染链已被后续 commit `5020ca9`（2026-06-27，晚于 story 创建 2026-06-16）整体下线。契约与实现层不再对应。 | git log + 文件存在性核查 |

## 4. 待用户裁决项

| # | 问题 | 上下文 | 建议 |
|---|---|---|---|
| Q1 | 验收是否应"历史性"进行？ | story.md 创建于 2026-06-16，`5020ca9` 删除 MdxRenderer 在 2026-06-27，story 当时已被标 `verified`。当前再核对只能看现存代码，无法回溯到删除前状态。 | 若仅核对 2026-06-16～2026-06-27 间的实现状态，需 git checkout 历史版本另行验收；本报告基于当前 working tree。 |
| Q2 | story/design 是否应归档或废止？ | MDX 整条链路已下线，本 story 的 AC 在现版本中无可对应实现。继续以 `verified` 状态保留会让契约与代码长期失配。 | 建议把 story/design 翻为 `superseded` 或追加废弃说明，引用 `5020ca9`。 |
| Q3 | markdown.css:46 的死规则是否清理？ | `.md-content.mdx-content` 选择器永不命中，与 AGENTS.md 约束 7 "修复前先确认真实 DOM、CSS 加载顺序、specificity" 精神不符。 | 单独开清理任务（不在本 story 范围内）。 |
| Q4 | 任务提示词的核对范围是否需修正？ | 提示词仅给 `MdxRenderer.tsx`，而 design.md 影响面是 `markdown.css / mdx.css / tests/*`。 | 由分发者裁决是否扩大核对范围后重跑。 |

## 5. 取证命令与产物索引

- 文件存在性：`glob **/MdxRenderer.tsx` → No files found；`glob **/mdx.css` → No files found。
- 内容搜索：`rg "mdx-content" apps/web/src -g "*.tsx"` → No matches（无组件渲染该 class）。
- `rg "journal-prose-max|mdx-content" apps/web/src` → 6 处，关键命中 `globals.css:163`、`journal-blocks.css:9`、`markdown.css:46`、`light-theme-unit.test.ts:226-228`。
- `git show --stat 5020ca9` → 删除 `apps/web/src/components/MdxRenderer.tsx`（454 行）及 MDX 链路共 75 文件。
- 时间线：`git log --pretty='%h %ai %s'` 显示 `5020ca9`（2026-06-27 15:30）下线 MDX，早于 `d26f89e`（同日 19:30）M8-a 清理；当前 HEAD 为后续多个提交。

## 6. 铁律自检

- 未修改任何代码或契约。
- 未替用户裁决（D-1～D-4 与 Q1～Q4 均如实列出，未自行折中）。
- 所有 fail 均以"文件不存在 / 对象已下线 / 死代码不命中 / 找不到证据"为据，未写"应该实现了"。

---

result: fail | fail 项数: 4 | 待裁决项数: 4
