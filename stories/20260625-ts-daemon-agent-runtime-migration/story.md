---
id: STORY-20260625-ts-daemon-agent-runtime-migration
title: 'TypeScript daemon 与 Coding Agent Runtime 迁移'
status: verified
source: gate
level: L3
hypothesis_basis: intuition
design: ./design.md
created: 2026-06-25
related:
  - AGENTS.md
  - docs/ARCH.md
  - README.cn.md
  - src/lib/tauri.ts
  - src/hooks/useConversation.ts
  - src/types.ts
  - src-tauri/src/conversation.rs
  - src-tauri/src/llm/tool_loop.rs
---

# TypeScript daemon 与 Coding Agent Runtime 迁移

> 一句话概括：**为依赖本地知识资产工作的知识工作者，解决高权限 Agent 工作台难以跨平台、难以适配多 Coding Agent CLI、难以从 Rust 主干演进的问题。**

> 2026-06-25 拆分决议：本 story 只作为总契约和迁移边界，不直接承载业务代码开发。实现必须拆到更小的 approved child stories 后再派发。

## 用户故事（Connextra）

作为 **使用本地优先个人知识 Agent 工作台的知识工作者**，
当我 **把本地笔记、文件、草稿和运行记录交给高权限 Agent 读取、写入、修改、组织和执行**，
我希望 **Agent 能在本地、多平台一致、可审计的运行时里工作，并能切换不同 Coding Agent CLI**，
以便 **我可以长期依赖这个工作台处理个人知识资产，而不被单一平台、单一 CLI 或 Rust 后端主干锁住**。

## 真实用户问题（背景，讲故事）

当前产品方向已从“带 AI 的笔记软件”收束为“Agent 可以操作的个人知识工作台”。用户认可高权限 Agent 可以读取、写入、修改、组织、执行和自动沉淀本地知识资产，但希望产品主干尽可能**本地、多平台、TypeScript 化**，并先适配 Claude Code、Codex CLI、OpenCode 三种 Coding Agent CLI。[推测：基于 handoff/final-state.md 与用户方向输入]

现状由 Tauri v2 + Rust 后端承担 Agent 运行时主干：内置 Anthropic Messages API 客户端、tool loop、文件工具、会话系统与 AI 队列，全部写在 `src-tauri/src/` 里；前端通过 `src/lib/tauri.ts` 单一入口 invoke。[证据：docs/ARCH.md；AGENTS.md §关键约束 #4 #6] 产品当前 README 与 ARCH 仍声明为 macOS 桌面应用。[证据：README.cn.md；docs/ARCH.md]

### 现状失败模式

- **平台绑定**：运行时边界与前端事件流强绑在 Tauri/Rust 上，旧架构还包含 macOS 专属事实（Swift sidecar、Apple Speech、AVFoundation、权限 FFI）。[证据：README.cn.md；docs/ARCH.md §技术债；AGENTS.md §关键约束 #5]
- **单一运行时主干**：内置 LLM 引擎和 tool loop 直接写在 Rust 后端；继续把 Claude Code、Codex CLI、OpenCode 的差异写进业务逻辑会扩大维护成本。[证据：AGENTS.md §关键约束 #4；src-tauri/src/llm/tool_loop.rs]
- **前端迁移缺少保护层**：前端调用虽然集中在 `src/lib/tauri.ts`，但 `useConversation` 仍直接监听 Tauri event `conversation-stream`。[证据：src/lib/tauri.ts；src/hooks/useConversation.ts]
- **权限默认值必须保守且可审计**：初期需要跑通本地 Agent 工作流，但默认不应直接全放开；默认采用 `workspace_write`，同时保留 `wide_with_audit` 作为显式迁移/审计模式，避免 Agent 默认越界写入。[推测：基于 handoff/final-state.md 与 2026-06-26 验收裁决]

## 成功标准（脊柱 Q4）

### 用户行为变化

做完后，使用本地知识 Agent 工作台的用户会：

- **把 Agent 任务交给本地 TS/Node 主干**：从当前 0 条 TS daemon 主路径，变成至少 1 条可验收的 TS daemon 运行路径，而不是继续依赖 Rust 后端主干。
- **在同一产品语义下选择不同 Coding Agent CLI**：从当前没有统一 adapter 语义，变成首批 Claude Code、Codex CLI、OpenCode 具备 detect/version/auth 基础探测和统一 run event 输出。
- **让 Run 自动沉淀为长期资产**：从当前 run lifecycle 没有默认沉淀阶段，变成 run 完成后自动写 summary、artifact index、memory/rule 记录。
- **用授权模式理解 Agent 权限**：从当前权限边界未统一，变成默认 `workspace_write`，并支持 `read_only`、`workspace_write`、`full_access` 三档语义；`wide_with_audit` 作为显式迁移/审计模式保留。

假设依据：以上基于用户明确方向与当前代码结构判断（intuition）。验证方式是 story approved 后进入 design.md 与分阶段实现验收。

## 验收标准（Given-When-Then）

### AC-1 — 迁移边界被用户确认且只本地、多平台

- **Given** 用户希望将产品主干迁往 TypeScript daemon 并适配多 Coding Agent CLI
- **When** story、design 和 ADR 被创建并进入评审
- **Then** 用户能看到本迁移**只支持本地执行**、**多平台行为一致**
- **And** story 不把 Apple Speech、Whisper、ffmpeg、系统 Trash 或任何平台专属 API 列为默认产品路径
- **And** 在 TS daemon 验收覆盖范围内，Rust 后端不作为这些能力的长期并行主干保留

### AC-2 — Coding Agent CLI 适配目标清晰

- **Given** 用户希望后续支持不同 Coding Agent CLI
- **When** 进入 design.md 或开发计划
- **Then** Claude Code、Codex CLI、OpenCode 三种 CLI 的差异被收敛到 adapter 层
- **And** 产品侧只面对统一 AgentRun event、ChangeSet 和 AuthorizationMode 语义，不在 adapter 层承载产品语义
- **And** Gemini、Cursor、ACP 等其它 CLI 暂不进入首批支持范围

### AC-3 — 授权策略符合用户当前取向

- **Given** 高权限 Agent 需要先跑通本地工作流
- **When** 第一阶段实现 TS daemon 和 Agent run
- **Then** 默认策略是 `workspace_write`：仅允许 workspace root 内写入，并记录工具调用和文件变更
- **And** 系统支持 `read_only`、`workspace_write`、`full_access` 三档授权
- **And** `wide_with_audit` 仅作为显式迁移/审计模式，不作为默认值

### AC-4 — Run 面板不被过度重做

- **Given** 用户认为当前 Run 面板中计划、工具调用、diff、输出的视觉优先级已经可用
- **When** 后续实现 Agent Run Workbench 数据接入
- **Then** 实现应复用现有视觉层级和 block 风格
- **And** 工作重点是接入结构化 run 数据、状态和 ChangeSet，而不是重新设计视觉优先级

### AC-5 — Rust 后端退出条件明确

- **Given** TS daemon 覆盖 workspace、文件工具、conversation/run event、Coding Agent CLI、ChangeSet 和 AuthorizationMode
- **When** 这些能力通过测试和真实任务验收
- **Then** Rust 后端不再作为长期并行主干保留
- **And** 删除 Rust 前必须通过独立验收清单，包含 host/runtime、API parity、AgentRun、三家 CLI、ChangeSet、自动沉淀、数据迁移、测试矩阵、真实任务和回滚计划

### AC-6 — Agent Run 自动沉淀

- **Given** 一个 Agent Run 已经结束
- **When** daemon 进入 run lifecycle 的收尾阶段
- **Then** 系统自动写入 run summary Markdown、artifact index、memory/rule 记录
- **And** 每条沉淀记录都带 source run、证据片段、相关 ChangeSet 或 artifact id
- **And** 用户可以事后回看、编辑、拒绝或回滚沉淀结果

## 三类边界（脊柱 Q5 · Won't · 输出闸必填）

- **不为哪些用户做**：不为需要云端团队协作、云同步或远端执行环境的团队用户做；本阶段只服务**本地个人知识工作台**用户。
- **不在哪些场景出现**：不在 Apple Speech、Whisper、ffmpeg、系统 Trash 或任何平台专属 API 上建立默认产品路径；不在 adapter 层承载产品语义；不在第一阶段设计细粒度权限系统。
- **不解决哪些相关但不同的问题**：不重做 Run 面板视觉优先级；不把 Rust 删除和 TS daemon 首次落地混成同一个任务；不在首批支持 Claude Code、Codex CLI、OpenCode 之外的其它 CLI。

## 风险

| #   | 风险                                                          | 影响 | 缓解方向（交 design）                                                                                     |
| --- | ------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------- |
| R1  | 迁移期双主干（Rust + TS daemon）并行，维护与一致性成本高      | 高   | 分阶段迁移，每阶段单能力验收后再并轨；明确退出条件（AC-5）                                                |
| R2  | 平台能力被误带进默认路径（Apple Speech/Whisper/ffmpeg/Trash） | 高   | story/ADR 明确禁项；验收以“多平台一致 + 只本地”为硬条件（AC-1）                                           |
| R3  | Coding Agent CLI 差异渗入产品层，adapter 失效                 | 中   | adapter 边界写进 AC-2；统一 AgentRun event / ChangeSet / AuthorizationMode                                |
| R4  | 默认 `workspace_write` 仍可能误写 workspace 内文件            | 中   | 默认限制在 workspace root 内，并记录工具调用与文件变更；`wide_with_audit` 仅作为显式迁移/审计模式（AC-3） |
| R5  | `src/lib/tauri.ts` 导出 API 形变波及前端                      | 中   | `JournalRuntimeClient` 保持现有导出不变（交棒清单）                                                       |
| R6  | 删除 Rust 缺测试/回滚记录导致不可逆                           | 高   | AC-5 强制要求回滚记录 + 迁移说明 + 测试覆盖                                                               |
| R7  | 大迁移整体偏大，单 story 难以 1-2 sprint 完成                 | 中   | 须按 design phase 拆分为可开发子 story；本 story 先承载产品边界与分阶段总契约                             |

## 交棒清单（移交 design.md 的实现层问题）

- [ ] `JournalRuntimeClient` 如何保持现有 `src/lib/tauri.ts` 导出 API 不变？
- [ ] TS daemon 目录放在 `apps/daemon` 还是 `packages/daemon`？
- [ ] AgentRun event 与现有 `ConversationStreamPayload`（`conversation-stream` 子事件）如何兼容？
- [ ] CodingAgentAdapter 如何映射各 CLI 的权限 flag 到三档授权？
- [ ] ChangeSet 如何计算 diff、hash 和项目内恢复路径？
- [ ] Rust 删除验收清单如何落入 `journal` 的 docs/ADR 或 story design，并进入 release gate？
- [ ] `AGENTS.md`、`docs/ARCH.md`、README 等文档何时同步迁移后的新事实（按 docs-maintenance 约定）？

## 待确认（意图层）

| #   | 问题                                                                                  | 当前默认值                                                                                | 状态   |
| --- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------ |
| Q1  | `workspace_write` 的“文件夹内”是否等同当前 workspace root？                           | 是                                                                                        | 待确认 |
| Q2  | 这个总迁移 story 是否只作为总契约，后续实现必须拆为 Phase 1/2/3 子 story？            | 是                                                                                        | 已决策 |
| Q3  | Rust 删除以“TS daemon 覆盖所有现有用户可见能力”为准，还是以“Agent 相关能力覆盖”为准？ | 以独立 Rust 删除验收清单为准；任何仍暴露给用户的 Rust-backed 能力必须被 TS 替代或明确下线 | 已决策 |
| Q4  | Memory/Rules 沉淀是否默认需要确认？                                                   | 默认自动沉淀；必须可回看、编辑、拒绝和回滚                                                | 已决策 |
| Q5  | 首批支持哪些 Coding Agent CLI？                                                       | Claude Code、Codex CLI、OpenCode；其它暂不支持                                            | 已决策 |

## INVEST 自检（输出闸记录）

- [x] **I** Independent：可先独立完成 story/ADR，再拆实现任务
- [x] **N** Negotiable：TS daemon、adapter、ChangeSet 可分阶段交付
- [x] **V** Valuable：降低平台绑定和单一 CLI 绑定，提高本地 Agent 工作台可演进性
- [x] **E** Estimable：已列出关键边界、风险和交棒问题
- [ ] **S** Small：整体迁移不是 1-2 sprint；必须拆成多个可开发 story / design phase 后才能进入代码实现
- [x] **T** Testable：AC 已用 GWT 描述可观察边界

## 门禁记录

| 轮次 | 日期       | Readiness | 主要缺口                                                                                                                |
| ---- | ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1    | 2026-06-25 | 待澄清    | story 已按 handoff 候选稿落仓；待用户确认 Q1/Q2，并决定是否批准为总契约或先拆 Phase 0                                   |
| 2    | 2026-06-25 | 可开发    | 用户要求“拆小一点，然后分发到 claude -p 中落地”；本 story 批准为总契约，但不直接派发业务代码，后续只按 child story 开发 |
