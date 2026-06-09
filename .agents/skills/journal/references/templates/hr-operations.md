# HR Operations Templates

## Family Boundary

- Recognition signal: 候选人、绩效、客户、活动、SOP、支持工单或运营指标。
- Expected output: 用证据、状态、责任和跟进动作支持运营判断。
- Routing rule: 以材料要完成的工作为准，不按单个关键词分类；会议产出的独立规格文档只有在用户明确要求时才切换家族。

## Subtypes

### customer-profile

- Classification signal: 客户画像相关素材，且主要任务与标题一致。
- Expected output: 客户画像；用证据、状态、责任和跟进动作支持运营判断。
- Required information: 客户背景/干系人地图、使用情况与健康信号、期望业务结果、已确认价值、阻塞与异议、续费/扩展风险、成功计划下一步。
- Recommended components: `Summary`（概括客户状态）、`Table`（记录需求、价值和风险）、`Steps`（安排下一次跟进）。
- Example: [客户画像](../template-examples/hr-operations/customer-profile.mdx)

### customer-success-followup

- Classification signal: 客户成功跟进相关素材，且主要任务与标题一致。
- Expected output: 客户成功跟进；用证据、状态、责任和跟进动作支持运营判断。
- Required information: 上次承诺与当前状态、使用变化、本轮交付价值、客户确认/反馈、未闭环风险、本轮续费/扩展信号、下次跟进触发条件。
- Recommended components: `Summary`（概括客户状态）、`Table`（记录需求、价值和风险）、`Steps`（安排下一次跟进）。
- Example: [客户成功跟进](../template-examples/hr-operations/customer-success-followup.mdx)

### customer-success

- Classification signal: 客户成功记录相关素材，且主要任务与标题一致。
- Expected output: 客户成功记录；用证据、状态、责任和跟进动作支持运营判断。
- Required information: 生命周期阶段、健康状态/风险等级、使用情况与采用率、已交付价值/业务结果、续费/扩展信号、干系人负责人、下一步成功计划。
- Recommended components: `Summary`（概括客户状态）、`Table`（记录需求、价值和风险）、`Steps`（安排下一次跟进）。
- Example: [客户成功记录](../template-examples/hr-operations/customer-success.mdx)

### event-plan

- Classification signal: 活动计划相关素材，且主要任务与标题一致。
- Expected output: 活动计划；用证据、状态、责任和跟进动作支持运营判断。
- Required information: 活动目标与成功指标、run-of-show 时间线、DRI/RACI、预算负责人和上限、供应商/场地交接、当日指挥链、风险触发条件与应急方案。
- Recommended components: `MilestoneTimeline`（安排运营节点）、`RACI`（明确协作责任）、`Table`（记录预算、风险和依赖）。
- Example: [活动计划](../template-examples/hr-operations/event-plan.mdx)

### kpi-tracking

- Classification signal: KPI 跟踪相关素材，且主要任务与标题一致。
- Expected output: KPI 跟踪；用证据、状态、责任和跟进动作支持运营判断。
- Required information: 指标定义/口径、当前值与数据源、目标/阈值、趋势与状态、偏差解释/驱动因素、调整动作、复盘 cadence 与指标负责人。
- Recommended components: `StatGroup`（显示少量关键数字）、`StatusBadge`（标记当前状态）、`Table`（关联异常和动作）。
- Example: [KPI 跟踪](../template-examples/hr-operations/kpi-tracking.mdx)

### partner-communication

- Classification signal: 合作伙伴沟通记录相关素材，且主要任务与标题一致。
- Expected output: 合作伙伴沟通记录；用证据、状态、责任和跟进动作支持运营判断。
- Required information: 共同目标/衡量方式、双方资源承诺、双方分工/RACI、依赖与决策权、未决请求、风险与升级路径、下一次同步时间。
- Recommended components: `MilestoneTimeline`（安排运营节点）、`RACI`（明确协作责任）、`Table`（记录预算、风险和依赖）。
- Example: [合作伙伴沟通记录](../template-examples/hr-operations/partner-communication.mdx)

### performance-review

- Classification signal: 绩效评估记录相关素材，且主要任务与标题一致。
- Expected output: 绩效评估记录；用证据、状态、责任和跟进动作支持运营判断。
- Required information: 目标/KR 与权重、结果证据与行为例子、差距/影响/根因、校准状态、反馈负责人、成长计划里程碑、下次 review 日期。
- Recommended components: `Table`（对应目标与证据）、`InsightCard`（提炼优势和成长点）、`Steps`（形成发展计划）。
- Example: [绩效评估记录](../template-examples/hr-operations/performance-review.mdx)

### recruiting-interview

- Classification signal: 招聘面试记录相关素材，且主要任务与标题一致。
- Expected output: 招聘面试记录；用证据、状态、责任和跟进动作支持运营判断。
- Required information: 岗位/级别/胜任力模型、候选人背景与约束、面试阶段状态、面试问题与能力维度、STAR 证据、录用风险与验证计划、决策负责人、跟进截止时间。
- Recommended components: `Table`（对应问题与行为证据）、`DecisionRecord`（保存评估结论）、`Callout`（标记证据不足）。
- Example: [招聘面试记录](../template-examples/hr-operations/recruiting-interview.mdx)

### sop

- Classification signal: SOP相关素材，且主要任务与标题一致。
- Expected output: SOP；用证据、状态、责任和跟进动作支持运营判断。
- Required information: 目的与成功标准、适用边界/不适用边界、触发条件、RACI、步骤：输入/动作/输出/责任人、异常处理与升级路径、版本负责人和复审周期。
- Recommended components: `Steps`（表达严格执行顺序）、`Checklist`（定义前置和验收）、`Callout`（突出危险步骤和回滚）。
- Example: [SOP](../template-examples/hr-operations/sop.mdx)

### support-ticket

- Classification signal: 支持工单相关素材，且主要任务与标题一致。
- Expected output: 支持工单；用证据、状态、责任和跟进动作支持运营判断。
- Required information: 问题/影响范围/严重级别、SLA/响应状态、环境/步骤/预期/实际、处理时间线、解决方案与验证结果、交接负责人、客户沟通记录与后续。
- Recommended components: `Timeline`（记录受理和处理过程）、`Callout`（突出复现条件）、`Checklist`（确认解决和回访）。
- Example: [支持工单](../template-examples/hr-operations/support-ticket.mdx)

## Family Quality Rules

- 事实、判断、未知项和下一步必须可区分。
- 只有真实存在的来源、负责人、日期和数字才能写成确定信息。
- Markdown 能表达清楚时不要强行使用组件。
