---
id: STORY-20260708-remove-cli-engines
title: 移除外部 Coding Agent 引擎支持，只保留内置引擎
status: verified # draft → clarifying → approved → in_progress → verified
source: gate
level: L2
hypothesis_basis: data # 用户明确：外部引擎从未被使用，无历史数据
design: ./design.md
created: 2026-07-08
related: []
---

# 移除外部 Coding Agent 引擎支持

> 一句话概括：**为独立维护者砍掉从未被使用的外部引擎适配层，把维护精力收敛到唯一的内置 Agent 引擎上**

## 用户故事（Connextra）

作为 **谨迹的独立维护者兼唯一用户**，
当我 **迭代 Agent 相关功能时被 claude / codex / opencode 三个外部 CLI adapter 的检测、认证、流解析与测试拖慢**，
我希望 **产品中不再存在外部 Coding Agent 引擎的任何入口与代码**，
以便 **只专注做好内置引擎一个，降低每次改动的兼容维护成本**。

## 真实用户问题（背景，讲故事）

产品当前内建 pi 引擎之外，还挂着 claude / codex / opencode 三个外部 CLI adapter（集中在 `apps/daemon/src/runtimes/`：可执行检测、认证、三套流协议解析及配套测试，web 端有引擎选择 UI 与设置）。这些适配层**从未被实际使用，没有任何历史 run 数据**，却在每次 Agent 功能迭代时都要陪跑：改接口要同步三个 adapter，测试矩阵×4。维护成本纯支出、零收益。

[证据] 用户原话："兼容维护成本太高，我只想专注做好一个就好了。没有历史数据，根本没用起来。"
[证据] `apps/daemon/src/runtimes/` 下 defs/stream/detection/auth 等 20+ 文件均为外部引擎专属。

### 现状失败模式

- 现在怎么解决：迭代时手动同步维护三个 adapter，或任其腐烂。
- 为什么不够好：改动面被放大数倍，测试与心智负担与实际使用价值（零）完全不成比例。
- 数据支撑：外部引擎使用次数为 0。

## 成功标准（脊柱 Q4）

### 用户行为变化

- 发起 Agent run 时可选引擎：4 个 → 1 个（内置引擎，无选择环节）。
- 维护者迭代 Agent 功能时需要同步修改的引擎适配代码：4 套 → 1 套。
- 外部引擎相关代码与测试文件数：20+ → 0。

⚠️ 假设依据：data（使用次数为 0，无历史数据需要兼容）。

## 验收标准（Given-When-Then）

### AC-1 — 界面上不再出现外部引擎

- **Given** 用户打开谨迹的任何界面（Agent 发起、设置等）
- **When** 浏览所有与 AI 引擎相关的选项
- **Then** 看不到 claude / codex / opencode 或任何"外部引擎/CLI 引擎"的选项、文案与配置项
- **And** 发起 Agent run 无需（也无法）选择引擎，直接使用内置引擎

### AC-2 — 内置引擎功能完好

- **Given** 外部引擎支持已移除
- **When** 用户用内置引擎发起并完成一次 Agent run
- **Then** run 的发起、流式输出、结果展示与移除前行为一致

### AC-3 — 代码库不再包含外部引擎实现

- **Given** 移除完成后的代码库
- **When** 检索 claude / codex / opencode adapter 相关实现（含 `apps/daemon/src/runtimes/` 的外部引擎 defs、stream 解析、检测、认证及其测试）
- **Then** 无残留实现代码与死测试；全量测试与构建通过

## 三类边界（Won't）

- **不为哪些用户做**：不考虑"正在使用外部引擎的用户"的迁移/兼容——该用户群不存在（使用次数为 0）。
- **不在哪些场景出现**：不做任何弃用过渡期、开关或隐藏配置保留外部引擎；不保留"未来重新接入外部引擎"的抽象占位——需要时再加回来。
- **不解决哪些相关但不同的问题**：不在本故事内改进内置引擎本身的能力；不动开发工作流中作为工具使用的 codex/opencode CLI（那是维护者的开发工具，与产品无关）；不清理与外部引擎无关的其他历史代码。

## 交棒清单（移交 design.md 的实现层问题）

- [ ] 删除范围清点：`apps/daemon/src/runtimes/` 内外部引擎专属 vs 内置引擎复用的公共部分如何切分
- [ ] settings schema 中引擎相关字段的移除与旧配置文件的容错读取
- [ ] web 端引擎选择组件、runtimeClient 相关接口的同步移除
- [ ] 文档同步：docs/ARCH.md 铁律 12 提及 CLI adapters，需随本次改动更新

## 待确认（意图层）

| #   | 问题             | 当前默认值                     | 状态     |
| --- | ---------------- | ------------------------------ | -------- |
| Q1  | 历史 run 数据    | 无数据，无需兼容               | 用户已答 |
| Q2  | 残留设置的处理   | 容错忽略即可（无过渡期）       | 默认接受 |

## INVEST 自检（输出闸记录）

- [x] **I** Independent：纯删除，不依赖其他故事
- [x] **N** Negotiable：删除批次可拆分
- [x] **V** Valuable：直接消灭 4 倍维护面
- [x] **E** Estimable：删除范围可清点
- [x] **S** Small：1 sprint 内可完成
- [x] **T** Testable：AC 均可通过 UI 检查、检索与全量测试断言

## 门禁记录

| 轮次 | 日期       | Readiness | 主要缺口                     |
| ---- | ---------- | --------- | ---------------------------- |
| 1    | 2026-07-08 | 可开发    | 无——待用户确认 approved 即可 |
