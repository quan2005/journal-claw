---
status: verified
phase: MDX-retire
created: 2026-06-27
---

# 下线 MDX（彻底移除，决策 b）

## 背景

用户决策：不再支持 MDX，彻底清理。接受图表/mermaid/公式/callout 块消失、阅读体验退化。执行排在 M6 之后。

## 范围

1. **daemon**：删 apps/daemon/src/mdx/（service.ts + service.test.ts，M3 迁的 compile_mdx）；删 server.ts 的 /mdx 路由；删前端 tauri.ts 的 compile_mdx 封装 + runtime flag 映射。
2. **前端渲染**：删 apps/web/src/components/MdxRenderer.tsx + components/mdx/\*（chart-frame/grid/mermaid/math/media/callout/cards/typography/semantic/display/layout/BlockRenderer/BlockErrorBoundary/ErrorCard/DegradationBadge/context/runtimeContext/source 等 20+ 文件）+ components/journal-blocks/（JournalBlockRenderer/enhanced）。
3. **渲染替代**：日志详情（DetailView 等）改用 MarkdownRenderer（纯 Markdown）；清理 import/调用点，确保无悬空。
4. **样式**：删 styles/mdx.css + mdx-errors.css；保留 markdown.css（纯 Markdown 样式）。
5. **依赖**：删 package.json 中 MDX 相关依赖（@mdx-js/\* 等，若仅 MDX 用）；保留 Markdown 渲染依赖（如 markdown-it / react-markdown，看现状）。
6. **Gate G**：现有 MDX 笔记降级为纯 Markdown 渲染——纯文本/frontmatter 正常显示，MDX 特有 `<Component>` 块作为未知 HTML 忽略或退化文本。不做迁移脚本。
7. **文档**：更新 AGENTS.md（若有 MDX 相关约束）、ARCH.md（渲染链描述）、DESIGN.md（若有 MDX token），移除 MDX 相关说明。

## 约束

- 不删 Rust mdx.rs（留 M8）。
- 不破坏 journal 的基本阅读（纯 Markdown 内容正常显示）。
- 测试：既有非 MDX 测试不新增失败；删 MDX 相关测试文件；新增 MarkdownRenderer 渲染日志详情的最小测试。

## 验收（Given-When-Then）

- Given 日志详情，When 打开一篇纯 Markdown 笔记，Then 正常渲染。
- Given 一篇含 MDX 块的旧笔记，Then 降级渲染（不崩、frontmatter+正文可读、MDX 块退化）。
- Given rg "mdx|Mdx|compile_mdx|journal-blocks"，Then apps/web/src 与 apps/daemon/src 仅余历史注释或为零。
- web tsc clean；web vitest 不新增失败（基线对比）；daemon vitest 不回退。

## 验收结论（Leader 独立验收，2026-06-27）：PASS（核心目标达成）+ 一项遗留决策

### 已达成

- 前端 MDX 渲染链彻底移除：删 75 文件（MdxRenderer + components/mdx/_ 44 + journal-blocks/_ + lib/mdx/\* + mdxRuntime + mdx.css/mdx-errors.css + 19 MDX 测试）
- 调用点改纯 Markdown：markdown.tsx 去 .mdx 分支 → ReactMarkdown/MarkdownRenderer；DetailView 等 10 处
- AGENTS.md 约束7 同步（渲染链改 renderMarkdown/MarkdownRenderer）
- web tsc clean；vitest 失败均为基线子集（9 failed，无新增）；测试数 548→340 因删 MDX 测试（预期）

### 遗留决策（directiveMigration，待用户定）

compile_mdx 残留被 directiveMigration 依赖（apps/web/src/lib/directiveMigration.ts + SectionGeneral 设置入口 + daemon directive_migration/）。
directiveMigration 把旧 directive 格式 → MDX。既然彻底去 MDX，此工具的"→MDX"目标失效。
选项：① directiveMigration 改输出纯 Markdown（去 compile_mdx 依赖，保留迁移能力）；② 整体下线 directiveMigration。
用户已在自行写 .md 迁移脚本，倾向 ②。待确认。
