---
id: SPEC-20260615-perf-batch1-2
title: '性能优化第 1+2 批：拖拽卡顿根治 + 首屏启动 + 数据层 I/O'
status: verified
source: gate
level: L2
created: 2026-06-15
related:
  - AGENTS.md（约束 1 视觉一致性、约束 6 IPC 单一入口、约束 7 真实渲染链验证、约束 8 HTML mockup）
  - docs/ARCH.md（系统分层、IPC 约定）
---

# 性能优化第 1+2 批：拖拽卡顿根治 + 首屏启动 + 数据层 I/O

## 1. 背景与问题

知识工作者用户每天高频浏览日志、拖拽分隔条调整布局、与 AI 对话。当前三类高频路径存在复合性能问题，用户**最痛的是拖拽卡顿**。

**证据（已逐行核实）**：

- **拖拽卡顿根因链**（复合，非单一）：
  1. `src/App.tsx:233,261` 每个 `mousemove` 调用 `setSidebarWidth`/`setRightPanelWidth`
  2. `src/contexts/UIContext.tsx:194-195,199-200` 这两个 setter 内部除了 `setState` 还同步 `saveDim` → `localStorage.setItem`（**主线程同步阻塞 I/O**）
  3. `src/App.tsx:262` 右面板还**重复** `localStorage.setItem` 一次
  4. `sidebarWidth`/`rightPanelWidth` 是 UIContext value 字段（`UIContext.tsx:243,247`），value 未 memo → 每次拖拽触发**整个 UIContext 所有消费者重渲染**
  5. 消费者中 `App.tsx:955,1120` 渲染两栏；DetailView 的 memo 被 `App.tsx:1041` 的 `entries.find` 破坏，2554 行巨型组件全量重渲染

- **首屏启动慢**：`vite.config.ts:18` `chunkSizeWarningLimit:2000` 掩盖告警；`dist/assets/main-CqgxAvr0.js` = 1.79MB；Tabler 字体 ttf(2.8MB)+woff(1.4MB)+woff2(900KB)+css(240KB) 全格式打包（仅服务 sandbox 预览）。

- **对话流式卡**：`src/hooks/useConversation.ts:137,151` 每个 `text_delta` 事件调用 `updateTabMessages` → `setTabs`；`src-tauri/src/conversation.rs:1888,1901` 每 token emit。

- **列表刷新慢**：`src/hooks/useJournal.ts:107-114,137-144` 逐月串行 `await listJournalEntriesByMonths([m])`（后端 `journal.rs:420` 支持多月）；`src-tauri/src/journal.rs:272` 为解析 frontmatter 全量 `read_to_string`；`config.rs:702-715` 每次 IPC 全量读盘（40+ 调用点）。

## 2. 目标与假设

通过**第 1 批（渲染链路优化）+ 第 2 批（构建与数据层优化）**，使：

- **拖拽**：分隔条拖拽丝滑无掉帧，拖拽时无同步 localStorage I/O
- **重渲染**：拖拽/切条目/流式对话时，重渲染节点数显著下降
- **首屏**：main bundle < 600KB，dist 字体体积 < 1MB
- **数据层**：config/journal 读盘次数显著下降，列表刷新单次 IPC 完成多月加载

**假设（可证伪）**：

- 拖拽卡顿的主因是同步 I/O + Context 雪崩重渲染 + memo 失效，而非浏览器 layout/paint（可通过 rAF + memo 后 Profiler 验证）
- Tabler 字体仅用于 sandbox 预览，删除 ttf/woff 不影响主 UI 图标（主 UI 用 `lucide-react`）
- config.json 在运行时不被外部进程高频修改，notify 监听失效足够

## 3. 范围（In Scope）

### 第 1 批（M1，渲染链路）

- M1-1 拖拽防抖与 localStorage 解耦
- M1-2 UIContext / TodoContext value memo 化
- M1-3 修复 DetailView memo 失效 + 稳定 App 下发 props
- M1-4 列表项与消息组件加 React.memo
- M1-5 流式 token rAF 批处理
- M1-6 resize 事件节流

### 第 2 批（M2，构建与数据层）

- M2-1 拆分 main bundle（manualChunks + lazy）
- M2-2 Tabler Icons 字体瘦身
- M2-3 Rust config / journal 内容内存缓存
- M2-4 消灭 N+1 串行 IPC + 增量刷新
- M2-5 refresh 风暴治理 + 重复订阅清理
- M2-6 生产环境日志守卫

## 4. 非目标（Out of Scope）

- ❌ 不引入虚拟列表（react-window/react-virtual）——数据量当前未到瓶颈，留作第 3 批
- ❌ 不引入状态管理库（Zustand/Redux）——先用 memo + Context 拆分解决
- ❌ 不替换数据存储方案（不引入 SQLite）——仅加内存缓存层
- ❌ 不重构组件文件结构（不拆分 ChatPanel.tsx/DetailView.tsx 巨型文件）
- ❌ 不改变 IPC 命令的契约（command 签名、事件名保持兼容）
- ❌ 不优化 LLM 引擎内部（重试策略、client 复用等留作后续）
- ❌ 不做 E2E 性能基准自动化（本次用人工 + Profiler 验证）

## 5. 验收标准（Acceptance Criteria）

### 里程碑 M1（第 1 批：拖拽与渲染）

- **AC-1**（拖拽不写盘）：当用户拖拽左/右分隔条过程中，在任意 `mousemove` 回调内，**不**执行 `localStorage.setItem`；仅 `mouseup` 时执行一次持久化。验证：拖拽期间 Performance 录制无同步 localStorage 写入；拖拽后重开应用宽度一致。
- **AC-2**（拖拽无重复写入）：当右面板分隔条拖拽结束时，`journal_right_panel_width` 在 localStorage 中**仅被写入一次**（当前为两次）。
- **AC-3**（拖拽 rAF 节流）：当连续触发 `mousemove`，宽度 state 更新频率受 rAF 约束（每帧最多一次），不每个事件都 setState。
- **AC-4**（UIContext value memo）：当任一 UIContext 内 state 变化（如 view 切换），用 `React.memo` 包裹且 props 未变的消费者**不**重渲染。验证：React DevTools Profiler "Highlight updates when components render" 开启时，拖拽宽度时非 LayoutContext 消费者不高亮。
- **AC-5**（LayoutContext 拆分）：`sidebarWidth`/`rightPanelWidth` 拆到独立 `LayoutContext`，拖拽时仅 LayoutContext 消费者更新；`useUI()` 的其他消费者（如读 view/selectedEntry 的组件）不受宽度变化影响。
- **AC-6**（DetailView memo 生效）：当拖拽面板宽度时，`DetailView`（React.memo）**不**重渲染。验证：Profiler 录制拖拽过程，DetailView 不在 commit 节点列表中。需先修复 `App.tsx:1041` 的 `entries.find`（改 useMemo）与内联回调（改 useCallback）。
- **AC-7**（列表项 memo）：当切换选中条目时，`JournalItem`/`TreeItem`/`MonthDivider` 中 props 未变的项**不**重渲染（React.memo 包裹 + props 稳定）。
- **AC-8**（消息组件 memo）：`MessageBubble`/`AssistantRun`/`ToolBlock`/`ArtifactBlock`/`WebSearchBlock`/`ThinkingBlock` 用 `React.memo` 包裹，props 未变时不重渲染。
- **AC-9**（流式批处理）：当收到连续 `text_delta` 事件，React state 更新频率受 rAF 约束（每帧最多一次 flush），不再每个 token 一次 setState。验证：流式回复时 React commit 频率 ≤ 60次/秒。
- **AC-10**（流式消息不丢失）：AC-9 的批处理**不**导致流式文本内容丢失或乱序；最终消息文本与逐 token 累积结果一致。
- **AC-11**（resize 节流）：当连续触发 `window.resize`，`setViewportWidth` 受 rAF 节流，每帧最多一次。
- **AC-12**（useJournal 派生值 memo）：`queueItems`、`isProcessing` 用 `useMemo` 包裹，引用稳定，不每次 render 产生新数组。
- **AC-13**（M1 回归）：M1 完成后，`npm test`、`npm run build`、`npm run lint`、`npm run format:check` 全绿。

### 里程碑 M2（第 2 批：构建与数据层）

- **AC-14**（manualChunks 拆分）：`vite.config.ts` 配置 `build.rollupOptions.output.manualChunks`，将 `react-markdown`+`remark`+`rehype`、`marked`+`dompurify`、`highlight.js`、`katex`、`recharts` 各自拆为独立 chunk。
- **AC-15**（main bundle 瘦身）：`npm run build` 后，主入口 chunk（index.html 同步加载的 JS）**< 600KB**（当前 ~1.79MB）。验证：`ls -lh dist/assets/` + bundle visualizer。
- **AC-16**（大组件 lazy）：`DetailView`、`OnboardingView`、`MergeIdentityDialog`、`MarkdownRenderer` 用 `React.lazy` + `Suspense` 加载，首屏不加载这些 chunk。
- **AC-17**（highlight.js 按需加载）：`highlight.js` 语言注册（当前 `MarkdownRenderer.tsx:26-40` 顶层注册 11 种）改为动态 `import()`，仅代码块渲染时加载对应语言。
- **AC-18**（katex.css 动态加载）：`katex.min.css` 改为在 `math.tsx` 内动态 `import()`，仅含公式的文档加载该 CSS。
- **AC-19**（chunkSizeWarningLimit 还原）：`chunkSizeWarningLimit` 从 2000 还原为默认值或合理值（如 700），让超大 chunk 告警重新生效。
- **AC-20**（bundle visualizer）：安装 `rollup-plugin-visualizer`，`npm run build` 产出 `dist/stats.html`，便于持续监控体积。
- **AC-21**（Tabler 字体瘦身）：dist 中 Tabler 字体**仅保留 woff2**（删除 ttf/woff），字体总体积 **< 1MB**（当前 ~5MB）。验证：sandbox 预览图标正常显示。
- **AC-22**（Rust config 缓存命中）：当连续调用 `config::load_config`，第二次起命中内存缓存，**不**触发 `fs::read_to_string`。验证：单元测试 mock fs 或计数。
- **AC-23**（Rust config 缓存失效）：当 `config.json` 文件 mtime 变化（notify 或下次 load 时比对），缓存失效并重新读盘。
- **AC-24**（journal 列表 mtime 缓存）：当连续调用 `list_entries`，mtime 未变的文件**不**重新 `read_to_string`，仅用缓存的 frontmatter。
- **AC-25**（N+1 消灭）：`useJournal.ts` 的 `refresh()` 与初始加载改为**单次** `listJournalEntriesByMonths(allNeededMonths)`，不再逐月 for 循环串行 await。
- **AC-26**（增量刷新）：`refresh()` 仅重读触发更新的月份（基于事件 payload 或 mtime），不重读所有已加载月份。
- **AC-27**（重复订阅清理）：`work-queue-updated` 事件**仅订阅一次**（当前 useEventSync + 直接 listen 重复）。
- **AC-28**（refresh 防抖）：`refresh()` 加 trailing 防抖（默认 200ms），批量事件连续触发时只在最后一次后执行一次。
- **AC-29**（Rust 日志守卫）：`src-tauri/src/` 中热路径的 `eprintln!`（`conversation.rs`、`ai_processor.rs`、`transcription.rs`、`work_queue.rs`）加 `cfg(debug_assertions)` 守卫或改用 `tracing` 按 level 过滤，release 构建不输出。
- **AC-30**（前端日志守卫）：生产构建（`vite build`）剥离 `console.log`/`console.debug`，保留 `console.error`/`console.warn`。
- **AC-31**（M2 回归）：M2 完成后，`npm test`、`npm run build`、`npm run lint`、`cd src-tauri && cargo test`、`cd src-tauri && cargo clippy` 全绿。

### 全局约束（两个里程碑均适用）

- **AC-32**（视觉一致性）：`JournalList`↔`IdentityList`、`DetailPanel`↔`IdentityDetail` 的 memo 化与渲染优化**同步**进行（AGENTS.md 约束 1）。
- **AC-33**（IPC 单一入口）：所有新增/修改的 Rust 调用经 `src/lib/tauri.ts`，组件中不直接 `invoke()`（约束 6）。
- **AC-34**（真实渲染链验证）：拖拽、流式、列表渲染的视觉验证在 Tauri 真实窗口中进行，不靠孤立 Vite 页面（约束 7）。

## 6. 非功能需求（NFR）

| 维度          | 要求                                                                                              | 备注               |
| ------------- | ------------------------------------------------------------------------------------------------- | ------------------ |
| 性能          | 拖拽 Long Task < 50ms；流式 commit ≤ 60fps；main bundle < 600KB；dist 字体 < 1MB；config 缓存命中 | AC-1,9,15,21,22    |
| 安全 / 权限   | 不引入新的文件系统/网络访问；config 缓存仅进程内存，不落盘额外文件                                | Rust 缓存为内存态  |
| 数据 / 隐私   | 不改变持久化数据格式；localStorage key 名不变；缓存失效后行为与无缓存完全一致                     | 向后兼容           |
| 可靠性 / 降级 | rAF 批处理失败时回退到逐 token（保证不丢消息，AC-10）；config 缓存失效时回退到读盘                | 降级路径必须存在   |
| 可观测性      | 保留 `console.error`/`console.warn`；release 剥离 debug 日志；Rust 用 tracing 可动态调 level      | AC-29,30           |
| 回滚策略      | 每项独立 commit，可单独 revert；M1/M2 分里程碑，M1 不依赖 M2                                      | 分批降低风险       |
| 兼容性        | IPC command 签名不变；事件名不变；localStorage key 不变；构建产物可在当前 Tauri 版本运行          | 无 breaking change |

## 7. 依赖与影响面

**依赖**：

- `vite` 7（manualChunks、optimizeDeps）——`[证据]` `package.json:3`
- `rollup-plugin-visualizer` —— **新增依赖**，需 `npm i -D`
- Tauri webview 支持 `woff2`（macOS WKWebView 全支持）——`[推测]` 目标平台仅 macOS
- Rust `notify` crate（已用于 topics watcher，`[证据]` `src-tauri/Cargo.toml`）可用于 config 失效监听；或用 mtime 比对更简单

**受影响模块**：

- `src/App.tsx`（拖拽、resize、props 下发）——M1 核心
- `src/contexts/UIContext.tsx`、`TodoContext.tsx`——M1-2
- `src/components/DetailView.tsx`、`ChatPanel.tsx`、`TreeSidebar.tsx`、`JournalItem.tsx`——M1-3,4
- `src/hooks/useConversation.ts`、`useJournal.ts`——M1-5, M2-4,5
- `vite.config.ts`、`src/lib/markdown.tsx`、`src/components/MarkdownRenderer.tsx`、`src/components/mdx/math.tsx`、`src/lib/sandbox/buildSrcdoc.ts`——M2-1,2
- `src-tauri/src/config.rs`、`workspace_settings.rs`、`journal.rs`——M2-3
- `src-tauri/src/conversation.rs`、`ai_processor.rs`、`transcription.rs`——M2-6

**与历史结论的冲突**：无。检索 `specs/` 8 个历史 spec 均为功能需求，未涉及性能。`[证据]` `specs/2026061*-*/spec.md`。

## 8. 风险与待人类决策的问题

- **[证据]** AC-9 流式批处理需保证不丢消息、不乱序——`useConversation.ts:151-220` 的 artifact parser 在流中检测 `<artifact>` 标签，rAF 批处理的缓冲边界需把 parser.feed 也纳入帧内处理，否则可能漏检标签。**风险**：批处理时机错误导致 artifact 检测错位。**缓解**：parser.feed 在累积 ref 时实时执行，仅 setState 走 rAF。
- **[证据]** AC-22/24 Rust config/journal 缓存涉及多线程——Tauri command 可能在多线程并发调用。**风险**：缓存读写竞态。**缓解**：用 `Mutex`/`RwLock` 保护；缓存写只在 save 时，读多写少用 `RwLock`。
- **[推测]** AC-16 React.lazy DetailView 可能导致首次打开详情页有短暂 loading 闪烁。**风险**：体验回退。**缓解**：Suspense fallback 用骨架屏或空态，首屏预加载该 chunk（modulepreload）。
- **[证据]** AC-21 删除 ttf/woff——需确认无其他引用。`[证据]` `buildSrcdoc.ts:3` 仅 import css，字体由 css 内 @font-face 引用，删格式不影响 css 加载，仅影响不支持 woff2 的环境（目标平台无此问题）。
- **[推测]** AC-26 增量刷新依赖事件 payload 携带月份信息，当前 `journal-updated` 事件 payload 可能不含月份。**风险**：需改 Rust emit 携带 `year_month`。**缓解**：若改 emit 成本高，回退为"全量重读但命中 mtime 缓存"，仍比当前快。
- **[证据]** Freeze 组件（`src/components/Freeze.tsx`）用 Suspense + MutationObserver 锁定隐藏面板——M1 的 memo 优化可能与 Freeze 的"冻结"行为交互。**风险**：被冻结面板的 props 变化不触发渲染，memo 后更难察觉。**缓解**：验证时确认 Freeze 使用点的行为不变。

## 9. 待确认

| #   | 问题                                                         | 当前默认值                                                                          | 状态   |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------ |
| Q1  | refresh 防抖延迟取多少？                                     | 200ms（trailing）                                                                   | 已确认 |
| Q2  | Rust 日志守卫用 `cfg(debug_assertions)` 还是引入 `tracing`？ | 先用 `cfg(debug_assertions)` 守卫热路径的裸 `eprintln!`，不引入 tracing（避免大改） | 已确认 |
| Q3  | bundle visualizer 是否加入 CI 体积门禁（超阈值 fail）？      | 仅本地产出 stats.html，不加 CI 门禁（避免过度工程）                                 | 已确认 |
| Q4  | Tabler 字体瘦身：只留 woff2，还是做 subset 精简图标？        | 只留 woff2（最简，删 ttf/woff）                                                     | 已确认 |
| Q5  | 增量刷新若需改 Rust emit payload 是否接受？                  | 接受（`journal-updated` 携带 `year_month`）；若复杂则回退"全量重读 + mtime 缓存"    | 已确认 |

## 10. 门禁记录

| 轮次 | 日期       | Readiness   | 主要缺口                                                                                        |
| ---- | ---------- | ----------- | ----------------------------------------------------------------------------------------------- |
| 1    | 2026-06-15 | 待澄清      | Q1-Q5 待用户确认默认值                                                                          |
| 2    | 2026-06-15 | 可开发      | 用户确认全部默认值，status → approved                                                           |
| 3    | 2026-06-15 | implemented | M1（项1-6）+ M2（项7-12）全部实现，tsc/build/lint/clippy 通过，cargo test 440/441（1 预存失败） |
| 4    | 2026-06-15 | verified    | 第 2 轮验收通过（34/34 AC pass），第 1 轮 4 项 fail（AC-7/16/17/18）全部修复                    |
