---
name: verification-gate
description: "验收门禁（Verification Gate）——与 requirements-gate 成对的下游环节：需求门禁确保做对的东西，验收门禁确保做的东西是对的。开发完成、准备 git commit、或想宣称'做完了'之前，凡存在与本次改动相关、status: approved 但尚未 verified 的 story.md，必须使用本技能。注意：测试全部通过不等于验收通过——技术正确性归 verification-before-completion，需求符合度归本技能。"
---

# 验收门禁 Verification Gate

## 为什么存在

实现者核对自己的代码，结论永远是"都实现了"——不是因为不诚实，而是因为实现者会无意识地按自己写代码时的理解去解读 AC，盲点和实现一起被继承。**自证清白无效**，所以验收必须由一个没参与实现、上下文干净的独立 subAgent 完成。

与相邻技能的边界，三者各管一段、互不耦合：

| 技能 | 回答的问题 | 性质 |
|---|---|---|
| verification-before-completion | 测试跑了吗、编译过了吗 | 技术正确性（代码 review） |
| **verification-gate（本技能）** | 实现和契约对得上吗 | 需求符合度（需求 review） |
| finishing-a-development-branch | 分支怎么收尾 | git 流程 |

测试全绿但做错了需求，是最贵的一种"完成"。

## 双契约基准

本技能核对的是**两层契约**，六字标准的每个字对照不同的基准：

| 契约 | 视角 | 校验什么 |
|---|---|---|
| **story.md** | 用户意图 | 做的是不是用户要的：AC（不漏/不偏/不少）、非目标（不多） |
| **design.md** | 实现方案 | 做的是不是设计说的：方案范围、NFR/依赖落实（不偏/不多） |

story.md 是主契约（`status` 落在它上面），design.md 是其附属方案契约。design.md 不存在时（如 L1 轻量需求无需方案细化），仅以 story.md 为基准，越界检查以 story 的非目标为准。

## 触发与放行判定

| 情形 | 动作 |
|---|---|
| 用户标注 `[skip-gate]` / `[跳过门禁]` | 放行，正常 commit |
| 找不到与本次改动相关的 story.md | 放行（不是所有 commit 都对应一个 story） |
| 相关 story 已 `status: verified` 且其后无新功能性改动 | 放行 |
| 存在相关、`status: approved` 但未 verified 的 story | **进入验收流程** |

## 流程

### Step 1 — 定位契约

用 `rga`（或 grep）在 `stories/` 及 brainstorming 输出目录中检索 `status: approved` 的 story.md，并核对开发计划首行引用的路径。找到 story 后，读其 frontmatter 的 `design` 字段定位配套 design.md。多个候选时以与本次 diff 实际相关者为准。

### Step 2 — 圈定核对范围

确定 subAgent 要看的改动：自 story 进入 approved 后的 git diff（含 staged 与 unstaged），或实现文件清单。**宁大勿小**——范围圈小了，"不多"（越界检查）就成了摆设。

### Step 3 — spawn 独立验收 subAgent

用 Task 工具派发独立 subAgent，提示词以 `references/subagent-prompt.md` 为底，仅填入五样输入：

1. story.md 路径（意图基准）
2. design.md 路径（方案基准；无则注明"本任务无 design.md"）
3. 核对范围（diff 或文件清单）
4. 报告输出路径（story 同目录）
5. 轮次

**输入里禁止夹带任何实现者自述**——不写"我已实现全部 AC"、不附实现思路、不解释取舍。subAgent 的结论只能来自契约与代码本身。把辩护词喂给裁判，独立性就没了，这正是本技能存在的理由。

subAgent 按 `references/six-criteria.md` 的六字标准逐项核对，产出报告（模板见 `assets/verify-report-template.md`）。

### Step 4 — 处置报告

- **result: pass** → 主对话把 story.md 的 `status` 翻为 `verified`（subAgent 只出报告不翻状态，裁判与书记员分离），随后继续 commit
- **result: fail** → 报告留存，**不翻 status**；向用户列出偏差与修复建议，修复后发起新一轮验收
- **报告含「待用户裁决」项**（如轻微越界的顺手改动）→ 用户接受的项**先回写进对应契约再翻 verified**：影响"要什么"的回写 story.md（AC/非目标），影响"怎么做"的回写 design.md（范围）。契约不允许与实现长期背离；用户不接受则按 fail 处理

### Step 5 — 多轮验收与留痕

每轮一份独立报告：首轮 `verify-report.md`，第 N 轮 `verify-report-r{N}.md`，frontmatter 记 `round`。旧报告不删不改——它是"修了什么、为什么修"的留痕。目录形态：

```
stories/20260610-xxx/
├── story.md            # status: approved → verified（全过时）
├── design.md           # 方案契约（如有）
├── verify-report.md     # 第 1 轮
└── verify-report-r2.md  # 第 2 轮（如有）
```

建议把报告随代码一并 commit，验收记录进版本史。

## Rationalizations — 想抄近道时读这里

| 借口 | 纠正 |
|---|---|
| "测试都过了，不用验收" | 测试 = 技术正确性，验收 = 需求符合度。测试通过 ≠ AC 覆盖，更测不出"不多" |
| "我刚写的代码，自己核对更快" | 自证清白无效。实现者按自己的理解解读 AC，盲点随实现一起继承 |
| "只看 story 就行，design 不用对" | 越界（不多）和方案落实（不偏）要对 design。漏掉它，超范围实现查不出来 |
| "diff 很小，目测一下就行" | 小 diff 也要 AC 映射与证据。目测不留痕，下一轮无从对比 |
| "这条 AC fail 了但不重要" | 重要性归用户判。报告留存、不翻 status，把偏差摆给用户 |
| "顺手的小重构不算越界" | 归属不了任何 AC/范围的功能性改动都进越界清单，由用户裁决 |
| "subAgent 太重，我自己照提示词跑一遍" | 同一上下文跑就是自检。独立性来自干净的上下文，不是提示词 |
| "用户在催 commit" | `[skip-gate]` 是用户的权利，不是模型替用户行使的权利 |

## Verification — 翻 verified 前自检

- [ ] 报告由独立 subAgent 在干净上下文中产出，输入未夹带实现者自述
- [ ] 每条 AC 有结论 + 证据（`文件:行` 或可复现的命令输出）
- [ ] 越界检查（不多）已对照 story 非目标 +（如有）design 范围
- [ ] design.md 存在时，方案落实情况（NFR/依赖）已核对
- [ ] result: pass，且「待用户裁决」项已清零或已回写进对应契约
- [ ] fail 时未翻 status，偏差与修复建议已呈给用户

---

> 安装与 hook 注册说明见同目录 `INSTALL.md`（面向人类读者，不属于技能上下文）。
