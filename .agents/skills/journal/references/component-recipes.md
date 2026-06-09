# Component Recipes

Use Markdown first. A recipe is justified only when its components make a repeated structure easier to scan or preserve a semantic contract that plain prose would blur.

## 1. Conclusion Plus Evidence

**Reader problem:** distinguish the author's interpretation from the source fact.

**Minimum set:** `Quote` or `SourceCard`, plus `InsightCard`.

```mdx
<Quote text="首次导入后，我不知道系统还要处理多久。" author="受访者 03" context="新用户访谈" />

<InsightCard title="解释">
  等待本身不是主要问题；缺少进度、预计时长和失败恢复信息才是流失信号。
</InsightCard>
```

**Markdown alternative:** use a blockquote followed by a paragraph beginning with `解释：`.

**Do not:** put an unsupported claim in `InsightCard` and present it as evidence.

## 2. Meeting Decision Plus Actions

**Reader problem:** preserve what was decided and who must act.

**Minimum set:** `DecisionRecord` and `Table`.

```mdx
<DecisionRecord
  question="首版是否支持自定义权限"
  decision="首版只提供三档预设权限"
  owner="产品负责人"
  due="2026-06-12"
  options={[
    { label: '预设权限', tradeoff: '上线快，覆盖主要场景' },
    { label: '自定义权限', tradeoff: '灵活，但审计和测试成本高' },
  ]}
  rationale="当前访谈只验证了三类稳定角色，自定义规则仍缺少需求证据。"
/>

<Table
  headers={['行动', '负责人', '截止', '状态']}
  rows={[
    ['补充角色边界说明', '产品负责人', '2026-06-12', 'open'],
    ['验证企业审计要求', '客户成功', '2026-06-14', 'open'],
  ]}
/>
```

**Markdown alternative:** use a `决定`段落 and a four-column action table.

**Do not:** create one `DecisionRecord` for every minor verbal agreement.

## 3. Project Status Plus Risks

**Reader problem:** see current delivery state without losing the risk response.

**Minimum set:** `StatGroup`, `StatusBadge`, and `Table`.

```mdx
<StatGroup>
  <Stat label="完成项" value={12} />
  <Stat label="剩余项" value={4} />
  <Stat label="高风险" value={1} />
</StatGroup>

当前状态：<StatusBadge status="at risk" tone="warning" />

<Table
  headers={['风险', '信号', '应对', '负责人']}
  rows={[['审批延迟', '法务尚未确认数据保留期', '拆分非阻塞发布范围', '项目经理']]}
/>
```

**Markdown alternative:** use three bold numbers, one status line, and a risk table.

**Do not:** use trend arrows when the direction is not based on comparable periods.

## 4. Option Comparison Plus Decision

**Reader problem:** compare alternatives and keep the final rationale.

**Minimum set:** `ComparisonMatrix` and `DecisionRecord`.

```mdx
<ComparisonMatrix
  columns={['交付时间', '审计能力', '迁移成本']}
  rows={[
    { label: '方案 A', values: ['2 周', '弱', '低'] },
    { label: '方案 B', values: ['4 周', '强', '中'] },
  ]}
/>

<DecisionRecord
  question="采用哪一套权限方案"
  decision="采用方案 B，先在一个企业客户中试点"
  rationale="审计是已验证需求；增加两周交付时间可接受。"
/>
```

**Markdown alternative:** use a comparison table followed by `决定 / 理由 / 复查日期`.

**Do not:** let the matrix silently imply a decision.

## 5. Incident Timeline Plus Corrective Actions

**Reader problem:** reconstruct what happened and verify recurrence prevention.

**Minimum set:** `Timeline`, `Table`, and `Checklist`.

```mdx
<Timeline
  heading="事件时间线"
  items={[
    { time: '10:12', title: '队列告警触发', description: '等待时间超过 10 分钟' },
    { time: '10:27', title: '暂停新导入', description: '避免积压继续扩大' },
    { time: '11:03', title: '服务恢复', description: '积压任务处理完成' },
  ]}
/>

<Table
  headers={['改进项', '负责人', '截止', '验证方式']}
  rows={[['增加队列水位限流', '平台组', '2026-06-16', '压测达到 2 倍峰值']]}
/>

<Checklist
  heading="关闭条件"
  items={[
    { text: '回归测试通过', state: 'todo' },
    { text: '告警演练完成', state: 'todo' },
  ]}
/>
```

**Markdown alternative:** use a timestamp list, corrective-action table, and task list.

**Do not:** mix planned corrective actions into the historical timeline.

## 6. Research Findings Plus Limitations

**Reader problem:** understand what evidence supports a finding and where it stops.

**Minimum set:** `Metrics`, `InsightCard`, `Callout`, and `ReferenceList`.

```mdx
<Metrics
  heading="样本"
  items={[
    { label: '访谈', value: 8, description: '其中 6 位为首月用户' },
    { label: '有效任务', value: 23, description: '排除测试账号' },
  ]}
/>

<InsightCard title="发现">用户更在意导入过程是否可解释，而不是绝对处理速度。</InsightCard>

<Callout tone="warning" title="限制">
  样本集中在桌面端知识工作者，不能外推到移动端或大规模团队。
</Callout>

<ReferenceList sources={[{ path: '2606/raw/interviews.txt', label: '访谈整理', type: 'text' }]} />
```

**Markdown alternative:** use `样本 / 发现 / 限制 / 来源`四个小节.

**Do not:** turn a small qualitative sample into a population percentage.

## 7. Technical Explanation Plus Diagram And Verification

**Reader problem:** connect architecture reasoning to an executable validation path.

**Minimum set:** `Mermaid`, `Steps`, and `Checklist`.

```mdx
<Mermaid
  chart={`flowchart LR
    UI[React UI] --> IPC[Tauri IPC]
    IPC --> Rust[Rust command]
    Rust --> Files[Workspace files]`}
  caption="写入日志的主要边界"
/>

<Steps
  heading="验证路径"
  items={[
    { title: '准备固定输入', description: '使用同一份本地素材' },
    { title: '执行真实链路', description: '通过前端 IPC 调用，而不是直接写文件' },
    { title: '检查结果', description: '验证文件、事件和界面状态一致' },
  ]}
/>

<Checklist
  items={[
    { text: '错误路径有可读反馈', state: 'todo' },
    { text: '回归测试覆盖边界', state: 'todo' },
  ]}
/>
```

**Markdown alternative:** use a text data-flow list, numbered steps, and task list.

**Do not:** add a diagram that merely repeats filenames without explaining boundaries.

## 8. Learning Note Plus Application

**Reader problem:** move from source summary to understanding and practice.

**Minimum set:** `Definition`, `MythFact`, and `Steps`.

```mdx
<Definition term="检索练习" description="在不查看材料的情况下主动回忆，再用原文校正遗漏。" />

<MythFact
  items={[
    {
      myth: '反复阅读会自动形成长期记忆',
      fact: '主动提取通常比被动重读更能暴露理解缺口',
      reason: '回忆失败本身提供了下一轮学习信号',
    },
  ]}
/>

<Steps
  heading="本周应用"
  items={[
    { title: '合上材料写出三个要点' },
    { title: '对照原文标记遗漏' },
    { title: '两天后再次回忆' },
  ]}
/>
```

**Markdown alternative:** use `定义 / 常见误解 / 应用步骤`.

**Do not:**把作者观点和自己的应用计划写成同一层事实.

## 9. Article Outline Plus Source Checks

**Reader problem:** keep a draft's argument structure separate from missing evidence.

**Minimum set:** `Toc`, `ReferenceList`, and `Checklist`.

```mdx
<Toc
  heading="文章结构"
  items={[
    { label: '01', title: '问题', description: '为什么导入等待会破坏信任' },
    { label: '02', title: '机制', description: '进度、预期和恢复如何降低不确定性' },
    { label: '03', title: '实践', description: '产品应显示哪些状态' },
  ]}
/>

<ReferenceList
  sources={[{ path: '2606/raw/research-notes.txt', label: '研究素材', type: 'text' }]}
/>

<Checklist
  heading="发布前"
  items={[
    { text: '每个关键结论都有来源', state: 'todo' },
    { text: '无法验证的数字已删除或标注', state: 'todo' },
  ]}
/>
```

**Markdown alternative:** use a numbered outline, source list, and task list.

**Do not:** use `Toc` as a decorative opening when the draft has only two sections.

## 10. Source Traceability And Local Navigation

**Reader problem:** move from synthesis back to raw material and related knowledge.

**Minimum set:** `ReferenceList`, `RelatedEntry`, and optionally `RelatedIdentity`.

```mdx
<ReferenceList
  sources={[
    { path: '2606/raw/meeting.m4a', label: '会议录音', type: 'audio' },
    { path: '2606/raw/notes.txt', label: '现场笔记', type: 'text' },
  ]}
/>

相关决策：<RelatedEntry path="2605/28-权限模型评审.mdx" label="权限模型评审" />

相关项目：<RelatedIdentity path="identities/权限系统.md" label="权限系统" />
```

**Markdown alternative:** use ordinary links only when they resolve through the same local-file navigation path.

**Do not:** fabricate a source path or replace a missing source with a generic placeholder.
