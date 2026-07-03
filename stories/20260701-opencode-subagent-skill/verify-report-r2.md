# 验收报告 — opencode-subagent skill（轮次 R2，独立 subAgent）

- **Story**：STORY-20260701-opencode-subagent-skill
- **核对范围**：`.agents/skills/opencode-subagent/SKILL.md`、`.agents/skills/opencode-subagent/opencode-subagent.sh`
- **design.md**：本任务无 design.md
- **核对日期**：2026-07-01
- **核对者**：独立 subAgent（opencode 调用，与实现者无关）

## result: pass（带 3 项待用户裁决）

---

## 一、AC 逐项核对

### AC-1 — skill 可被 AI 发现并引用 —— pass

| 子句 | 结论 | 证据 |
|---|---|---|
| Then：明确说明何时用 opencode subagent、何时仍用 host Agent 工具 | pass | SKILL.md `## When to Use`（L12-16）列出 3 类使用场景；`**Do not use when:**`（L18-21）列出 3 类反场景，其中"simple inline read/grep that doesn't need an independent agent"即暗示回退到 host 内联/Agent 工具；L15 显式提到 "The host `Agent`/`Task` tool is unavailable, expensive..." |
| And：提供可拷贝的调用模板（命令、参数、输入文件格式、输出路径） | pass | SKILL.md L25-32 `## Core Pattern` 给出完整 bash 调用块；L40-49 `## Quick Reference` 表格逐条列出 agent、message order、output path、format、permissions、--dir、tmp 文件 7 条规则 |

### AC-2 — 标准化调用能成功跑通 —— pass（附注）

| 子句 | 结论 | 证据 |
|---|---|---|
| Then：子 agent 在独立会话中完成读取契约/代码、运行命令、写入报告 | pass（机制） | `opencode-subagent.sh` L78-82 调用 `opencode run "<msg>" --format default --agent build -f "$PROMPT_FILE"`；prompt 模板（L53-76）明确指示子 agent 读取 story.md、按 AC 取证、写入指定报告路径。**本次 R2 报告即由该 prompt 模板驱动生成**，证明调用链通畅。 |
| And：主对话能回收报告路径和 `result: pass/fail` 摘要 | pass | 脚本 L84-90 在 opencode 退出后检查 `$OUTPUT_FILE` 存在并 `tail -n 3 \| grep -E '^(SUMMARY:\|result:)'`；prompt（L66-71）强制报告含 `result:` 行与最后一行摘要。本报告顶部即含 `result: pass`。 |

> 附注：脚本封装本身未被本次 R2 直接 invoke（R2 由调用方直接以渲染好的 prompt 驱动 opencode），因此"脚本 wrapper 端到端"未在本次独立验证；但 prompt 模板与 opencode 调用约定已被实际执行（即本报告），机制层验证通过。脚本端到端建议由用户做一次 `./opencode-subagent.sh ...` 冒烟测试固化为证据。

### AC-3 — 不破坏现有门禁体系 —— pass

| 子句 | 结论 | 证据 |
|---|---|---|
| Then：不删除、不修改现有 skill 的默认流程 | pass | `git status --short -- .agents/skills/` 仅显示 `?? .agents/skills/opencode-subagent/`（新增未跟踪），`verification-gate` / `requirements-gate` / `docs-maintenance` 三个目录无任何改动。 |
| And：新 skill 仅作为"可选 subagent 后端"补充说明 | pass | SKILL.md L14-16 将自身定位为"可选后端"（"The host `Agent`/`Task` tool is unavailable, expensive, or you want a fully external...subagent run"），未声明取代；verification-gate SKILL.md:54 仍保留原 "用 Task 工具派发独立 subAgent" 流程，未被改写。 |

### AC-4 — 错误处理与边界清晰 —— pass

| 子句 | 结论 | 证据 |
|---|---|---|
| Then：提供明确回退路径（重试、换 host Agent 工具、向用户报告） | pass | SKILL.md L52-62 `## Failure & Fallback` 给出三步：① 定位根因（引用 Troubleshooting 表）② 改一处重跑一次（"Do not loop indefinitely"）③ 三选一：Escalate to user / Fall back to host Agent/Task / Abandon。L86-94 `## Troubleshooting` 表覆盖 File not found、/tmp 权限拒绝、agent 错误、报告缺失、scope 漂移 5 类症状。 |
| And：不隐瞒失败或伪造验收结论 | pass | L62 显式铁律 "Do not hide the failure, do not fabricate a report"；L96-105 `## Rationalizations` 表列出 7 条自我合理化陷阱。脚本 L88-90 在报告缺失时 `exit 2` 并stderr告警，不伪造成功。 |

---

## 二、Won't 边界核对

| Won't 条款 | 是否遵守 | 证据 |
|---|---|---|
| 不面向 Journal 终端用户 | 是 | SKILL.md 全文面向 "AI coding assistants and human developers"，无终端用户语义。 |
| 不替代 opencode CLI 本身；不改 opencode 配置/provider | 是 | 范围内两文件均未触碰 `.opencode/opencode.json` / `tui.json` / provider 配置；SKILL.md 多处提示"check first with `which opencode`"、"adjust `build` agent permissions in opencode config"（建议而非修改）。 |
| 不用于生产运行时编排 | 是 | 无 daemon/Electron 业务代码引用。 |
| 不解决模型质量/成本/速度 | 是 | SKILL.md 未承诺任何模型层指标。 |
| 不解决 CLI 安装/授权 | 是 | L21 "You are not sure `opencode` is installed; check first"——明确划界。 |
| 不强制所有 subagent 必须走 opencode | 是 | L18-21 "Do not use when" + L59 "Fall back to host Agent/Task tool"。 |

---

## 三、脚本静态核对（opencode-subagent.sh）

| 检查 | 结果 |
|---|---|
| `bash -n` 语法 | OK（无语法错误） |
| 可执行权限 | `-rwxr-xr-x` ✓ |
| `set -euo pipefail` | L2 ✓ |
| `mktemp` + `trap rm` 清理临时 prompt | L50-51 ✓ |
| 调用形式与 SKILL.md Quick Reference 一致 | 脚本 L78-82 = message first → `--format default --agent build -f prompt.md`，与 SKILL.md L44 一致 ✓ |
| scope/story 路径防混淆守卫 | L28-31 拒绝 scope == story 路径 ✓ |
| 拒绝 /tmp 输出 | L35-38 ✓（与 SKILL.md L70 一致） |

---

## 四、越界 / 偏差清单

| # | 类型 | 描述 | 严重度 |
|---|---|---|---|
| D1 | 偏差 | story.md Q2 默认值是"保留在 `.opencode/`，skill 引用并说明"，实现把脚本实体放在 `.agents/skills/opencode-subagent/` 下，仅在 `.opencode/opencode-subagent.sh` 建了一个符号链接（`-> ../.agents/skills/opencode-subagent/opencode-subagent.sh`）。SKILL.md L27 引用的是 skill 目录实体路径，未提及 `.opencode/` 兼容入口。 | 低（功能不破，向后兼容靠 symlink 维持；但与 story 默认值的字面表述不一致，且 SKILL.md 未告知读者 symlink 存在） |
| D2 | 偏差 | story.md Q3 默认值是"统一摘要格式，必须含 `result:` **和 `SUMMARY:`**"。prompt 模板（脚本 L66-71）只强制 `result:` + 末行摘要（result + fail 数 + 待裁决数），未强制 `SUMMARY:` 字面 token；SKILL.md 也未规定 `SUMMARY:` 必填。脚本 L87 grep 同时容忍两者，偏宽容。 | 低（不影响回收，但与 story 默认值不完全一致） |
| D3 | 状态 | story.md "待确认（意图层）"表中 Q1/Q2/Q3 仍标 `待确认`，但 story front matter `status: approved`。实现者按各自判断落地，未把 Q1-Q3 的最终决策回写到 story。 | 低（属流程瑕疵，非代码缺陷） |

无越界（未触碰范围外文件、未改契约、未伪造）。

---

## 五、待用户裁决项

1. **D1 脚本归宿**：是否接受"实体在 skill 目录 + `.opencode/` 软链"的折中？若坚持 story Q2 字面默认值，需把实体移回 `.opencode/`、skill 引用之；若接受现状，建议在 SKILL.md 补一句说明 symlink 兼容入口。
2. **D2 摘要 token**：是否强制报告必须出现 `SUMMARY:` 字面行？若是，需在 prompt 模板与 SKILL.md 同步加约束；若接受当前"result: + 末行摘要"即足够，建议把 story Q3 默认值改写以消除歧义。
3. **D3 story 待确认项闭环**：Q1-Q3 是否需要在 story.md 里翻为"已确认"并记录最终决策，以符合门禁闭环？

---

## 六、不漏 / 不重 / 不偏 / 不倚 / 不多 / 不少 自检

- **不漏**：4 条 AC + 6 条 Won't 全部覆盖；脚本与 SKILL.md 双向交叉核对（agent、format、message order、/tmp、permissions、scope 守卫）。
- **不重**：每条证据仅归到一条 AC，未重复计分。
- **不偏**：结论全部基于文件:行或命令输出；未采纳实现者自述。
- **不倚**：AC-2 未因"本报告即产物"而放宽——附注已声明脚本 wrapper 端到端未独立验证。
- **不多**：未追加 story 未要求的检查项作为 pass 条件。
- **不少**：未通过技术正确性替代需求符合度——D1/D2/D3 即来自需求层默认值与实现层差异。

---

SUMMARY: result=pass | fail 项数=0 | 待裁决项数=3
