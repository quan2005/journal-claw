---
status: verified
slug: 20260628-topics-curation
owner: opencode (技术执行)
source: 终局 UI 10 优化目标 — G6（用户已选「全做」）
---

# 专题文件树策展（opencode 批次）

## 用户故事

作为一名打开「专题」想沉浸阅读的知识工作者，
我希望看到的是围绕主题组织的、名字可读的笔记集合，而不是裸的文件系统目录，
以便我「打开即平静」地按主题浏览，而不被 `00-index.md`、`assets/`、英文 slug、深层缩进这些基础设施噪声打断。

## 背景与失败模式

[证据] 专题页左树是原始文件系统 dump：暴露 `00-index.md` / `me-export-readme.md` / `assets/` 等基础设施文件；条目名直接用文件名（英文 slug、截断如 `interview-story-framew...`）；中英混杂、深缩进难扫读。与空状态文案「专题是围绕特定主题组织的笔记集合」承诺有落差。

## 成功标准（GWT 验收）

- **AC-1**（隐藏基础设施文件）Given 专题树渲染某文件夹，When 该文件夹含 `00-index.md`、`*-readme.md`/`*-README.md`、`assets/` 等基础设施条目，Then 这些条目默认不在树中展示（仍可被索引/内容引用，仅不占据浏览视图）。
- **AC-2**（用 frontmatter 标题）Given 一个 `.md` 文档含 frontmatter `title`，When 在树中渲染该条目，Then 显示 `title` 而非文件名 slug；无 title 时回退到去扩展名、可读化的文件名。
- **AC-3**（限制默认展开深度）Given 用户进入专题页，When 首次渲染树，Then 默认仅展开顶层（一层），更深层折叠，用户可手动展开。
- **AC-4**（不破坏阅读）Given 用户点击任一可见文档，When 打开，Then 正文正常渲染，路径解析/内部链接跳转不受策展影响。
- **AC-5**（测试）Given 改动完成，When 运行 `npm test`，Then 新增针对「基础设施文件被过滤 / frontmatter title 优先 / 默认展开深度=1」的单测全绿；`npm run build` 通过。

## 边界（Won't）

- 不删除任何磁盘文件，只改「浏览视图的展示与过滤」。
- 不改专题的存储结构、文件夹层级本身。
- 不做搜索/重命名/拖拽重组等新功能。
- 「哪些算基础设施文件」清单按 AC-1 列举的模式，不擅自扩大到用户实际笔记。

## 交棒 design（实现层）

- 基础设施文件过滤规则建议集中为一份可维护的 ignore 模式列表，勿散落各处硬编码。
- frontmatter 解析复用项目现有 markdown/frontmatter 解析能力（勿引入新依赖，CLAUDE.md Rule1）。
- 默认展开深度若与现有树组件的展开状态持久化冲突，以「首次进入深度=1」为准，记入实现说明。
