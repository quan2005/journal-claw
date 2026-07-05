---
id: STORY-20260627-final-state-cleanup
title: 'Final-state 终局锚点与发布文档收尾'
status: verified
source: gate
level: L2
hypothesis_basis: data
design: ./design.md
created: 2026-06-27
related:
  - ../../docs/final-state.md
  - ../../docs/ARCH.md
  - ../../docs/adr/rust-removal-acceptance.md
  - ../../docs/adr/rust-removal-release-note.md
  - ../20260627-m8b-delete-rust/story.md
---

# Final-state 终局锚点与发布文档收尾

> 一句话概括：**为维护 JournalClaw 终局重构的项目执行者解决“代码已到 M8-b 终局，但协作锚点、用户文档与验证环境仍在讲旧世界”的问题**

## 用户故事（Connextra）

作为 **正在维护 JournalClaw M8-b 终局重构结果的项目执行者**，
当我 **根据最终验收结果准备继续派发修复、复跑测试或交付发布说明**，
我希望 **仓库里的终局锚点、用户可见文档、UI 文案与依赖验证状态都能共同指向 2026-06-27 的真实终局**，
以便 **后续 agent 和人类维护者不会按过期的 Rust/Tauri/语音/MDX 叙述继续做错事，并能用稳定命令重新验收主链路**。

## 真实用户问题（背景，讲故事）

本轮深入验收发现，实现主链路静态证据基本成立：Rust/Tauri 运行路径已删除，Electron host + TypeScript daemon + pi 内建引擎成为主路径，五个一等对象在 contract、daemon route/service 与 AgentRunPanel 上基本落地。[证据：`docs/adr/rust-removal-acceptance.md` Gate A-J；`docs/ARCH.md`；`apps/web/src/lib/runtimeClient.ts`；`apps/daemon/src/server.ts`；`apps/web/src/components/AgentRunPanel.tsx`]

但协作锚点与用户可见叙述没有同步：`docs/final-state.md` 仍停在 2026-06-25，把 Phase 10/Rust 退出标为未完成，仍把 Rust tool loop 当迁移底盘，完全漏掉 pi 内建引擎；README、用户指南、About/Permissions 文案仍在宣传已经下线的录音、WhisperKit、SpeechAnalyzer、speaker profiles；当前工作树还存在 `apps/desktop/package.json` 与 `pnpm-lock.yaml` 依赖分类不一致，导致本轮验收无法独立复跑 `pnpm --frozen-lockfile` 矩阵。[证据：本轮验收报告；`README.md`；`README.cn.md`; `docs/guide/index.md`; `docs/guide/recording.md`; `docs/guide/settings.md`; `apps/web/src/locales/en.ts`; `apps/web/src/locales/zh.ts`; `apps/desktop/package.json`; `pnpm-lock.yaml`]

### 现状失败模式

- 用户现在怎么解决？项目执行者只能在 `docs/ARCH.md`、M8-b story/verify-report、ADR、`docs/final-state.md`、README/guide 和源码之间手工比对，靠记忆判断哪些是历史、哪些是终局。[证据：`docs/final-state.md` 与 `docs/ARCH.md` 对终局状态描述冲突]
- 为什么不够好？后续 agent 会把 `docs/final-state.md` 当协作锚点，却读到 Phase 3-10 未完成、Tauri shell 待定、Rust tool loop 仍可复用等旧信息；用户阅读 README/guide 会误以为语音转写和 speaker profiles 仍是可用功能；验证者复跑测试时会被 lockfile/manifest drift 或 pnpm build approval 阻断。[证据：本轮 opencode 三路审计输出]
- 哪些数据/反馈支撑？本轮审计列出至少 5 类冲突：final-state 过期、语音/WhisperKit 文档残留、story 留痕颗粒度疑点、测试复跑阻断、lockfile/manifest drift；其中前两类是用户/agent 可见误导，后一类直接阻断独立验收。[证据：本轮最终诊断]

## 成功标准（脊柱 Q4）

### 用户行为变化

做完后，项目执行者会：

- 以 `docs/final-state.md` 判断终局状态时，过期 Phase/D1-D7/Rust/Tauri 叙述冲突从“多处需要人工辨别”降为“0 个有效冲突”。
- 以 README、用户指南、About/Permissions 文案判断用户可见能力时，已下线的录音/语音转写/WhisperKit/SpeechAnalyzer/speaker profile 宣传从“多处命中”降为“0 个有效宣传入口”，仅允许 release note/历史迁移说明保留。
- 以常用验证命令复核主链路时，依赖清单与 lockfile 不再因 Electron 依赖分类漂移阻断 frozen install 或测试启动；若仍有既有测试失败，失败集合必须被明确记录为基线且不新增。

假设依据：以上基于本轮深入验收的静态证据与命令输出，属于 data。

## 验收标准（Given-When-Then）

### AC-1 — 终局锚点可信

- **Given** 项目执行者打开 `docs/final-state.md`
- **When** 阅读产品北极星、技术最终态、迁移进度、待定决策和落地记录
- **Then** 文档明确反映 2026-06-27 M8-b 终局：Electron host、TypeScript daemon、pi 内建引擎、Rust/Tauri 删除、音频/语音/MDX 下线、五个一等对象当前完成度
- **And** 不再把已完成的 Rust 退出、Electron 切换、AuthorizationMode、AgentRun/Sources/Artifacts/Memory/Workspace 一等化标为待定或未开始

### AC-2 — 用户可见能力叙述不误导

- **Given** 用户或维护者阅读 README 与 `docs/guide/*`
- **When** 搜索录音、语音转写、WhisperKit、SpeechAnalyzer、speaker profiles、Tauri v2、Rust IPC 等已过期终局叙述
- **Then** 用户可见文档不再宣传已下线能力或旧架构为当前能力
- **And** 语音/转写相关 guide 页面直接删除，不保留下线说明页；现有导航和相关链接不得指向被删除页面

### AC-3 — 应用内文案不宣传已下线语音能力

- **Given** 用户打开设置页的权限和关于区域
- **When** 查看权限说明、About credit 和相关本地化文案
- **Then** 不再出现 WhisperKit/SpeechAnalyzer/Apple speech recognition 等当前不可用能力的可用性暗示
- **And** daemon 返回的 `apple_stt=false`、`whisperkit=false`、`speaker_diarization=false` 与前端展示含义一致

### AC-4 — 依赖与验证入口可复跑

- **Given** 项目执行者在当前工作树完成本故事相关修改后
- **When** 运行 package manager 的 frozen/install 检查、contracts/daemon/desktop/web 的 typecheck 与核心测试命令
- **Then** 不再因 `apps/desktop/package.json` 与 `pnpm-lock.yaml` 不一致、半残 node_modules 或 pnpm build approval 配置缺失而阻断
- **And** 若 web vitest 仍保留既有 9 个失败基线，报告必须列明失败文件集合并证明没有新增失败

### AC-5 — 后续 agent 按开发/测试对抗执行

- **Given** 本 story 被确认并进入开发
- **When** 编排者拆分并派发多个 agent
- **Then** 每个产出型 agent 都有对应的对抗验收 agent，形成类似开发工程师与测试工程师的成对检查
- **And** 每组 agent 的成功标准、反证搜索、fail 反馈与修复轮次都有记录
- **And** 最终验收 agent 只接受文件内容、diff 与命令输出作为证据，不依赖实现者自述

## 三类边界（脊柱 Q5 · Won't · 输出闸必填）

- **不为哪些用户做**：不为仍希望继续使用本地录音、WhisperKit、Apple SpeechAnalyzer、speaker profiles 或 MDX 组件渲染的用户恢复这些能力；这些能力已在 M0/MDX-retire/M8-b 中下线。
- **不在哪些场景出现**：不在本故事中新增或重构 AgentRun、ChangeSet、Memory、Workspace meta、Electron host、daemon engine 的业务能力；只修正终局叙述、用户可见文案、删除已下线 guide 与验证可复跑性。
- **不解决哪些相关但不同的问题**：不处理 `useAgentRun` 缺专门测试、Run 冷启动回放/列表化、Memory reject/edit 前端 UI、Workspace meta 前端编辑、悬空旧 story 的产品取舍；这些是后续独立故事或设计债，不混入本收尾任务。

## 交棒清单（移交 design.md 的实现层问题）

- [ ] 文档分工：`docs/final-state.md` 是重写为当前终局锚点，还是归档为历史快照并新增新的终局文档？
- [ ] 搜索口径：哪些语音/MDX/Rust/Tauri 命中允许作为历史迁移资料保留，哪些必须从当前用户文档和 UI 文案中删除？语音/转写 guide 页面必须直接删除并清理链接。
- [ ] 依赖策略：Electron 应保留在 desktop dependencies 还是 devDependencies，lockfile 如何同步，是否需要 pnpm build approval 配置入库？
- [ ] 验证矩阵：本故事最终必须复跑哪些最小命令，如何记录 web 既有 9 个失败基线？
- [ ] 相邻文档：是否同步 README.cn、docs/guide、llms.txt、AGENTS.md、ARCH.md、release note 的指向关系？
- [ ] 脏工作树：如何避免覆盖本轮开始前已有的未提交改动，尤其 `apps/web/e2e/`、`IdeasWorkbench`、`HistoryFloatingButton`、`desktop daemon` 等文件？

## 待确认（意图层）

| #   | 问题                                                                                 | 当前默认值                                  | 状态                                                        |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------- |
| Q1  | `docs/final-state.md` 是继续作为“当前终局锚点”重写，还是标为历史快照并另建终局锚点？ | 继续作为当前终局锚点重写                    | 待用户确认                                                  |
| Q2  | 是否把当前用户文档里的语音录音/转写相关页面改为“已下线说明”，而不是删除整页？        | 直接删除语音/转写相关 guide，并清理所有链接 | 已由用户确认                                                |
| Q3  | 是否把依赖/测试复跑阻断也纳入本次 agent 处理范围？                                   | 纳入，作为 AC-4                             | 已由用户要求“定义对应任务的验收 Agent / 成功标准”确认       |
| Q4  | agent 编排是否采用开发/测试成对对抗，而不是执行者自验？                              | 采用 Generator/Discriminator 对抗编排       | 已由用户要求“形成 gan 对抗，类似开发工程师和测试工程师”确认 |

## INVEST 自检（输出闸记录）

- [x] **I** Independent：本故事可独立交付，不依赖新增业务能力
- [x] **N** Negotiable：只锁定用户可观察结果，具体文档组织和依赖策略交给 design.md
- [x] **V** Valuable：消除终局重构后的误导性锚点和发布前验收阻断
- [x] **E** Estimable：问题清单、涉及文档、文案和验证阻断均已有本轮诊断证据
- [x] **S** Small：限定在文档/文案/依赖验证收尾，排除后续产品债
- [x] **T** Testable：每条 AC 均可用文件检索、页面文案断言或命令输出验证

## 门禁记录

| 轮次 | 日期       | Readiness | 主要缺口                                                                                             |
| ---- | ---------- | --------- | ---------------------------------------------------------------------------------------------------- |
| 1    | 2026-06-27 | 可开发    | 用户已确认 Q1 默认值；Q2/Q3/Q4 已按用户指令确认；可按 design.md 的 GAN 式开发/测试对抗编排派发 agent |
