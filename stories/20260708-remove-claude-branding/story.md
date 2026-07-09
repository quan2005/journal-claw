---
id: STORY-20260708-remove-claude-branding
title: 剔除产品内所有 Claude 元素（仅保留 Anthropic API 协议）
status: verified # draft → clarifying → approved → in_progress → verified
source: gate
level: L2
hypothesis_basis: data
design: ./design.md
created: 2026-07-08
related: [STORY-20260708-remove-cli-engines]
---

# 剔除产品内所有 Claude 元素

> 一句话概括：**把谨迹从"依附 Claude Code 生态的应用"变成品牌中立的独立 Agent 产品：`.claude` → `.agent`、`CLAUDE.md` → `AGENTS.md`、界面与代码中 Claude 字样清零，仅保留 Anthropic API 协议**

## 用户故事（Connextra）

作为 **谨迹的维护者兼用户**，
当我 **使用和迭代这个产品**，
我希望 **产品的目录约定、上下文文件名、界面文案不再带有 Claude 印记**，
以便 **产品身份独立、不与 Claude Code 生态耦合，同时继续通过 Anthropic API 协议调用模型**。

## 真实用户问题（背景，讲故事）

产品脱胎于 Claude Code 生态，至今残留大量 Claude 元素：daemon 读写 workspace 根的 `CLAUDE.md` 作为系统提示词；auto-lint 状态与 workspace 模板 skills 存于 workspace 内 `.claude/`；**全局 skills 与 plugins 缓存直接复用 Claude Code 本尊的 `~/.claude/`（与其生态共享）**；web 端文案/类型中散布 Claude 字样。这与"独立 Agent 产品"的定位不符。

[证据] `apps/daemon/src/server.ts:1356`（CLAUDE.md 读写）、`apps/daemon/src/skills/service.ts`（~/.claude/skills 与 plugins/cache）、`apps/daemon/src/auto_lint/service.ts:48`（workspace/.claude）、web 端 locales/AgentRunPanel 等多处。
[证据] 用户拍板：与 Claude Code 生态**彻底解耦**；存量数据**应用自动迁移一次**。

### 现状失败模式

- 现在：产品数据寄居在 `~/.claude/` 下，与 Claude Code 互相可见、互相影响；文件名/文案暴露非本品牌名。
- 为什么不够好：品牌不独立；共享目录使两个产品的 skills/缓存互相污染，行为不可控。

## 成功标准（脊柱 Q4）

- 产品运行时读写的目录/文件名含 "claude" 的数量：多处 → 0（`.agent/`、`AGENTS.md`、`~/.agent/`）。
- 用户界面文案中 Claude 字样：若干处 → 0（Anthropic 作为 API 协议/厂商名保留）。
- 与 Claude Code 生态的目录共享：共享 `~/.claude/` → 完全独立 `~/.agent/`。

## 验收标准（Given-When-Then）

### AC-1 — 新命名生效

- **Given** 用户在一个新 workspace 中使用产品全部功能（系统提示词、skills、auto-lint）
- **When** 查看磁盘产生的文件与目录
- **Then** 上下文文件为 `AGENTS.md`、workspace 数据目录为 `.agent/`、全局目录为 `~/.agent/`，无任何 `.claude`/`CLAUDE.md` 被创建或读取

### AC-2 — 存量数据自动迁移

- **Given** 用户现有 workspace/home 中存在旧的 `.claude/`、`CLAUDE.md`
- **When** 升级后首次启动应用
- **Then** 旧数据被自动迁移到新命名位置，原有系统提示词、skills、lint 状态全部继续可用，用户无需手动操作

### AC-3 — 界面无 Claude 字样

- **Given** 用户浏览应用所有界面（设置、About、Agent 面板、错误提示）
- **When** 查看文案
- **Then** 不出现 Claude 字样；模型厂商语境下的 "Anthropic" 正常保留

### AC-4 — Anthropic 协议调用不受影响

- **Given** 剔除完成后
- **When** 用户通过 Anthropic API 协议配置并调用模型完成一次 Agent run
- **Then** 行为与改动前一致

## 三类边界（Won't）

- **不为哪些用户做**：不考虑"希望继续与 Claude Code 共享 skills"的用法——已拍板彻底解耦。
- **不在哪些场景出现**：不改仓库自身的开发配置（本仓库根目录的 `CLAUDE.md`、`.claude/` 是给开发用 AI 工具看的，不属于产品运行时，不在本故事范围）。
- **不解决哪些相关但不同的问题**：不移除 Anthropic API 协议支持（明确保留）；不重命名与 Claude 无关的内部标识；外部引擎 adapter 的删除归 remove-cli-engines。

## 交棒清单（移交 design.md 的实现层问题）

- [ ] 全量清点运行时 claude 引用（daemon/web/workspace 模板/打包资源），区分运行时 vs 仓库开发配置
- [ ] 迁移策略细节：迁移时机、旧目录处理（复制后保留还是改名）、迁移失败的回退
- [ ] 与 remove-cli-engines 的实施顺序（先删 runtimes 可减少本故事清点面）
- [ ] skills 兼容性：SKILL.md 格式沿用（格式本身无品牌问题）

## 待确认（意图层）

| #   | 问题                      | 结论                       | 状态     |
| --- | ------------------------- | -------------------------- | -------- |
| Q1  | 与 Claude Code skills 生态 | 彻底解耦，用 `~/.agent/`   | 用户已答 |
| Q2  | 存量数据                  | 首次启动自动迁移一次       | 用户已答 |

## INVEST 自检（输出闸记录）

- [x] **I**（与 remove-cli-engines 有顺序建议但不强依赖）/ [x] N / [x] V / [x] E / [x] S / [x] T

## 门禁记录

| 轮次 | 日期       | Readiness | 主要缺口 |
| ---- | ---------- | --------- | -------- |
| 1    | 2026-07-08 | 可开发    | 无       |
