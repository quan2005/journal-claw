---
story: ./story.md
design: ./design.md
date: 2026-06-25
round: 1
result: fail
scope: '核对范围：用户给定的 6 个文件清单'
---

# 验收报告 — Agent Runtime 迁移契约文档落仓

## 判定依据

- 六字标准要求每条结论必须附证据，找不到证据就是 fail（`.agents/skills/verification-gate/references/six-criteria.md:3`）。
- `result: pass` 需要六项全部通过，任一项 fail 则 `result: fail`；灰色地带列入「待用户裁决」，结论按保守原则计 fail（`.agents/skills/verification-gate/references/six-criteria.md:18`、`.agents/skills/verification-gate/references/six-criteria.md:19`、`.agents/skills/verification-gate/references/six-criteria.md:20`）。

## 契约提取

### AC

- AC-1：`stories/20260625-agent-runtime-contract-docs/design.md` 存在；明确阶段拆分、冲突热点、派发顺序、验收顺序和不做项；引用 umbrella story 和 handoff 事实来源（`story.md:55`、`story.md:58`、`story.md:59`、`story.md:60`）。
- AC-2：`docs/adr/ts-daemon-agent-runtime-migration.md` 存在；明确 JournalRuntimeClient、AgentRun、CodingAgentAdapter、ChangeSet、AuthorizationMode、自动沉淀管线；明确只本地、多平台一致、首批只支持 Claude Code / Codex CLI / OpenCode（`story.md:62`、`story.md:65`、`story.md:66`、`story.md:67`）。
- AC-3：`docs/adr/rust-removal-acceptance.md` 存在；清单覆盖 host/runtime、API parity、AgentRun、三家 CLI、ChangeSet、自动沉淀、数据迁移、测试矩阵、真实任务和回滚计划；明确桌面宿主仍依赖 Tauri/Rust 时 gate 不通过（`story.md:69`、`story.md:72`、`story.md:73`、`story.md:74`）。
- AC-4：本 story 只负责契约落仓，不修改 `src/`、`src-tauri/`、`package.json`、workspace 配置或测试文件；允许改动范围仅限本 story 目录、`docs/adr/` 目标文档和 handoff 账本（`story.md:76`、`story.md:79`、`story.md:80`）。

### 三类边界

- 不为最终产品用户直接做功能体验；本 story 服务维护者和 coding agent 协作（`story.md:84`）。
- 不进入业务代码实现、不新增 daemon、不改前端 runtime、不改 Rust 后端（`story.md:85`）。
- 不验证三家 CLI 是否可运行；不实现 ChangeSet、授权、自动沉淀；不删除 Rust（`story.md:86`）。

### 方案范围、NFR / 依赖

- 方案目标是把 handoff 外部目录中的迁移共识收进仓库，形成后续 coding agent 可引用的契约；只处理文档契约，不修改业务代码（`design.md:7`、`design.md:9`）。
- 输入依赖为 umbrella story、handoff design 草稿、ADR 草稿、Rust 删除清单草稿、冲突管理和 coding-agent 任务清单（`design.md:13`、`design.md:14`、`design.md:15`、`design.md:16`、`design.md:17`、`design.md:18`）。
- Phase 0 应输出本 story design、两个 ADR 文档；handoff 账本允许同步但不要求（`design.md:20`、`design.md:24`、`design.md:25`、`design.md:26`、`design.md:28`）。
- Phase 0 允许修改本 story 目录、两个 ADR 目标文档和 handoff 账本；不允许修改 `src/**`、`src-tauri/**`、`package.json`、workspace 配置和测试文件（`design.md:36`、`design.md:38`、`design.md:39`、`design.md:40`、`design.md:41`、`design.md:43`、`design.md:45`、`design.md:46`、`design.md:47`、`design.md:48`、`design.md:49`）。
- 后续阶段的关键 NFR / 依赖包括：Phase 1 默认仍走 Tauri、不新增 daemon、不改 Rust、不重写 ChatPanel；Phase 2 使用跨平台 Node API，不依赖平台专属二进制；Phase 3 首批只支持 Claude Code / Codex CLI / OpenCode；Phase 5 自动沉淀是 run lifecycle 默认尾声（`design.md:64`、`design.md:66`、`design.md:67`、`design.md:68`、`design.md:84`、`design.md:86`、`design.md:87`、`design.md:88`、`design.md:90`、`design.md:92`、`design.md:98`、`design.md:111`、`design.md:118`、`design.md:119`）。

## AC 核对（不漏 / 不偏 / 不倚，对照 story.md）

| AC   | 结论    | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | ✅ pass | `design.md` 存在并声明本设计对应当前 story（`design.md:1`、`design.md:5`）；阶段拆分覆盖 Phase 0-5（`design.md:30`、`design.md:32`、`design.md:51`、`design.md:70`、`design.md:90`、`design.md:100`、`design.md:111`）；冲突热点列出并声明 Phase 0 不触碰（`design.md:121`、`design.md:123`、`design.md:134`）；Claude 派发规则和示例 prompt 明确（`design.md:136`、`design.md:138`、`design.md:146`）；验收项列出（`design.md:154`、`design.md:156`、`design.md:157`、`design.md:158`、`design.md:159`、`design.md:160`）；不做项见 Phase 约束与禁改路径（`design.md:43`、`design.md:45`、`design.md:46`、`design.md:47`、`design.md:48`、`design.md:49`、`design.md:64`、`design.md:68`）；输入来源引用 umbrella story 和 handoff 文件（`design.md:13`、`design.md:14`、`design.md:15`、`design.md:16`、`design.md:17`、`design.md:18`）。 |
| AC-2 | ✅ pass | ADR 存在（`docs/adr/ts-daemon-agent-runtime-migration.md:1`）；JournalRuntimeClient（`docs/adr/ts-daemon-agent-runtime-migration.md:55`）、AgentRun（`docs/adr/ts-daemon-agent-runtime-migration.md:71`）、CodingAgentAdapter（`docs/adr/ts-daemon-agent-runtime-migration.md:112`）、ChangeSet（`docs/adr/ts-daemon-agent-runtime-migration.md:136`）、AuthorizationMode（`docs/adr/ts-daemon-agent-runtime-migration.md:159`）和 SedimentationRecord（`docs/adr/ts-daemon-agent-runtime-migration.md:178`）均有定义；只本地/多平台/首批三家 CLI 约束见 `docs/adr/ts-daemon-agent-runtime-migration.md:21`、`docs/adr/ts-daemon-agent-runtime-migration.md:22`、`docs/adr/ts-daemon-agent-runtime-migration.md:24`。                                                                                                                        |
| AC-3 | ✅ pass | Rust 删除清单存在（`docs/adr/rust-removal-acceptance.md:1`）；覆盖 Host 与 Runtime（`docs/adr/rust-removal-acceptance.md:39`）、API Parity（`docs/adr/rust-removal-acceptance.md:55`）、Agent Run（`docs/adr/rust-removal-acceptance.md:81`）、三家 CLI（`docs/adr/rust-removal-acceptance.md:98`）、ChangeSet（`docs/adr/rust-removal-acceptance.md:124`）、自动沉淀（`docs/adr/rust-removal-acceptance.md:142`）、数据与文件迁移（`docs/adr/rust-removal-acceptance.md:162`）、测试矩阵（`docs/adr/rust-removal-acceptance.md:170`）、真实任务（`docs/adr/rust-removal-acceptance.md:201`）、回滚与发布（`docs/adr/rust-removal-acceptance.md:216`）；Tauri/Rust 宿主仍依赖时 gate 不通过见 `docs/adr/rust-removal-acceptance.md:13`。                                                                                                     |
| AC-4 | ❌ fail | 禁改业务代码要求本身满足：核对范围中没有 `src/`、`src-tauri/`、`package.json`、workspace 配置或测试文件；但允许改动范围要求不满足，因为 `stories/20260625-ts-daemon-agent-runtime-migration/story.md` 和 `stories/20260625-runtime-client-protection/story.md` 不在 Phase 0 允许路径内。契约允许范围见 `story.md:80` 与 `design.md:36`-`design.md:41`。命令 `git status --short -- <6 个核对路径>` 输出 6 个 untracked 文件，其中包含这两个 story；路径归属命令输出显示这两个文件 `phase0_allowed=no`。                                                                                                                                                                                                                                                                                                                                      |

## 范围完整性（不少，对照 story.md 范围）

- ✅ 必需输出文件齐备：当前 story 的 `design.md`、迁移 ADR、Rust 删除清单均存在，证据分别为 `design.md:1`、`docs/adr/ts-daemon-agent-runtime-migration.md:1`、`docs/adr/rust-removal-acceptance.md:1`。
- ✅ AC 未显式覆盖但 design 要求的输入来源已记录：umbrella story 与 handoff 事实来源列在 `design.md:13`-`design.md:18`。
- ✅ 后续拆分任务边界已记录：Phase 1 runtime client、Phase 2 daemon、Phase 3 adapter、Phase 4 AgentRun/ChangeSet/AuthorizationMode、Phase 5 Workbench/自动沉淀见 `design.md:51`、`design.md:70`、`design.md:90`、`design.md:100`、`design.md:111`。
- ❌ 范围完整性与范围控制存在同一偏差：若用户给定核对清单即变更清单，则新增两个其它 story 文件无法归入 Phase 0 明确允许修改范围（`story.md:80`、`design.md:36`-`design.md:41`；命令输出见「越界检查」）。

## 方案落实（不偏，对照 design.md）

- ✅ Phase 0 文档产物已落实：design、迁移 ADR、Rust 删除清单均存在（`design.md:24`、`design.md:25`、`design.md:26`；实际文件证据见 `design.md:1`、`docs/adr/ts-daemon-agent-runtime-migration.md:1`、`docs/adr/rust-removal-acceptance.md:1`）。
- ✅ 不把 umbrella story 直接当作业务代码任务派发：umbrella story 明确“只作为总契约和迁移边界，不直接承载业务代码开发”，后续必须拆到更小 child stories（`stories/20260625-ts-daemon-agent-runtime-migration/story.md:25`）；design 验收也要求“不把 umbrella story 直接当作业务代码任务派发”（`design.md:160`）。
- ✅ 冲突热点和派发规则已落实到设计：热点列表见 `design.md:121`-`design.md:134`；派发规则要求每次只派一个目标、写明读写边界和不允许顺手重构（`design.md:136`-`design.md:145`）。
- ❌ Phase 0 允许修改路径未被严格遵守：design 只允许本 story 目录、两个 ADR 目标文件和 handoff 账本（`design.md:36`-`design.md:41`），但核对范围 / git 状态包含两个其它 `stories/*/story.md`。

## 越界检查（不多，对照 story 非目标 + design 范围）

- ✅ 未命中业务代码禁区：命令输出显示 6 个核对路径的 `forbidden_business=no`，且不包含 `src/`、`src-tauri/`、`package.json`、workspace 配置或测试文件。该结论对应 story 禁区（`story.md:79`）和 design 禁区（`design.md:43`-`design.md:49`）。
- ❌ 命中 Phase 0 范围越界：两个其它 story 文件不属于 story/design 允许改动路径。可复现命令输出如下：

```text
$ git status --short -- <6 个核对路径>
?? docs/adr/rust-removal-acceptance.md
?? docs/adr/ts-daemon-agent-runtime-migration.md
?? stories/20260625-agent-runtime-contract-docs/design.md
?? stories/20260625-agent-runtime-contract-docs/story.md
?? stories/20260625-runtime-client-protection/story.md
?? stories/20260625-ts-daemon-agent-runtime-migration/story.md
```

```text
$ for p in <6 个核对路径>; do ...; done
stories/20260625-agent-runtime-contract-docs/story.md	exists=yes	phase0_allowed=yes	forbidden_business=no
stories/20260625-agent-runtime-contract-docs/design.md	exists=yes	phase0_allowed=yes	forbidden_business=no
docs/adr/ts-daemon-agent-runtime-migration.md	exists=yes	phase0_allowed=yes	forbidden_business=no
docs/adr/rust-removal-acceptance.md	exists=yes	phase0_allowed=yes	forbidden_business=no
stories/20260625-ts-daemon-agent-runtime-migration/story.md	exists=yes	phase0_allowed=no	forbidden_business=no
stories/20260625-runtime-client-protection/story.md	exists=yes	phase0_allowed=no	forbidden_business=no
```

## 冗余（不重，对照 story.md）

- ✅ 未发现同一 AC 的重复文档实现。三个核心产物各自对应一个 AC：design 对应 AC-1，迁移 ADR 对应 AC-2，Rust 删除清单对应 AC-3（`story.md:55`-`story.md:74`；输出文件定义见 `design.md:24`-`design.md:26`）。
- ⚠️ 两个额外 story 文件不是重复实现同一 AC，而是范围越界问题；已归入「越界检查」和「待用户裁决」。

## 结论

result: fail

Fail 项数：1

失败项：Phase 0 允许改动范围不满足。当前核对范围 / git 状态包含 `stories/20260625-ts-daemon-agent-runtime-migration/story.md` 和 `stories/20260625-runtime-client-protection/story.md`，两者均不在 story/design 明确允许的 Phase 0 修改范围内（`story.md:80`、`design.md:36`-`design.md:41`）。这导致 AC-4、范围控制和「不多」失败。

修复建议：

1. 若这两个 story 文件确实属于本次 Phase 0 产出：先回写契约，至少更新 `story.md` 的允许范围 / AC，以及 `design.md` 的输出文件和 Phase 0 允许修改路径，然后重新验收。
2. 若不属于本次 Phase 0：将这两个 story 文件移出本轮改动，或推迟到各自独立 story 的门禁/验收流程。

## 待用户裁决

1. 是否接受 `stories/20260625-ts-daemon-agent-runtime-migration/story.md` 与 `stories/20260625-runtime-client-protection/story.md` 作为本次“契约文档落仓”的合法产物？
   - 接受代价：需要回写 story/design 契约，否则实现与契约长期背离；影响“要什么”和“怎么做”，分别应回写 `story.md` 与 `design.md`。
   - 不接受代价：需要把这两个文件移出本轮改动，后续按独立 story 再进入门禁与验收。
