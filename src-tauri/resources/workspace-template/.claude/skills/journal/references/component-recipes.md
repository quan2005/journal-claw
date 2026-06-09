# Component Recipes

## Markdown Before Components

Use Markdown for ordinary prose, headings, lists, tables, and code. Use typed JSX directly for hero openings, metric summaries, timelines, steps, verdicts, quotes, FAQ, resource lists, notices, final summaries, and richer semantic structures. Prefer one component that carries information over several decorative wrappers.

## Evidence Quote

```mdx
<Quote
  text="第 3 轮后模型经常答非所问。"
  author="张荣立"
  context="多轮对话场景，缺少节点级可观测性"
/>
```

## Structured Summary

```mdx
<Hero title="用户研究结论" subtitle="效果优先与节点级可观测性是当前最强信号。" />

<Metrics
  heading="样本概览"
  items={[{ label: '访谈', value: 3, description: '覆盖新用户与成长期用户' }]}
/>
```

## Decision Review

Use:

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
  rationale="企业客户审计需求已经进入本季度目标，短期实现成本可以接受。"
/>
```

## Action Extraction

Use `ActionTable` only when there are at least two actions or owner/deadline/source fields matter.

```mdx
<ActionTable
  items={[
    { action: '补齐权限边界说明', owner: '李四', due: '周三', status: 'open', source: '需求评审' },
  ]}
/>
```

## Research Evidence

Use `EvidenceCard` for source-backed facts and `InsightCard` for interpretation.

```mdx
<EvidenceCard title="用户流失集中在导入阶段" source="用户访谈 03">
  5 位受访者中有 3 位提到首次导入材料时不知道系统处理进度。
</EvidenceCard>
```

## Incident Review

Use `IncidentTimeline` plus `RiskMatrix`.

```mdx
<IncidentTimeline
  items={[{ time: '10:12', title: '告警触发', impact: '导入任务排队时间超过 10 分钟' }]}
/>
```

## Source Traceability

Use `ReferenceList` near the end when a note relies on multiple sources.

```mdx
<ReferenceList
  sources={[
    { path: '2605/raw/meeting.m4a', label: '会议录音', type: 'audio' },
    { path: '2605/raw/notes.txt', label: '粘贴文本', type: 'text' },
  ]}
/>
```

## Copyable Exact Text

Use `CopyButton` only for exact snippets that the reader is likely to reuse, such as prompts, commands, or canonical wording. Never use it to mutate journal content.

```mdx
<CopyButton text="请基于这段会议素材整理决策、行动项和风险" label="复制整理提示" />
```
