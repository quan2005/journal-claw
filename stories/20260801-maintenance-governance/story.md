---
id: STORY-20260801-maintenance-governance
title: '建立可执行的项目维护治理规则'
status: in_progress
source: user
level: L3
hypothesis_basis: repository-audit
design: ./design.md
created: 2026-08-01
---

# 建立可执行的项目维护治理规则

> 一句话概括：为个人维护者与多个 AI Agent 建立一套按小团队标准运行、能够由 CI 复现和强制的维护治理体系。

## 背景

用户要求由技术架构师负责 JournalClaw 的长期维护规则，并授权架构师在不逐项请示的情况下采用专业判断。只有对外发布、不可逆数据操作或产品方向改变仍需用户确认。

仓库只读审查发现现有规则已有较好基础，但文档、代码与自动化存在漂移：

- release-please manifest 停在 `0.11.3`，package 与最新正式 tag 为 `0.16.0`；现有 Release PR 拟被历史 breaking commits 推至 `1.0.0`。
- `docs/CONVENTIONS.md` 引用的 `.agents/skills/*` 已不存在，流程门禁不可执行。
- CI 文档声称响应 PR 与 master push，实际 workflow 仅响应 PR。
- `docs/ARCH.md` 和 `docs/final-state.md` 仍包含已经删除的外部 CLI engine/runtime 描述。
- `packages/contracts` 的单一契约源规则被 Web 本地镜像类型破坏。
- CI 尚未执行 Playwright、真实 Electron smoke，也未保存结构化测试证据。

## 成功标准

- 每类维护规则只有一个权威出处，其他文档只做链接或摘要。
- 所有硬性规则都有自动检查，或明确记录暂不能自动化的原因、人工责任人与证据格式。
- 普通 PR 能通过路径和风险选择最小充分验证；版本、数据迁移、权限、IPC 与公共契约变更始终执行高风险门禁。
- CI 是最终可复现硬门；独立 AI 验收负责需求符合性，不替代 CI。
- 版本保持 `0.x`：兼容性 `feat` 与 `fix` 升 patch，breaking change 升 minor；满足 1.0 准入条件前不得自动发布 `1.0.0`。
- workspace 用户数据升级具备升级前备份、幂等前向迁移、失败停写与恢复，至少支持从上一正式版本升级。

## 验收标准

### AC-1 — 权威文档边界明确

- **Given** 维护者需要查找一条架构、工程、兼容或设计规则
- **When** 从根 `AGENTS.md` 的文档地图进入
- **Then** 能到达该规则的唯一权威文档
- **And** 不存在两个当前文档同时声明自己是同一规则的真相源

### AC-2 — 版本与兼容策略可执行

- **Given** 仓库处于 `0.x` 阶段
- **When** 提交包含兼容功能、修复或 breaking change
- **Then** release tooling 分别产生 patch、patch 或 minor 版本
- **And** tag、根 package、workspace package 与 release baseline 一致

### AC-3 — 架构边界可自动检查

- **Given** Web、daemon、desktop 或 contracts 代码发生变化
- **When** 执行架构门禁
- **Then** 能检测绕过 runtimeClient/hostBridge、app 反向依赖、契约镜像、退休能力回潮及失效文档路径

### AC-4 — 测试按风险分级

- **Given** 一个 PR 的变更路径和风险已知
- **When** CI 运行
- **Then** 执行该风险所需的最小充分测试组合
- **And** 高风险变更包含真实 renderer、daemon 或 Electron 证据

### AC-5 — 写入和迁移通道分级

- **Given** Agent、用户、系统或迁移需要写入
- **When** 发生写操作
- **Then** 分别走 ChangeSet、Mutation Service、专用 Store 或 Migration 通道
- **And** Migration 具备备份、幂等、失败停写与恢复测试

### AC-6 — 门禁漂移被消除

- **Given** 当前文档、CI 和仓库路径
- **When** 运行一致性检查
- **Then** 不再引用不存在的 `.agents/skills/*` 或已删除 runtime
- **And** CI 触发条件、实际 jobs 与文档描述一致

## 边界

- 本 story 建立治理规则、检查和 CI 门禁，不实现产品功能。
- 不在本 story 内完成所有历史大文件拆分或全部 runtime contract 重构；只建立规则、阻止新增漂移并为存量债建账。
- 不自动合并 Release PR、不创建 tag、不发布 DMG；对外发布继续需要用户确认。
- 不以拍脑袋方式设置高覆盖率阈值；先建立基线和防回退，再为关键模块单独定阈值。

## 决策记录

- 2026-08-01：用户选择暂不进入 1.0。
- 2026-08-01：用户选择 `fix`/兼容 `feat` → patch，breaking → minor。
- 2026-08-01：用户选择数据升级前备份、幂等迁移、失败停写恢复，至少支持上一正式版本。
- 2026-08-01：用户授权架构师对其余维护规则采用专业判断，不再逐项请示。
