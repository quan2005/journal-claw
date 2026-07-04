---
id: STORY-20260701-opencode-subagent-skill
title: '创建 opencode-subagent skill，指引 AI 使用 opencode CLI 作为独立 subagent 引擎'
status: verified
source: gate
level: L2
hypothesis_basis: intuition
design: ./design.md
created: 2026-07-01
related:
  - .agents/skills/verification-gate/SKILL.md
  - .agents/skills/requirements-gate/SKILL.md
  - .agents/skills/docs-maintenance/SKILL.md
  - .opencode/opencode-subagent.sh
---

# 创建 opencode-subagent skill，指引 AI 使用 opencode CLI 作为独立 subagent 引擎

> 一句话概括：**为在 Journal 仓库中执行独立子任务的 AI 编码助手，提供一条标准化、可复现的 opencode subagent 调用路径，减少上下文污染并保证验收/文档/需求梳理等任务的独立性。**

## 用户故事（Connextra）

作为 **在 Journal 仓库中执行门禁/验收/文档维护等需要独立上下文子任务的 AI 编码助手**，
当我 **遇到 verification-gate、docs-maintenance、requirements-gate 等需要 spawn 独立 subAgent 的场景时**，
我希望 **有一份标准化的 skill 指引我如何用 opencode CLI 来派发独立 subagent**，
以便 **每次调用都遵循同一套输入、输出、权限和错误处理约定，不再依赖单一 host Agent 实现或口头指令。**

## 真实用户问题（背景，讲故事）

Journal 的门禁体系（requirements-gate / verification-gate / docs-maintenance）都依赖"独立 subAgent"完成特定子任务。当前这些 skill 的 Step 3 通常写"用 Task 工具派发独立 subAgent"，但：

- **上下文隔离依赖 host 实现**：不同 host 对 Agent/Task 工具的上下文隔离、模型选择、工具权限控制不一致，导致同一份 skill 在不同宿主环境下行为可能不同。[证据：.agents/skills/verification-gate/SKILL.md Step 3]
- **调用方式无统一约定**：没有一份文档说明当选择 opencode 作为 subagent 后端时，应该如何构造 prompt、指定输出路径、回收报告、处理失败。[证据：仓库内无 opencode-subagent 相关 skill]
- **已验证能力未固化**：此前已实测 `opencode run` 可以 spawn 独立 subagent 会话、读取文件、运行 bash、写入报告，但经验只停留在一次性脚本，未沉淀为可复用技能。[证据：.opencode/opencode-subagent.sh]

### 现状失败模式

- AI 遇到需要 subagent 的任务时，只能依赖 host 原生 Agent 工具或临时写脚本，调用方式不一致。
- opencode 的调用参数（`--format`、`--agent`、`-f`、message 顺序）、权限配置、报告回收没有标准，容易踩坑（如 `--format stream` 不存在、`-f` 与 message 顺序错误导致 File not found）。[证据：.opencode/opencode-subagent.sh 迭代调试记录]
- 验收/门禁类任务若调用方式不标准，可能引入实现者自述或上下文泄漏，违背"独立验收"铁律。

## 成功标准（脊柱 Q4）

### 用户行为变化

做完后，AI 编码助手会：

- **从依赖 host 原生 Agent 工具或临时脚本**，变成**引用 `.agents/skills/opencode-subagent/SKILL.md` 即可按标准调用 opencode subagent**。
- **从每次重新摸索参数和输出解析**，变成**使用 skill 提供的 prompt 模板、脚本封装和错误处理清单**。
- **从报告落盘路径不统一**，变成**按 skill 约定写入指定位置并返回标准摘要**。

⚠️ 假设依据：以上基于当前门禁体系对"独立 subagent"的强依赖，以及 opencode CLI 已实测可用的判断（intuition）。验证方式是：用新 skill 成功执行一次 verification-gate / docs-maintenance / requirements-gate 子任务并产出可接受的报告。

## 验收标准（Given-When-Then）

### AC-1 — skill 可被 AI 发现并引用

- **Given** AI 在 Journal 仓库中收到需要 spawn 独立 subagent 的任务
- **When** AI 查看 `.agents/skills/opencode-subagent/SKILL.md`
- **Then** 该 skill 明确说明何时应使用 opencode subagent、何时仍用 host Agent 工具
- **And** 提供可拷贝的调用模板（命令、参数、输入文件格式、输出路径约定）

### AC-2 — 标准化调用能成功跑通

- **Given** 已安装 opencode CLI 且可联网/调用模型
- **When** AI 按 skill 指引调用 opencode subagent 执行一次验收或文档检查任务
- **Then** 子 agent 在独立会话中完成读取契约/代码、运行命令、写入报告
- **And** 主对话能回收报告路径和 `result: pass/fail` 摘要

### AC-3 — 不破坏现有门禁体系

- **Given** 现有 verification-gate / requirements-gate / docs-maintenance skill 已存在
- **When** 新 skill 入仓
- **Then** 不删除、不修改现有 skill 的默认流程
- **And** 新 skill 仅作为"可选 subagent 后端"补充说明

### AC-4 — 错误处理与边界清晰

- **Given** opencode subagent 调用失败（如文件不存在、权限被拒绝、模型不可用）
- **When** AI 按 skill 指引处理
- **Then** skill 提供明确的回退路径（重试、换 host Agent 工具、向用户报告）
- **And** 不隐瞒失败或伪造验收结论

## 三类边界（脊柱 Q5 · Won't · 输出闸必填）

- **不为哪些用户做**：不面向最终 Journal 终端用户；本 skill 的使用者是仓库内工作的 AI 编码助手和人类开发者，用于辅助开发流程。
- **不在哪些场景出现**：不替代 opencode CLI 本身；不修改 opencode 配置或模型 provider；不用于生产运行时服务编排（daemon / Electron 业务逻辑不走此 skill）。
- **不解决哪些相关但不同的问题**：不解决 opencode 模型质量、成本、响应速度问题；不解决 opencode CLI 安装或授权配置问题；不强制所有 subagent 任务必须走 opencode（host Agent 工具仍是合法路径）。

## 交棒清单（移交 design.md 的实现层问题）

- [ ] skill 目录结构：是否放 `.agents/skills/opencode-subagent/`？是否配套 `references/` 和 `assets/`？
- [ ] prompt 模板放在 skill 内还是复用 verification-gate 的 `references/subagent-prompt.md`？
- [ ] 调用脚本放在 skill 内、`.opencode/` 下、还是 `scripts/` 下？
- [ ] 输出路径约定：是否固定到 `stories/<slug>/verify-report-opencode.md`？是否支持轮次后缀？
- [ ] 是否需要为 opencode 配置 `external_directory` 权限以允许写入任意 story 目录？
- [ ] 失败/超时时的重试策略和回退到 host Agent 工具的触发条件？

## 待确认（意图层）

| #   | 问题                                                                                                        | 当前默认值                                                                                      | 状态   |
| --- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------ | ---------- | ------ |
| Q1  | 新 skill 是否只覆盖 verification-gate，还是同时覆盖 requirements-gate / docs-maintenance 的 subagent 调用？ | 同时覆盖三类门禁/文档任务的 opencode subagent 调用，提供通用模板                                | 已确认 |
| Q2  | 是否保留 `.opencode/opencode-subagent.sh` 作为参考实现，还是迁移到 skill 目录内？                           | 实体放在 `.agents/skills/opencode-subagent/`，`.opencode/opencode-subagent.sh` 作为兼容软链保留 | 已确认 |
| Q3  | 是否要求所有 opencode subagent 输出都必须包含 `result:` 和 `SUMMARY:`？                                     | 报告正文含 `result:` 行；最后一行必须是 `SUMMARY: result=...                                    | fail=N | pending=N` | 已确认 |

## INVEST 自检（输出闸记录）

- [x] **I** Independent：不依赖其他未做 story，仅新增 skill 文档和调用约定
- [x] **N** Negotiable：范围可裁剪，可先从 verification-gate 试点再扩展
- [x] **V** Valuable：降低 AI 调用 subagent 的出错率，保证门禁独立性
- [x] **E** Estimable：1-2 小时内可完成 skill 初版
- [x] **S** Small：单 skill + 可能一个脚本，不触碰业务代码
- [x] **T** Testable：AC-2 可直接用一次真实验收任务验证

## 门禁记录

| 轮次 | 日期       | Readiness | 主要缺口                       |
| ---- | ---------- | --------- | ------------------------------ |
| 1    | 2026-07-01 | 待澄清    | 待用户确认 Q1-Q3 及 story 范围 |
