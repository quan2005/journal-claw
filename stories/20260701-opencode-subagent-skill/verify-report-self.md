# 验收报告 · opencode-subagent skill

- **Story**: `STORY-20260701-opencode-subagent-skill`（status: approved）
- **Design**: 无（prompt 注明"本任务无 design.md"；但 story.md frontmatter `design: ./design.md` 指向不存在的文件——见偏差 D-2）
- **核对范围（传入）**: `stories/20260701-opencode-subagent-skill/story.md`
- **轮次**: 1
- **subAgent**: opencode `build` agent（经 `.agents/skills/opencode-subagent/opencode-subagent.sh` 派发，独立会话）
- **结论**: `result: fail`

---

## ⚠️ 范围声明（影响所有 AC 的取证前提）

传入的"核对范围"仅列出 `stories/.../story.md`（需求契约本身），而 4 条 AC 的断言对象实际是交付物 `.agents/skills/opencode-subagent/SKILL.md` 及配套脚本。若严格按"只在范围内取证"，所有 AC 都会因"范围内无交付物"而无证据。

本报告按**保守但不形式主义**的原则处理：**就 AC 断言对象（交付物）实地取证**，同时把"范围与 AC 对象不匹配"作为独立偏差 D-1 记录、移交用户裁决。这是 script 调用方把 story 路径当作 scope 传入导致的用法问题（见证据 E-1）。

---

## AC 逐项核对

### AC-1 — skill 可被 AI 发现并引用 → **PASS**（含 1 处弱项）

- **Then（何时用 opencode / 何时仍用 host Agent 工具）**：
  - 何时用 opencode：`.agents/skills/opencode-subagent/SKILL.md:12-16`（When to Use）明确列出三类场景。✓
  - 何时仍用 host Agent 工具：仅**隐式**——`SKILL.md:15`"host Agent/Task tool is unavailable, expensive..."与 `:18-21`"Do not use when"反推。**无独立的"何时仍用 host Agent 工具"正面表述**。弱项，不致命。
- **And（可拷贝调用模板：命令/参数/输入格式/输出路径）**：
  - Core Pattern `SKILL.md:23-37`（命令+参数+输入文件+输出路径）✓；Quick Reference `SKILL.md:39-48`（Output path 规则 `:45`）✓。
- **可发现性**：`.claude/skills` 是指向 `../.agents/skills` 的符号链接（`ls -la .claude/skills` → `lrwxr-xr-x ... skills -> ../.agents/skills`），且本 skill 已出现在 host 的 `available_skills` 列表中。✓
- **结论**：PASS。建议补一句正面说明"何时仍用 host Agent 工具"以消除弱项。

### AC-2 — 标准化调用能成功跑通 → **PASS**（自证）

- **Then（子 agent 独立会话读契约/跑命令/写报告）**：
  - 本次验收**即由该 skill 的脚本派发**（`opencode run --agent build -f <prompt.md>`，见脚本末段）。本 subAgent 正运行于独立会话，已读 story.md、跑 `ls/git/diff/rg` 取证，并将本报告写入指定路径。✓
  - 脚本经 `-f` 读取 `/tmp` 下的 prompt 文件成功（prompt 内容已注入本会话）。✓
- **And（主对话回收报告路径 + result 摘要）**：
  - 脚本末尾 `if [[ -f "$OUTPUT_FILE" ]]; then echo "报告已生成：..."; tail -n 3 | grep -E '^(SUMMARY:|result:)'`（opencode-subagent.sh 末段）会回显路径与摘要行；本报告含 `result: fail` 与末行 SUMMARY。✓
- **自证说明**：AC-2 的设计验证方式（story.md:52）就是"用新 skill 跑一次子任务并产出可接受报告"——本次运行即该验证，非循环论证。✓
- **结论**：PASS。

### AC-3 — 不破坏现有门禁体系 → **PASS**

- **Then（不删除/不修改现有 skill）**：
  - 三个既有 gate skill 均在且 mtime 为 `Jun 16`（早于本 story 的 Jul 1），未被触碰：
    - `.agents/skills/verification-gate/SKILL.md`（6729B, Jun 16 15:04）
    - `.agents/skills/requirements-gate/SKILL.md`（11100B, Jun 16 15:08）
    - `.agents/skills/docs-maintenance/SKILL.md`（5153B, Jun 16 15:09）
  - `git status --porcelain` 中三者均未出现（无 M/D）。✓
- **And（仅作"可选 subagent 后端"补充）**：
  - `SKILL.md:15` 将 opencode 定位为 host 工具不可用/想要外部可审计运行时的替代；与 story Won't 边界 `story.md:84`"host Agent 工具仍是合法路径"一致。✓
- **结论**：PASS。

### AC-4 — 错误处理与边界清晰 → **FAIL**

- **Then（提供明确回退路径：重试 / 换 host Agent 工具 / 向用户报告）**：
  - 对全文检索 `fall back|fallback|retry|重试|回退|escalat|switch to` → **NO MATCH**（`rg` 实测）。
  - "向用户报告"：间接满足——脚本对"报告文件缺失"打印告警并 `exit 2`；Troubleshooting 表给出症状→动作。⚠️ 仅此一项。
  - "**重试**"策略：**无**（脚本一次失败即 `exit 2`，无重试逻辑；SKILL.md 无重试约定）。
  - "**换 host Agent 工具**"的决策点：**无**（无"当 opencode 不可用→改用 host Agent 工具"的显式判定流程）。
- **And（不隐瞒失败/不伪造结论）**：
  - 脚本 `exit 2` 不隐瞒；prompt 铁律"找不到证据=fail"。此子句满足。
- **证据缺口**：AC-4 的 Then 明确要求三类回退，仅"向用户报告"有据，"重试"与"换 host Agent 工具"**找不到证据**。依铁律"找不到证据=fail"。
- **结论**：FAIL。修复方向：在 SKILL.md 增加一节"Failure & Fallback"决策流（如：失败→重试 1 次→仍失败则回退 host Agent 工具或报告用户裁决），即可翻 PASS。

---

## 越界 / 偏差清单

| #   | 类型          | 描述                                                                                                                                                                                                                  | 证据                                                                              | 严重度                                              |
| --- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------- |
| D-1 | 范围错配      | 传入 scope 仅 story.md，不含交付物；系 script 调用方误把 story 路径当 scope 传入（script 第 3 位置参数为 scope）                                                                                                      | 脚本 `SCOPE="${3:-}"`；本次 SCOPE 实际值=story 路径                               | 中（影响可复现性）                                  |
| D-2 | 契约不一致    | story.md frontmatter `design: ./design.md` 指向不存在的文件                                                                                                                                                           | `ls stories/.../design.md` → No such file                                         | 低（prompt 已声明无 design）                        |
| D-3 | 重复/孤儿脚本 | `.opencode/opencode-subagent.sh`（旧，"验收 subAgent"，3164B, 21:41）与 skill 内脚本（新，"独立 subAgent"，2898B, 22:15）**内容不同**；SKILL.md Core Pattern 仅引用 skill 内副本，`.opencode/` 版沦为未被引用的旧拷贝 | `diff` 两脚本不一致；`SKILL.md:27` 指向 `.agents/skills/.../opencode-subagent.sh` | 低（Q2 默认"保留 .opencode 并由 skill 引用"未落实） |
| D-4 | 自相矛盾      | 脚本把 prompt 写入 `/tmp/opencode-subagent-prompt-XXXXXX.md`，而 SKILL.md "Common Mistakes" 明禁 /tmp（针对输出，但规则表述未区分输入/输出，易误导）                                                                  | 脚本 `mktemp /tmp/...`；`SKILL.md:56`                                             | 低                                                  |
| D-5 | 健壮性回退    | skill 内脚本用 `set -eo pipefail`，丢了 `-u`；旧 `.opencode/` 版本是 `-euo pipefail`                                                                                                                                  | `diff` line 2                                                                     | 极低                                                |

> 注：工作树存在大量与本 story 无关的未提交改动（apps/web、apps/daemon、docs 等），非本 story 产物，不计入越界。

---

## 待用户裁决项

| #   | 议题                                                                                                                                                                                                                                 | 两边代价                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| R-1 | **AC-4 是否可接受现状**：当前仅有"症状→修复 + 失败即退出+报告"，缺"重试 / 换 host Agent 工具"显式决策流。                                                                                                                            | 接受→AC-4 翻 PASS，但 skill 对"调用失败时下一步"指引不足；不接受→要求补一节 Fallback 决策流再复验。 |
| R-2 | **范围错配 D-1 是否需修 script**：script 第 3 参数 scope 被调用方填成 story 路径。                                                                                                                                                   | 修 script（校验 scope≠story 路径 / 必填）→ 杜绝复发；不修→依赖调用方自律。                          |
| R-3 | **story Q1-Q3 是否已正式裁定**：story 门禁记录 `story.md:114-116` 标"待澄清"，Q1-Q3 `:97-102` 标"待确认"，但已 approved 并实现。实现实际选择（Q1 覆盖三 gate / Q2 保留 .opencode / Q3 统一摘要）与默认值一致，但是否经用户确认未知。 | 视为已默许→继续；要求显式确认→回 story 补记录。                                                     |
| R-4 | **D-3 孤儿脚本处置**：`.opencode/opencode-subagent.sh` 旧版是否删除/对齐/保留为参考。                                                                                                                                                | 删除→清爽；保留→须对齐内容并由 SKILL.md 明确引用关系。                                              |

---

## SUMMARY

`result: fail` · fail 项数: 1（AC-4） · 待裁决项数: 4（R-1~R-4）
