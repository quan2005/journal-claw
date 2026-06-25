---
id: STORY-20260625-agent-runtime-contract-docs
title: "Agent Runtime 迁移契约文档落仓"
status: verified
source: gate
level: L2
hypothesis_basis: intuition
design: ./design.md
created: 2026-06-25
parent: ../20260625-ts-daemon-agent-runtime-migration/story.md
related:
  - AGENTS.md
  - docs/ARCH.md
  - README.cn.md
  - stories/20260625-ts-daemon-agent-runtime-migration/story.md
---

# Agent Runtime 迁移契约文档落仓

> 一句话概括：**为需要派发多个 coding agent 推进迁移的维护者，解决迁移边界散落在 handoff 中、无法作为仓库内开发契约复用的问题。**

## 用户故事（Connextra）

作为 **需要并发派发 coding agent 推进 Journal runtime 迁移的维护者**，
当我 **准备让 Claude Code、Codex CLI、OpenCode 相关任务进入仓库实现**，
我希望 **迁移边界、阶段顺序、Rust 删除 gate 和冲突规则先沉淀到仓库内的 story/design/ADR 文档**，
以便 **后续 agent 能按同一份契约落地，不把完整迁移揉成一个超大任务，也不越界改业务代码**。

## 真实用户问题（背景，讲故事）

handoff 已经给出 TypeScript daemon + Coding Agent Runtime 的最终状态、ADR 草稿、design 草稿、Rust 删除验收清单和 coding-agent 任务清单。[证据：handoff/README.md；handoff/final-state.md；handoff/tasks/design-draft.md；handoff/docs/rust-removal-acceptance.md]

但这些内容仍在 Open Design handoff 外部目录里，`journal` 仓库只新增了 umbrella story。若直接派发任务 B/C/D，coding agent 会拿不到稳定的仓库内契约，且容易碰到当前工作树里的热点文件和未提交改动。[证据：stories/20260625-ts-daemon-agent-runtime-migration/story.md；git status 显示 `src/lib/tauri.ts`、`src/types.ts` 等热点已有改动]

### 现状失败模式

- **契约不在仓库内**：后续 agent 需要跨目录读取 handoff，容易漏掉只本地、多平台一致、首批三家 CLI、自动沉淀、Rust 删除 gate 等硬边界。
- **任务过大**：umbrella story 的 INVEST Small 未过，不能直接作为实现任务。
- **派发风险高**：如果没有 design/ADR/冲突规则，Claude 可能直接修改业务代码或热点文件，扩大合并成本。

## 成功标准（脊柱 Q4）

### 用户行为变化

做完后，维护者会：

- **按仓库内契约派发任务**：从依赖外部 handoff 变成可引用 `stories/.../design.md` 与 `docs/adr/...`。
- **按小任务推进迁移**：从一个超大 umbrella story 变成 Phase 0 文档契约、Phase 1 runtime client、Phase 2 daemon skeleton 等可独立验收任务。
- **降低误改风险**：从口头提醒冲突热点，变成 design/ADR 明确禁止越界和长期双主干。

假设依据：以上基于用户要求“拆小一点，然后分发到 claude -p 中落地”和当前 handoff 状态判断（intuition）。验证方式是检查目标文档是否落仓，并确认没有业务代码改动。

## 验收标准（Given-When-Then）

### AC-1 — design 契约落仓
- **Given** 维护者准备拆分 TypeScript daemon + Coding Agent Runtime 迁移
- **When** 本 story 完成
- **Then** `stories/20260625-agent-runtime-contract-docs/design.md` 存在
- **And** 文档明确阶段拆分、冲突热点、派发顺序、验收顺序和不做项
- **And** 文档引用 umbrella story 和 handoff 的事实来源

### AC-2 — ADR 落仓
- **Given** 后续任务需要统一迁移架构判断
- **When** 本 story 完成
- **Then** `docs/adr/ts-daemon-agent-runtime-migration.md` 存在
- **And** ADR 明确 JournalRuntimeClient、AgentRun、CodingAgentAdapter、ChangeSet、AuthorizationMode、自动沉淀管线
- **And** ADR 明确只本地、多平台一致、首批只支持 Claude Code / Codex CLI / OpenCode

### AC-3 — Rust 删除 gate 落仓
- **Given** Rust 后端不能在 TS daemon 未覆盖时被提前删除
- **When** 本 story 完成
- **Then** `docs/adr/rust-removal-acceptance.md` 存在
- **And** 清单覆盖 host/runtime、API parity、AgentRun、三家 CLI、ChangeSet、自动沉淀、数据迁移、测试矩阵、真实任务和回滚计划
- **And** 文档明确如果桌面宿主仍依赖 Tauri/Rust，则 Rust 删除 gate 不通过

### AC-4 — 不修改业务代码
- **Given** 本 story 只负责契约落仓
- **When** Claude 或人工执行任务
- **Then** 不修改 `src/`、`src-tauri/`、`package.json`、workspace 配置或测试文件
- **And** 允许改动范围仅限本 story 目录、umbrella story、已拆出的 child story、`docs/adr/` 目标文档和 handoff 账本

### AC-5 — umbrella 被收缩为总契约并拆出首批 child story
- **Given** umbrella story 的范围过大，INVEST Small 未过
- **When** 本 story 完成
- **Then** `stories/20260625-ts-daemon-agent-runtime-migration/story.md` 明确只作为总契约，不直接承载业务代码
- **And** 至少拆出 `stories/20260625-agent-runtime-contract-docs/story.md` 和 `stories/20260625-runtime-client-protection/story.md` 两个小 story
- **And** Phase 1 代码任务必须以 child story 为准，不直接用 umbrella story 派发

## 三类边界（脊柱 Q5 · Won't · 输出闸必填）

- **不为哪些用户做**：不为最终产品用户直接做功能体验；本 story 服务维护者和 coding agent 协作。
- **不在哪些场景出现**：不进入业务代码实现、不新增 daemon、不改前端 runtime、不改 Rust 后端。
- **不解决哪些相关但不同的问题**：不验证三家 CLI 是否可运行；不实现 ChangeSet、授权、自动沉淀；不删除 Rust。

## 交棒清单（移交 design.md 的实现层问题）

- [ ] ADR 如何保持和 `docs/ARCH.md` 当前事实不冲突？
- [ ] Rust 删除清单放在 `docs/adr/` 还是后续 release gate 文档？
- [ ] 后续 Phase 1/2 子 story 的依赖顺序如何写入 design？
- [x] Claude 派发时如何限制允许改动路径？

## 待确认（意图层）

| # | 问题 | 当前默认值 | 状态 |
|---|---|---|---|
| Q1 | 本 story 是否只做契约文档，不改业务代码？ | 是 | 已决策 |
| Q2 | 是否可以用 Claude `-p` 执行文档落仓？ | 是 | 已决策 |

## INVEST 自检（输出闸记录）

- [x] **I** Independent：可独立完成，不依赖代码实现
- [x] **N** Negotiable：ADR/design/rust gate 可分文件调整
- [x] **V** Valuable：给后续 agent 派发提供稳定契约
- [x] **E** Estimable：只涉及文档落仓和引用整理
- [x] **S** Small：可在一个小任务内完成
- [x] **T** Testable：可用文件存在、内容检查和 git diff 范围验证

## 门禁记录

| 轮次 | 日期 | Readiness | 主要缺口 |
|---|---|---|---|
| 1 | 2026-06-25 | 可开发 | 用户要求拆小并分发落地；本 story 限定为文档契约落仓，允许派发 Claude |
| 2 | 2026-06-25 | 可开发 | 第一轮验收指出拆分 story 未列入 Phase 0 允许范围；已将 umbrella/child story 文件纳入契约范围 |
