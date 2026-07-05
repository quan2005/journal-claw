---
id: DESIGN-20260616-leading-punctuation-alignment
story: ./story.md
created: 2026-06-16
status: verified
---

# MDX 预览行首符号左对齐修复设计

## 方案

沿真实渲染链路修复符号悬挂，不改渲染架构：

1. 在 `.md-content` / `.mdx-content` 阅读容器上禁用行首悬挂标点。
2. 保留上一轮正文阅读栏宽度和复杂块全宽分层。
3. 增加 CSS 级测试，防止重新启用行首悬挂标点。
4. 用浏览器 computed style 验证 `【...】` 行与普通段落实际 left 一致。

## 影响面

- `src/styles/markdown.css`
- `src/styles/mdx.css`
- `src/tests/*`

## 风险与处理

- 风险：禁用悬挂标点会少一点出版排版感。处理：日志预览以稳定扫读和左边界一致为优先。
- 风险：只改 MDX 会漏掉普通 Markdown。处理：共享 `.md-content` 明确禁用，`.mdx-content` 也显式继承同一规则。
