---
id: STORY-20260616-mdx-left-alignment
title: "MDX 预览正文左对齐与阅读排版修复"
status: verified
source: gate
level: L2
created: 2026-06-16
design: ./design.md
related:
  - stories/20260616-mdx-component-hygiene/story.md
---

# MDX 预览正文左对齐与阅读排版修复

## 1. 背景与问题

知识工作者在预览 `.mdx` 日志时，需要快速扫读长篇正文。当前截图显示正文区域内标题、引用块、段落和分割线的左边缘不够一致，阅读时会感到内容在横向上漂移。[证据：用户 2026-06-16 截图反馈「目前渲染没有左对齐」]

项目约束要求视觉修复验证真实渲染链路：`MdxRenderer` → `.md-content.mdx-content` → `JournalBlockRenderer` → `journal-blocks.css`，并留意 `max-width`、`line-height`、`margin`、`text-wrap` 等会让界面看似改了但实际没变的属性。[证据：AGENTS.md]

仓库现状中，`.md-content` 和 `.mdx-content` 都对内容宽度与排版有规则；`.md-content > :where(...)` 对常规正文块设置最大行宽，`.mdx-content` 又为 MDX 组件设置全宽规则。[证据：src/styles/markdown.css；src/styles/mdx.css；src/components/MdxRenderer.tsx]

## 2. 目标与假设

目标：用户打开 MDX 预览时，常规正文内容在同一阅读栏左边缘开始，长篇稿件读起来稳定、平静，重点橙色不影响整体对齐。

假设：让正文块共享明确的左边缘与宽度规则，并让复杂 MDX 块只在需要时全宽，可以解决截图中的横向漂移感。[推测]

## 3. 范围（In Scope）

- `.mdx` 预览里的常规正文排版：标题、段落、列表、引用、分割线、代码块、表格、图片。
- `.md-content.mdx-content` 真实组合容器下的样式冲突与优先级。
- 与左对齐直接相关的阅读节奏：行宽、段落间距、标题间距、引用块视觉边界。
- 针对左对齐问题补充红/绿测试。

## 4. 非目标（Out of Scope）

- 不改变 MDX 编译、组件注册、块级渲染架构。
- 不修改日志内容、frontmatter、标签或文件数据。
- 不重新设计全应用主题、颜色体系或字体体系。
- 不新增 MDX 组件 API。
- 不处理与本截图无关的移动端导航、列表栏或编辑器交互。

## 5. 验收标准（Acceptance Criteria）

- **AC-1**: 当用户打开包含标题、段落、引用和分割线的 MDX 预览时，应看到这些正文块从同一阅读栏左边缘开始，且不会被居中或额外缩进。
- **AC-2**: 当用户阅读长篇中文正文时，应看到段落、列表与标题保持稳定行宽和舒适间距，不出现忽宽忽窄造成的横向漂移。
- **AC-3**: 当用户查看代码块、表格、图片或 MDX 复杂组件时，应看到它们可以使用可用宽度，但不会把后续普通正文的左边缘带偏。
- **AC-4**: 当用户在深色主题预览 MDX 时，应保持现有 Modern · Bold · Agentic 基调，信号橙仍只用于强调与交互，不引入新的装饰色。

## 6. 待确认

| # | 问题 | 当前默认值 | 状态 |
|---|---|---|---|
| Q1 | 是否需要同时调整非 MDX 的普通 Markdown 预览？ | 本次只修复共享 `.md-content` 中会影响 MDX 真实链路的规则；不单独重设普通 Markdown 视觉风格。 | 已采用默认值 |

## 7. 交棒清单（移交 design.md 的实现层问题）

- [ ] 哪些选择器属于普通正文，哪些属于全宽媒体/组件？
- [ ] 如何避免 `markdown.css` 与 `mdx.css` 的加载顺序让修复失效？
- [ ] 如何用测试覆盖 `.md-content.mdx-content` 的真实组合，而不是只测孤立选择器？
- [ ] 是否需要浏览器验证真实 DOM computed style？

## 8. 门禁记录

| 轮次 | 日期 | Readiness | 主要缺口 |
|---|---|---|---|
| 1 | 2026-06-16 | 可开发 | 用户已提供截图和目标；范围限定为 MDX 预览正文左对齐与阅读排版。 |
