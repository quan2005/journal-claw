---
id: STORY-20260616-design-prototype-framework
title: '优化 DESIGN.md 并建立 JournalClaw 原型框架'
status: clarifying
source: gate
level: L2
created: 2026-06-16
design: ./design.md
related:
  - docs/DESIGN.md
  - docs/ARCH.md
  - specs/20260615-design-system-unification/spec.md
  - specs/20260615-workbench-layout-unification/spec.md
  - docs/superpowers/mockups/
---

# 优化 DESIGN.md 并建立 JournalClaw 原型框架

## 1. 背景与问题

JournalClaw 是面向知识工作者的 macOS 桌面日志应用，核心体验是高效浏览与沉浸阅读，而非创作。[证据: AGENTS.md]

当前 `docs/DESIGN.md` 已完成 Agentic 设计语言统一，覆盖信号橙、暖白分层、字体三栈、8pt 网格、结构化 token 与组件约束。[证据: docs/DESIGN.md]

`src/styles/globals.css` 已落地大部分设计 token，包括 `--font-display`、`--font-mono`、`--radius-*`、`--shadow-overlay`、`--border-menu`、`--focus-ring`、workbench 共享 token。[证据: src/styles/globals.css]

历史设计系统统一已 verified，说明本次不应重新发明视觉语言，而应在既有 Agentic 体系上补齐“如何用 DESIGN.md 生成和迭代原型”的工作契约。[证据: specs/20260615-design-system-unification/spec.md]

仓库已有 `docs/superpowers/mockups/` 存放 HTML mockup，但缺少一个可复用的原型框架入口、共享样式、示例页面和迭代说明，后续做原型容易各自开局、重复造轮子。[证据: docs/superpowers/mockups/]

需求原文中的“深入了解”“优化”“原型框架”“方便后续迭代”属于范围与成功标准不够明确的表述。[推测] 默认将其收敛为：补强 DESIGN.md 的原型使用规则，并新增一个可直接复制/打开/扩展的 JournalClaw HTML 原型框架。

## 2. 目标与假设

通过补强 `docs/DESIGN.md` 的原型设计契约，并建立一个复用现有设计 token、组件姿态和 mockup 目录约定的 HTML 原型框架，让后续 JournalClaw 原型迭代能从同一套视觉语言、页面骨架和交互状态起步。

假设 A：[推测] 原型框架的首要目标是服务项目内设计探索与验收沟通，不是替代生产 React 组件。

假设 B：[推测] 原型框架默认面向 JournalClaw 当前主产品形态，也就是 macOS/Tauri 桌面应用壳，而不是营销落地页。

假设 C：[推测] “少创造，多参考”意味着优先复用 `docs/DESIGN.md`、`src/styles/globals.css` token、历史 mockup 目录和现有工作台/三栏信息架构，而不是引入新的设计系统或外部 UI kit。

## 3. 范围（In Scope）

- 更新 `docs/DESIGN.md`，补充面向原型迭代的章节：原型目标、信息架构基线、屏幕/状态分类、组件复用规则、交互状态要求、响应式/桌面窗口约束、验收清单。
- 建立一个可运行的 HTML 原型框架，默认放在现有 mockup 体系下，便于浏览器直接打开并继续扩展。[推测: 路径待确认]
- 原型框架应复用 JournalClaw 的 Agentic 设计语言：信号橙、暖白分层、字体三栈、8pt 网格、结构化 token、单橙 accent、默认扁平表面。
- 原型框架应包含 JournalClaw 关键产品骨架：标题栏/导航区、树/列表浏览区、详情阅读区、AI 对话/任务侧栏，以及至少一个可扩展的工作台页面示例。
- 原型框架应包含真实交互状态示例：选中、hover、focus-visible、空状态、处理中状态、面板展开/收起或标签切换中的至少三类。
- 原型框架应提供后续迭代说明，让新增原型页面知道从哪里复制、如何命名、如何保持 DESIGN.md 一致。

## 4. 非目标（Out of Scope）

- 不重写 JournalClaw 的整体视觉方向，不替换 Agentic 橙白设计语言。
- 不改变生产应用的数据模型、Rust 后端、IPC 或现有业务逻辑。
- 不把原型框架接入构建产物或发布流程。
- 不重构生产 React 组件；如发现 DESIGN.md 与实现冲突，只记录或做最小文档约束，具体组件重构另开任务。
- 不为所有现有页面补齐完整高保真原型；本次交付的是可复用框架和少量基准示例。
- 不引入新的外部设计系统、Tailwind、组件库或图标体系。

## 5. 验收标准（Acceptance Criteria）

- **AC-1**：当开发者阅读 `docs/DESIGN.md`，应能看到面向原型迭代的明确规则，包括原型目标、屏幕分类、布局骨架、组件复用、交互状态和验收清单。
- **AC-2**：当开发者检查 `docs/DESIGN.md`，应看不到与当前 verified Agentic 设计系统冲突的新色板、新字体或第二交互 accent。
- **AC-3**：当开发者打开原型框架入口 HTML，应看到一个 JournalClaw 风格的真实产品原型骨架，而不是营销页、说明书页面或设计器控制面板。
- **AC-4**：当开发者查看原型框架源码，应能识别与 DESIGN.md 对应的 token、布局区、组件类和状态类，并能复制这些结构创建新原型页面。
- **AC-5**：当用户在原型框架中操作至少三类交互状态（例如导航切换、面板展开/收起、筛选或选中态），应看到符合 DESIGN.md 的 hover、active、focus-visible、空状态或处理中反馈。
- **AC-6**：当在 1366px、1440px、1920px 宽桌面视口查看原型框架，应无横向滚动，三栏/工作台布局的密度和留白符合 JournalClaw 桌面应用气质。
- **AC-7**：当在较窄视口查看原型框架（默认 900px 左右），应有可读的降级布局，不出现文字重叠或关键操作不可达。
- **AC-8**：当后续新增原型页面时，开发者应能通过 README/说明知道命名规则、复制入口、token 使用禁令和检查步骤。
- **AC-9**：当运行项目约定的文档/前端检查时，本次变更不应引入新的构建、lint 或格式化错误。[推测: 具体命令由 design.md 方案确定]

## 6. 待确认

| #   | 问题                         | 当前默认值                                                                          | 状态   |
| --- | ---------------------------- | ----------------------------------------------------------------------------------- | ------ |
| Q1  | 原型框架默认面向哪种平台？   | **桌面应用优先**：围绕 macOS/Tauri 三栏工作流建立框架，窄屏只做可读降级             | 待确认 |
| Q2  | 原型框架放在哪里？           | **`docs/superpowers/mockups/prototype-framework/`**：复用现有 mockup 资产与评审目录 | 待确认 |
| Q3  | 首版原型框架要覆盖多少页面？ | **1 个入口 + 2 个示例屏**：主工作台骨架、详情/对话阅读骨架                          | 待确认 |
| Q4  | `docs/DESIGN.md` 优化幅度？  | **增量补强**：保留现有视觉规范，只新增/调整“原型迭代契约”相关章节                   | 待确认 |

## 7. 交棒清单（移交 design.md 的实现层问题）

- [ ] 选择原型框架目录结构、入口文件命名与是否需要 README。
- [ ] 确定原型 HTML 是否单文件自包含，还是拆分 `prototype.css` / `prototype.js` 以利复用。
- [ ] 确定从 `src/styles/globals.css` 复制哪些 token，如何避免与生产 token 漂移。
- [ ] 确定原型框架是否需要通过浏览器自动截图/视口检查。
- [ ] 确定文档检查、前端测试、格式化检查的最小验证命令。
- [ ] 确定后续原型迭代与 `docs/superpowers/specs`、`stories`、`specs` 的引用关系。

## 8. 门禁记录

| 轮次 | 日期       | Readiness | 主要缺口                                                                 |
| ---- | ---------- | --------- | ------------------------------------------------------------------------ |
| 1    | 2026-06-16 | 待澄清    | 平台范围、原型目录、示例屏数量、DESIGN.md 优化幅度需用户确认或接受默认值 |
