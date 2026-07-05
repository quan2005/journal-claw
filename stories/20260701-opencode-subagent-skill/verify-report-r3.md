# verify-report-r3 — opencode-subagent skill 独立验收

> 轮次：R3 · 独立 subAgent（与实现者无关）· 本次会话即由 `opencode-subagent.sh` 经 `opencode run` spawn 产生，凭据为脚本生成的 prompt 文件 `/tmp/opencode-subagent-prompt-XXXXXX.md`（其结构与脚本 `printf` 模板逐行一致）。

result: pass

## 核对范围

- `.agents/skills/opencode-subagent/SKILL.md`（存在，113 行）
- `.agents/skills/opencode-subagent/opencode-subagent.sh`（存在，91 行，可执行，`bash -n` 语法通过）
- 关联验证项：`.opencode/opencode-subagent.sh` 软链、三个兄弟 gate skill 是否被改动、`story.md` 的 Won't 边界。

## 逐条 AC 结论

### AC-1 — skill 可被 AI 发现并引用 ✅ PASS

| 子句                                  | 证据                                                                                                                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文件存在且可被发现                    | `.agents/skills/opencode-subagent/SKILL.md:1-4` 含合法 frontmatter（`name` + `description`），在仓库 skills 列表中可枚举。                                                                                                               |
| 何时用 opencode subagent              | `SKILL.md:12-16`「When to Use」列明三类触发场景（独立 subagent 显式要求、host Agent 工具不可用/昂贵、需磁盘报告）。                                                                                                                      |
| 何时仍用 host Agent 工具              | `SKILL.md:18-21`「Do not use when」+ `SKILL.md:66`「Fall back to the host `Agent`/`Task` tool」+ `SKILL.md:15` 明确 host Agent/Task 为合法备选。                                                                                         |
| 可拷贝调用模板（命令/参数/输入/输出） | `SKILL.md:25-32` Core Pattern 四参数签名 `<story.md> [design.md] <scope> <output-report.md>`；`SKILL.md:46-56` Quick Reference 约定 message 顺序、`--agent build`、输出路径、format、permissions；`SKILL.md:42-44` 报告 SUMMARY 行格式。 |

### AC-2 — 标准化调用能成功跑通 ✅ PASS（运行时实证）

本次验收本身就是 AC-2 的活体证明：

1. 实现者侧调用 `opencode-subagent.sh`（脚本经 `bash -n` 通过、可执行位 `-rwxr-xr-x`）。
2. 脚本 `opencode-subagent.sh:50-76` 用 `mktemp` 渲染独立 prompt → `opencode-subagent.sh:78-82` 以 `opencode run "<message>" --format default --agent build -f <prompt>` spawn 独立会话。
3. 我（独立会话）确实完成了：读取 `story.md`（Read）、读取 SKILL.md/sh（Read）、运行 `ls`/`glob`/`grep`/`bash -n`（Bash）取证 —— 上下文独立于实现者。
4. 报告写入 `verify-report-r3.md`（本文件）并以 `SUMMARY:` 行收尾。

主对话回收链路（脚本 `opencode-subagent.sh:84-90`）：运行后校验报告文件存在 → 打印 `报告已生成：<path>` → `tail -n 1 | grep -E '^SUMMARY:'` 回吐摘要行。`result: pass/fail` 编码在 `SUMMARY: result=...` 内。✓

### AC-3 — 不破坏现有门禁体系 ✅ PASS

| 子句                       | 证据                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 不删除现有 skill           | `.agents/skills/` 下 `verification-gate` / `requirements-gate` / `docs-maintenance` 三目录均存在（`ls` 确认）。                                                                            |
| 不修改现有 skill 默认流程  | `grep 'opencode-subagent\|opencode run\|--agent build'` 在三个兄弟 skill 的 `*.md` 中 **0 命中**（13 命中全部落在 `opencode-subagent/SKILL.md` 自身）——新 skill 未侵入既有 gate 默认流程。 |
| 仅作可选 subagent 后端补充 | `SKILL.md:10`「headless subagent backend」；`SKILL.md:18-21` 明示 host Agent/Task 仍为合法路径，无强制接管语义。                                                                           |

### AC-4 — 错误处理与边界清晰 ✅ PASS

| 子句                                | 证据                                                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 回退路径（重试/换 host Agent/上报） | `SKILL.md:58-69`「Failure & Fallback」三步：修一处→重跑一次→{上报用户 / 回退 host Agent / 放弃走 inline}。                                                                                       |
| 不隐瞒失败/不伪造结论               | `SKILL.md:69`「Do not hide the failure, do not fabricate a report」；`SKILL.md:82-91`「Red Flags」+「verify before summarizing」；脚本 `opencode-subagent.sh:88-91` 报告缺失即 `exit 2` 并告警。 |
| 失败模式覆盖                        | `SKILL.md:93-101`「Troubleshooting」覆盖 File not found（`-f` 吞 message）、`/tmp` 权限拒绝、`--agent` 误用、报告缺失、scope 漂移五类典型失败。                                                  |

## 三类边界（Won't）核对

- **不面向终端用户**：`SKILL.md` frontmatter description 明示使用者是「AI coding helpers in the Journal repository」。✓
- **不替代 opencode CLI / 不改 provider 配置 / 非生产运行时**：skill 调用 opencode、不重新实现；`SKILL.md:54` 仅建议「adjust build agent permissions in opencode config」作为文档提示，skill/脚本本身不修改任何配置；定位为 dev-time 门禁辅助。✓
- **不解决模型质量/成本/速度、不解决安装/授权、不强制全走 opencode**：`SKILL.md:18-21`「Do not use when」含「check first with `which opencode`」；host Agent/Task 为并列合法路径。✓

## 越界 / 偏差清单

1. **【小瑕疵·不阻断】`SKILL.md:56` 表格行多出一个单元格**：该行为 `| Temporary prompt files | <text> | <text> |`（4 个 `|` = 3 单元格），而表头为 2 列。GFM 渲染会丢弃末尾「Do not confuse this with the **report output path**, which must be inside the repo.」一句。该警告内容已在 `SKILL.md:82-91` Red Flags（"The **report output** path starts with `/tmp/`"）覆盖，故不导致任何 AC 失败，建议合并为一格以保留信息。
2. story.md frontmatter `design: ./design.md`，但 story 目录实际无 `design.md`；验收 prompt 已声明「本任务无 design.md」，与本报告一致，不计偏差。

## 待用户裁决项

无。所有 AC 均有证据通过，偏差项 #1 为明确的小瑕疵，无需用户裁决（建议顺手修，但不阻断）。

## 铁律自检

- 未修改任何代码或契约（仅读取 + 写本报告）。✓
- 未替用户裁决；拿不准项为空。✓
- 所有结论均有 `文件:行` 或命令输出为证，无「应该实现了」式断言。✓
- 核对范围内文件均存在。✓

SUMMARY: result=pass | fail=0 | pending=0
