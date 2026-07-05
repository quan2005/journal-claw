# 验收报告 — STORY-20260701-opencode-subagent-skill（R1 / 轮次 1）

- **result: pass**
- 核对范围：`.agents/skills/opencode-subagent/SKILL.md`、`.agents/skills/opencode-subagent/opencode-subagent.sh`
- 意图契约：`stories/20260701-opencode-subagent-skill/story.md`
- 方案契约：本任务无 design.md
- 验收者：独立 subAgent（由 `opencode-subagent.sh` 通过 `opencode run` 派发）
- 日期：2026-07-01

---

## AC 逐项核对

### AC-1 — skill 可被 AI 发现并引用 — **pass**

| 子句                                                              | 结论     | 证据                                                                                                                                                         |
| ----------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Given：收到需 spawn 独立 subagent 的任务                          | 满足     | 本报告即由该场景触发                                                                                                                                         |
| When：查看 `.agents/skills/opencode-subagent/SKILL.md`            | 文件存在 | `ls` 确认：`.agents/skills/opencode-subagent/SKILL.md`（6892 字节）                                                                                          |
| Then：明确说明何时用 opencode subagent、何时用 host Agent 工具    | 满足     | `SKILL.md:12-16`（When to Use 三条）+ `SKILL.md:18-21`（Do not use when 三条）+ `SKILL.md:66`（"Fall back to the host `Agent`/`Task` tool"）显式界定两者边界 |
| And：提供可拷贝调用模板（命令、参数、输入文件格式、输出路径约定） | 满足     | `SKILL.md:23-44`（Core Pattern 含完整命令、参数、输入文件、输出路径）+ `SKILL.md:46-56`（Quick Reference 表固化 7 条规则）                                   |

### AC-2 — 标准化调用能成功跑通 — **pass**（强元证据）

| 子句                                                             | 结论 | 证据                                                                                                                                  |
| ---------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Given：已安装 opencode CLI 且可调用模型                          | 满足 | 本 subAgent 正在运行即证明 CLI 可用、模型可调用                                                                                       |
| When：按 skill 指引调用 opencode subagent 执行一次验收任务       | 满足 | 本次调用即一次真实验收任务，脚本 `opencode-subagent.sh:78-82` 执行 `opencode run "..." --format default --agent build -f <prompt.md>` |
| Then：子 agent 在独立会话中完成读取契约/代码、运行命令、写入报告 | 满足 | 本 subAgent 已：读 `story.md`（契约）、读 `SKILL.md`+`opencode-subagent.sh`（范围代码）、运行 6 次 bash 取证命令、正在写入本报告      |
| And：主对话能回收报告路径和 `result: pass/fail` 摘要             | 满足 | 脚本 `opencode-subagent.sh:85-87` 校验报告存在并 `grep '^SUMMARY:'`；本报告首行 `result: pass` + 末行 `SUMMARY:` 满足回收约定         |

> 说明：AC-2 的证据为"我在运行"这一行为事实本身——脚本已成功派发独立会话、读取文件、执行 bash、写入报告。这是比单测更强的端到端证据。

### AC-3 — 不破坏现有门禁体系 — **pass**

| 子句                                                                        | 结论 | 证据                                                                                                                                                     |
| --------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Given：现有 verification-gate / requirements-gate / docs-maintenance 已存在 | 满足 | `ls .agents/skills/{verification-gate,requirements-gate,docs-maintenance}/` 三者目录完整（均含 SKILL.md/references/hooks/assets/INSTALL.md）             |
| When：新 skill 入仓                                                         | 满足 | `opencode-subagent/` 作为第 4 个 skill 平级存在                                                                                                          |
| Then：不删除、不修改现有 skill 的默认流程                                   | 满足 | `git status --short .agents/skills/{verification-gate,requirements-gate,docs-maintenance}/` → 空；`git diff --stat HEAD -- <三 gate>` → 空（无任何改动） |
| And：新 skill 仅作为"可选 subagent 后端"补充                                | 满足 | `grep -rn "opencode-subagent" <三 gate SKILL.md>` → 无引用；新 skill 不被任何现有 gate 强制引用，纯增量                                                  |

### AC-4 — 错误处理与边界清晰 — **pass**

| 子句                                                        | 结论     | 证据                                                                                                                                                        |
| ----------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Given：调用失败（文件不存在 / 权限拒绝 / 模型不可用）       | 场景覆盖 | `SKILL.md:93-101`（Troubleshooting 表覆盖 File not found、`external_directory` 权限拒绝、agent 错误、报告丢失、scope drift）                                |
| When：按 skill 指引处理                                     | 满足     | `SKILL.md:58-69`（Failure & Fallback 三步：Inspect → Fix & re-run once → Escalate/Fallback/Abandon）                                                        |
| Then：提供明确回退路径（重试 / 换 host Agent / 向用户报告） | 满足     | `SKILL.md:64-67` 明确列出三条回退；`SKILL.md:62`"re-run **once**"限定不无限重试                                                                             |
| And：不隐瞒失败或伪造验收结论                               | 满足     | `SKILL.md:69`"Do not hide the failure, do not fabricate a report"；`SKILL.md:90-91`（Red Flags）+ `SKILL.md:103-112`（Rationalizations 反合理化表）多层防御 |

---

## Won't 边界核对（不偏/不倚）

| Won't 条款                        | 是否越界 | 证据                                                                                                             |
| --------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| 不面向终端用户                    | 未越界   | `SKILL.md:3` 描述明确指向"dispatching independent subagents … in the Journal repository"                         |
| 不替代 opencode CLI 本身          | 未越界   | `SKILL.md:21`"check first with `which opencode`"，skill 封装调用而非替代                                         |
| 不修改 opencode 配置或 provider   | 未越界   | 文件无任何对 `opencode.json` / provider 的写操作；`SKILL.md:54`明确"do not use `--dangerously-skip-permissions`" |
| 不用于生产运行时编排              | 未越界   | 无 daemon/Electron 业务代码引用；纯开发流程辅助                                                                  |
| 不解决模型质量/成本/速度          | 未越界   | 文件无相关承诺                                                                                                   |
| 不解决 CLI 安装/授权              | 未越界   | `SKILL.md:21`将安装检查交给用户                                                                                  |
| 不强制所有 subagent 必走 opencode | 未越界   | `SKILL.md:18-21`（Do not use when）+ `SKILL.md:66`（Fall back to host Agent tool）双保险                         |

## Q1-Q3 已确认项落实核对

| 确认项                                         | 落实 | 证据                                                                                                                            |
| ---------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| Q1：同时覆盖三类门禁任务                       | 是   | `SKILL.md:3`描述 + `SKILL.md:14`"verification-gate, docs-maintenance, requirements-gate follow-ups"                             |
| Q2：实体在 skill 目录，`.opencode/` 为兼容软链 | 是   | `readlink .opencode/opencode-subagent.sh` → `../.agents/skills/opencode-subagent/opencode-subagent.sh`；`SKILL.md:34`说明该软链 |
| Q3：报告含 `result:` 行 + 末行 `SUMMARY:`      | 是   | `SKILL.md:41-44` + `opencode-subagent.sh:67,71`（prompt 模板强制要求）+ `opencode-subagent.sh:87`（回收时 grep 校验）           |

---

## 越界 / 偏差清单

无。

## 待用户裁决项

无。

## 观察项（非 AC 缺陷，仅供参考，不影响结论）

- `story.md:14` 的 `related:` 字段仍引用旧路径 `.opencode/opencode-subagent.sh`。该路径现为软链仍可解析，不构成 AC 违规；如需文档精确化，可在 docs-maintenance 环节同步为 `.agents/skills/opencode-subagent/`。属文档整洁度问题，非验收范围。

---

## 铁律自检

- [x] 不修改任何代码或契约（仅读取与写报告）
- [x] 未替用户裁决（无 pending 项）
- [x] 所有结论均有命令输出或文件:行证据，无"应该实现了"
- [x] 核对范围内文件均存在

SUMMARY: result=pass | fail=0 | pending=0
