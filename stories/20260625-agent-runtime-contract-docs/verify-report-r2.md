---
story: ./story.md
design: ./design.md
date: 2026-06-25
round: 2
result: pass
scope: '核对范围：用户给定的 6 个文件清单'
---

# 验收报告 — Agent Runtime 迁移契约文档落仓

## 判定依据

- 六字标准要求每条结论必须附证据，找不到证据就是 fail（`.agents/skills/verification-gate/references/six-criteria.md:3`）。
- `result: pass` 需要六项全部通过；任一项 fail 则 `result: fail`，灰色地带列入「待用户裁决」并按保守原则计 fail（`.agents/skills/verification-gate/references/six-criteria.md:18`、`.agents/skills/verification-gate/references/six-criteria.md:19`、`.agents/skills/verification-gate/references/six-criteria.md:20`）。
- story 是意图契约，design 是方案契约；不多优先对 design 范围，其次对 story 非目标（`.agents/skills/verification-gate/references/six-criteria.md:5`、`.agents/skills/verification-gate/references/six-criteria.md:26`）。

## 契约提取

### AC

- AC-1：`stories/20260625-agent-runtime-contract-docs/design.md` 存在；明确阶段拆分、冲突热点、派发顺序、验收顺序和不做项；引用 umbrella story 和 handoff 事实来源（`story.md:55`、`story.md:58`、`story.md:59`、`story.md:60`）。
- AC-2：`docs/adr/ts-daemon-agent-runtime-migration.md` 存在；明确 JournalRuntimeClient、AgentRun、CodingAgentAdapter、ChangeSet、AuthorizationMode、自动沉淀管线；明确只本地、多平台一致、首批只支持 Claude Code / Codex CLI / OpenCode（`story.md:62`、`story.md:65`、`story.md:66`、`story.md:67`）。
- AC-3：`docs/adr/rust-removal-acceptance.md` 存在；清单覆盖 host/runtime、API parity、AgentRun、三家 CLI、ChangeSet、自动沉淀、数据迁移、测试矩阵、真实任务和回滚计划；明确桌面宿主仍依赖 Tauri/Rust 时 gate 不通过（`story.md:69`、`story.md:72`、`story.md:73`、`story.md:74`）。
- AC-4：本 story 只负责契约落仓，不修改 `src/`、`src-tauri/`、`package.json`、workspace 配置或测试文件；允许改动范围仅限本 story 目录、umbrella story、已拆出的 child story、`docs/adr/` 目标文档和 handoff 账本（`story.md:76`、`story.md:79`、`story.md:80`）。
- AC-5：umbrella story 明确只作为总契约，不直接承载业务代码；至少拆出本 story 和 runtime-client-protection 两个小 story；Phase 1 代码任务必须以 child story 为准（`story.md:82`、`story.md:85`、`story.md:86`、`story.md:87`）。

### 三类边界

- 不为最终产品用户直接做功能体验；本 story 服务维护者和 coding agent 协作（`story.md:91`）。
- 不进入业务代码实现、不新增 daemon、不改前端 runtime、不改 Rust 后端（`story.md:92`）。
- 不验证三家 CLI 是否可运行；不实现 ChangeSet、授权、自动沉淀；不删除 Rust（`story.md:93`）。

### 方案范围、NFR / 依赖

- 方案目标是把 handoff 外部目录中的迁移共识收进仓库，形成后续 coding agent 可引用的契约；只处理文档契约，不修改业务代码（`design.md:7`、`design.md:9`）。
- 输入依赖为 umbrella story、handoff design 草稿、ADR 草稿、Rust 删除清单草稿、冲突管理和 coding-agent 任务清单（`design.md:13`、`design.md:14`、`design.md:15`、`design.md:16`、`design.md:17`、`design.md:18`）。
- 输出范围包括本 story design、umbrella story、runtime-client-protection child story、两个 ADR 文档；handoff 账本允许同步但不要求（`design.md:20`、`design.md:24`、`design.md:25`、`design.md:26`、`design.md:27`、`design.md:28`、`design.md:30`）。
- Phase 0 允许修改本 story 目录、umbrella story、runtime-client-protection child story、两个 ADR 目标文件和 handoff 账本；不允许修改 `src/**`、`src-tauri/**`、`package.json`、workspace 配置和测试文件（`design.md:34`、`design.md:38`、`design.md:40`、`design.md:41`、`design.md:42`、`design.md:43`、`design.md:44`、`design.md:45`、`design.md:47`、`design.md:49`、`design.md:50`、`design.md:51`、`design.md:52`、`design.md:53`）。
- 后续阶段的关键 NFR / 依赖包括：Phase 1 默认仍走 Tauri、不新增 daemon、不改 Rust、不重写 ChatPanel；Phase 2 使用跨平台 Node API，不依赖平台专属二进制；Phase 3 首批只支持 Claude Code / Codex CLI / OpenCode；Phase 5 自动沉淀是 run lifecycle 默认尾声（`design.md:59`、`design.md:70`、`design.md:72`、`design.md:90`、`design.md:91`、`design.md:96`、`design.md:102`、`design.md:121`、`design.md:122`）。

## 上一轮复核

- 上一轮唯一 fail 是 `stories/20260625-ts-daemon-agent-runtime-migration/story.md` 与 `stories/20260625-runtime-client-protection/story.md` 不在 Phase 0 允许修改范围内，导致 AC-4、范围控制和「不多」失败（`verify-report.md:95`、`verify-report.md:97`、`verify-report.md:99`）。
- 上一轮待裁决项是是否接受这两个 story 文件作为本次契约文档落仓的合法产物（`verify-report.md:106`、`verify-report.md:108`、`verify-report.md:109`、`verify-report.md:110`）。
- 本轮契约已回写：story 门禁记录声明已将 umbrella/child story 文件纳入契约范围（`story.md:120`、`story.md:123`）；story AC-4 允许范围包含 umbrella story 和已拆出的 child story（`story.md:80`）；design 输出文件和 Phase 0 允许修改路径包含这两个 story 文件（`design.md:25`、`design.md:26`、`design.md:41`、`design.md:42`）。
- 未发现因该回写引入的新越界：回写只扩展文档契约产物范围，仍保留业务代码禁区（`story.md:79`、`design.md:47`、`design.md:49`、`design.md:50`、`design.md:51`、`design.md:52`、`design.md:53`）。

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC   | 结论    | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-1 | ✅ pass | `design.md` 存在并声明对应当前 story（`design.md:1`、`design.md:5`）；阶段拆分覆盖 Phase 0-5（`design.md:34`、`design.md:55`、`design.md:74`、`design.md:94`、`design.md:104`、`design.md:115`）；冲突热点列出并声明 Phase 0 不触碰（`design.md:125`、`design.md:127`、`design.md:138`）；派发规则要求每次只派一个目标并写明读写边界（`design.md:140`、`design.md:142`、`design.md:144`、`design.md:145`、`design.md:146`）；验收项列出（`design.md:158`、`design.md:160`、`design.md:161`、`design.md:162`、`design.md:163`、`design.md:164`、`design.md:165`、`design.md:166`）；不做项见禁改路径和阶段约束（`design.md:47`、`design.md:49`、`design.md:50`、`design.md:51`、`design.md:52`、`design.md:53`、`design.md:70`、`design.md:72`）；输入来源引用 umbrella story 和 handoff 文件（`design.md:13`、`design.md:14`、`design.md:15`、`design.md:16`、`design.md:17`、`design.md:18`）。 |
| AC-2 | ✅ pass | ADR 存在（`docs/adr/ts-daemon-agent-runtime-migration.md:1`）；JournalRuntimeClient（`docs/adr/ts-daemon-agent-runtime-migration.md:55`）、AgentRun（`docs/adr/ts-daemon-agent-runtime-migration.md:71`）、CodingAgentAdapter（`docs/adr/ts-daemon-agent-runtime-migration.md:112`）、ChangeSet（`docs/adr/ts-daemon-agent-runtime-migration.md:136`）、AuthorizationMode（`docs/adr/ts-daemon-agent-runtime-migration.md:159`）和 SedimentationRecord（`docs/adr/ts-daemon-agent-runtime-migration.md:178`）均有定义；只本地、多平台一致、首批三家 CLI 约束见 `docs/adr/ts-daemon-agent-runtime-migration.md:21`、`docs/adr/ts-daemon-agent-runtime-migration.md:24`。                                                                                                                                                                                                                          |
| AC-3 | ✅ pass | Rust 删除清单存在（`docs/adr/rust-removal-acceptance.md:1`）；覆盖 Host 与 Runtime（`docs/adr/rust-removal-acceptance.md:39`）、API Parity（`docs/adr/rust-removal-acceptance.md:55`）、Agent Run（`docs/adr/rust-removal-acceptance.md:81`）、三家 CLI（`docs/adr/rust-removal-acceptance.md:98`）、ChangeSet（`docs/adr/rust-removal-acceptance.md:124`）、自动沉淀（`docs/adr/rust-removal-acceptance.md:142`）、数据与文件迁移（`docs/adr/rust-removal-acceptance.md:162`）、测试矩阵（`docs/adr/rust-removal-acceptance.md:170`）、真实任务（`docs/adr/rust-removal-acceptance.md:201`）、回滚与发布（`docs/adr/rust-removal-acceptance.md:216`）；Tauri/Rust 宿主仍依赖时 gate 不通过见 `docs/adr/rust-removal-acceptance.md:13`。                                                                                                                                                         |
| AC-4 | ✅ pass | 在用户给定核对范围内，6 个文件全部属于本轮 story/design 允许范围，且均未命中业务代码禁区；契约禁区见 `story.md:79`、`design.md:47`、`design.md:49`、`design.md:50`、`design.md:51`、`design.md:52`、`design.md:53`，允许范围见 `story.md:80`、`design.md:40`、`design.md:41`、`design.md:42`、`design.md:43`、`design.md:44`。可复现命令输出见「越界检查」。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| AC-5 | ✅ pass | Umbrella story 明确“只作为总契约和迁移边界，不直接承载业务代码开发”（`stories/20260625-ts-daemon-agent-runtime-migration/story.md:25`）；本 story 存在（`story.md:1`）；runtime-client-protection child story 存在并为 approved（`stories/20260625-runtime-client-protection/story.md:1`、`stories/20260625-runtime-client-protection/story.md:4`）；Phase 1 对应 child story 且默认路径仍走 Tauri、不接 HTTP daemon（`design.md:55`、`design.md:57`、`design.md:59`）。                                                                                                                                                                                                                                                                                                                                                                                                                         |

## 范围完整性（不少，对照 story.md 范围）

- ✅ 必需输出文件齐备：本 story 的 design、迁移 ADR、Rust 删除清单、umbrella story、runtime-client-protection child story 均存在，证据分别为 `design.md:1`、`docs/adr/ts-daemon-agent-runtime-migration.md:1`、`docs/adr/rust-removal-acceptance.md:1`、`stories/20260625-ts-daemon-agent-runtime-migration/story.md:1`、`stories/20260625-runtime-client-protection/story.md:1`。
- ✅ AC 未显式覆盖但 design 要求的输入来源已记录：umbrella story 与 handoff 事实来源列在 `design.md:13`、`design.md:14`、`design.md:15`、`design.md:16`、`design.md:17`、`design.md:18`。
- ✅ 后续拆分任务边界已记录：Phase 1 runtime client、Phase 2 daemon、Phase 3 adapter、Phase 4 AgentRun/ChangeSet/AuthorizationMode、Phase 5 Workbench/自动沉淀见 `design.md:55`、`design.md:74`、`design.md:94`、`design.md:104`、`design.md:115`。
- ✅ 上一轮缺失的 Phase 0 允许范围已补齐：story 允许范围包含 umbrella story 和已拆出的 child story（`story.md:80`），design 允许路径包含 umbrella story 与 runtime-client-protection story（`design.md:41`、`design.md:42`）。

## 方案落实（不偏，对照 design.md）

- ✅ Phase 0 文档产物已落实：design、umbrella story、runtime-client-protection child story、迁移 ADR、Rust 删除清单均存在（`design.md:24`、`design.md:25`、`design.md:26`、`design.md:27`、`design.md:28`；实际文件证据见 `design.md:1`、`stories/20260625-ts-daemon-agent-runtime-migration/story.md:1`、`stories/20260625-runtime-client-protection/story.md:1`、`docs/adr/ts-daemon-agent-runtime-migration.md:1`、`docs/adr/rust-removal-acceptance.md:1`）。
- ✅ 不把 umbrella story 直接当作业务代码任务派发：umbrella story 明确只作为总契约，不直接承载业务代码（`stories/20260625-ts-daemon-agent-runtime-migration/story.md:25`）；本 story AC-5 要求 Phase 1 以 child story 为准（`story.md:87`）；design 验收要求不把 umbrella story 直接当作业务代码任务派发（`design.md:166`）。
- ✅ 冲突热点和派发规则已落实到设计：热点列表见 `design.md:125`、`design.md:127`、`design.md:129`、`design.md:130`、`design.md:131`、`design.md:132`、`design.md:133`、`design.md:134`、`design.md:135`、`design.md:136`；派发规则要求每次只派一个目标、写明读写边界和不允许顺手重构（`design.md:140`、`design.md:142`、`design.md:144`、`design.md:145`、`design.md:146`、`design.md:148`）。
- ✅ 后续 NFR/依赖未被本轮文档越界实现：Phase 1 明确默认仍走 Tauri、不新增 daemon、不改 Rust、不重写 ChatPanel（`design.md:59`、`design.md:70`、`design.md:72`）；Phase 2 明确使用跨平台 Node API、不依赖平台专属二进制（`design.md:90`、`design.md:91`）；Phase 3 明确首批三家且排除其它 CLI（`design.md:96`、`design.md:102`）。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ 核对范围 6 个文件均存在，且均归属 Phase 0 允许范围；未命中 `src/`、`src-tauri/`、`package.json`、workspace 配置或测试文件禁区。可复现命令输出：

```text
$ for p in <6 个核对路径>; do ...; done
stories/20260625-agent-runtime-contract-docs/story.md	exists=yes	phase0_allowed=yes	forbidden_business=no
stories/20260625-agent-runtime-contract-docs/design.md	exists=yes	phase0_allowed=yes	forbidden_business=no
docs/adr/ts-daemon-agent-runtime-migration.md	exists=yes	phase0_allowed=yes	forbidden_business=no
docs/adr/rust-removal-acceptance.md	exists=yes	phase0_allowed=yes	forbidden_business=no
stories/20260625-ts-daemon-agent-runtime-migration/story.md	exists=yes	phase0_allowed=yes	forbidden_business=no
stories/20260625-runtime-client-protection/story.md	exists=yes	phase0_allowed=yes	forbidden_business=no
```

- ✅ `git status --short -- <6 个核对路径>` 只显示用户给定的 6 个文档 / story 路径；这些路径均已被本轮 story/design 允许范围覆盖（`story.md:80`、`design.md:40`、`design.md:41`、`design.md:42`、`design.md:43`、`design.md:44`）。可复现命令输出：

```text
$ git status --short -- <6 个核对路径>
?? docs/adr/rust-removal-acceptance.md
?? docs/adr/ts-daemon-agent-runtime-migration.md
?? stories/20260625-agent-runtime-contract-docs/design.md
?? stories/20260625-agent-runtime-contract-docs/story.md
?? stories/20260625-runtime-client-protection/story.md
?? stories/20260625-ts-daemon-agent-runtime-migration/story.md
```

- ✅ 未发现命中三类边界的实现：本轮核对文件均为契约/ADR/story 文档，未新增 daemon、未改前端 runtime、未改 Rust 后端；对应非目标见 `story.md:91`、`story.md:92`、`story.md:93`。

## 冗余（不重，对照 story.md）

- ✅ 未发现同一 AC 的重复实现。design 对应 AC-1，迁移 ADR 对应 AC-2，Rust 删除清单对应 AC-3，范围控制对应 AC-4，umbrella + child story 对应 AC-5（`story.md:55`、`story.md:62`、`story.md:69`、`story.md:76`、`story.md:82`；输出文件定义见 `design.md:24`、`design.md:25`、`design.md:26`、`design.md:27`、`design.md:28`）。
- ✅ 上一轮两个额外 story 文件已经从“无法归属的范围越界”转为 AC-5 与 Phase 0 输出范围内的合法产物，证据见 `story.md:86`、`design.md:25`、`design.md:26`、`design.md:41`、`design.md:42`。

## 结论

result: pass

Fail 项数：0

六字标准结论：不漏、不重、不偏、不倚、不多、不少均通过。上一轮 fail 项已通过 story/design 契约回写解决，且在用户给定核对范围内未发现新越界。

## 待用户裁决

无。
