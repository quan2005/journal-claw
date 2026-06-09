# Technical Docs Templates

## Family Boundary

- Recognition signal: 接口、架构、命令、日志、错误、部署、迁移或代码审查。
- Expected output: 让未来的工程工作可以复现、验证、执行或回滚。
- Routing rule: 以材料要完成的工作为准，不按单个关键词分类；会议产出的独立规格文档只有在用户明确要求时才切换家族。

## Subtypes

### api-doc

- Classification signal: API 文档相关素材，且主要任务与标题一致。
- Expected output: API 文档；让未来的工程工作可以复现、验证、执行或回滚。
- Required information: 端点、鉴权、参数、请求、响应、错误、示例。
- Recommended components: `Table`（列出参数和错误）、`Steps`（说明调用顺序）、`CopyButton`（复制可执行请求）。
- Example: [API 文档](../template-examples/technical-docs/api-doc.mdx)

### architecture-doc

- Classification signal: 架构文档相关素材，且主要任务与标题一致。
- Expected output: 架构文档；让未来的工程工作可以复现、验证、执行或回滚。
- Required information: 系统上下文与外部依赖、C4 层级、需求、质量属性、依赖方向、关键失败模式、架构决策、未来演进约束。
- Recommended components: `Mermaid`（解释系统边界）、`DecisionRecord`（保存架构选择）、`ComparisonMatrix`（比较替代方案）。
- Example: [架构文档](../template-examples/technical-docs/architecture-doc.mdx)

### code-review

- Classification signal: 代码评审记录相关素材，且主要任务与标题一致。
- Expected output: 代码评审记录；让未来的工程工作可以复现、验证、执行或回滚。
- Required information: 变更文件与职责、发现、严重度、证据、行为变化与回归风险、必改项、已有/缺失测试、兼容性影响。
- Recommended components: `Table`（按严重度组织发现）、`Callout`（突出阻塞问题）、`Checklist`（确认修复和测试）。
- Example: [代码评审记录](../template-examples/technical-docs/code-review.mdx)

### code-snippet

- Classification signal: 代码片段说明相关素材，且主要任务与标题一致。
- Expected output: 代码片段说明；让未来的工程工作可以复现、验证、执行或回滚。
- Required information: 用途、代码、输入、输出、依赖、限制、来源。
- Recommended components: `CopyButton`（复制准确代码或命令）、`Callout`（说明适用边界）、`ReferenceList`（链接来源文件）。
- Example: [代码片段说明](../template-examples/technical-docs/code-snippet.mdx)

### debug-record

- Classification signal: 调试记录相关素材，且主要任务与标题一致。
- Expected output: 调试记录；让未来的工程工作可以复现、验证、执行或回滚。
- Required information: 可观察症状、环境、证据：日志/trace/metric/截图/命令输出、复现步骤与复现率、假设、已排除假设、根因、回归测试或监控告警。
- Recommended components: `Timeline`（保留调查顺序）、`Callout`（区分症状和假设）、`Checklist`（确认修复与回归）。
- Example: [调试记录](../template-examples/technical-docs/debug-record.mdx)

### deployment-runbook

- Classification signal: 部署 Runbook相关素材，且主要任务与标题一致。
- Expected output: 部署 Runbook；让未来的工程工作可以复现、验证、执行或回滚。
- Required information: 环境与前置条件、影响范围和冻结窗口、部署命令与参数、部署前验证、部署后验证、回滚步骤与触发条件、负责人和值班升级路径、风险。
- Recommended components: `Steps`（表达严格执行顺序）、`Checklist`（定义前置和验收）、`Callout`（突出危险步骤和回滚）。
- Example: [部署 Runbook](../template-examples/technical-docs/deployment-runbook.mdx)

### incident-rca

- Classification signal: 故障 RCA相关素材，且主要任务与标题一致。
- Expected output: 故障 RCA；让未来的工程工作可以复现、验证、执行或回滚。
- Required information: 事故摘要与当前状态、用户/数据/业务影响、时间线、发现方式、根因、促成因素、为什么没有更早发现、预防动作。
- Recommended components: `Timeline`（重建事故经过）、`Verdict`（概括影响和根因）、`Table`（追踪纠正措施）。
- Example: [故障 RCA](../template-examples/technical-docs/incident-rca.mdx)

### migration-guide

- Classification signal: 迁移指南相关素材，且主要任务与标题一致。
- Expected output: 迁移指南；让未来的工程工作可以复现、验证、执行或回滚。
- Required information: 迁移前状态、迁移后状态、分阶段步骤、兼容窗口和受影响方、数据备份/校验/恢复、切换/灰度/冻结窗口、回滚或前滚策略、验证。
- Recommended components: `Steps`（表达严格执行顺序）、`Checklist`（定义前置和验收）、`Callout`（突出危险步骤和回滚）。
- Example: [迁移指南](../template-examples/technical-docs/migration-guide.mdx)

### rfc-architecture

- Classification signal: 架构 RFC相关素材，且主要任务与标题一致。
- Expected output: 架构 RFC；让未来的工程工作可以复现、验证、执行或回滚。
- Required information: 问题陈述与成功标准、架构提案、替代方案与拒绝理由、系统边界、兼容性契约、迁移/灰度/回滚、开放问题、审议记录。
- Recommended components: `Mermaid`（解释系统边界）、`DecisionRecord`（保存架构选择）、`ComparisonMatrix`（比较替代方案）。
- Example: [架构 RFC](../template-examples/technical-docs/rfc-architecture.mdx)

### rfc

- Classification signal: RFC相关素材，且主要任务与标题一致。
- Expected output: RFC；让未来的工程工作可以复现、验证、执行或回滚。
- Required information: 问题陈述与成功标准、提案概要、替代方案与拒绝理由、决策状态、兼容性契约、迁移/灰度/回滚、开放问题、审议记录。
- Recommended components: `Mermaid`（解释系统边界）、`DecisionRecord`（保存架构选择）、`ComparisonMatrix`（比较替代方案）。
- Example: [RFC](../template-examples/technical-docs/rfc.mdx)

### technical-design

- Classification signal: 技术设计相关素材，且主要任务与标题一致。
- Expected output: 技术设计；让未来的工程工作可以复现、验证、执行或回滚。
- Required information: 问题背景与触发原因、功能需求与非功能需求、明确不解决什么、已确定/待确认/废弃方案、核心设计选择、验证计划、回滚或降级路径、未覆盖风险。
- Recommended components: `Mermaid`（解释系统边界）、`DecisionRecord`（保存架构选择）、`ComparisonMatrix`（比较替代方案）。
- Example: [技术设计](../template-examples/technical-docs/technical-design.mdx)

## Family Quality Rules

- 事实、判断、未知项和下一步必须可区分。
- 只有真实存在的来源、负责人、日期和数字才能写成确定信息。
- Markdown 能表达清楚时不要强行使用组件。
