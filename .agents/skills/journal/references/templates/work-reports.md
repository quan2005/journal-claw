# Work Reports Templates

## Family Boundary

- Recognition signal: 周期、完成项、指标、阻塞、风险、下阶段计划。
- Expected output: 让读者快速判断本周期结果、变化、风险和所需支持。
- Routing rule: 以材料要完成的工作为准，不按单个关键词分类；会议产出的独立规格文档只有在用户明确要求时才切换家族。

## Subtypes

### daily-report

- Classification signal: 日报相关素材，且主要任务与标题一致。
- Expected output: 日报；让读者快速判断本周期结果、变化、风险和所需支持。
- Required information: 已完成且可验证的产出、关键事实/数据、未完成原因、阻塞、明日 Top 3、需要支持。
- Recommended components: `StatGroup`（显示少量关键数字）、`StatusBadge`（标记当前状态）、`Table`（关联异常和动作）。
- Example: [日报](../template-examples/work-reports/daily-report.mdx)

### executive-summary

- Classification signal: 管理层摘要相关素材，且主要任务与标题一致。
- Expected output: 管理层摘要；让读者快速判断本周期结果、变化、风险和所需支持。
- Required information: 一句话答案、关键指标、财务/业务影响、风险、可选方案、决策请求、决策期限。
- Recommended components: `Metrics`（解释重要指标）、`Verdict`（先给管理判断）、`Table`（展开风险和请求）。
- Example: [管理层摘要](../template-examples/work-reports/executive-summary.mdx)

### monthly-quarterly-report

- Classification signal: 月度/季度汇报相关素材，且主要任务与标题一致。
- Expected output: 月度/季度汇报；让读者快速判断本周期结果、变化、风险和所需支持。
- Required information: 汇报周期、比较基线、目标、关键指标、相对基线变化、风险、领导层请求。
- Recommended components: `Metrics`（解释重要指标）、`Verdict`（先给管理判断）、`Table`（展开风险和请求）。
- Example: [月度/季度汇报](../template-examples/work-reports/monthly-quarterly-report.mdx)

### monthly-report

- Classification signal: 月报相关素材，且主要任务与标题一致。
- Expected output: 月报；让读者快速判断本周期结果、变化、风险和所需支持。
- Required information: 目标与贡献、关键指标、资源投入、重大变化、停止/加码/保持、风险、需要决策。
- Recommended components: `Metrics`（解释重要指标）、`Verdict`（先给管理判断）、`Table`（展开风险和请求）。
- Example: [月报](../template-examples/work-reports/monthly-report.mdx)

### okr-tracking

- Classification signal: OKR 跟踪相关素材，且主要任务与标题一致。
- Expected output: OKR 跟踪；让读者快速判断本周期结果、变化、风险和所需支持。
- Required information: 目标结果、KR 基线/当前/目标、当前进度、信心依据、阻塞、KR 调整请求、下一步行动。
- Recommended components: `Metrics`（呈现 KR 进展）、`StatusBadge`（标记信心或状态）、`Table`（记录偏差与动作）。
- Example: [OKR 跟踪](../template-examples/work-reports/okr-tracking.mdx)

### performance-review

- Classification signal: 绩效复盘相关素材，且主要任务与标题一致。
- Expected output: 绩效复盘；让读者快速判断本周期结果、变化、风险和所需支持。
- Required information: 周期、角色期待、目标、行为证据、业务影响、成长点、反馈、成长动作与支持。
- Recommended components: `Table`（对应目标与证据）、`InsightCard`（提炼优势和成长点）、`Steps`（形成发展计划）。
- Example: [绩效复盘](../template-examples/work-reports/performance-review.mdx)

### project-progress

- Classification signal: 项目进展汇报相关素材，且主要任务与标题一致。
- Expected output: 项目进展汇报；让读者快速判断本周期结果、变化、风险和所需支持。
- Required information: 里程碑验收状态、最新进展、验收证据、关键路径变化、范围变化、依赖、风险、需要支持。
- Recommended components: `MilestoneTimeline`（显示里程碑状态）、`StatusBadge`（标记整体健康度）、`Table`（列出风险和依赖）。
- Example: [项目进展汇报](../template-examples/work-reports/project-progress.mdx)

### quarterly-report

- Classification signal: 季报相关素材，且主要任务与标题一致。
- Expected output: 季报；让读者快速判断本周期结果、变化、风险和所需支持。
- Required information: 季度战略目标、关键指标、战略取舍、资源配置变化、重大变化、风险暴露、下季度押注。
- Recommended components: `Metrics`（解释重要指标）、`Verdict`（先给管理判断）、`Table`（展开风险和请求）。
- Example: [季报](../template-examples/work-reports/quarterly-report.mdx)

### risk-focused-report

- Classification signal: 风险专项汇报相关素材，且主要任务与标题一致。
- Expected output: 风险专项汇报；让读者快速判断本周期结果、变化、风险和所需支持。
- Required information: 风险、概率、影响半径、严重度、触发信号、应对、残余风险、升级阈值。
- Recommended components: `Table`（按概率、影响、信号和应对排序）、`Verdict`（给出总体风险判断）、`DecisionRecord`（保存风险接受决定）。
- Example: [风险专项汇报](../template-examples/work-reports/risk-focused-report.mdx)

### status-report

- Classification signal: 状态汇报相关素材，且主要任务与标题一致。
- Expected output: 状态汇报；让读者快速判断本周期结果、变化、风险和所需支持。
- Required information: 当前健康状态、上次状态、状态变化、系统约束、风险、解除约束所需支持、下一步。
- Recommended components: `StatGroup`（显示少量关键数字）、`StatusBadge`（标记当前状态）、`Table`（关联异常和动作）。
- Example: [状态汇报](../template-examples/work-reports/status-report.mdx)

### weekly-report

- Classification signal: 周报相关素材，且主要任务与标题一致。
- Expected output: 周报；让读者快速判断本周期结果、变化、风险和所需支持。
- Required information: 本周可验证成果、结果指标、前置指标、项目进展、管理层需关注、风险、下周杠杆动作。
- Recommended components: `Metrics`（解释重要指标）、`Verdict`（先给管理判断）、`Table`（展开风险和请求）。
- Example: [周报](../template-examples/work-reports/weekly-report.mdx)

## Family Quality Rules

- 事实、判断、未知项和下一步必须可区分。
- 只有真实存在的来源、负责人、日期和数字才能写成确定信息。
- Markdown 能表达清楚时不要强行使用组件。
