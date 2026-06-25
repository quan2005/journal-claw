# Component Recipes

Markdown for prose, headings, lists, tables, code. JSX for metric summaries, timelines, steps, verdicts, quotes, decisions, source lists, and structured semantics. One informative component beats several decorative wrappers.

---

## 会议纪要

```mdx
<Metrics
  title="会议概览"
  items={[
    { label: '参会人数', value: 6 },
    { label: '决策项', value: 2 },
    { label: '待办项', value: 4 },
  ]}
/>

<Timeline
  title="关键节点"
  items={[
    { time: '10:05', title: '需求对齐', description: '确认 Q3 目标优先级' },
    { time: '10:30', title: '方案讨论', description: '对比方案 A/B 实现成本' },
    { time: '11:00', title: '决策', description: '选定方案 B，两周试点' },
  ]}
/>

<Checklist
  title="后续动作"
  items={[
    { text: '李四：补齐权限边界说明（周三前）', state: 'todo' },
    { text: '王五：准备试点环境', state: 'todo' },
  ]}
/>
```

## 访谈整理

```mdx
<Quote
  text="最看重的是效果，不是效率。"
  author="冯灿威"
  context="新用户（<1 月），首次深度访谈"
/>

<InsightCard title="导入阶段流失严重">
  5 位受访者中 3 位提到首次导入材料时不知道系统处理进度，导致中途放弃。
</InsightCard>

<Callout tone="warning" title="待确认">
  受访者提到的「自动分类」功能可能指竞品而非本产品，需二次确认。
</Callout>
```

## 决策记录

```mdx
<DecisionRecord
  question="是否采用方案 B"
  decision="先采用方案 B 做两周试点"
  owner="张三"
  due="下周五"
  options={[
    { label: '方案 A', tradeoff: '成本低，但无法覆盖企业客户权限' },
    { label: '方案 B', tradeoff: '实现更重，但能支撑后续审计需求' },
  ]}
  rationale="企业客户审计需求已进入本季度目标，短期成本可接受。"
/>
```

## 项目追踪

```mdx
<MilestoneTimeline
  items={[
    { time: '6/10', title: '需求冻结', desc: '完成 PRD 评审' },
    { time: '6/20', title: '技术方案', desc: '架构评审通过' },
    { time: '7/05', title: '内测发布' },
  ]}
/>

<RACI
  rows={[
    { work: '前端实现', responsible: '李四', accountable: '张三', consulted: '设计组' },
    { work: '数据迁移', responsible: '王五', accountable: '张三', informed: '运维' },
  ]}
/>

<Kanban
  columns={[
    { title: '待办', items: [{ text: '权限边界文档', tags: ['P0'] }] },
    { title: '进行中', items: [{ text: '试点环境搭建' }] },
    { title: '已完成', items: [{ text: '需求评审' }] },
  ]}
/>
```

## 研究笔记

```mdx
<ComparisonMatrix
  columns={['维度', '方案 A', '方案 B', '方案 C']}
  rows={[
    { label: '实现成本', values: ['低', '中', '高'] },
    { label: '可扩展性', values: ['差', '良', '优'] },
    { label: '上线周期', values: ['1 周', '2 周', '4 周'] },
  ]}
/>

<Verdict
  title="推荐方案 B"
  summary="平衡成本与扩展性，满足 Q3 审计需求"
  confidence="高"
  status="已批准"
  variant="success"
/>
```

## 来源追溯

```mdx
<ReferenceList
  sources={[
    { path: '2605/raw/meeting.m4a', label: '会议录音', type: 'audio' },
    { path: '2605/raw/notes.txt', label: '粘贴文本', type: 'text' },
  ]}
/>

<CopyButton text="请基于这段会议素材整理决策、行动项和风险" label="复制整理提示" />
```

---

## 常见错误

### 1. 使用不存在的组件

```mdx
<!-- 错误：ActionTable、EvidenceCard、IncidentTimeline 不存在 -->
<ActionTable items={[...]} />

<!-- 正确：用 Checklist 或 Markdown 表格替代 -->
<Checklist title="行动项" items={[{ text: '李四：补文档（周三）', state: 'todo' }]} />
```

### 2. props 名拼错：用 heading 代替 title

```mdx
<!-- 错误：heading 不是有效 prop -->
<Metrics heading="概览" items={[...]} />

<!-- 正确：使用 title -->
<Metrics title="概览" items={[...]} />
```

### 3. Checklist items 结构错误

```mdx
<!-- 错误：直接传字符串数组 -->
<Checklist items={['任务一', '任务二']} />

<!-- 正确：传对象数组 -->
<Checklist items={[{ text: '任务一', state: 'todo' }, { text: '任务二', state: 'done' }]} />
```

### 4. 图表 data 结构错误

```mdx
<!-- 错误：用 name/count -->
<BarChart data={[{ name: 'A', count: 10 }]} />

<!-- 正确：用 label/value -->
<BarChart data={[{ label: 'A', value: 10 }]} />
```

### 5. 过度使用组件

```mdx
<!-- 错误：简单两行内容也包装成组件 -->
<Card title="备注"><p>下次会议周五</p></Card>

<!-- 正确：Markdown 足够时直接用 Markdown -->
> 备注：下次会议周五
```
