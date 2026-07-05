---
id: DESIGN-20260616-mdx-full-width-prose
story: ./story.md
created: 2026-06-16
status: verified
---

# MDX 全屏预览正文宽度跟随窗口设计

## 方案

沿真实渲染链路继续修正宽度契约：

1. 将 `--journal-prose-max` 改为跟随 `--journal-readable-max`，让普通正文块使用完整可用内容宽度。
2. 保留 `.md-content` / `.mdx-content` 的左对齐和 `hanging-punctuation: none`。
3. 保留代码块、表格、图片和复杂 MDX 组件的全宽规则。
4. 更新样式契约测试，明确正文宽度不再使用固定 `rem` / `ch` / `clamp` 上限。
5. 用真实 CSS cascade 下的浏览器几何检查验证：宽屏正文宽度等于内容区宽度，行首符号不偏移，窄屏不溢出。

## 影响面

- `src/styles/globals.css`
- `src/styles/markdown.css`
- `src/styles/mdx.css`
- `src/styles/journal-blocks.css`
- `src/tests/*`

## 风险与处理

- 风险：全屏长行更长。处理：这是用户明确指出的全屏空间利用诉求，本次以减少提前换行为优先。
- 风险：只改 Markdown 漏掉 MDX prose 组件。处理：继续使用共享 `--journal-prose-max` token，让 `.md-content`、`.mdx-content` 和 journal block prose 一起生效。
- 风险：复杂块或符号对齐回退。处理：保留现有复杂块全宽规则和 `hanging-punctuation: none` 测试。
