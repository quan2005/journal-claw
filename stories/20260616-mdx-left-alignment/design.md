---
id: DESIGN-20260616-mdx-left-alignment
story: ./story.md
created: 2026-06-16
status: verified
---

# MDX 预览正文左对齐与阅读排版修复设计

## 方案

沿真实渲染链路修复样式，不改渲染架构：

1. 在 `.md-content.mdx-content` 组合容器上建立明确的阅读栏左对齐规则。
2. 把常规正文块与全宽媒体/组件分开：正文块共享 `--journal-prose-max`，复杂块保持可用宽度。
3. 统一 MDX 预览中的段落、标题、引用和分割线节奏，避免默认 margin 或 `text-wrap` 造成横向漂移。
4. 增加 CSS 级红/绿测试，覆盖真实组合选择器和关键属性。
5. 用浏览器检查真实预览 DOM 与 computed style，确认截图问题所在链路已被修复。

## 影响面

- `src/styles/markdown.css`
- `src/styles/mdx.css`
- `src/tests/*`

## 风险与处理

- 普通 Markdown 与 MDX 共用 `.md-content`：只改共享阅读规则，不引入 MDX 专属重置破坏普通 Markdown。
- 复杂 MDX 组件需要全宽：使用排除/覆盖策略保留复杂块 `max-width: 100%`。
- 视觉修复难以靠单元测试完全证明：测试 CSS 约束，再用浏览器进行真实渲染烟测。
