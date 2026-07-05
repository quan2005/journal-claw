---
id: DESIGN-20260616-mdx-responsive-prose-width
story: ./story.md
created: 2026-06-16
status: verified
---

# MDX 预览宽屏阅读栏自适应设计

## 方案

沿真实渲染链路修复宽屏空白，不重做 MDX 架构：

1. 把 `--journal-prose-max` 从固定窄宽度改为响应式宽度 token，使正文块在宽屏下随容器增长。
2. 保留 `.md-content.mdx-content` 的左对齐规则，避免回退到居中或符号悬挂。
3. 保留代码块、表格、图片和复杂 MDX 组件的全宽规则。
4. 更新样式契约测试，明确宽屏正文上限是响应式 `clamp(...)`，且行首符号规则仍为 `hanging-punctuation: none`。
5. 用真实 CSS cascade 下的浏览器布局检查验证：宽屏正文宽度大于旧 46rem，复杂块仍比正文更宽，窄屏不溢出。

## 影响面

- `src/styles/globals.css`
- `src/styles/markdown.css`
- `src/styles/mdx.css`
- `src/styles/journal-blocks.css`
- `src/tests/*`

## 风险与处理

- 风险：正文过宽影响长文阅读。处理：使用 `clamp` 设置上限，不无限铺满。
- 风险：只改普通正文导致 MDX prose 组件仍窄。处理：继续让 `.md-content`、`.mdx-content` 和 journal block prose 共享同一 token。
- 风险：复杂块被新上限误伤。处理：保留复杂块 `width: 100%` / `max-width: 100%` 或 `--journal-content-max` 分层。
