# Project Docs Templates

## Family Boundary

- Recognition signal: 范围、需求、里程碑、依赖、验收、发布或变更。
- Expected output: 形成可长期引用并能指导协作或验收的项目文档。
- Routing rule: 以材料要完成的工作为准，不按单个关键词分类；会议产出的独立规格文档只有在用户明确要求时才切换家族。

## Subtypes

### changelog

- Classification signal: 变更日志相关素材，且主要任务与标题一致。
- Expected output: 变更日志；形成可长期引用并能指导协作或验收的项目文档。
- Required information: 版本、发布日期、新增、变更、修复、Breaking changes、用户/系统影响、迁移/兼容性。
- Recommended components: `Summary`（概括本次变化）、`Table`（说明影响和兼容性）、`Checklist`（检查迁移和沟通）。
- Example: [变更日志](../template-examples/project-docs/changelog.mdx)

### charter

- Classification signal: 项目章程相关素材，且主要任务与标题一致。
- Expected output: 项目章程；形成可长期引用并能指导协作或验收的项目文档。
- Required information: 授权目标、Sponsor/批准人、授权边界、预算/资源上限、决策权、升级路径、里程碑、治理风险。
- Recommended components: `MilestoneTimeline`（建立交付节奏）、`RACI`（明确跨角色责任）、`Table`（记录范围、依赖和风险）。
- Example: [项目章程](../template-examples/project-docs/charter.mdx)

### milestone-plan

- Classification signal: 里程碑计划相关素材，且主要任务与标题一致。
- Expected output: 里程碑计划；形成可长期引用并能指导协作或验收的项目文档。
- Required information: 目标、可验收里程碑、交付物、负责人、关键链/阻塞点、依赖、缓冲、决策门。
- Recommended components: `MilestoneTimeline`（组织阶段目标）、`Table`（记录依赖和成功信号）、`Verdict`（说明路线可行性）。
- Example: [里程碑计划](../template-examples/project-docs/milestone-plan.mdx)

### prd

- Classification signal: 产品需求文档相关素材，且主要任务与标题一致。
- Expected output: 产品需求文档；形成可长期引用并能指导协作或验收的项目文档。
- Required information: 目标用户、核心场景/JTBD、用户问题、非目标场景、可测试需求、验收标准、成功指标、开放问题。
- Recommended components: `Table`（保持需求和验收可扫描）、`DecisionRecord`（保存边界选择）、`ReferenceList`（回溯需求来源）。
- Example: [产品需求文档](../template-examples/project-docs/prd.mdx)

### project-plan

- Classification signal: 项目计划相关素材，且主要任务与标题一致。
- Expected output: 项目计划；形成可长期引用并能指导协作或验收的项目文档。
- Required information: 预期结果、范围内、范围外、成功指标、项目节奏/检查点、关键依赖、验收口径、下一步行动/负责人/截止时间。
- Recommended components: `MilestoneTimeline`（建立交付节奏）、`RACI`（明确跨角色责任）、`Table`（记录范围、依赖和风险）。
- Example: [项目计划](../template-examples/project-docs/project-plan.mdx)

### project-retrospective

- Classification signal: 项目复盘相关素材，且主要任务与标题一致。
- Expected output: 项目复盘；形成可长期引用并能指导协作或验收的项目文档。
- Required information: 时间线/事实、预期 vs 实际、未达到预期、系统性原因、可复用经验、修复实验、复发风险、跟进日期。
- Recommended components: `Timeline`（重建事件或阶段顺序）、`InsightCard`（提炼机制性教训）、`Table`（追踪改进项）。
- Example: [项目复盘](../template-examples/project-docs/project-retrospective.mdx)

### release-checklist

- Classification signal: 发布检查清单相关素材，且主要任务与标题一致。
- Expected output: 发布检查清单；形成可长期引用并能指导协作或验收的项目文档。
- Required information: 发布窗口、前置条件、发布检查项、灰度/回滚开关、监控信号、沟通对象、Go/No-Go 决策、回滚步骤。
- Recommended components: `Checklist`（形成可验证质量门）、`Table`（列出用例或发布责任）、`Steps`（明确执行和回滚顺序）。
- Example: [发布检查清单](../template-examples/project-docs/release-checklist.mdx)

### requirement-pool

- Classification signal: 需求池相关素材，且主要任务与标题一致。
- Expected output: 需求池；形成可长期引用并能指导协作或验收的项目文档。
- Required information: 需求ID、来源证据、可验收需求陈述、优先级、优先级理由、状态、冲突/依赖、下一步处理动作。
- Recommended components: `Table`（保持需求和验收可扫描）、`DecisionRecord`（保存边界选择）、`ReferenceList`（回溯需求来源）。
- Example: [需求池](../template-examples/project-docs/requirement-pool.mdx)

### roadmap

- Classification signal: 路线图相关素材，且主要任务与标题一致。
- Expected output: 路线图；形成可长期引用并能指导协作或验收的项目文档。
- Required information: 产品目标、主题/机会、现在、下一阶段、以后、假设、决策门槛、不做事项。
- Recommended components: `MilestoneTimeline`（组织阶段目标）、`Table`（记录依赖和成功信号）、`Verdict`（说明路线可行性）。
- Example: [路线图](../template-examples/project-docs/roadmap.mdx)

### technical-proposal

- Classification signal: 技术方案相关素材，且主要任务与标题一致。
- Expected output: 技术方案；形成可长期引用并能指导协作或验收的项目文档。
- Required information: 问题、不可变约束、方案选项、架构草图/数据流、决策状态、后果/权衡、验证计划、回滚方案。
- Recommended components: `ComparisonMatrix`（比较技术方案）、`DecisionRecord`（保存技术选择）、`Mermaid`（解释关键边界）。
- Example: [技术方案](../template-examples/project-docs/technical-proposal.mdx)

### test-plan

- Classification signal: 测试计划相关素材，且主要任务与标题一致。
- Expected output: 测试计划；形成可长期引用并能指导协作或验收的项目文档。
- Required information: 测试目标、测试范围、不测范围、风险模型、测试数据、风险驱动用例、入口/退出标准、缺陷分级。
- Recommended components: `Checklist`（形成可验证质量门）、`Table`（列出用例或发布责任）、`Steps`（明确执行和回滚顺序）。
- Example: [测试计划](../template-examples/project-docs/test-plan.mdx)

### user-story

- Classification signal: 用户故事相关素材，且主要任务与标题一致。
- Expected output: 用户故事；形成可长期引用并能指导协作或验收的项目文档。
- Required information: 用户角色、触发情境、前置条件、待完成任务、用户价值/业务价值、主流程、例外/边界、验收示例。
- Recommended components: `Table`（保持需求和验收可扫描）、`DecisionRecord`（保存边界选择）、`ReferenceList`（回溯需求来源）。
- Example: [用户故事](../template-examples/project-docs/user-story.mdx)

## Family Quality Rules

- 事实、判断、未知项和下一步必须可区分。
- 只有真实存在的来源、负责人、日期和数字才能写成确定信息。
- Markdown 能表达清楚时不要强行使用组件。
