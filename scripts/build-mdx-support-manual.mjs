import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const workspaceRoot = '/Users/yanwu/Documents/journal'
const manualRoot = path.join(workspaceRoot, 'topics/mdx-support-manual')
const templateRoot = path.join(manualRoot, 'templates')
const componentRoot = path.join(manualRoot, 'components')

const projectSource = (relPath) => `../../Projects/github/journal/${relPath}`
const q = (value) => JSON.stringify(value)
const jsxString = (value) => `{${JSON.stringify(value)}}`

const refs = {
  registry: projectSource('.agents/skills/journal/references/template-registry.md'),
  writingRules: projectSource('.agents/skills/journal/references/writing-rules.md'),
  componentCatalog: projectSource('.agents/skills/journal/references/component-catalog.md'),
  componentRecipes: projectSource('.agents/skills/journal/references/component-recipes.md'),
  mdxIndex: projectSource('src/components/mdx/index.ts'),
  mdxCss: projectSource('src/styles/mdx.css'),
  mdxRenderer: projectSource('src/components/MdxRenderer.tsx'),
  mdxRuntime: projectSource('src/lib/mdxRuntime.ts'),
}

const familyMeta = {
  'meeting-collaboration': {
    label: '会议协作',
    source: projectSource('.agents/skills/journal/references/templates/meeting-collaboration.md'),
    signal: '多人发言、议程、分歧、决策、行动项、转写材料。',
    avoid: '如果目标是沉淀长期规范，而不是记录一次讨论，应转入项目文档或技术文档。',
    fields: ['结论', '背景', '参与者', '议题', '分歧', '决策', '行动项', '来源'],
    recommended: ['DecisionList', 'ActionTable', 'Transcript', 'ReferenceList'],
  },
  'work-reports': {
    label: '工作汇报',
    source: projectSource('.agents/skills/journal/references/templates/work-reports.md'),
    signal: '周期性总结、完成项、阻塞、指标、下阶段计划。',
    avoid: '如果材料主要是一次会议或一份长期项目规范，不要归入汇报。',
    fields: ['结论', '周期', '完成项', '关键指标', '风险', '下阶段计划', '行动项', '来源'],
    recommended: ['StatGroup', 'Progress', 'RiskMatrix', 'ActionTable'],
  },
  'project-docs': {
    label: '项目文档',
    source: projectSource('.agents/skills/journal/references/templates/project-docs.md'),
    signal: '项目范围、需求、里程碑、角色、依赖、发布计划。',
    avoid: '如果只是同步进展，用工作汇报；如果只是会议记录，用会议协作。',
    fields: ['目标', '范围', '用户/对象', '里程碑', '角色', '风险', '验收标准', '来源'],
    recommended: ['MilestoneTimeline', 'RACI', 'RiskMatrix', 'DecisionRecord'],
  },
  'research-analysis': {
    label: '研究分析',
    source: projectSource('.agents/skills/journal/references/templates/research-analysis.md'),
    signal: '研究问题、证据、样本、数据、竞品、假设、洞察。',
    avoid: '没有证据来源的个人判断，不应包装成研究结论。',
    fields: ['研究问题', '样本/来源', '发现', '证据', '洞察', '限制', '后续问题', '来源'],
    recommended: ['EvidenceCard', 'InsightCard', 'ComparisonMatrix', 'ReferenceList'],
  },
  'learning-notes': {
    label: '学习笔记',
    source: projectSource('.agents/skills/journal/references/templates/learning-notes.md'),
    signal: '书、论文、课程、概念、例题、模型、摘录和复述。',
    avoid: '如果主要是个人复盘，归入个人日志；如果主要是研究判断，归入研究分析。',
    fields: ['来源', '核心命题', '概念', '证据/例子', '我的理解', '问题', '复习点'],
    recommended: ['InsightCard', 'QuoteCard', 'Checklist', 'ReferenceList'],
  },
  'personal-journal': {
    label: '个人日志',
    source: projectSource('.agents/skills/journal/references/templates/personal-journal.md'),
    signal: '个人反思、情绪、习惯、目标、旅行、购买、家庭事项。',
    avoid: '不要把事实稀少的个人感受改写成商业或研究结论。',
    fields: ['今日状态', '事件', '感受', '判断', '行动', '复盘', '来源'],
    recommended: ['Checklist', 'Progress', 'DecisionRecord', 'RatingBar'],
  },
  'technical-docs': {
    label: '技术文档',
    source: projectSource('.agents/skills/journal/references/templates/technical-docs.md'),
    signal: 'API、架构、日志、命令、错误栈、根因、RFC、部署、评审。',
    avoid: '一次技术会议的原始讨论仍优先归入会议协作，除非目标是产出长期技术方案。',
    fields: ['问题/目标', '上下文', '设计/步骤', '命令或代码', '风险', '验证', '后续'],
    recommended: ['Callout', 'CopyButton', 'RiskMatrix', 'IncidentTimeline'],
  },
  'content-creation': {
    label: '内容创作',
    source: projectSource('.agents/skills/journal/references/templates/content-creation.md'),
    signal: '文章、演讲、社媒、产品文案、发布稿、采访、简报。',
    avoid: '不要把素材事实改写成无来源的营销断言。',
    fields: ['受众', '目标', '核心信息', '结构', '素材', '待补充', '发布检查'],
    recommended: ['Cards', 'Checklist', 'CopyButton', 'ReferenceList'],
  },
  'hr-operations': {
    label: 'HR 与运营',
    source: projectSource('.agents/skills/journal/references/templates/hr-operations.md'),
    signal: '候选人、绩效、SOP、客户状态、KPI、工单、伙伴沟通。',
    avoid: '如果是个人感受或一次普通会议，不要误归入运营记录。',
    fields: ['对象', '状态', '事实', '风险', '责任人', '下一步', '来源'],
    recommended: ['StatusBadge', 'ActionTable', 'RACI', 'ReferenceList'],
  },
}

const componentSpecs = [
  {
    name: 'Section',
    group: 'Typography',
    source: 'src/components/mdx/typography.tsx',
    desc: '内容区块容器，用 density 控制段落密度。',
    props: [
      ['density', '"compact" | "default" | "relaxed"', '可选；默认 default。'],
      ['children', 'ReactNode', '区块内容。'],
    ],
    example: `<Section density="relaxed">
  <Subtitle>一个独立的阅读区块，适合承载结论、证据或说明。</Subtitle>
  <Callout type="note" title="区块边界">把一个主题放进一个 Section，避免卡片套卡片。</Callout>
</Section>`,
  },
  {
    name: 'Subtitle',
    group: 'Typography',
    source: 'src/components/mdx/typography.tsx',
    desc: '标题下方的辅助说明文字。',
    props: [['children', 'ReactNode', '辅助说明。']],
    example: `<Subtitle>用于解释当前页面、章节或组件的用途。</Subtitle>`,
  },
  {
    name: 'Label',
    group: 'Typography',
    source: 'src/components/mdx/typography.tsx',
    desc: '短标签，适合状态、分类或小型前缀。',
    props: [['children', 'ReactNode', '标签文本。']],
    example: `<Flow>
  <Label>MDX</Label>
  <Label>read-only</Label>
  <Label>component</Label>
</Flow>`,
  },
  {
    name: 'Divider',
    group: 'Typography',
    source: 'src/components/mdx/typography.tsx',
    desc: '章节分隔线，可带标签。',
    props: [['label', 'string', '可选；显示在分隔线中间。']],
    example: `<Divider label="证据与判断分界" />`,
  },
  {
    name: 'Split',
    group: 'Layout',
    source: 'src/components/mdx/layout.tsx',
    desc: '双列布局，适合对照两个信息块。',
    props: [['children', 'ReactNode', '两个或多个子块。']],
    example: `<Split>
  <Callout type="tip" title="左侧">放结论、判断或目标。</Callout>
  <Callout type="note" title="右侧">放证据、约束或风险。</Callout>
</Split>`,
  },
  {
    name: 'Columns',
    group: 'Layout',
    source: 'src/components/mdx/layout.tsx',
    desc: '2 到 4 列的轻量布局。',
    props: [
      ['cols', '2 | 3 | 4', '可选；默认 2。'],
      ['children', 'ReactNode', '列内容。'],
    ],
    example: `<Columns cols={3}>
  <Column><Stat label="资料" value={12} /></Column>
  <Column><Stat label="结论" value={4} /></Column>
  <Column><Stat label="待确认" value={2} /></Column>
</Columns>`,
  },
  {
    name: 'Column',
    group: 'Layout',
    source: 'src/components/mdx/layout.tsx',
    desc: 'Columns 的子列。',
    props: [['children', 'ReactNode', '列内容。']],
    example: `<Columns>
  <Column><Callout title="第一列" type="note">放主线信息。</Callout></Column>
  <Column><Callout title="第二列" type="info">放补充信息。</Callout></Column>
</Columns>`,
  },
  {
    name: 'MacPreview',
    group: 'Preview',
    source: 'src/components/mdx/layout.tsx',
    desc: 'macOS 窗口壳预览，适合展示桌面端界面草图或格式样例。',
    props: [
      ['title', 'string', '可选；标题栏文本。'],
      ['children', 'ReactNode', '预览内容。'],
    ],
    example: `<MacPreview title="输出预览">
  <Checklist items={[{ text: "结论先行", checked: true }, { text: "来源可追溯" }]} />
</MacPreview>`,
  },
  {
    name: 'Placeholder',
    group: 'Layout',
    source: 'src/components/mdx/layout.tsx',
    desc: '显式标记待补内容，不伪造信息。',
    props: [['children', 'ReactNode', '占位说明。']],
    example: `<Placeholder>待补：用户访谈原文和样本数量。</Placeholder>`,
  },
  {
    name: 'Grid',
    group: 'Layout',
    source: 'src/components/mdx/grid.tsx',
    desc: '12 栅格布局，用 span 控制内容宽度。',
    props: [
      ['cols', 'number', '总列数，默认 12。'],
      ['gap', 'number', '列间距 px。'],
      ['children', 'ReactNode', 'Col 子元素。'],
    ],
    example: `<Grid cols={12} gap={12}>
  <Col span={7}><Callout title="主要内容">占 7 列。</Callout></Col>
  <Col span={5}><Callout title="补充信息" type="info">占 5 列。</Callout></Col>
</Grid>`,
  },
  {
    name: 'Col',
    group: 'Layout',
    source: 'src/components/mdx/grid.tsx',
    desc: 'Grid 的列单元。',
    props: [
      ['span', 'number | "auto" | "fill"', '列跨度。'],
      ['offset', 'number', '左侧偏移列数。'],
      ['children', 'ReactNode', '列内容。'],
    ],
    example: `<Grid cols={12}>
  <Col span={4}><Stat label="A" value="4/12" /></Col>
  <Col span={8}><Stat label="B" value="8/12" /></Col>
</Grid>`,
  },
  {
    name: 'Flow',
    group: 'Layout',
    source: 'src/components/mdx/grid.tsx',
    desc: '自然换行的横向流式布局。',
    props: [
      ['gap', 'number', '间距 px。'],
      ['justify', 'string', '横向对齐。'],
      ['align', 'string', '纵向对齐。'],
    ],
    example: `<Flow gap={8}>
  <StatusBadge status="open" />
  <StatusBadge status="blocked" tone="warning" />
  <StatusBadge status="done" tone="success" />
</Flow>`,
  },
  {
    name: 'Stack',
    group: 'Layout',
    source: 'src/components/mdx/cards.tsx',
    desc: '纵向堆叠布局，用统一间距组织组件。',
    props: [
      ['gap', 'number', '空间 token 序号，默认 4。'],
      ['children', 'ReactNode', '堆叠内容。'],
    ],
    example: `<Stack gap={3}>
  <Callout title="第一层">先给结论。</Callout>
  <EvidenceCard title="证据">再给可追溯材料。</EvidenceCard>
</Stack>`,
  },
  {
    name: 'ProsCons',
    group: 'Display',
    source: 'src/components/mdx/display.tsx',
    desc: '优缺点双列容器。',
    props: [['children', 'ReactNode', 'Pros 和 Cons。']],
    example: `<ProsCons>
  <Pros><li>实现成本低</li><li>容易验证</li></Pros>
  <Cons><li>表达力有限</li><li>后续可能要扩展</li></Cons>
</ProsCons>`,
  },
  {
    name: 'Pros',
    group: 'Display',
    source: 'src/components/mdx/display.tsx',
    desc: 'ProsCons 中的优势列表。',
    props: [['children', 'ReactNode', 'li 列表项。']],
    example: `<Pros><li>读者能快速扫描收益。</li><li>适合方案比较。</li></Pros>`,
  },
  {
    name: 'Cons',
    group: 'Display',
    source: 'src/components/mdx/display.tsx',
    desc: 'ProsCons 中的劣势列表。',
    props: [['children', 'ReactNode', 'li 列表项。']],
    example: `<Cons><li>不要替代完整风险分析。</li><li>不要写成情绪化评价。</li></Cons>`,
  },
  {
    name: 'Stat',
    group: 'Display',
    source: 'src/components/mdx/display.tsx',
    desc: '单个关键指标。',
    props: [
      ['label', 'string', '指标名。'],
      ['value', 'string | number', '指标值。'],
      ['trend', '"up" | "down"', '可选趋势。'],
      ['suffix', 'string', '可选单位。'],
    ],
    example: `<Stat label="完成度" value={72} suffix="%" trend="up" />`,
  },
  {
    name: 'StatGroup',
    group: 'Display',
    source: 'src/components/mdx/display.tsx',
    desc: '多指标并排展示。',
    props: [['children', 'ReactNode', '多个 Stat。']],
    example: `<StatGroup>
  <Stat label="资料" value={18} />
  <Stat label="决策" value={3} />
  <Stat label="风险" value={2} trend="down" />
</StatGroup>`,
  },
  {
    name: 'Table',
    group: 'Display',
    source: 'src/components/mdx/display.tsx',
    desc: '组件化表格，适合由数组生成稳定结构。',
    props: [
      ['headers', 'string[]', '表头。'],
      ['rows', 'string[][]', '表格行。'],
    ],
    example: `<Table
  headers={["字段", "写法"]}
  rows={[["summary", "写结论，不写泛泛概述"], ["sources", "保留来源路径"]]}
/>`,
  },
  {
    name: 'Timeline',
    group: 'Display',
    source: 'src/components/mdx/display.tsx',
    desc: '简单事件时间线。',
    props: [['items', '{ time; title; desc? }[]', '事件列表。']],
    example: `<Timeline
  items={[
    { time: "09:30", title: "素材导入", desc: "录音和粘贴文本进入 raw。" },
    { time: "09:45", title: "生成日志", desc: "AI 输出可读条目。" },
  ]}
/>`,
  },
  {
    name: 'TagList',
    group: 'Display',
    source: 'src/components/mdx/display.tsx',
    desc: '标签列表。',
    props: [['tags', 'string[]', '标签文本。']],
    example: `<TagList tags={["journal", "mdx", "manual"]} />`,
  },
  {
    name: 'Progress',
    group: 'Display',
    source: 'src/components/mdx/display.tsx',
    desc: '0-100 的进度条。',
    props: [
      ['value', 'number', '进度值。'],
      ['label', 'string', '可选说明。'],
    ],
    example: `<Progress value={68} label="手册覆盖度" />`,
  },
  {
    name: 'Avatar',
    group: 'Display',
    source: 'src/components/mdx/display.tsx',
    desc: '姓名缩写头像。',
    props: [
      ['name', 'string', '姓名。'],
      ['size', '"sm" | "md" | "lg"', '可选尺寸。'],
    ],
    example: `<Avatar name="Yan Wu" size="md" />`,
  },
  {
    name: 'AvatarGroup',
    group: 'Display',
    source: 'src/components/mdx/display.tsx',
    desc: '头像组。',
    props: [['children', 'ReactNode', '多个 Avatar。']],
    example: `<AvatarGroup>
  <Avatar name="Yan Wu" />
  <Avatar name="Journal Claw" />
</AvatarGroup>`,
  },
  {
    name: 'Callout',
    group: 'Context',
    source: 'src/components/mdx/callout.tsx',
    desc: '提示块，支持 note/info/tip/warning。',
    props: [
      ['type', '"info" | "warning" | "tip" | "note"', '提示类型。'],
      ['title', 'string', '标题。'],
      ['children', 'ReactNode', '正文。'],
    ],
    example: `<Callout type="tip" title="MDX 使用原则">
  只有当组件提升扫描、追溯或校验时才使用。
</Callout>`,
  },
  {
    name: 'Quote',
    group: 'Context',
    source: 'src/components/mdx/callout.tsx',
    desc: '带来源的引用块。',
    props: [
      ['text', 'string', '引用文本。'],
      ['source', 'string', '可选来源。'],
      ['url', 'string', '可选链接。'],
    ],
    example: `<Quote text="先保留事实，再提炼判断。" source="Journal writing rules" />`,
  },
  {
    name: 'RelatedEntry',
    group: 'Context',
    source: 'src/components/mdx/callout.tsx',
    desc: '链接到另一篇日志或 MDX 文件。',
    props: [
      ['path', 'string', '目标路径。'],
      ['label', 'string', '可选显示文本。'],
    ],
    example: `<RelatedEntry path="../00-index.mdx" label="回到 MDX 手册首页" />`,
  },
  {
    name: 'RelatedIdentity',
    group: 'Context',
    source: 'src/components/mdx/callout.tsx',
    desc: '链接到身份画像文件。',
    props: [
      ['path', 'string', '身份画像路径。'],
      ['label', 'string', '可选显示文本。'],
    ],
    example: `<RelatedIdentity path="../../identities/示例-人物.md" label="示例人物画像" />`,
  },
  {
    name: 'Cards',
    group: 'Cards',
    source: 'src/components/mdx/cards.tsx',
    desc: '卡片网格容器。',
    props: [['children', 'ReactNode', '多个 Card。']],
    example: `<Cards>
  <Card title="结构" description="用组件稳定表达重复信息。" />
  <Card title="证据" description="来源和判断分开呈现。" />
</Cards>`,
  },
  {
    name: 'Card',
    group: 'Cards',
    source: 'src/components/mdx/cards.tsx',
    desc: '单张信息卡。',
    props: [
      ['title', 'string', '标题。'],
      ['description', 'string', '说明。'],
      ['image', 'string', '可选图像占位文本。'],
      ['variant', 'string', 'default/subtle/elevated。'],
    ],
    example: `<Card title="结论卡" description="用于承载一个独立观点，不要嵌套更多卡片。" variant="subtle" />`,
  },
  {
    name: 'Options',
    group: 'Cards',
    source: 'src/components/mdx/cards.tsx',
    desc: '方案列表容器。',
    props: [['children', 'ReactNode', '多个 Option。']],
    example: `<Options>
  <Option letter="A" title="保持 Markdown" description="最低成本，表达有限。" />
  <Option letter="B" title="使用 MDX 组件" description="结构更清晰，适合重复信息。" />
</Options>`,
  },
  {
    name: 'Option',
    group: 'Cards',
    source: 'src/components/mdx/cards.tsx',
    desc: '单个方案项。',
    props: [
      ['letter', 'string', '方案字母。'],
      ['title', 'string', '方案标题。'],
      ['description', 'string', '说明。'],
    ],
    example: `<Option letter="A" title="轻量方案" description="适合快速记录和低风险内容。" />`,
  },
  {
    name: 'Kanban',
    group: 'Cards',
    source: 'src/components/mdx/cards.tsx',
    desc: '静态看板，用于展示事项状态。',
    props: [['columns', '{ title; items }[]', '列和卡片。']],
    example: `<Kanban
  columns={[
    { title: "待处理", items: [{ text: "补充来源", tags: ["source"] }] },
    { title: "完成", items: [{ text: "组件页已改为实时渲染", tags: ["mdx"] }] },
  ]}
/>`,
  },
  {
    name: 'Checklist',
    group: 'Cards',
    source: 'src/components/mdx/cards.tsx',
    desc: '只读检查清单。',
    props: [['items', '{ text; checked? }[]', '清单项。']],
    example: `<Checklist
  items={[
    { text: "组件示例是实时渲染", checked: true },
    { text: "同时保留可复制代码", checked: true },
    { text: "不要加入可变状态" },
  ]}
/>`,
  },
  {
    name: 'Counter',
    group: 'Cards',
    source: 'src/components/mdx/cards.tsx',
    desc: '单个计数器。',
    props: [
      ['count', 'number', '数字。'],
      ['label', 'string', '说明。'],
    ],
    example: `<Counter count={66} label="MDX 组件" />`,
  },
  {
    name: 'RatingBar',
    group: 'Cards',
    source: 'src/components/mdx/cards.tsx',
    desc: '静态评分。',
    props: [
      ['score', 'number', '分数。'],
      ['max', 'number', '最高分，默认 5。'],
      ['label', 'string', '说明。'],
    ],
    example: `<RatingBar score={4} max={5} label="证据完整度" />`,
  },
  {
    name: 'AudioCard',
    group: 'Media',
    source: 'src/components/mdx/media.tsx',
    desc: '音频播放器卡片。',
    props: [
      ['src', 'string', '音频地址。'],
      ['title', 'string', '标题。'],
    ],
    example: `<AudioCard src="2605/raw/example.m4a" title="会议录音示例" />`,
  },
  {
    name: 'VideoCard',
    group: 'Media',
    source: 'src/components/mdx/media.tsx',
    desc: '视频播放器卡片。',
    props: [
      ['src', 'string', '视频地址。'],
      ['title', 'string', '标题。'],
      ['poster', 'string', '封面地址。'],
    ],
    example: `<VideoCard src="2605/raw/demo.mp4" title="演示视频示例" />`,
  },
  {
    name: 'ImageViewer',
    group: 'Media',
    source: 'src/components/mdx/media.tsx',
    desc: '图片与说明。',
    props: [
      ['src', 'string', '图片地址。'],
      ['alt', 'string', '替代文本。'],
      ['caption', 'string', '说明文字。'],
      ['width', 'string', '可选宽度。'],
    ],
    example: `<ImageViewer
  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='280'%3E%3Crect width='640' height='280' fill='%231c1c1e'/%3E%3Ctext x='40' y='155' fill='%23c8933b' font-size='42'%3EMDX Preview%3C/text%3E%3C/svg%3E"
  alt="MDX preview"
  caption="语义图片示例"
/>`,
  },
  {
    name: 'FileCard',
    group: 'Media',
    source: 'src/components/mdx/media.tsx',
    desc: '文件入口；点击后在 JournalClaw 内部打开可预览文件。',
    props: [
      ['path', 'string', '工作区相对路径或绝对路径。'],
      ['label', 'string', '显示文本。'],
    ],
    example: `<FileCard path="topics/mdx-support-manual/00-index.mdx" label="打开手册首页" />`,
  },
  {
    name: 'BarChart',
    group: 'Charts',
    source: 'src/components/mdx/charts.tsx',
    desc: '柱状图。',
    props: [
      ['data', '{ label; value }[]', '数据。'],
      ['title', 'string', '标题。'],
      ['color', 'string', '可选颜色。'],
    ],
    example: `<BarChart
  title="模板覆盖"
  data={[{ label: "模板", value: 104 }, { label: "组件", value: 66 }]}
/>`,
  },
  {
    name: 'LineChart',
    group: 'Charts',
    source: 'src/components/mdx/charts.tsx',
    desc: '折线图。',
    props: [
      ['data', '{ label; value }[]', '数据。'],
      ['title', 'string', '标题。'],
      ['color', 'string', '可选颜色。'],
    ],
    example: `<LineChart
  title="整理进度"
  data={[{ label: "D1", value: 20 }, { label: "D2", value: 48 }, { label: "D3", value: 88 }]}
/>`,
  },
  {
    name: 'PieChart',
    group: 'Charts',
    source: 'src/components/mdx/charts.tsx',
    desc: '饼图。',
    props: [
      ['data', '{ label; value }[]', '数据。'],
      ['title', 'string', '标题。'],
      ['color', 'string', '可选颜色。'],
    ],
    example: `<PieChart
  title="内容类型"
  data={[{ label: "模板", value: 104 }, { label: "组件", value: 66 }]}
/>`,
  },
  {
    name: 'RadarChart',
    group: 'Charts',
    source: 'src/components/mdx/charts.tsx',
    desc: '雷达图。',
    props: [
      ['data', '{ label; value }[]', '数据。'],
      ['title', 'string', '标题。'],
      ['color', 'string', '可选颜色。'],
    ],
    example: `<RadarChart
  title="质量维度"
  data={[{ label: "结构", value: 90 }, { label: "证据", value: 76 }, { label: "可读性", value: 84 }]}
/>`,
  },
  {
    name: 'Mermaid',
    group: 'Diagrams',
    source: 'src/components/mdx/mermaid.tsx',
    desc: 'Mermaid 图表，支持流程图、时序图、甘特图等。',
    props: [
      ['chart', 'string', 'Mermaid 源码。'],
      ['caption', 'string', '说明。'],
    ],
    example: `<Mermaid
  chart={"flowchart LR\\n  A[素材] --> B[结构化]\\n  B --> C[MDX 渲染]"}
  caption="从素材到 MDX 阅读页"
/>`,
  },
  {
    name: 'HtmlPreview',
    group: 'Preview',
    source: 'src/components/mdx/html-preview.tsx',
    desc: '裸 HTML 预览，使用 sandbox iframe 隔离运行 HTML fragment 或 document，并内置 Journal preview preset 与 Tabler Icons webfont：语义 HTML 默认可读，常用类如 card/grid/stack/badge/callout/kpi 可直接使用，图标可直接写 <i class="ti ti-clock" aria-hidden="true"></i>。',
    props: [
      ['src', 'string', '可选；workspace 相对路径或绝对路径。'],
      ['html', 'string', '可选；直接传入 HTML 字符串。'],
      ['height', 'number | string', '预览高度，默认 420。'],
      ['title', 'string', 'iframe 标题。'],
    ],
    example: `<HtmlPreview
  src="2606/raw/note_component_library.html"
  height={520}
  title="笔记组件分类体系"
/>`,
  },
  {
    name: 'PhonePreview',
    group: 'Preview',
    source: 'src/components/mdx/device-mockups.tsx',
    desc: '手机壳预览，适合展示移动端截图或手机阅读态内容。',
    props: [
      ['src', 'string', '可选截图。'],
      ['children', 'ReactNode', '屏幕内容。'],
      ['size', '"sm" | "md" | "lg" | "auto"', '尺寸。'],
      ['density', 'string', '内容密度。'],
    ],
    example: `<PhonePreview size="sm" density="compact">
  <div style={{ padding: 18 }}>
    <Label>JournalClaw</Label>
    <h3>移动端阅读预览</h3>
    <p>用于展示内容在设备内的状态。</p>
  </div>
</PhonePreview>`,
  },
  {
    name: 'ActionTable',
    group: 'Semantic',
    source: 'src/components/mdx/semantic.tsx',
    desc: '行动项表格。',
    props: [['items', 'ActionItem[]', '行动项，含 owner/due/source/status。']],
    example: `<ActionTable
  items={[
    { action: "补齐 MDX 示例", owner: "Yan", due: "今日", source: "手册修订", status: "doing" },
  ]}
/>`,
  },
  {
    name: 'DecisionRecord',
    group: 'Semantic',
    source: 'src/components/mdx/semantic.tsx',
    desc: '单条决策记录。',
    props: [
      ['question', 'string', '问题。'],
      ['decision', 'string', '结论。'],
      ['options', 'DecisionOption[]', '备选方案。'],
      ['rationale', 'string', '理由。'],
    ],
    example: `<DecisionRecord
  question="组件示例是否只放代码块？"
  decision="否，必须先给实时渲染，再给可复制代码。"
  options={[{ label: "代码块", tradeoff: "方便复制但无法验证渲染" }, { label: "实时示例", tradeoff: "能直接验证组件可用" }]}
  rationale="手册的目标是理解 MDX 支持细节，渲染状态本身就是关键证据。"
/>`,
  },
  {
    name: 'DecisionList',
    group: 'Semantic',
    source: 'src/components/mdx/semantic.tsx',
    desc: '多条决策记录。',
    props: [['decisions', 'DecisionRecord props[]', '决策数组。']],
    example: `<DecisionList
  decisions={[
    { question: "链接如何打开？", decision: "本地文件在 JournalClaw 内部打开。" },
    { question: "模板如何呈现？", decision: "使用组件化骨架表达结构。" },
  ]}
/>`,
  },
  {
    name: 'RiskMatrix',
    group: 'Semantic',
    source: 'src/components/mdx/semantic.tsx',
    desc: '风险矩阵。',
    props: [['risks', 'RiskItem[]', '风险、概率、影响、应对。']],
    example: `<RiskMatrix
  risks={[
    { risk: "示例不能渲染", likelihood: "高", impact: "高", severity: "P1", mitigation: "所有组件页加入实时示例" },
  ]}
/>`,
  },
  {
    name: 'StatusBadge',
    group: 'Semantic',
    source: 'src/components/mdx/semantic.tsx',
    desc: '紧凑状态标记。',
    props: [
      ['status', 'string', '状态文本。'],
      ['tone', 'neutral | success | warning | danger', '语气。'],
    ],
    example: `<Flow>
  <StatusBadge status="draft" />
  <StatusBadge status="ready" tone="success" />
  <StatusBadge status="needs source" tone="warning" />
</Flow>`,
  },
  {
    name: 'ComparisonMatrix',
    group: 'Semantic',
    source: 'src/components/mdx/semantic.tsx',
    desc: '对比矩阵。',
    props: [
      ['columns', 'string[]', '对比维度。'],
      ['rows', '{ label; values }[]', '对比对象。'],
    ],
    example: `<ComparisonMatrix
  columns={["可读性", "可验证", "维护成本"]}
  rows={[
    { label: "Markdown", values: ["中", "低", "低"] },
    { label: "MDX", values: ["高", "高", "中"] },
  ]}
/>`,
  },
  {
    name: 'OptionMatrix',
    group: 'Semantic',
    source: 'src/components/mdx/semantic.tsx',
    desc: '方案矩阵，接口同 ComparisonMatrix。',
    props: [
      ['columns', 'string[]', '维度。'],
      ['rows', '{ label; values }[]', '方案。'],
    ],
    example: `<OptionMatrix
  columns={["收益", "风险"]}
  rows={[
    { label: "保守修复", values: ["稳定", "覆盖不足"] },
    { label: "重建手册", values: ["完整", "改动较多"] },
  ]}
/>`,
  },
  {
    name: 'RACI',
    group: 'Semantic',
    source: 'src/components/mdx/semantic.tsx',
    desc: '角色责任矩阵。',
    props: [['rows', 'RACI row[]', '事项与 R/A/C/I。']],
    example: `<RACI
  rows={[
    { work: "手册生成", responsible: "AI", accountable: "Yan", consulted: "组件源码", informed: "读者" },
  ]}
/>`,
  },
  {
    name: 'MilestoneTimeline',
    group: 'Semantic',
    source: 'src/components/mdx/semantic.tsx',
    desc: '里程碑时间线。',
    props: [['items', '{ time; title; desc? }[]', '里程碑。']],
    example: `<MilestoneTimeline
  items={[
    { time: "M1", title: "组件页实时渲染", desc: "每个组件都有 live preview。" },
    { time: "M2", title: "模板页组件化", desc: "模板骨架使用语义组件。" },
  ]}
/>`,
  },
  {
    name: 'IncidentTimeline',
    group: 'Semantic',
    source: 'src/components/mdx/semantic.tsx',
    desc: '事故时间线。',
    props: [['items', '{ time; title; impact?; desc? }[]', '事件列表。']],
    example: `<IncidentTimeline
  items={[
    { time: "10:00", title: "发现示例未渲染", impact: "用户无法验证组件效果", desc: "示例被放在 mdx 代码块里。" },
  ]}
/>`,
  },
  {
    name: 'InsightCard',
    group: 'Semantic',
    source: 'src/components/mdx/semantic.tsx',
    desc: '洞察卡。',
    props: [
      ['title', 'string', '标题。'],
      ['children', 'ReactNode', '洞察内容。'],
    ],
    example: `<InsightCard title="组件手册的关键不是列 API">
  读者需要同时看到渲染结果、可复制代码和使用边界。
</InsightCard>`,
  },
  {
    name: 'EvidenceCard',
    group: 'Semantic',
    source: 'src/components/mdx/semantic.tsx',
    desc: '证据卡。',
    props: [
      ['title', 'string', '标题。'],
      ['source', 'string', '来源。'],
      ['children', 'ReactNode', '证据内容。'],
    ],
    example: `<EvidenceCard title="截图证据" source="用户反馈截图">
  组件页只显示代码块，没有真实组件渲染。
</EvidenceCard>`,
  },
  {
    name: 'QuoteCard',
    group: 'Semantic',
    source: 'src/components/mdx/semantic.tsx',
    desc: '引用卡。',
    props: [
      ['quote', 'string', '引用文本。'],
      ['source', 'string', '来源。'],
    ],
    example: `<QuoteCard quote="没有渲染的示例无法说明组件支持。" source="MDX 手册修复目标" />`,
  },
  {
    name: 'SourceCard',
    group: 'Sources',
    source: 'src/components/mdx/source.tsx',
    desc: '单个来源入口；本地文件在 JournalClaw 内部打开。',
    props: [
      ['path', 'string', '路径或 URL。'],
      ['label', 'string', '显示名。'],
      ['type', 'string', '来源类型。'],
      ['note', 'string', '说明。'],
    ],
    example: `<SourceCard
  path="../../Projects/github/journal/src/components/mdx/source.tsx"
  label="source.tsx"
  type="file"
  note="点击后在 JournalClaw 内部预览"
/>`,
  },
  {
    name: 'ReferenceList',
    group: 'Sources',
    source: 'src/components/mdx/source.tsx',
    desc: '来源列表。',
    props: [['sources', 'ReferenceSource[]', '来源数组。']],
    example: `<ReferenceList
  sources={[
    { path: "../../Projects/github/journal/src/components/mdx/index.ts", label: "index.ts", type: "file" },
    { path: "../../Projects/github/journal/src/styles/mdx.css", label: "mdx.css", type: "file" },
  ]}
/>`,
  },
  {
    name: 'Transcript',
    group: 'Sources',
    source: 'src/components/mdx/source.tsx',
    desc: '转写片段列表，可折叠。',
    props: [
      ['items', 'TranscriptItem[]', '说话人、时间、文本。'],
      ['collapsible', 'boolean', '是否折叠。'],
      ['title', 'string', '标题。'],
    ],
    example: `<Transcript
  title="会议片段"
  items={[
    { speaker: "A", time: "00:12", text: "这里需要看到真实渲染，而不只是代码。", src: "2605/raw/meeting.m4a" },
  ]}
/>`,
  },
  {
    name: 'TimestampLink',
    group: 'Sources',
    source: 'src/components/mdx/source.tsx',
    desc: '媒体时间点跳转链接。',
    props: [
      ['src', 'string', '媒体地址。'],
      ['time', 'string | number', '时间点。'],
      ['children', 'ReactNode', '显示内容。'],
    ],
    example: `<p>关键片段：<TimestampLink src="2605/raw/meeting.m4a" time="00:12">00:12</TimestampLink></p>`,
  },
  {
    name: 'CopyButton',
    group: 'Sources',
    source: 'src/components/mdx/source.tsx',
    desc: '复制只读文本。',
    props: [
      ['text', 'string', '复制内容。'],
      ['label', 'string', '按钮文本。'],
      ['children', 'ReactNode', '自定义内容。'],
    ],
    example: `<CopyButton text="请基于这段素材整理结论、证据、行动项和风险。" label="复制整理提示" />`,
  },
]

function frontmatter({ tags, summary, sources }) {
  return `---\ntags: ${q(tags)}\nsummary: ${q(summary)}\nsources: ${q(sources)}\n---\n\n`
}

function codeFence(code) {
  return `\`\`\`mdx\n${code.trim()}\n\`\`\``
}

function referenceList(sources) {
  const items = sources.map((source) => ({
    path: source.path,
    label: source.label ?? path.basename(source.path),
    type: source.type ?? 'file',
    ...(source.note ? { note: source.note } : {}),
  }))
  return `<ReferenceList\n  sources={${JSON.stringify(items, null, 4)}}\n/>`
}

function propsTable(props) {
  return `<Table\n  headers={["Prop", "Type", "说明"]}\n  rows={${JSON.stringify(props, null, 4)}}\n/>`
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${content.trimEnd()}\n`)
}

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name)
      return entry.isDirectory() ? walk(full) : [full]
    })
    .sort()
}

function componentPage(spec) {
  const sourcePath = projectSource(spec.source)
  const exampleCode = spec.example.trim()
  const sources = [
    { path: sourcePath, label: path.basename(spec.source), type: 'file' },
    { path: refs.mdxIndex, label: 'index.ts', type: 'file' },
    { path: refs.mdxCss, label: 'mdx.css', type: 'file' },
  ]

  return `${frontmatter({
    tags: ['journal', 'mdx-manual', 'component', spec.group.toLowerCase()],
    summary: `${spec.name} 组件的实时渲染示例、Props 和使用边界。`,
    sources: sources.map((source) => source.path),
  })}# ${spec.name}

<Subtitle>${spec.desc}</Subtitle>

<Callout type="tip" title="阅读方式">
  本页先展示真实渲染，再给出可复制 MDX。截图中只显示代码块的问题来自旧版手册生成策略。
</Callout>

## 实时渲染

${exampleCode}

## 可复制用法

${codeFence(exampleCode)}

## Props

${propsTable(spec.props)}

## 使用边界

<Checklist
  items={[
    { text: "组件只用于只读展示，不在 MDX 内修改日志、todo 或 AI 状态。", checked: true },
    { text: "当 Markdown 表格或列表足够清楚时，不为了装饰而使用组件。", checked: true },
    { text: "复杂数据用数组 props 表达，避免在正文里堆不可维护的长表格。", checked: true },
  ]}
/>

## 样式与实现

${referenceList(sources)}
`
}

function existingTemplateFiles() {
  return walk(templateRoot).filter((file) => file.endsWith('.mdx'))
}

const subtypeLabels = {
  'general-meeting': '通用会议纪要',
  'decision-review': '决策评审纪要',
  'progress-sync': '进展同步纪要',
  'interview-1on1': '一对一访谈记录',
  'retrospective-incident': '事故/项目复盘会',
  'daily-standup': '每日站会记录',
  'requirement-review': '需求评审纪要',
  'technical-review': '技术评审纪要',
  'design-review': '设计评审纪要',
  'strategic-decision': '战略决策纪要',
  'customer-visit': '客户拜访记录',
  brainstorm: '头脑风暴记录',
  'training-share': '培训分享记录',
  retrospective: '复盘会议纪要',
  'incident-review': '事故复盘纪要',

  'daily-report': '日报',
  'weekly-report': '周报',
  'monthly-quarterly-report': '月度/季度汇报',
  'monthly-report': '月报',
  'quarterly-report': '季报',
  'okr-tracking': 'OKR 跟踪',
  'project-progress': '项目进展汇报',
  'status-report': '状态汇报',
  'performance-review': '绩效复盘',
  'executive-summary': '管理层摘要',
  'risk-focused-report': '风险专项汇报',

  'project-plan': '项目计划',
  charter: '项目章程',
  prd: '产品需求文档',
  'user-story': '用户故事',
  'requirement-pool': '需求池',
  'technical-proposal': '技术方案',
  'test-plan': '测试计划',
  'release-checklist': '发布检查清单',
  roadmap: '路线图',
  'milestone-plan': '里程碑计划',
  changelog: '变更日志',
  'project-retrospective': '项目复盘',

  'market-research': '市场研究',
  'competitor-analysis': '竞品分析',
  'data-analysis': '数据分析',
  swot: 'SWOT 分析',
  'user-research': '用户研究',
  feasibility: '可行性分析',
  'feasibility-analysis': '可行性分析',
  'risk-assessment': '风险评估',
  'experiment-report': '实验报告',
  'business-analysis': '商业分析',

  'deep-reading': '深度阅读笔记',
  'book-note': '读书笔记',
  'paper-note': '论文笔记',
  'course-video-note': '课程视频笔记',
  'knowledge-card': '知识卡片',
  'cornell-note': '康奈尔笔记',
  'feynman-note': '费曼笔记',
  'concept-explanation': '概念解释',
  'problem-solving': '解题记录',
  'literature-matrix': '文献矩阵',
  'learning-plan': '学习计划',
  flashcard: '闪卡',

  'daily-journal': '日记',
  'morning-journal': '晨间日志',
  'evening-journal': '晚间日志',
  'emotion-log': '情绪记录',
  'goal-okr': '个人目标 OKR',
  'review-journal': '个人复盘',
  'decision-journal': '决策日志',
  'habit-tracking': '习惯跟踪',
  'travel-plan': '旅行计划',
  'purchase-decision': '购买决策',
  'family-affairs': '家庭事务记录',
  'personal-plan': '个人计划',

  'technical-design': '技术设计',
  'api-doc': 'API 文档',
  'debug-record': '调试记录',
  'architecture-doc': '架构文档',
  'incident-rca': '故障 RCA',
  rfc: 'RFC',
  'rfc-architecture': '架构 RFC',
  'deployment-runbook': '部署 Runbook',
  'code-review': '代码评审记录',
  'code-snippet': '代码片段说明',
  'migration-guide': '迁移指南',

  'article-draft': '文章草稿',
  'talk-outline': '演讲大纲',
  'talk-ppt-outline': '演讲 PPT 大纲',
  'social-plan': '社媒内容计划',
  'social-content-plan': '社媒内容计划',
  'product-copy': '产品文案',
  'press-release': '新闻稿',
  announcement: '公告',
  'interview-record': '采访记录',
  'speaker-notes': '演讲者备注',
  'newsletter-brief': 'Newsletter 简报',

  'recruiting-interview': '招聘面试记录',
  'hr-operations-performance-review': '绩效评估记录',
  sop: 'SOP',
  'event-plan': '活动计划',
  'customer-profile': '客户画像',
  'kpi-tracking': 'KPI 跟踪',
  'support-ticket': '支持工单',
  'partner-communication': '合作伙伴沟通记录',
  'customer-success': '客户成功记录',
  'customer-success-followup': '客户成功跟进',
}

const fieldLabels = {
  background: '背景',
  participants: '参与者',
  agenda: '议程',
  'discussion by topic': '按主题讨论',
  'aligned items': '已达成一致',
  'unresolved items': '未解决问题',
  actions: '行动项',
  question: '核心问题',
  disagreement: '分歧点',
  positions: '不同立场',
  'key evidence': '关键证据',
  'turning point': '转折点',
  decision: '决策',
  stability: '决策稳定性',
  'progress summary': '进展摘要',
  'status changes': '状态变化',
  blockers: '阻塞',
  'next plan': '下一步计划',
  'risk board': '风险看板',
  'person context': '对象背景',
  needs: '需求',
  'pain points': '痛点',
  quotes: '关键原话',
  signals: '信号',
  'follow-up': '跟进',
  goal: '目标',
  'actual result': '实际结果',
  timeline: '时间线',
  cause: '原因',
  'root cause': '根因',
  'root causes': '根因',
  impact: '影响',
  lessons: '经验教训',
  'what worked': '有效做法',
  'what failed': '失败点',
  fixes: '修复动作',
  'completed today': '今日完成',
  'key facts': '关键事实',
  'tomorrow plan': '明日计划',
  'weekly outcomes': '本周成果',
  'project progress': '项目进展',
  metrics: '指标',
  risks: '风险',
  risk: '风险',
  'risk list': '风险清单',
  'next week plan': '下周计划',
  goals: '目标',
  'key metrics': '关键指标',
  'major changes': '重大变化',
  decisions: '决策',
  'next period focus': '下周期重点',
  objective: '目标',
  'key results': '关键结果',
  'current progress': '当前进度',
  confidence: '信心指数',
  'next actions': '下一步行动',
  'milestone status': '里程碑状态',
  'latest progress': '最新进展',
  dependencies: '依赖',
  'requested support': '需要支持',
  scope: '范围',
  owner: '负责人',
  owners: '负责人',
  milestones: '里程碑',
  deliverables: '交付物',
  constraints: '约束',
  'acceptance criteria': '验收标准',
  users: '用户',
  problem: '问题',
  value: '价值',
  requirements: '需求',
  'open questions': '开放问题',
  options: '方案选项',
  recommendation: '推荐方案',
  'trade-offs': '取舍',
  'test cases': '测试用例',
  environment: '环境',
  rollback: '回滚',
  period: '周期',
  budget: '预算',
  sponsor: '赞助人/发起人',
  now: '现在',
  next: '下一阶段',
  later: '以后',
  'research question': '研究问题',
  sample: '样本',
  findings: '发现',
  evidence: '证据',
  insight: '洞察',
  limitation: '限制',
  limitations: '限制',
  'follow-up questions': '后续问题',
  'source context': '来源背景',
  source: '来源',
  'main argument': '核心论点',
  'core thesis': '核心命题',
  concepts: '概念',
  examples: '例子',
  'my understanding': '我的理解',
  questions: '问题',
  review: '复习点',
  trigger: '触发事件',
  feeling: '感受',
  interpretation: '解释',
  regulation: '调节动作',
  'current state': '当前状态',
  judgment: '判断',
  reflection: '复盘',
  context: '上下文',
  design: '设计',
  steps: '步骤',
  commands: '命令',
  validation: '验证',
  audience: '受众',
  message: '核心信息',
  structure: '结构',
  material: '素材',
  'publishing check': '发布检查',
  candidate: '候选人',
  assessment: '评估',
  status: '状态',
  process: '流程',
  'responsible person': '责任人',
  'next step': '下一步',
  'next action': '下一步行动',
  symptom: '现象',
  logs: '日志',
  hypotheses: '假设',
  experiments: '验证实验',
  result: '结果',
  fix: '修复',
  'regression test': '回归测试',
  summary: '摘要',
  detection: '发现方式',
  resolution: '解决过程',
  'preventive actions': '预防措施',
  endpoint: '接口地址',
  auth: '认证方式',
  params: '参数',
  request: '请求',
  response: '响应',
  errors: '错误',
  alternatives: '替代方案',
  compatibility: '兼容性',
  migration: '迁移方案',
  proposal: '提案',
  'data flow': '数据流',
  tradeoffs: '取舍',
  rollout: '上线计划',
  architecture: '架构',
  version: '版本',
  checks: '检查项',
  communication: '沟通计划',
  stakeholders: '相关方',
  'out of scope': '不在范围内',
  'user stories': '用户故事',
  'market context': '市场背景',
  segments: '细分市场',
  opportunities: '机会',
  competitors: '竞品',
  'comparison dimensions': '对比维度',
  strengths: '优势',
  weaknesses: '劣势',
  positioning: '定位',
  'data scope': '数据范围',
  'metric changes': '指标变化',
  explanation: '解释',
  anomalies: '异常',
  recommendations: '建议',
  method: '方法',
  insights: '洞察',
  likelihood: '概率',
  mitigation: '应对措施',
  'monitoring signal': '监控信号',
  thesis: '主张',
  outline: '结构大纲',
  'key arguments': '关键论点',
  ending: '结尾',
  'next edit': '下一轮修改',
  'narrative arc': '叙事弧线',
  'slide outline': '幻灯片大纲',
  'speaker notes': '演讲者备注',
  platform: '平台',
  angle: '切入角度',
  'content pieces': '内容条目',
  schedule: '排期',
  measurement: '衡量方式',
  offer: '卖点',
  'value proposition': '价值主张',
  proof: '证据',
  tone: '语气',
  variants: '版本变体',
  subject: '采访对象',
  themes: '主题',
  'usable excerpts': '可用摘录',
  role: '岗位',
  'candidate context': '候选人背景',
  gaps: '差距',
  feedback: '反馈',
  'growth plan': '成长计划',
  purpose: '目的',
  roles: '角色',
  procedure: '操作步骤',
  exceptions: '异常处理',
  checklist: '检查清单',
  'revision history': '修订记录',
  'customer context': '客户背景',
  usage: '使用情况',
  objections: '异议',
  metric: '指标',
  'current value': '当前值',
  target: '目标值',
  trend: '趋势',
  action: '行动',
  events: '事件',
  mood: '情绪',
  'key thought': '关键想法',
  meaning: '意义',
  'next small action': '下一步小行动',
  reason: '原因',
  lesson: '经验',
  'next adjustment': '下一步调整',
  criteria: '判断标准',
  assumption: '假设',
  'expected result': '预期结果',
  'review date': '复盘日期',
  'itinerary or schedule': '行程或排期',
  'budget or constraints': '预算或约束',
  'book metadata': '书籍信息',
  'chapter summary': '章节摘要',
  'key quotes': '关键摘录',
  'personal applications': '个人应用',
  citations: '引用',
  reuse: '可复用点',
  timestamps: '时间戳',
  'key ideas': '关键观点',
  'practice tasks': '练习任务',
  concept: '概念',
  definition: '定义',
  example: '例子',
  counterexample: '反例',
  application: '应用',
  'related notes': '相关笔记',
  argument: '论证',
  assumptions: '假设',
  critique: '批判',
}

const scenarioIntros = {
  brainstorm: '把发散讨论整理成可执行共识：先写背景问题，再整理观点、推理关系、共识和下一步实验。',
  'decision-review': '用于记录存在取舍的评审会：保留问题、不同立场、关键证据、转折点和最终决策。',
  'progress-sync': '用于多人同步进展：突出状态变化、阻塞、风险和下一步计划。',
  'daily-standup': '用于站会：每个人只记录状态变化、阻塞和今天最重要的行动。',
  'requirement-review': '用于需求评审：把背景、验收标准、变更点、争议和结论放在同一页。',
  'technical-review': '用于技术评审：记录约束、方案取舍、迁移风险、未决问题和验证方式。',
  'design-review': '用于设计评审：记录目标、反馈主题、互斥意见、组合方案和下一轮修改。',
  'strategic-decision': '用于战略决策：突出资源分配、机会成本、决策稳定性和隐藏风险。',
  'customer-visit': '用于客户拜访：保留客户背景、需求、反对意见、购买信号和跟进行动。',
  'training-share': '用于培训分享：提炼概念、案例、可迁移方法和听众问题。',
  'weekly-report': '用于周报：用结论先行总结成果、指标、风险和下周重点。',
  'okr-tracking': '用于 OKR 跟踪：记录目标状态、KR 进度、信心、阻塞和调整动作。',
  'project-plan': '用于项目启动计划：明确目标、范围、角色、里程碑、风险和验收标准。',
  prd: '用于产品需求文档：写清用户、场景、需求、验收标准和开放问题。',
  'user-story': '用于用户故事：聚焦用户、场景、需求、价值和验收条件。',
  'experiment-report': '用于实验报告：从假设、设计、结果推导出继续、调整或停止的决策。',
  'deep-reading': '用于深度阅读：先复述核心论点，再写证据、理解、疑问和复习点。',
  'feynman-note': '用于费曼笔记：用简单语言解释概念，暴露理解缺口，再修正表达。',
  'decision-journal': '用于个人决策：记录当时信息、判断、预期、风险和复盘时间。',
  'debug-record': '用于调试记录：保留现象、假设、验证命令、结果、根因和后续防复发动作。',
  'incident-rca': '用于故障 RCA：记录影响、时间线、根因、修复、验证和预防措施。',
  'article-draft': '用于文章草稿：明确受众、主张、结构、素材、待补证据和发布检查。',
  'recruiting-interview': '用于面试记录：记录候选人背景、证据、风险、判断和后续动作。',
  sop: '用于 SOP：明确触发条件、步骤、责任人、异常处理和验收标准。',
}

const subtypeFieldOverrides = {
  'meeting-collaboration/daily-standup': ['上次完成', '今天计划', '阻塞', '需要协助', '行动项'],
  'meeting-collaboration/requirement-review': ['需求背景', '用户场景', '验收标准', '变更点', '争议', '结论', '行动项'],
  'meeting-collaboration/technical-review': ['技术背景', '约束', '方案选项', '架构风险', '迁移风险', '决策', '验证方式', '行动项'],
  'meeting-collaboration/design-review': ['设计目标', '方案截图/链接', '反馈主题', '互斥意见', '组合方案', '下一轮修改', '行动项'],
  'meeting-collaboration/strategic-decision': ['战略问题', '选项', '资源投入', '机会成本', '隐藏风险', '决策稳定性', '行动项'],
  'meeting-collaboration/customer-visit': ['客户背景', '需求', '痛点', '异议', '购买信号', '跟进行动'],
  'meeting-collaboration/training-share': ['主题', '核心概念', '案例', '可迁移方法', '听众问题', '行动项'],
  'meeting-collaboration/retrospective': ['目标', '实际结果', '时间线', '原因', '影响', '经验教训', '修复动作'],
  'meeting-collaboration/incident-review': ['目标', '实际结果', '时间线', '原因', '影响', '经验教训', '修复动作'],

  'work-reports/status-report': ['当前状态', '状态变化', '阻塞', '风险', '下一步', '需要支持'],
  'work-reports/performance-review': ['周期', '目标', '证据', '影响', '成长点', '反馈', '下一步'],
  'work-reports/executive-summary': ['结论', '关键指标', '风险', '决策请求', '下一步'],
  'work-reports/risk-focused-report': ['风险', '概率', '影响', '应对', '负责人', '期限'],
  'work-reports/monthly-report': ['目标', '关键指标', '重大变化', '风险', '决策', '下周期重点'],
  'work-reports/quarterly-report': ['目标', '关键指标', '重大变化', '风险', '决策', '下周期重点'],

  'project-docs/charter': ['项目目标', '授权范围', '预算', 'Sponsor', '决策权', '里程碑', '风险'],
  'project-docs/user-story': ['用户', '场景', '需求', '价值', '验收标准'],
  'project-docs/requirement-pool': ['来源', '需求', '优先级', '状态', '负责人', '下一步'],
  'project-docs/roadmap': ['Now', 'Next', 'Later', '依赖', '风险'],
  'project-docs/test-plan': ['范围', '测试用例', '环境', '验收标准', '风险'],
  'project-docs/milestone-plan': ['目标', '里程碑', '负责人', '交付物', '验收标准'],
  'project-docs/changelog': ['新增', '变更', '修复', '破坏性变更', '影响'],

  'research-analysis/swot': ['优势', '劣势', '机会', '威胁', '结论', '下一步'],
  'research-analysis/feasibility': ['约束', '可行性判断', '所需验证', '风险', '决策'],
  'research-analysis/feasibility-analysis': ['约束', '可行性判断', '所需验证', '风险', '决策'],
  'research-analysis/experiment-report': ['假设', '实验设计', '样本', '结果', '决策', '下一步'],
  'research-analysis/business-analysis': ['商业模式', '成本', '收入', '战略影响', '风险', '建议'],

  'learning-notes/cornell-note': ['线索', '笔记', '总结', '问题', '复习计划'],
  'learning-notes/feynman-note': ['概念', '简单解释', '理解缺口', '修正解释', '例子'],
  'learning-notes/concept-explanation': ['定义', '例子', '反例', '适用边界', '相关概念'],
  'learning-notes/problem-solving': ['问题', '尝试', '解法', '反思', '下次注意'],
  'learning-notes/literature-matrix': ['论文', '研究问题', '方法', '发现', '限制', '可复用点'],
  'learning-notes/learning-plan': ['目标', '资源', '计划', '进度', '复习点'],
  'learning-notes/flashcard': ['问题', '答案', '提示', '掌握程度'],

  'personal-journal/morning-journal': ['意图', '能量', '优先事项', '风险', '小行动'],
  'personal-journal/evening-journal': ['事件', '感受', '反思', '收尾', '明日调整'],
  'personal-journal/emotion-log': ['触发事件', '身体信号', '情绪解释', '调节动作', '后续观察'],
  'personal-journal/habit-tracking': ['习惯', '进度', '连续天数', '阻塞', '下一步调整'],
  'personal-journal/travel-plan': ['行程', '交通', '住宿', '预算', '清单', '风险'],
  'personal-journal/purchase-decision': ['需求', '选项', '判断标准', '取舍', '决策', '复盘日期'],
  'personal-journal/family-affairs': ['相关人', '时间线', '责任', '待确认', '跟进'],

  'technical-docs/rfc': ['问题', '提案', '替代方案', '决策', '兼容性', '迁移方案', '开放问题'],
  'technical-docs/architecture-doc': ['上下文', '需求', '约束', '架构', '数据流', '取舍', '上线计划', '风险'],
  'technical-docs/deployment-runbook': ['环境', '命令', '验证', '回滚', '负责人', '风险'],
  'technical-docs/code-review': ['文件', '发现', '风险', '必要修复', '验证'],
  'technical-docs/code-snippet': ['代码', '使用场景', '注意事项', '相关文件'],
  'technical-docs/migration-guide': ['迁移前', '迁移后', '步骤', '兼容性', '回滚', '验证'],

  'content-creation/press-release': ['标题', '导语', '引用', '发布时间/可用性', '公司样板', '来源'],
  'content-creation/announcement': ['变更内容', '影响对象', '影响范围', '生效时间', '下一步'],
  'content-creation/speaker-notes': ['时间', '转场', '重点', '讲法提示', '强调语'],
  'content-creation/newsletter-brief': ['栏目', '链接', '摘要', '行动号召'],
  'content-creation/social-plan': ['受众', '平台', '切入角度', '内容条目', '排期', '衡量方式'],

  'hr-operations/support-ticket': ['问题', '复现步骤', '处理过程', '结果', '后续'],
  'hr-operations/partner-communication': ['合作目标', '资源', '分工', '风险', '下一步'],
  'hr-operations/customer-success': ['使用情况', '已交付价值', '风险', '续费/扩展信号', '下一步'],
  'hr-operations/customer-success-followup': ['使用情况', '已交付价值', '风险', '续费/扩展信号', '下一步'],
}

const localSourcePath = (sourcePath) =>
  path.join(repoRoot, sourcePath.replace('../../Projects/github/journal/', ''))

function parseFamilyRules(meta) {
  const markdown = fs.existsSync(localSourcePath(meta.source))
    ? fs.readFileSync(localSourcePath(meta.source), 'utf8')
    : ''
  const core = new Map()
  const sectionRe = /^### ([^\n]+)\n([\s\S]*?)(?=^### |^## |\z)/gm
  for (const match of markdown.matchAll(sectionRe)) {
    const [, subtype, body] = match
    core.set(subtype.trim(), {
      fields: splitCsv(body.match(/^Fields:\s*(.+)$/m)?.[1]),
      components: [...(body.match(/^Recommended components:\s*(.+)$/m)?.[1]?.matchAll(/`([^`]+)`/g) ?? [])].map((m) => m[1]),
      useWhen: body.match(/^Use when:\s*(.+)$/m)?.[1] ?? '',
      avoidWhen: body.match(/^Avoid when:\s*(.+)$/m)?.[1] ?? '',
    })
  }

  const variants = new Map()
  for (const line of markdown.split('\n')) {
    const match = line.match(/^\| ([a-z0-9-]+) \| (.+) \|$/)
    if (match && match[1] !== 'Subtype') {
      variants.set(match[1], match[2].trim())
    }
  }

  return { core, variants }
}

function splitCsv(value) {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim().replace(/[.。]$/, ''))
    .filter(Boolean)
}

function baseSubtypeFromVariant(note, family) {
  const explicit = note.match(/Use ([a-z0-9-]+)/)?.[1]
  if (explicit) return explicit
  if (family === 'work-reports' && ['monthly-report', 'quarterly-report'].includes(note)) {
    return 'monthly-quarterly-report'
  }
  return null
}

function translatedField(field) {
  const normalized = field.toLowerCase().trim()
  return fieldLabels[normalized] ?? fieldLabels[field.trim()] ?? field.trim()
}

function subtypeOverride(map, family, title) {
  return map[`${family}/${title}`] ?? map[title]
}

const expertTemplateProfiles = {
  'meeting-collaboration/general-meeting': {
    lens: 'Andy Grove 的高产出会议视角',
    insight: '通用会议不是转写汇总，而是把信息同步、决策、未决问题和承诺分桶，让读者立刻知道会议产出了什么。',
    fields: ['会议目标', '本次产出类型', '议题推进表', '关键证据', '已确认结论', '未决问题', '待确认信息', '行动项'],
    checks: [
      '第一屏能看到会议目标和本次产出类型',
      '每个议题都有结论、未决或后续动作之一',
      '每个行动项都有负责人、截止时间、状态和来源议题',
    ],
  },
  'meeting-collaboration/decision-review': {
    lens: 'Annie Duke 的决策质量视角',
    insight: '好决策记录要把结果好坏和决策质量分开，保留选项、关键假设、反证、转折点和复盘条件。',
    fields: ['决策问题', '不同立场', '关键假设', '关键证据', '反证或弃用理由', '不可逆程度', '稳定性/重审条件', '复盘时间'],
    checks: [
      '至少有两个选项；只有一个选项时写明其他选项为何被排除',
      '决策理由写出关键证据和转折点，不能只写大家同意',
      '重审条件、复盘时间或验证行动至少存在一个',
    ],
  },
  'meeting-collaboration/progress-sync': {
    lens: 'Eliyahu Goldratt 的约束理论视角',
    insight: '进展同步的核心不是逐人报功劳，而是找出限制吞吐的约束，并明确下一次同步前可以验证的解除动作。',
    fields: ['轨道/负责人', '上次承诺 vs 当前状态', '状态变化', '当前约束', '需要协助', '下次可验证结果', '风险/阻塞板', '行动项'],
    checks: [
      '每个轨道都有相对上次同步的状态变化',
      '每个阻塞都写清影响、解除负责人和截止时间',
      '下一步计划是可验证结果，不能只写继续推进',
    ],
  },
  'meeting-collaboration/daily-standup': {
    lens: 'Jeff Sutherland 的 Scrum 检视与调整视角',
    insight: '站会不是状态汇报会，而是围绕迭代目标检查承诺、暴露阻塞、调整当天最小推进。',
    fields: ['迭代目标', '成员', '昨日承诺完成情况', '今日最小推进', '阻塞/决策请求', '需要协助人', '状态变化', '升级项'],
    checks: [
      '每个人都有昨日、今日、阻塞三项；没有变化也写无变化/无阻塞',
      '每个阻塞都有需要协助的人或待决策对象',
      '今日计划写成可交付结果，不能只写继续开发或继续沟通',
    ],
  },
  'meeting-collaboration/interview-1on1': {
    lens: 'Edgar Schein 的过程咨询视角',
    insight: '一对一记录要保存对方的真实语境和心智模型，区分原话、事实信号、记录员判断和后续承诺。',
    fields: ['访谈目标', '对象背景/关系', '明示需求', '真实痛点', '关键原话', '信号与证据', '记录员判断', '跟进承诺'],
    checks: [
      '至少有一条关键原话支撑后面的判断',
      '每条记录员判断都能回指到原话、事实或行为信号',
      '跟进行动写清负责人和截止时间；没有承诺则标为待确认',
    ],
  },
  'meeting-collaboration/customer-visit': {
    lens: 'Steve Blank 的客户发现视角',
    insight: '客户拜访记录不是销售纪要，而是用客户原话和行为信号验证问题、现有替代方案、购买意愿和下一步实验。',
    fields: ['访谈目标', '客户画像/当前流程', '触发事件', '任务/需求', '现有替代方案', '反对意见', '购买/扩展信号', '商务/产品跟进'],
    checks: [
      '至少一条痛点或异议来自客户原话',
      '购买信号必须绑定行为或明确表述，不能只写记录员感觉',
      '跟进行动区分产品问题、商务动作和待确认信息',
    ],
  },
  'meeting-collaboration/retrospective': {
    lens: 'Diana Larsen 与 Esther Derby 的敏捷复盘视角',
    insight: '复盘不是追责，而是从事实差距中提炼可复用模式，并把教训转成下一轮实验。',
    fields: ['时间范围', '预期目标', '实际结果', '关键时间线', '差距解释', '学到的模式', '改进实验', '实验成功信号'],
    checks: [
      '预期目标和实际结果能直接比较，不能只有情绪评价',
      '每条教训都能回指到时间线中的具体事件',
      '每个改进动作都有负责人、截止时间和成功信号',
    ],
  },
  'meeting-collaboration/retrospective-incident': {
    lens: 'Gary Klein 的 After Action Review 视角',
    insight: '事故/项目混合复盘要先选复盘类型，再对比预期与实际，解释差距，并把修复动作拆成防复发或可复用两类。',
    fields: ['复盘类型', '预期结果', '实际发生', '关键时间线', '影响范围', '差距解释', '防复发/复用动作', '验证方式'],
    checks: [
      '页面明确选择项目复盘或事故复盘，不能两套语言混用',
      '预期与实际的差距能被记录员直接读出',
      '每个修复动作都写清是防复发、复用还是补证据',
    ],
  },
  'meeting-collaboration/incident-review': {
    lens: 'Sidney Dekker 与 John Allspaw 的无责事故复盘视角',
    insight: '事故复盘要把人为错误当作分析起点，而不是根因；记录系统条件、检测、缓解、恢复和防复发验证。',
    fields: ['触发时间', '检测时间', '缓解时间', '恢复时间', '用户/业务影响', '促成因素/系统条件', '未确认事实', '防复发验证'],
    checks: [
      '时间线至少包含触发、检测、缓解、恢复四类节点中的已知项',
      '原因不能只写某个人做错；必须写系统、流程或信息条件',
      '每个防复发动作都有验证方式和负责人',
    ],
  },
  'meeting-collaboration/brainstorm': {
    lens: 'IDEO / Tom Kelley 的创意收敛视角',
    insight: '头脑风暴的价值不是点子数量，而是记录点子之间的互补、互斥、并列、组合和依赖关系，再收敛为可验证行动。',
    fields: ['背景问题', '观点', '主张', '推理过程', '观点关系', '组合方案', '共识', '行动项'],
    checks: [
      '背景问题同时写清触发背景、目标和边界',
      '每个观点都有推理过程，并标注互补、互斥、并列、组合或依赖之一',
      '共识写清吸收了哪些观点、排除了哪些观点、哪些进入行动项',
    ],
  },
  'meeting-collaboration/training-share': {
    lens: 'Robert Gagne 的教学设计视角',
    insight: '培训分享记录要把内容转成可迁移任务能力：概念、例子、适用边界、练习和会后实践必须连起来。',
    fields: ['学习目标/任务', '概念与定义', '工作案例', '适用边界', '可复用步骤', '练习/检查题', '听众问题与澄清', '会后实践行动'],
    checks: [
      '每个核心概念都有例子或反例',
      '可迁移方法能按步骤执行，不是抽象心得',
      '听众问题要么已澄清，要么进入带负责人和截止时间的跟进项',
    ],
  },
  'meeting-collaboration/requirement-review': {
    lens: 'Marty Cagan 的产品发现视角',
    insight: '需求评审不是功能清单确认，而是把用户问题、证据、验收行为、范围变更和风险假设放到同一页。',
    fields: ['用户问题/业务背景', '用户场景', '可验收行为', '变更点与影响', '争议/取舍', '非目标', '成功指标', '待验证假设'],
    checks: [
      '每条通过的需求都有可测试的验收标准',
      '每个变更点都写清对范围、时间或风险的影响',
      '每个争议要么有结论，要么有验证负责人和截止时间',
    ],
  },
  'meeting-collaboration/technical-review': {
    lens: 'Martin Fowler 的架构取舍视角',
    insight: '技术评审要像轻量 ADR：记录约束、方案力场、迁移风险、验证方法和回滚条件。',
    fields: ['现状架构', '设计约束', '方案/取舍', '不可逆点', '性能/安全/维护性影响', '迁移与回滚风险', '验证命令/指标', '回滚条件'],
    checks: [
      '至少两个方案有明确取舍，不能只写最终方案',
      '最终决策有验证命令、指标或回滚条件',
      '迁移风险写到生产影响层面，而不是只写有风险',
    ],
  },
  'meeting-collaboration/design-review': {
    lens: 'Don Norman 的以用户任务为中心的设计评审视角',
    insight: '设计反馈不能停留在审美偏好，必须绑定用户任务、可用性证据、互斥意见和下一轮验证。',
    fields: ['设计目标', '用户任务', '截图/版本链接', '反馈主题', '互斥意见及用户影响', '合并方案', '待验证体验假设', '下一轮验证方式'],
    checks: [
      '每条反馈都能对应设计目标或用户任务',
      '互斥意见必须写清取舍理由和最终处理',
      '下一轮修改有负责人、截止时间和验证信号',
    ],
  },
  'meeting-collaboration/strategic-decision': {
    lens: 'Richard Rumelt 的好战略视角',
    insight: '战略决策页要写诊断、指导方针和一致行动，尤其要暴露机会成本、资源配置和重审触发条件。',
    fields: ['诊断', '指导方针选项', '非目标', '资源配置', '机会成本', '关键假设', '风险信号', '一致行动'],
    checks: [
      '决策回答了诊断中的核心问题，不只是写期望结果',
      '资源投入和机会成本至少有定性说明；能量化的必须量化',
      '写明触发重审的条件或信号',
    ],
  },
  'work-reports/daily-report': {
    lens: 'David Allen 的 GTD 视角',
    insight: '日报不是流水账，而是把今日承诺闭环、未闭环原因和明日最小行动放进同一个可信系统。',
    fields: ['已完成且可验证的产出', '关键事实/数据', '未完成原因', '阻塞', '明日 Top 3', '需要支持'],
    checks: ['每条完成项必须有证据、数量、链接或明确交付物', '每个阻塞必须写明需要谁在何时提供什么支持', '明日计划不得超过 3 条，且每条都能在 1 个工作日内验证'],
  },
  'work-reports/weekly-report': {
    lens: 'Andy Grove 的高产出管理视角',
    insight: '周报要汇报产出和杠杆，不汇报忙碌；指标要同时体现结果指标和前置指标。',
    fields: ['本周可验证成果', '结果指标', '前置指标', '项目进展', '管理层需关注', '风险', '下周杠杆动作'],
    checks: ['每个指标必须包含本周值、上周值或目标值中的至少两项', '每个风险必须有应对、负责人和截止时间', '下周计划中的每条动作必须绑定一个成果、风险或指标'],
  },
  'work-reports/monthly-report': {
    lens: 'Peter Drucker 的目标管理视角',
    insight: '月报应回答本月对目标贡献了什么、资源是否用在正确事项上、下月该停止或加码什么。',
    fields: ['目标与贡献', '关键指标', '资源投入', '重大变化', '停止/加码/保持', '风险', '需要决策'],
    checks: ['每个关键指标必须有本月值和目标值', '每个重大变化必须注明发生时间和证据来源', '每个决策请求必须写清选项、推荐项和截止日期'],
  },
  'work-reports/quarterly-report': {
    lens: 'Michael Porter 的战略取舍视角',
    insight: '季报要呈现战略选择是否有效，而不是把三个月周报相加；重点是取舍、资源配置和下一季度下注。',
    fields: ['季度战略目标', '关键指标', '战略取舍', '资源配置变化', '重大变化', '风险暴露', '下季度押注'],
    checks: ['每个季度结论必须绑定至少一个目标或关键指标', '每个战略变化必须说明相对上季度的差异', '下季度重点不得超过 3 个，并必须写明负责人'],
  },
  'work-reports/monthly-quarterly-report': {
    lens: 'Ram Charan 的执行节奏视角',
    insight: '通用周期汇报要先固定比较口径，再按月度或季度选择粒度，避免同一模板生成不可比较的叙述。',
    fields: ['汇报周期', '比较基线', '目标', '关键指标', '相对基线变化', '风险', '领导层请求'],
    checks: ['页面必须明确是月度、季度或其他周期', '所有核心指标必须有当前值和比较基线', '每个领导层请求必须写明请求对象和决策期限'],
  },
  'work-reports/okr-tracking': {
    lens: 'John Doerr 的 OKR 视角',
    insight: 'OKR 跟踪不是任务进度表，而是用可量化 KR、信心指数和调整动作判断目标是否仍可达成。',
    fields: ['目标结果', 'KR 基线/当前/目标', '当前进度', '信心依据', '阻塞', 'KR 调整请求', '下一步行动'],
    checks: ['每个 KR 必须有可量化目标和当前值', '信心指数必须写明依据，不能只有高/中/低', '每条下一步行动必须绑定到一个具体 KR'],
  },
  'work-reports/status-report': {
    lens: 'Eliyahu Goldratt 的约束理论视角',
    insight: '状态汇报的价值在于暴露系统约束：当前状态、上次状态、变化原因和解除约束所需支持必须连在一起。',
    fields: ['当前健康状态', '上次状态', '状态变化', '系统约束', '风险', '解除约束所需支持', '下一步'],
    checks: ['必须同时出现上次状态和当前状态', '每个状态变化必须写明触发原因或证据', '每个支持请求必须有支持对象、截止时间和预期结果'],
  },
  'work-reports/performance-review': {
    lens: 'Kim Scott 的 Radical Candor 视角',
    insight: '绩效复盘要把事实证据、业务影响、行为模式和成长动作分开，避免空泛评价。',
    fields: ['周期', '角色期待', '目标', '行为证据', '业务影响', '成长点', '反馈', '成长动作与支持'],
    checks: ['每条绩效判断必须对应至少一条行为证据', '每个影响必须写清影响对象、范围或指标', '每条成长动作必须有负责人、截止时间和验证方式'],
  },
  'work-reports/project-progress': {
    lens: 'Fred Brooks 的项目里程碑视角',
    insight: '项目进展不能只写百分比；必须写清里程碑是否真实完成、关键路径是否变化、依赖是否可控。',
    fields: ['里程碑验收状态', '最新进展', '验收证据', '关键路径变化', '范围变化', '依赖', '风险', '需要支持'],
    checks: ['每个里程碑必须有截止时间、状态和验收证据', '每个依赖必须有外部负责人和期望交付时间', '任何范围变化必须说明对时间、成本或质量的影响'],
  },
  'work-reports/executive-summary': {
    lens: 'Barbara Minto 的金字塔原理视角',
    insight: '管理层摘要必须答案先行：结论、证据、风险、请求按决策顺序排列，低层细节只保留能影响判断的部分。',
    fields: ['一句话答案', '关键指标', '财务/业务影响', '风险', '可选方案', '决策请求', '决策期限'],
    checks: ['首个结论能独立回答管理层最关心的问题', '每个决策请求必须包含推荐项、备选项和截止时间', '正文不得出现无法支撑结论、风险或请求的细节'],
  },
  'work-reports/risk-focused-report': {
    lens: 'Nassim Nicholas Taleb 的尾部风险视角',
    insight: '风险专项汇报要区分概率、暴露、触发信号和残余风险，不能只列风险名称。',
    fields: ['风险', '概率', '影响半径', '严重度', '触发信号', '应对', '残余风险', '升级阈值'],
    checks: ['每个风险必须包含概率、影响、严重度和应对', '所有高严重度风险必须有负责人和截止时间', '每个风险必须写明触发信号或升级阈值'],
  },
  'research-analysis/market-research': {
    lens: 'Clayton Christensen + April Dunford 的市场机会视角',
    insight: '市场研究不能只列市场规模；要把谁在什么情境下为什么会切换写清楚，否则机会会变成空泛 TAM。',
    fields: ['研究问题', '市场背景', '目标细分', '需求触发/切换动因', '证据发现', '机会假设', '限制条件', '下一步验证'],
    checks: ['每个市场规模、增长率或用户行为判断都必须有来源', '机会判断必须写成推断，并列出至少一个限制条件', '下一步验证必须包含动作、指标和判定阈值'],
  },
  'research-analysis/competitor-analysis': {
    lens: 'Michael Porter 的竞争战略视角',
    insight: '竞品分析的核心是定位差异和可防守优势；功能对比只是证据，不是结论。',
    fields: ['竞品集合', '客户任务/购买标准', '对比维度', '对方优势证据', '对方弱点证据', '定位判断', '可差异化机会', '待验证盲区'],
    checks: ['每个关键对比维度至少有一条来源证据，不能只写主观评分', '定位、优势和弱点必须区分事实证据和分析推断', '下一步验证必须指向真实市场信号'],
  },
  'research-analysis/data-analysis': {
    lens: 'John Tukey + Edward Tufte 的数据解释视角',
    insight: '数据分析模板要防止看见趋势就讲故事；必须先写数据范围、口径和异常处理。',
    fields: ['分析问题', '数据范围/口径', '基线/对照', '指标变化', '异常与排除', '解释假设', '建议', '下一步验证'],
    checks: ['每个指标必须有时间范围、样本量或数据口径', '解释必须至少列出一个替代解释或异常来源', '下一步验证必须说明要补哪份数据、跑哪个切分或做什么对照实验'],
  },
  'research-analysis/swot': {
    lens: 'Richard Rumelt 的好战略视角',
    insight: 'SWOT 不应是四格词库；每一格都要有证据，并收敛到战略判断和下一步行动。',
    fields: ['背景目标', '优势证据', '劣势证据', '机会推断', '威胁推断', '战略诊断', '优先动作', '待验证假设'],
    checks: ['优势和劣势必须来自内部事实或可追溯证据', '战略诊断必须引用 SWOT 中至少两个证据项', '下一步动作必须能验证某个关键假设'],
  },
  'research-analysis/user-research': {
    lens: 'Erika Hall + Teresa Torres 的用户机会视角',
    insight: '用户研究最重要的是把用户说了什么、做了什么和我们推断什么分开。',
    fields: ['样本与招募条件', '研究方法', '行为/痛点证据', '关键原话', '洞察假设', '机会点', '样本限制', '后续验证'],
    checks: ['每条用户痛点至少对应一条原话、行为观察或调查数据', '洞察必须声明样本限制', '下一步验证必须说明验证对象、方法和成功标准'],
  },
  'research-analysis/feasibility': {
    lens: 'Marty Cagan + Bent Flyvbjerg 的可行性视角',
    insight: '可行性模板不能只问能不能做；要写清约束、最小可行验证和失败条件。',
    fields: ['约束', '价值假设', '技术假设', '商业/成本假设', '可行性判断', '所需验证', '风险', '决策'],
    checks: ['可行性判断必须绑定具体约束', '每个高风险假设必须标注证据状态', '下一步验证必须包含最小实验、负责人和停止条件'],
  },
  'research-analysis/feasibility-analysis': {
    lens: 'Marty Cagan + Bent Flyvbjerg 的可行性视角',
    insight: '可行性模板不能只问能不能做；要写清约束、最小可行验证和失败条件。',
    fields: ['约束', '价值假设', '技术假设', '商业/成本假设', '可行性判断', '所需验证', '风险', '决策'],
    checks: ['可行性判断必须绑定具体约束', '每个高风险假设必须标注证据状态', '下一步验证必须包含最小实验、负责人和停止条件'],
  },
  'research-analysis/risk-assessment': {
    lens: 'Nassim Taleb + Paul Slovic 的风险认知视角',
    insight: '风险模板要避免只打分；必须写清触发信号、暴露面、缓解动作和剩余风险。',
    fields: ['风险背景', '风险清单', '触发信号', '概率', '影响', '缓解措施', '负责人', '剩余风险/监控'],
    checks: ['每个高等级风险必须有证据来源或明确标注为假设风险', '概率和影响必须说明判断依据', '下一步验证必须包含监控信号、阈值和触发后的负责人动作'],
  },
  'research-analysis/experiment-report': {
    lens: 'Ron Kohavi + R. A. Fisher 的实验设计视角',
    insight: '实验报告的价值不在结果好坏，而在结果是否足以改变决策。',
    fields: ['假设', '实验设计', '样本/分流', '指标与成功标准', '结果', '异常/污染', '决策', '下一步验证'],
    checks: ['实验必须写清预注册假设、主要指标和成功标准', '结果解释必须区分数据证据、推断原因和实验限制', '下一步必须明确是放大、复测、改方案还是停止'],
  },
  'research-analysis/business-analysis': {
    lens: 'Alex Osterwalder + Hamilton Helmer 的商业模式视角',
    insight: '商业分析不能只列收入成本；要判断这个模式为什么能持续、哪里会被竞争或执行成本击穿。',
    fields: ['商业模式', '客户/渠道', '成本结构', '收入结构', '单位经济', '战略影响', '风险', '建议/下一步验证'],
    checks: ['收入、成本、单位经济等数字必须有来源、口径或假设说明', '战略影响必须说明依赖哪些商业假设', '下一步验证必须指向一个关键商业假设'],
  },
  'project-docs/project-plan': {
    lens: 'Andy Grove 的高产出管理视角',
    insight: '项目计划不是愿望列表，而是目标、边界、节奏、责任人与前置风险构成的执行系统。',
    fields: ['预期结果', '范围内', '范围外', '成功指标', '项目节奏/检查点', '关键依赖', '验收口径', '下一步行动/负责人/截止时间'],
    checks: ['范围必须同时写范围内和范围外', '每个里程碑必须有负责人和验收口径', '每个高风险项必须有缓解动作或负责人'],
  },
  'project-docs/charter': {
    lens: 'Harold Kerzner 的项目治理视角',
    insight: '项目章程的核心是授权：谁批准、给多少资源、谁有权改变范围与优先级。',
    fields: ['授权目标', 'Sponsor/批准人', '授权边界', '预算/资源上限', '决策权', '升级路径', '里程碑', '治理风险'],
    checks: ['Sponsor 和批准人不能为空', '范围、预算、时间任一变更的决策人必须明确', '预算或资源上限未知时必须标记为待确认'],
  },
  'project-docs/prd': {
    lens: 'Marty Cagan 的产品发现视角',
    insight: 'PRD 应把用户问题、产品行为、风险和成功指标分开，而不是堆功能清单。',
    fields: ['目标用户', '核心场景/JTBD', '用户问题', '非目标场景', '可测试需求', '验收标准', '成功指标', '开放问题'],
    checks: ['每条需求必须对应用户问题或场景', '每条验收标准必须可测试', '成功指标必须写基线或目标值'],
  },
  'project-docs/user-story': {
    lens: 'Jeff Patton 的用户故事地图视角',
    insight: '用户故事要落在旅程和验收示例里，否则只是格式化口号。',
    fields: ['用户角色', '触发情境', '前置条件', '待完成任务', '用户价值/业务价值', '主流程', '例外/边界', '验收示例'],
    checks: ['每条故事只能服务一个明确用户角色', '验收条件必须包含 Given/When/Then 或等价可测描述', '故事必须写清用户价值，不只写系统动作'],
  },
  'project-docs/requirement-pool': {
    lens: 'Karl Wiegers 的需求工程视角',
    insight: '需求池是 triage 系统，重点是来源、优先级理由、状态和冲突处理。',
    fields: ['需求ID', '来源证据', '可验收需求陈述', '优先级', '优先级理由', '状态', '冲突/依赖', '下一步处理动作'],
    checks: ['每条需求必须有来源', '优先级必须有理由，不能只有 P0/P1', '重复或冲突需求必须标记合并、拆分或待决'],
  },
  'project-docs/technical-proposal': {
    lens: 'Michael Nygard 的 ADR 视角',
    insight: '技术方案应记录约束下的选择、备选项、后果、上线与回滚，不是架构说明散文。',
    fields: ['问题', '不可变约束', '方案选项', '架构草图/数据流', '决策状态', '后果/权衡', '验证计划', '回滚方案'],
    checks: ['至少两个方案必须写出取舍', '最终决策必须有负责人和状态', '上线计划必须同时写验证方式和回滚触发条件'],
  },
  'project-docs/test-plan': {
    lens: 'Cem Kaner 的情境驱动测试视角',
    insight: '测试计划应说明要降低哪些风险、用什么环境和数据证明，而不是穷举用例。',
    fields: ['测试目标', '测试范围', '不测范围', '风险模型', '测试数据', '风险驱动用例', '入口/退出标准', '缺陷分级'],
    checks: ['每个测试用例必须映射到需求或风险', '环境和测试数据必须可复现', '通过/失败标准必须避免主观词'],
  },
  'project-docs/release-checklist': {
    lens: 'Gene Kim 的发布安全视角',
    insight: '发布检查清单要证明发布可控、反馈可见、回滚可执行。',
    fields: ['发布窗口', '前置条件', '发布检查项', '灰度/回滚开关', '监控信号', '沟通对象', 'Go/No-Go 决策', '回滚步骤'],
    checks: ['每个检查项必须有负责人和状态', '回滚必须写触发条件和具体步骤', '沟通计划必须写对象、内容和时间'],
  },
  'project-docs/roadmap': {
    lens: 'Bruce McCarthy 的产品路线图视角',
    insight: '路线图传达意图和不确定性，Now/Next/Later 必须连接 outcome、证据和依赖。',
    fields: ['产品目标', '主题/机会', 'Now', 'Next', 'Later', '假设', '决策门槛', '不做事项'],
    checks: ['每个路线图事项必须写结果目标', 'Next/Later 必须体现不确定性或待验证条件', '关键依赖和不做事项必须可见'],
  },
  'project-docs/milestone-plan': {
    lens: 'Eliyahu Goldratt 的约束理论视角',
    insight: '里程碑计划要暴露瓶颈、依赖和缓冲，而不只是日期清单。',
    fields: ['目标', '可验收里程碑', '交付物', '负责人', '关键链/阻塞点', '依赖', '缓冲', '决策门'],
    checks: ['每个里程碑必须有交付物和验收标准', '依赖必须早于对应里程碑列出', '关键瓶颈必须有负责人和缓冲方案'],
  },
  'project-docs/changelog': {
    lens: 'Olivier Lacan 的 Keep a Changelog 视角',
    insight: '变更日志是面向读者的影响账本，不是 commit log。',
    fields: ['版本', '发布日期', '新增', '变更', '修复', 'Breaking changes', '用户/系统影响', '迁移/兼容性'],
    checks: ['条目必须按新增、变更、修复、破坏性变更分组', '破坏性变更必须写迁移动作', '每条重要变更必须有来源或 issue/PR 编号'],
  },
  'project-docs/project-retrospective': {
    lens: 'Norman Kerth 的项目复盘视角',
    insight: '项目复盘要把事实、解释、系统性原因和后续实验分开，避免归咎个人。',
    fields: ['时间线/事实', '预期 vs 实际', '未达到预期', '系统性原因', '可复用经验', '修复实验', '复发风险', '跟进日期'],
    checks: ['关键判断必须连接事实或证据', '根因描述必须指向系统、流程或约束', '每个跟进行动必须有负责人、日期和成功信号'],
  },
  'technical-docs/technical-design': {
    lens: 'Martin Fowler 的演进式架构视角',
    insight: '技术设计不是一次性蓝图，而是把当前约束下的可逆选择、不可逆选择和演进路径写清楚。',
    fields: ['问题背景与触发原因', '功能需求与非功能需求', '明确不解决什么', '已确定/待确认/废弃方案', '核心设计选择', '验证计划', '回滚或降级路径', '未覆盖风险'],
    checks: ['每个关键设计选择都有证据来源、约束来源或业务需求来源', '验证计划包含可执行检查', '回滚路径写清触发条件、负责人和仍未覆盖的兼容性风险'],
  },
  'technical-docs/api-doc': {
    lens: 'Stripe API Docs 的契约优先视角',
    insight: 'API 文档的核心不是解释实现，而是让调用方在不知道内部代码的情况下稳定集成、处理错误并安全升级。',
    fields: ['方法与路径', '认证方式与权限范围', '参数表', '请求示例', '响应示例', '错误与恢复', '限流与重试策略', '版本/弃用/兼容承诺'],
    checks: ['请求示例和响应示例能直接复制运行', '每个错误码都写明状态、原因、是否可重试和调用方动作', '兼容性章节写清新增字段、废弃字段、破坏性变更和旧客户端风险'],
  },
  'technical-docs/debug-record': {
    lens: 'Charity Majors 的可观测性调试视角',
    insight: '调试记录要保存证据链，而不是只保存最终修复；未来读者需要复盘每个假设为何成立或被排除。',
    fields: ['可观察症状', '环境', '证据：日志/trace/metric/截图/命令输出', '复现步骤与复现率', '假设', '已排除假设', '根因', '回归测试或监控告警'],
    checks: ['根因结论必须能回指至少一条证据或实验结果', '每个假设都标明 confirmed、ruled out 或 pending', '修复后必须写明验证命令、回归测试名称或监控指标'],
  },
  'technical-docs/architecture-doc': {
    lens: 'Simon Brown 的 C4 模型视角',
    insight: '架构文档要按读者层级组织：先说明系统边界和关系，再进入容器、组件、运行时和质量属性。',
    fields: ['系统上下文与外部依赖', 'C4 层级', '需求', '质量属性', '依赖方向', '关键失败模式', '架构决策', '未来演进约束'],
    checks: ['图中每个外部系统、数据库、队列或第三方服务都有职责说明和失败影响', '至少列出 3 个质量属性及验证方式', '兼容性与迁移段落写明旧模块、旧数据、旧 API 或旧客户端影响'],
  },
  'technical-docs/incident-rca': {
    lens: 'John Allspaw / Google SRE 的无责复盘视角',
    insight: 'RCA 不是寻找单一罪魁祸首，而是重建系统如何允许事故发生，并把检测、缓解和预防动作落到可验证改进。',
    fields: ['事故摘要与当前状态', '用户/数据/业务影响', '时间线', '发现方式', '根因', '促成因素', '为什么没有更早发现', '预防动作'],
    checks: ['时间线至少包含检测、确认、缓解、恢复四个节点', '根因和促成因素必须分开', '每个预防动作都有负责人、截止时间、验证方式和残余风险'],
  },
  'technical-docs/rfc': {
    lens: 'IETF RFC 的 durable agreement 视角',
    insight: 'RFC 的价值在于把争议、替代方案、兼容性和迁移代价写成可审议的决策记录，而不是提前包装成最终答案。',
    fields: ['问题陈述与成功标准', '提案概要', '替代方案与拒绝理由', '决策状态', '兼容性契约', '迁移/灰度/回滚', '开放问题', '审议记录'],
    checks: ['至少列出 2 个替代方案并说明为什么不选', '兼容性章节明确列出受影响 API、数据、配置、依赖方或运行环境', '开放问题必须标注负责人、决策截止时间和阻塞影响'],
  },
  'technical-docs/rfc-architecture': {
    lens: 'IETF RFC + 架构 ADR 的 durable agreement 视角',
    insight: '架构类 RFC 要把系统边界、替代方案、兼容性和迁移代价写成可审议的长期决策。',
    fields: ['问题陈述与成功标准', '架构提案', '替代方案与拒绝理由', '系统边界', '兼容性契约', '迁移/灰度/回滚', '开放问题', '审议记录'],
    checks: ['至少列出 2 个替代架构方案并说明为什么不选', '兼容性章节明确列出受影响模块、数据、配置或依赖方', '开放问题必须标注负责人、决策截止时间和阻塞影响'],
  },
  'technical-docs/deployment-runbook': {
    lens: 'Google SRE Workbook 的运营就绪视角',
    insight: 'Runbook 要让值班人按步骤执行并判断是否继续、暂停或回滚；它不是部署过程的回忆录。',
    fields: ['环境与前置条件', '影响范围和冻结窗口', '部署命令与参数', '部署前验证', '部署后验证', '回滚步骤与触发条件', '负责人和值班升级路径', '风险'],
    checks: ['每条命令都包含目标环境、必要变量、预期输出或成功判断', '验证步骤覆盖部署前、部署后和回滚后三个阶段', '回滚触发条件可观察'],
  },
  'technical-docs/code-review': {
    lens: 'Michaela Greiler 的有效代码评审视角',
    insight: '代码评审记录应优先保存行为风险、接口契约和必须修改项，而不是逐行复述代码。',
    fields: ['变更文件与职责', '发现', '严重度', '证据', '行为变化与回归风险', '必改项', '已有/缺失测试', '兼容性影响'],
    checks: ['每条发现都指向具体文件、函数、测试、日志或用户行为风险', '高/中风险项必须写明缺失测试或需要补的验证命令', '兼容性检查明确覆盖旧数据、旧配置、旧调用方或跨平台行为'],
  },
  'technical-docs/code-snippet': {
    lens: 'Kent Beck 的小例子视角',
    insight: '代码片段要最小、完整、可运行，并说明边界；否则只是未来会过期的摘抄。',
    fields: ['解决的具体问题', '最小可运行代码', '依赖版本与导入方式', '输入示例', '预期输出', '测试方式', '边界/前置条件/反例', '真实项目文件路径'],
    checks: ['代码片段包含必要 import、依赖版本、输入示例和预期输出', '明确写出至少一个不适用场景或容易误用的边界', '相关文件路径、包版本或来源链接存在'],
  },
  'technical-docs/migration-guide': {
    lens: 'Kelsey Hightower 的生产迁移视角',
    insight: '迁移指南的重点是控制风险：读者必须知道迁移前后差异、兼容窗口、验证点和如何撤回。',
    fields: ['迁移前状态', '迁移后状态', '分阶段步骤', '兼容窗口和受影响方', '数据备份/校验/恢复', '切换/灰度/冻结窗口', '回滚或前滚策略', '验证'],
    checks: ['迁移前后差异能对照检查', '每个阶段都有验证命令、预期结果和失败处理方式', '回滚策略说明哪些变化可回滚、哪些只能前滚，以及数据安全风险'],
  },
  'learning-notes/deep-reading': {
    lens: 'Mortimer Adler 的分析阅读视角',
    insight: '深度阅读不是摘录更多，而是能复述作者的问题、论证链和自己可迁移的判断。',
    fields: ['核心命题', '论证链', '关键证据', '隐含假设', '反向复述', '我的批判', '可迁移工作场景', '复习问题'],
    checks: ['必须有一段不引用原文的反向复述', '至少写出一个本周可试用的动作或判断标准', '复习问题至少包含一个针对论证漏洞或假设的问题'],
  },
  'learning-notes/book-note': {
    lens: 'Tiago Forte 的渐进式摘要视角',
    insight: '书摘要服务于未来调用，不服务于完整复述；每条笔记都要能回到行动、决策或表达。',
    fields: ['书籍信息', '章节一句话', '关键摘录', '可复用概念', '二次压缩摘要', '未来调用场景', '个人应用实验', '重读触发条件'],
    checks: ['每章摘要必须用主张、理由和例子表达', '至少一条个人应用要转成带负责人和截止时间的行动', '必须写明下次重读触发条件'],
  },
  'learning-notes/paper-note': {
    lens: 'S. Keshav 的三遍论文阅读视角',
    insight: '论文笔记的关键是读懂研究问题、方法可信度、结论边界和可复用部分。',
    fields: ['阅读轮次', '研究问题', '方法与样本', '主要发现', '限制与威胁', '关键图表', '可复用方法/指标/数据', '后续追踪论文'],
    checks: ['必须用不超过 5 句话说明研究问题、方法、发现和限制', '至少写出一个可复用元素', '至少列出两个后续追踪问题或引用论文'],
  },
  'learning-notes/course-video-note': {
    lens: 'Richard Mayer 的多媒体学习视角',
    insight: '视频笔记必须把时间点、概念、例子和练习结果连起来，否则很难回看和迁移。',
    fields: ['视频/课程来源', '关键时间点', '知识点', '示例', '自己的复述', '未解问题', '练习任务与结果', '回看原因'],
    checks: ['至少 3 个关键时间点后写一句自己的复述', '至少一个练习任务有可交付结果', '必须标记需要回看的时间点及回看原因'],
  },
  'learning-notes/knowledge-card': {
    lens: 'Andy Matuschak 的 Evergreen notes 视角',
    insight: '知识卡不是资料片段，而是一个可被未来笔记引用的独立命题。',
    fields: ['原子概念', '一句话定义', '正例', '反例', '适用边界', '易混概念', '使用条件', '相关笔记'],
    checks: ['一张卡只解释一个概念，并能用一句话定义', '至少写出一个使用条件和一个不该使用的边界', '必须链接至少一篇相关笔记或写明待建立链接主题'],
  },
  'learning-notes/cornell-note': {
    lens: 'Walter Pauk 的 Cornell Notes 视角',
    insight: 'Cornell 的价值在课后自测：线索必须能遮住正文后触发主动回忆。',
    fields: ['线索/问题', '主笔记', '课后总结', '自测问题', '错误回忆', '迁移题', '复习计划'],
    checks: ['线索栏至少包含 5 个可自测问题，不能只是章节标题', '至少一个问题必须改写成真实情境中的迁移题', '必须记录一次遮住主笔记后的自测结果'],
  },
  'learning-notes/feynman-note': {
    lens: 'Richard Feynman 的解释失败视角',
    insight: '费曼笔记的核心不是通俗化，而是用解释失败找到知识缺口。',
    fields: ['概念', '禁用术语清单', '小白解释', '卡壳点', '类比', '新例子', '修正版解释', '复讲对象/日期'],
    checks: ['小白解释中如果出现术语，必须紧跟一句不用术语的解释', '必须写一个来自原材料之外的新例子', '必须记录卡壳点是否已被修正版解释解决'],
  },
  'learning-notes/concept-explanation': {
    lens: 'Robert Gagne 的概念学习视角',
    insight: '概念解释不是下定义，而是让读者能判断什么属于它、什么不属于它。',
    fields: ['定义', '必要属性', '非必要属性', '正例', '反例', '判断边界', '易混概念', '诊断题'],
    checks: ['至少列出 2 个正例和 2 个反例，并说明判断依据', '必须写一个诊断题让读者判断新案例', '必须把易混概念加入复习清单并写出区分标准'],
  },
  'learning-notes/problem-solving': {
    lens: 'George Polya 的解题四步法视角',
    insight: '解题笔记要保留失败尝试，因为迁移能力来自看见路径选择和错因。',
    fields: ['问题重述', '已知/未知', '约束条件', '尝试记录', '最终解法', '检验方式', '错因与规律', '类似题迁移'],
    checks: ['必须先重述问题，并列出已知、未知和约束，才能写解法', '必须写至少一个类似题或工作中的同构问题', '必须记录错误尝试及错因'],
  },
  'learning-notes/literature-matrix': {
    lens: 'Webster & Watson 的概念中心文献综述视角',
    insight: '文献矩阵的目标是发现共识、冲突和缺口，而不是把多篇论文笔记拼成表格。',
    fields: ['主题维度', '论文/年份', '研究问题', '方法/样本', '发现', '限制', '共识', '冲突/研究缺口'],
    checks: ['矩阵至少包含 3 篇文献，并按同一组列比较', '必须产出至少一个可复用框架、方法、指标或研究假设', '必须写出下一轮阅读顺序以及每篇要补的缺口'],
  },
  'learning-notes/learning-plan': {
    lens: 'Anders Ericsson 的刻意练习视角',
    insight: '学习计划不是资源清单；它必须定义目标行为、练习任务、反馈来源和复盘节奏。',
    fields: ['当前水平', '目标行为', '资源队列', '刻意练习任务', '训练排期', '反馈来源', '进度指标', '复盘节奏'],
    checks: ['目标必须写成可观察行为', '每个资源至少绑定一个练习任务或输出物', '必须设置复盘频率和进度指标，至少包含本周检查点'],
  },
  'learning-notes/flashcard': {
    lens: 'Piotr Wozniak 的间隔重复视角',
    insight: '闪卡不是笔记摘要，而是一次主动回忆测试；问题必须能被明确判对或判错。',
    fields: ['问题', '标准答案', '提示', '干扰项/易错点', '评分标准', '掌握程度', '下次复习时间', '来源链接'],
    checks: ['每张卡只问一个问题，答案必须能明确判对、部分对或错', '至少一张卡要把概念放入新情境', '必须记录掌握程度和下次复习时间'],
  },
  'personal-journal/daily-journal': {
    lens: 'James Pennebaker + Daniel Kahneman 的可复核日记视角',
    insight: '日记不是把一天写满，而是把发生了什么、我怎么感受、我当时如何解释、明天做一个什么小动作留成可复核记录。',
    fields: ['事实片段', '感受', '当时解释', '为什么重要', '下一步小行动', '保留问题'],
    checks: ['至少写出一个可被第三方观察到的事实片段', '感受词和解释句分成不同字段', '只有一个 15 分钟内可启动的下一步小行动'],
  },
  'personal-journal/morning-journal': {
    lens: 'Peter Drucker + Gollwitzer 的执行意图视角',
    insight: '晨间记录的价值是把注意力从愿望收束到今天的触发条件、优先级和第一步。',
    fields: ['今日意图', '当前精力信号', '今日前三优先级', '现实约束', '今日边界', 'if-then 启动句', '第一小行动'],
    checks: ['列出今天明确不做的一件事', '每个优先级都有可启动的第一步', '包含一个 if-then 触发句'],
  },
  'personal-journal/evening-journal': {
    lens: 'Donald Schon + Kahneman 的晚间复盘视角',
    insight: '晚间记录要避免只被最后一件事支配，先列事实，再写感受和解释，最后完成收尾。',
    fields: ['三个事实', '事件', '感受', '我给事件的解释', '今日收尾动作', '未关闭事项', '明日一件事'],
    checks: ['至少记录两个非最后时段发生的事实', '明确区分事实、感受、解释', '把明日行动压缩为一件事'],
  },
  'personal-journal/emotion-log': {
    lens: 'Lisa Feldman Barrett + James Gross 的情绪标注视角',
    insight: '情绪记录不是分析自己，而是给状态贴上更精确的标签，并记录触发、身体信号、解释和可做动作。',
    fields: ['事实触发', '身体信号', '情绪标签', '强度 1-5', '我当时的解释', '当下可做动作', '后续观察时间'],
    checks: ['写的是具体触发事件而不是笼统原因', '身体信号和情绪标签是两个独立字段', '不出现诊断、人格判断或治疗建议'],
  },
  'personal-journal/goal-okr': {
    lens: 'John Doerr + Locke & Latham 的个人目标视角',
    insight: '个人 OKR 要把愿望变成可观察进度：目标、关键结果、领先指标、风险和下一步动作必须连起来。',
    fields: ['目标', '关键结果', '领先指标', '当前证据', '信心依据', '反目标', '下一步行动', '下次检查日期'],
    checks: ['每个 KR 都有可度量当前值', '信心分数后面有事实依据', '下一步行动能直接推动某个 KR'],
  },
  'personal-journal/review-journal': {
    lens: 'Kolb + Donald Schon 的经验学习视角',
    insight: '复盘不是自我评价，而是把目标、结果、证据、原因假设和下一轮调整连成学习闭环。',
    fields: ['周期', '原目标', '结果证据', '原因假设', '可复用经验', '下一轮调整'],
    checks: ['结果字段包含数字、产物或事实证据', '原因写成假设而不是定论', '下一轮调整具体到时间或触发条件'],
  },
  'personal-journal/decision-journal': {
    lens: 'Annie Duke + Tetlock 的决策日志视角',
    insight: '好决策日志要保留当时知道什么、不知道什么、各选项取舍和未来如何复盘，避免事后聪明。',
    fields: ['决策问题', '已知事实', '选项', '判断标准', '关键假设', '情绪/压力信号', '预期结果与概率', '复盘触发条件'],
    checks: ['每个选项都有明确取舍', '至少写出一个可能推翻决策的假设', '有具体复盘日期或触发条件'],
  },
  'personal-journal/habit-tracking': {
    lens: 'BJ Fogg + Wendy Wood 的习惯形成视角',
    insight: '习惯记录不要只看意志力，要记录触发、摩擦、奖励、连续证据和下一次更小的调整。',
    fields: ['习惯', '触发条件', '进度', '连续天数', '行为完成证据', '摩擦点', '奖励/反馈', '下一次更小动作'],
    checks: ['记录触发条件而不是只写目标', '完成情况有日期、次数或截图等证据', '下一次动作比当前动作更容易启动'],
  },
  'personal-journal/travel-plan': {
    lens: 'Rick Steves + Gary Klein 的旅行预演视角',
    insight: '旅行计划的核心不是景点清单，而是目的、约束、动线、预算、备用方案和待确认事项。',
    fields: ['出行目的', '日期与地点', '行程动线', '交通', '住宿', '预算', '关键约束', '备用方案'],
    checks: ['每一天都有地点、交通和住宿状态', '预算包含交通、住宿、餐饮和机动项', '每个高风险事项都有备用方案'],
  },
  'personal-journal/purchase-decision': {
    lens: 'Wirecutter 评测方法 + 行为决策偏差视角',
    insight: '购买决策要先写真实需求和不可妥协条件，再比较总成本、证据、取舍和复盘触发。',
    fields: ['真实需求', '不可妥协条件', '替代方案', '总拥有成本', '使用频率假设', '不买的代价', '取舍', '复盘日期'],
    checks: ['先写不买或延迟购买的选项', '比较总拥有成本而不仅是标价', '每个候选项至少有一条来源证据'],
  },
  'personal-journal/family-affairs': {
    lens: 'Harvard Negotiation Project 的原则谈判视角',
    insight: '家庭事务记录应把人、事实、责任、待确认和跟进分开，避免把解释写成对人的判断。',
    fields: ['相关人及角色', '具体事件', '时间线', '各方明确表达的需求', '责任与决策权', '待确认问题', '跟进时间'],
    checks: ['只记录对方明确说过或做过的事实', '责任人与决策权没有混在一起', '每个待确认问题都有跟进人和时间'],
  },
  'personal-journal/personal-plan': {
    lens: 'David Allen + Peter Drucker 的结果优先规划视角',
    insight: '个人计划要从期望结果倒推约束、资源、时间块、风险和下一步，而不是堆愿望清单。',
    fields: ['期望结果', '范围边界', '可用资源', '时间块', '完成清单', '风险', '下一步行动', '复盘日期'],
    checks: ['写清不在本计划范围内的事项', '每个阶段都有产出或完成标准', '下一步行动有具体时间块'],
  },
  'content-creation/article-draft': {
    lens: '资深长文主编的论证编辑视角',
    insight: '文章不是素材堆叠，而是一条可辩护的主张链：受众问题、中心主张、证据顺序、反对意见和结尾动作必须连成闭环。',
    fields: ['受众问题', '读者承诺', '中心主张', '证据地图', '关键论点', '反对意见', '发布渠道', '最终事实检查'],
    checks: ['受众问题能用一句话写出，且开头前 120 字回应这个问题', '每个关键论点至少绑定一个证据或来源', '发布前确认标题、导语、结尾行动、链接、日期和引用来源'],
  },
  'content-creation/talk-outline': {
    lens: 'TED 风格演讲教练的听众迁移视角',
    insight: '演讲大纲的核心不是 slide list，而是听众状态变化：进场时相信什么，离场时应该相信什么，中间靠哪些转折完成迁移。',
    fields: ['听众状态变化', '开场 hook', '信念弧线', '关键 takeaway', '证据时刻', '互动/停顿', '时间预算'],
    checks: ['每个段落标出听众状态变化，不能只列主题', '每个核心观点对应一个例子、数据、故事或演示证据', '发布前确认总时长、开场 60 秒、转场句、收尾行动和设备需求'],
  },
  'content-creation/talk-ppt-outline': {
    lens: 'TED 风格演讲教练的听众迁移视角',
    insight: 'PPT 大纲的核心不是页数，而是每页推动听众从一个状态迁移到下一个状态。',
    fields: ['听众状态变化', '开场 hook', '信念弧线', '幻灯片信息', '证据时刻', '视觉提示', '时间预算'],
    checks: ['每页都标出信息、证据和听众状态变化', '每个核心观点对应一个例子、数据、故事或演示证据', '发布前确认总时长、转场句、视觉素材和设备需求'],
  },
  'content-creation/social-plan': {
    lens: '增长内容负责人的分发实验视角',
    insight: '社媒计划不是排期表，而是同一主张在不同平台的分发实验：hook、格式、受众细分、复用路径和衡量口径要一起设计。',
    fields: ['受众细分', '平台', 'hook 角度', '核心主张', '内容格式', '平台适配', '复用路径', '成功指标'],
    checks: ['每条内容写清目标受众、平台、hook 和读者下一步', '每个核心主张有证据、案例、截图、链接或公开来源', '发布前确认平台限制、链接、图片比例、排期时区和衡量指标'],
  },
  'content-creation/social-content-plan': {
    lens: '增长内容负责人的分发实验视角',
    insight: '社媒内容计划要把同一主张拆成平台化实验，并保留复用路径和复盘日期。',
    fields: ['受众细分', '平台', 'hook 角度', '核心主张', '内容格式', '平台适配', '复用路径', '复盘日期'],
    checks: ['每条内容写清目标受众、平台、hook 和读者下一步', '每个核心主张有证据、案例、截图、链接或公开来源', '发布前确认平台限制、链接、图片比例、排期时区和衡量指标'],
  },
  'content-creation/product-copy': {
    lens: '产品营销负责人的转化文案视角',
    insight: '产品文案要把用户痛点、承诺、差异化和证明压缩成可选择的语言，不是把功能翻译成形容词。',
    fields: ['用户任务', '痛点', '承诺', '差异化', '反对意见', '证明资产', '文案版本', '转化目标'],
    checks: ['首屏文案同时说明受众、痛点、承诺和下一步动作', '每个价值主张绑定证明资产', '发布前确认 CTA、价格/版本信息、法律限制、链接和埋点名称'],
  },
  'content-creation/press-release': {
    lens: '企业传播总监的新闻价值视角',
    insight: '新闻稿要服务记者快速判断新闻价值：what changed, why now, who cares, proof, quote, availability 必须可抓取。',
    fields: ['新闻角度', '导语', '影响对象', '证据/指标', '发言人引用', '可用性/时间', '公司样板', '媒体联系人'],
    checks: ['导语第一段回答 what changed、who cares、why now', '所有数字、日期、客户名、引用和可用性信息有来源或审批记录', '发布前确认媒体联系人、禁发时间、链接和图片素材可公开'],
  },
  'content-creation/announcement': {
    lens: '变更沟通负责人的不确定性管理视角',
    insight: '公告的重点是减少不确定性：谁受影响、什么时候发生、用户要做什么、哪里能获得帮助，比宣传语更重要。',
    fields: ['影响对象', '变更内容', '用户影响', '生效时间', '需要的行动', '支持路径', '例外/回滚'],
    checks: ['开头写清影响对象、变化内容、生效时间和是否需要用户行动', '影响范围、例外情况和支持路径可从来源链接复核', '发布前确认时区、版本号、帮助文档、客服话术和更新路径'],
  },
  'content-creation/interview-record': {
    lens: '深度采访编辑的可追溯原话视角',
    insight: '采访记录要保留原话的可追溯性，同时提炼可发布主题；不能把受访者没说过的话润色成结论。',
    fields: ['采访目标', '采访对象', '授权范围', '转写片段', '已核验引语', '主题', '可发布摘录', '后续问题'],
    checks: ['每条可发布引语保留原文、来源位置和必要上下文', '主题洞察能追溯到转写片段', '发布前确认授权范围、匿名处理、敏感信息、事实核验和回访问题'],
  },
  'content-creation/speaker-notes': {
    lens: '高管演讲稿教练的现场执行视角',
    insight: 'speaker notes 是现场执行脚本：讲什么、何时停顿、如何转场、哪里强调、如果超时怎么删，都要能直接上台使用。',
    fields: ['段落时间', '讲法提示', '转场句', '强调语', '听众互动', '删减备选', '彩排备注'],
    checks: ['每段备注包含时间、讲法提示、转场句和强调语', '关键主张配有例子、数据、故事或现场演示提示', '发布前确认计时、删减备选、设备、读音、人名和结尾行动'],
  },
  'content-creation/newsletter-brief': {
    lens: 'Newsletter 主编的读者信任视角',
    insight: '简报要建立读者信任：稳定栏目、清晰筛选标准、少而准的摘要、可点击的下一步，比信息量更重要。',
    fields: ['读者细分', '编辑承诺', '固定栏目', '主条目', '为什么重要', '链接与来源', '订阅读者行动', '主题行'],
    checks: ['每个栏目说明读者是谁、这条信息为什么值得进入本期', '每个链接有摘要、来源和读者下一步', '发布前确认主题行、预览文本、链接、UTM、退订页和发送时间'],
  },
  'hr-operations/recruiting-interview': {
    lens: '结构化招聘专家的胜任力证据视角',
    insight: '面试记录的价值不是印象总结，而是把岗位胜任力、行为证据、录用风险和后续验证动作绑在一起。',
    fields: ['岗位/级别/胜任力模型', '候选人背景与约束', '面试阶段状态', '面试问题与能力维度', 'STAR 证据', '录用风险与验证计划', '决策负责人', '跟进截止时间'],
    checks: ['每个能力判断至少有一条可追溯证据或明确写为假设', '最终决策包含负责人、决定日期、下一步动作和截止时间', '每个录用风险都有验证动作、责任人和状态'],
  },
  'hr-operations/performance-review': {
    lens: '绩效校准与管理教练视角',
    insight: '绩效不是评价人格，而是把目标结果、行为证据、业务影响、反馈协议和成长承诺分开记录。',
    fields: ['目标/KR 与权重', '结果证据与行为例子', '差距/影响/根因', '校准状态', '反馈负责人', '成长计划里程碑', '下次 review 日期'],
    checks: ['每个评价或评级都有对应目标、证据日期和影响说明', '每个差距都有具体行为例子、改进动作和支持人', '成长计划至少包含负责人、截止时间、状态和下次检查日期'],
  },
  'hr-operations/event-plan': {
    lens: '大型活动制作人的现场控制视角',
    insight: '活动计划不是待办清单，而是成功指标、run-of-show、DRI、供应商交接和应急预案的现场控制系统。',
    fields: ['活动目标与成功指标', 'run-of-show 时间线', 'DRI/RACI', '预算负责人和上限', '供应商/场地交接', '当日指挥链', '风险触发条件与应急方案'],
    checks: ['每个关键里程碑都有 DRI、截止时间和当前状态', '每个高风险项都有触发条件、应对方案和现场负责人', '活动前交接包包含联系人、物料状态、场地/供应商确认和下一步'],
  },
  'hr-operations/sop': {
    lens: '流程卓越与检查清单专家视角',
    insight: '可执行 SOP 必须把触发条件、输入输出、步骤责任、异常路径和验收标准写清，而不是写成说明文。',
    fields: ['目的与成功标准', '适用边界/不适用边界', '触发条件', 'RACI', '步骤：输入/动作/输出/责任人', '异常处理与升级路径', '版本负责人和复审周期'],
    checks: ['每个步骤都有输入、动作、输出、责任人和完成校验', '每个异常场景都有升级负责人、SLA 或处理时限', '修订历史写清版本、修改人、日期、状态和下次复审时间'],
  },
  'hr-operations/customer-profile': {
    lens: '企业客户经营专家的健康度视角',
    insight: '客户画像应暴露客户想达成的业务结果、当前健康度、关键干系人、价值缺口和下一次推进动作。',
    fields: ['客户背景/干系人地图', '使用情况与健康信号', '期望业务结果', '已确认价值', '阻塞与异议', '续费/扩展风险', '成功计划下一步'],
    checks: ['客户健康状态必须有使用数据、客户反馈或会议证据支撑', '每个风险都有影响、缓解动作、负责人和截止时间', '下一步明确客户侧干系人、我方负责人、目标结果和状态'],
  },
  'hr-operations/kpi-tracking': {
    lens: '运营指标管理专家的控制回路视角',
    insight: 'KPI 模板要形成控制回路：定义指标、看趋势、解释偏差、指定负责人、安排下一次复盘。',
    fields: ['指标定义/口径', '当前值与数据源', '目标/阈值', '趋势与状态', '偏差解释/驱动因素', '调整动作', '复盘 cadence 与指标负责人'],
    checks: ['每个 KPI 都有口径、数据源、负责人和目标阈值', '每个 off-target 指标都有偏差解释、调整动作和截止时间', '记录中包含上次状态、本次状态变化和下一次复盘日期'],
  },
  'hr-operations/support-ticket': {
    lens: 'ITIL 支持运营负责人的可交接工单视角',
    insight: '工单的核心是可复现、可分级、可交接、可验证关闭，并且客户沟通不能断线。',
    fields: ['问题/影响范围/严重级别', 'SLA/响应状态', '环境/步骤/预期/实际', '处理时间线', '解决方案与验证结果', '交接负责人', '客户沟通记录与后续'],
    checks: ['工单包含严重级别、当前状态、SLA 负责人和下一次响应时间', '复现信息足够让接手人复查', '关闭或交接时写清验证结果、客户通知状态、下一步负责人和截止时间'],
  },
  'hr-operations/partner-communication': {
    lens: '战略合作运营专家的承诺闭环视角',
    insight: '合作沟通要把共同目标、双方承诺、资源依赖、未决请求和升级路径固定下来，避免只留下寒暄纪要。',
    fields: ['共同目标/衡量方式', '双方资源承诺', '双方分工/RACI', '依赖与决策权', '未决请求', '风险与升级路径', '下一次同步时间'],
    checks: ['每个合作承诺都标明我方负责人、对方负责人、截止时间和状态', '每个未决请求都有决策人、所需材料和目标决定日期', '每个合作风险都有依赖方、升级路径和下一步动作'],
  },
  'hr-operations/customer-success': {
    lens: '客户成功负责人的生命周期视角',
    insight: '客户成功记录必须连接生命周期阶段、健康信号、价值实现、续费/扩展机会和下一步成功计划。',
    fields: ['生命周期阶段', '健康状态/风险等级', '使用情况与采用率', '已交付价值/业务结果', '续费/扩展信号', '干系人负责人', '下一步成功计划'],
    checks: ['健康状态必须由使用数据、客户反馈或价值交付证据支持', '续费/扩展信号写清来源干系人、金额或范围假设、风险状态', '下一步同时包含 CSM 负责人、客户侧负责人、截止时间和期望结果'],
  },
  'hr-operations/customer-success-followup': {
    lens: '客户成功跟进专家的承诺闭环视角',
    insight: '跟进记录的重点是闭环上次承诺：状态发生了什么变化、客户是否确认、还剩什么风险、下一次何时推进。',
    fields: ['上次承诺与当前状态', '使用变化', '本轮交付价值', '客户确认/反馈', '未闭环风险', '本轮续费/扩展信号', '下次跟进触发条件'],
    checks: ['上次承诺的每个动作都有 done/open/blocked 状态和说明', '本轮价值或风险变化有客户确认、使用数据或会议证据', '下次跟进写清触发条件、负责人、截止时间和客户动作'],
  },
}

const familyExpertProfiles = {
  'project-docs': {
    lens: 'Senior Project Manager 的执行系统视角',
    insight: '项目文档要把目标、边界、责任、风险和验收口径固定下来，让后续协作不依赖口头记忆。',
    checks: ['范围必须能区分做什么和不做什么', '责任人和验收口径必须可见', '高风险项必须有缓解动作或升级路径'],
  },
  'technical-docs': {
    lens: '资深架构师的证据链视角',
    insight: '技术文档要把问题、约束、方案、验证、回滚和未覆盖风险连成证据链，避免只留下实现描述。',
    checks: ['关键结论能回指需求、日志、测试或约束来源', '验证方式包含命令、指标或验收样例', '回滚或恢复路径写清触发条件和负责人'],
  },
  'learning-notes': {
    lens: '学习设计专家的闭环视角',
    insight: '学习笔记的目标不是保存更多材料，而是完成理解验证、迁移应用和复习闭环。',
    checks: ['必须有自己的复述或解释', '至少有一个可迁移的应用场景或练习动作', '复习问题、复习时间或后续阅读必须可见'],
  },
  'personal-journal': {
    lens: '专业个人记录员的事实分离视角',
    insight: '个人日志要把事实、感受、解释和下一步小行动分开，避免把一时判断写成不可更改的结论。',
    checks: ['事实、感受和解释没有混写', '下一步小行动足够具体且可完成', '需要复盘的判断有日期或触发条件'],
  },
  'content-creation': {
    lens: '资深主编的读者任务视角',
    insight: '内容模板要服务读者行动：先明确受众和主张，再组织证据、结构和发布校验。',
    checks: ['受众和读者下一步行动明确', '主张和证据分开', '发布前检查事实、链接、日期和语气'],
  },
  'hr-operations': {
    lens: '运营负责人的闭环交接视角',
    insight: '运营记录的价值在于让责任、状态、风险、交接和下一步可追踪，避免只留下过程描述。',
    checks: ['每个状态都有负责人或归属对象', '风险和异常有升级路径', '下一步动作写清负责人、截止时间和验收方式'],
  },
}

function templateProfile(family, title, baseSubtype = title) {
  return (
    expertTemplateProfiles[`${family}/${title}`] ??
    expertTemplateProfiles[`${family}/${baseSubtype}`] ??
    familyExpertProfiles[family]
  )
}

function templateSpec(family, title) {
  const meta = familyMeta[family] ?? familyMeta['meeting-collaboration']
  const { core, variants } = parseFamilyRules(meta)
  const variantNote = variants.get(title) ?? ''
  const overrideFields = subtypeOverride(subtypeFieldOverrides, family, title)
  const baseSubtype =
    title === 'monthly-report' || title === 'quarterly-report'
      ? 'monthly-quarterly-report'
      : baseSubtypeFromVariant(variantNote, family) ?? title
  const base = core.get(title) ?? core.get(baseSubtype) ?? {
    fields: meta.fields,
    components: meta.recommended,
    useWhen: meta.signal,
    avoidWhen: meta.avoid,
  }
  const profile = templateProfile(family, title, baseSubtype)

  return {
    family,
    title,
    label: subtypeLabels[family === 'hr-operations' && title === 'performance-review' ? 'hr-operations-performance-review' : title] ?? `${title.replace(/-/g, ' ')} ${meta.label}`,
    fields: profile?.fields ?? overrideFields ?? (base.fields.length > 0 ? base.fields : meta.fields),
    components: base.components.length > 0 ? base.components : meta.recommended,
    baseSubtype,
    variantNote,
    intro: scenarioIntros[title] ?? scenarioIntros[baseSubtype] ?? profile?.insight ?? `${meta.label}场景记录模板，按素材替换占位内容。`,
  }
}

function exampleTitle(family, title) {
  return templateSpec(family, title).label
}

function fieldRows(fields) {
  return fields.slice(0, 8).map((field) => [
    translatedField(field),
    `【填写 ${translatedField(field)}】`,
  ])
}

function fieldTable(fields) {
  return `<Table
  headers={["记录项", "内容"]}
  rows={${JSON.stringify(fieldRows(fields), null, 4)}}
/>`
}

function summaryWhen(spec) {
  if (spec.title === 'brainstorm') {
    return '当讨论处于发散状态，需要整理背景问题、观点逻辑关系、共识和下一步实验时使用。'
  }

  const fields = spec.fields
    .slice(0, 4)
    .map(translatedField)
    .join('、')
  return `当需要记录${spec.label}，并梳理${fields}时使用。`
}

function expertProfile(spec) {
  const profile = templateProfile(spec.family, spec.title, spec.baseSubtype)
  return profile ?? {
    lens: '专业记录员',
    insight: '把事实、判断、风险和下一步分开记录，让读者打开后能直接复核和执行。',
    checks: [
      '结论能脱离上下文独立读懂',
      '关键判断都有事实、证据或假设来源',
      '下一步写清负责人、截止时间和触发条件',
    ],
  }
}

function expertCallout(spec) {
  const profile = expertProfile(spec)
  return `<Callout type="tip" title="专业校准">
  ${profile.lens}：${profile.insight}
</Callout>`
}

function qualityChecklist(spec) {
  const profile = expertProfile(spec)
  return `<Checklist
  items={${JSON.stringify(
    profile.checks.map((text) => ({ text })),
    null,
    4,
  )}}
/>`
}

function sourceList() {
  return `<ReferenceList
  sources={[
    { path: "2605/raw/source.txt", label: "原始素材", type: "text" },
  ]}
/>`
}

function actionTable(label, action = '【下一步动作】') {
  return `<ActionTable
  items={[
    { action: "${action}", owner: "【负责人】", due: "【截止时间】", source: "${label}", status: "open" },
  ]}
/>`
}

function riskMatrix(label = '风险') {
  return `<RiskMatrix
  risks={[
    { risk: "【${label}】", likelihood: "【概率】", impact: "【影响】", severity: "【级别】", mitigation: "【应对/验证】" },
  ]}
/>`
}

function evidenceInsight(evidenceTitle = '关键证据', insightTitle = '记录员判断') {
  return `<EvidenceCard title="${evidenceTitle}" source="【来源】">
  【保留事实、数字、原话、日志、截图或链接；不要把推断写成证据。】
</EvidenceCard>

<InsightCard title="${insightTitle}">
  【从证据推出判断，并写清限制、假设或下一步验证。】
</InsightCard>`
}

function decisionRecord(spec, question = '【要决定什么】', decision = '【最终选择或暂定方向】') {
  return `<DecisionRecord
  question="${question}"
  decision="${decision}"
  owner="【负责人】"
  due="【复核时间】"
  options={[
    { label: "方案 A", tradeoff: "【收益、代价、适用条件】" },
    { label: "方案 B", tradeoff: "【收益、代价、适用条件】" },
  ]}
  rationale="【记录关键证据、转折点，以及为什么当前结论成立。】"
/>`
}

function optionMatrix() {
  return `<OptionMatrix
  columns={["收益", "代价", "适用条件", "风险"]}
  rows={[
    { label: "方案 A", values: ["【收益】", "【代价】", "【适用条件】", "【风险】"] },
    { label: "方案 B", values: ["【收益】", "【代价】", "【适用条件】", "【风险】"] },
  ]}
/>`
}

function coreMetrics() {
  return `<StatGroup>
  <Stat label="当前值" value={"【数值】"} />
  <Stat label="目标值" value={"【数值】"} />
  <Stat label="风险项" value={"【数量】"} />
</StatGroup>`
}

function brainstormTemplate(spec) {
  return `<Subtitle>把发散讨论整理成可执行共识：先写背景问题，再整理观点、推理关系、共识和下一步实验。</Subtitle>

${expertCallout(spec)}

## 背景问题

<Callout type="note" title="要解决的问题">
  【写清楚这次头脑风暴的触发背景、当前卡点、目标和边界。例：模板页太像说明书，读者希望打开后直接拿到可用框架。】
</Callout>

## 观点与逻辑

<Table
  headers={["观点", "主张", "推理过程", "关系", "当前处理"]}
  rows={[
    ["观点 A", "【主张是什么】", "【为什么成立；依赖哪些事实或假设】", "并列 / 互补 / 互斥 / 组合 / 依赖", "保留 / 组合 / 放弃 / 待验证"],
    ["观点 B", "【主张是什么】", "【与观点 A 的关系；解决同一问题还是不同问题】", "并列 / 互补 / 互斥 / 组合 / 依赖", "保留 / 组合 / 放弃 / 待验证"],
    ["观点 C", "【主张是什么】", "【收益、风险、适用条件】", "并列 / 互补 / 互斥 / 组合 / 依赖", "保留 / 组合 / 放弃 / 待验证"],
  ]}
/>

## 共识

<DecisionRecord
  question="这轮讨论最后收敛到什么方向？"
  decision="【写最终共识：吸收了哪些观点，排除了哪些观点，哪些仍需验证。】"
  rationale="【写共识成立的逻辑：例如 A 和 B 是互补关系，可以组合；C 与目标互斥，暂不采用。】"
/>

## 下一步实验

<ActionTable
  items={[
    { action: "【实验 1：要验证什么】", owner: "【负责人】", due: "【截止时间】", source: "头脑风暴", status: "open" },
    { action: "【实验 2：要验证什么】", owner: "【负责人】", due: "【截止时间】", source: "头脑风暴", status: "open" },
  ]}
/>

${qualityChecklist(spec)}`
}

function meetingTemplate(spec) {
  if (spec.title === 'brainstorm') return brainstormTemplate(spec)
  if (['decision-review', 'requirement-review', 'technical-review', 'design-review', 'strategic-decision'].includes(spec.title)) {
    return `<Subtitle>${spec.intro}</Subtitle>

${expertCallout(spec)}

## 问题与背景

${fieldTable(spec.fields)}

## 方案与取舍

<DecisionRecord
  question="【这次评审要决定什么】"
  decision="【最终选择或暂定方向】"
  owner="【负责人】"
  due="【复核时间】"
  options={[
    { label: "方案 A", tradeoff: "【收益、代价、适用条件】" },
    { label: "方案 B", tradeoff: "【收益、代价、适用条件】" },
  ]}
  rationale="【记录关键证据、转折点，以及为什么当前结论成立。】"
/>

## 行动项

<ActionTable
  items={[
    { action: "【补充证据或验证】", owner: "【负责人】", due: "【截止时间】", source: "${spec.label}", status: "open" },
  ]}
/>

${qualityChecklist(spec)}`
  }
  if (['progress-sync', 'daily-standup'].includes(spec.title)) {
    return `<Subtitle>${spec.intro}</Subtitle>

${expertCallout(spec)}

<StatGroup>
  <Stat label="正常推进" value={"【数量】"} />
  <Stat label="存在阻塞" value={"【数量】"} />
  <Stat label="需要协助" value={"【数量】"} />
</StatGroup>

## 进展与阻塞

${fieldTable(spec.fields)}

<RiskMatrix
  risks={[
    { risk: "【阻塞或风险】", likelihood: "【概率】", impact: "【影响】", severity: "【级别】", mitigation: "【处理方式】" },
  ]}
/>

<ActionTable
  items={[
    { action: "【下一步动作】", owner: "【负责人】", due: "【截止时间】", source: "${spec.label}", status: "open" },
  ]}
/>

${qualityChecklist(spec)}`
  }
  if (['interview-1on1', 'customer-visit'].includes(spec.title)) {
    return `<Subtitle>${spec.intro}</Subtitle>

${expertCallout(spec)}

## 对象与背景

${fieldTable(spec.fields)}

<QuoteCard quote="【保留一句最能代表对方需求、顾虑或信号的原话。】" source="${spec.label}" />

<InsightCard title="记录员判断">
  【从事实中提炼判断：对方真正关心什么、有哪些风险、下一步应该如何跟进。】
</InsightCard>

<ActionTable
  items={[
    { action: "【跟进行动】", owner: "【负责人】", due: "【截止时间】", source: "${spec.label}", status: "open" },
  ]}
/>

${qualityChecklist(spec)}`
  }
  return `<Subtitle>${spec.intro}</Subtitle>

${expertCallout(spec)}

## 会议主线

${fieldTable(spec.fields)}

<DecisionList
  decisions={[
    {
      question: "【本次会议最重要的问题】",
      decision: "【已达成一致或暂定结论】",
      rationale: "【保留分歧、证据和未解决问题。】",
    },
  ]}
/>

<ActionTable
  items={[
    { action: "【行动项】", owner: "【负责人】", due: "【截止时间】", source: "${spec.label}", status: "open" },
  ]}
/>

${qualityChecklist(spec)}`
}

function workReportTemplate(spec) {
  return `<Subtitle>${spec.intro}</Subtitle>

${expertCallout(spec)}

<Callout type="note" title="结论">
  【一句话写清本周期状态：完成了什么、最大风险是什么、下一步最重要的动作是什么。】
</Callout>

<StatGroup>
  <Stat label="完成项" value={"【数量】"} />
  <Stat label="风险" value={"【数量】"} />
  <Stat label="下阶段重点" value={"【数量】"} />
</StatGroup>

## 汇报内容

${fieldTable(spec.fields)}

<RiskMatrix
  risks={[
    { risk: "【风险】", likelihood: "【概率】", impact: "【影响】", severity: "【级别】", mitigation: "【应对】" },
  ]}
/>

<ActionTable
  items={[
    { action: "【下一步动作】", owner: "【负责人】", due: "【截止时间】", source: "${spec.label}", status: "open" },
  ]}
/>

${qualityChecklist(spec)}`
}

function projectTemplate(spec) {
  let body = ''
  if (spec.title === 'technical-proposal') {
    body = `## 目标、约束与方案

${fieldTable(spec.fields)}

${optionMatrix()}

${decisionRecord(spec, '这份技术方案最终建议什么？', '【推荐方案与决策状态】')}

${riskMatrix('上线、迁移或回滚风险')}

${actionTable(spec.label, '【补充验证或推进上线】')}`
  } else if (spec.title === 'release-checklist') {
    body = `## 发布状态

<StatusBadge status="【ready / blocked / done】" tone="warning" />

${fieldTable(spec.fields)}

<Checklist
  items={[
    { text: "【前置条件已确认】" },
    { text: "【灰度/回滚开关已确认】" },
    { text: "【监控信号已确认】" },
    { text: "【沟通对象已确认】" },
  ]}
/>

${decisionRecord(spec, '是否 Go / No-Go？', '【Go / No-Go / 延后】')}

${riskMatrix('发布风险')}`
  } else if (spec.title === 'roadmap') {
    body = `## 路线图

${fieldTable(spec.fields)}

<Kanban
  columns={[
    { title: "Now", items: [{ text: "【当前承诺事项：结果目标 + owner】", tags: ["committed"] }] },
    { title: "Next", items: [{ text: "【待验证事项：假设 + 决策门槛】", tags: ["validation"] }] },
    { title: "Later", items: [{ text: "【暂缓事项：不确定性或依赖】", tags: ["uncertain"] }] },
  ]}
/>

<DecisionList
  decisions={[
    {
      question: "【这轮路线图做了什么取舍】",
      decision: "【保留 / 推迟 / 放弃的方向】",
      rationale: "【证据、依赖和不做事项。】",
    },
  ]}
/>

${riskMatrix('路线图风险/假设风险')}`
  } else if (spec.title === 'changelog') {
    body = `## 变更账本

${fieldTable(spec.fields)}

<Table
  headers={["类型", "变更", "影响对象", "迁移/兼容性", "来源"]}
  rows={[
    ["Added", "【新增内容】", "【影响对象】", "【是否需要迁移】", "【PR/issue/source】"],
    ["Changed", "【变更内容】", "【影响对象】", "【兼容性影响】", "【PR/issue/source】"],
    ["Fixed", "【修复内容】", "【影响对象】", "【验证方式】", "【PR/issue/source】"],
    ["Breaking", "【破坏性变更】", "【影响对象】", "【迁移动作】", "【PR/issue/source】"],
  ]}
/>

<Callout type="warning" title="Breaking changes">
  【写清用户或系统需要采取的迁移动作；没有破坏性变更时写“无”。】
</Callout>`
  } else if (spec.title === 'project-retrospective') {
    body = `## 事实与复盘

${fieldTable(spec.fields)}

<Timeline
  items={[
    { time: "【时间点】", title: "【关键事实】", desc: "【影响或证据】" },
  ]}
/>

${evidenceInsight('复盘事实证据', '系统性原因与可复用经验')}

${actionTable(spec.label, '【下一轮修复实验或复用动作】')}

${riskMatrix('复发风险')}`
  } else if (['prd', 'user-story', 'requirement-pool', 'test-plan'].includes(spec.title)) {
    body = `## 可验收结构

${fieldTable(spec.fields)}

<Checklist
  items={[
    { text: "【验收条件或入口标准】" },
    { text: "【边界或不适用条件】" },
    { text: "【来源或证据已补齐】" },
  ]}
/>

${evidenceInsight('需求/测试证据', '处理判断')}

${actionTable(spec.label, '【补证据、拆分、测试或确认】')}`
  } else {
    body = `## 目标、边界与执行节奏

${fieldTable(spec.fields)}

<MilestoneTimeline
  items={[
    { time: "【阶段 1】", title: "【里程碑】", desc: "【交付物与验收】" },
    { time: "【阶段 2】", title: "【里程碑】", desc: "【交付物与验收】" },
  ]}
/>

<RACI
  rows={[
    { work: "【关键事项】", responsible: "【R】", accountable: "【A】", consulted: "【C】", informed: "【I】" },
  ]}
/>

${riskMatrix('项目风险')}

${actionTable(spec.label, '【下一步行动】')}`
  }

  return `<Subtitle>${spec.intro}</Subtitle>

${expertCallout(spec)}

<Callout type="note" title="项目结论">
  【写清项目目标、当前边界、最重要的验收口径。】
</Callout>

${body}

${qualityChecklist(spec)}`
}

function researchTemplate(spec) {
  return `<Subtitle>${spec.intro}</Subtitle>

${expertCallout(spec)}

<Callout type="note" title="研究问题">
  【写清这次研究要回答的问题，以及本页结论适用的范围。】
</Callout>

## 研究记录

${fieldTable(spec.fields)}

<EvidenceCard title="关键证据" source="【来源】">
  【保留样本、数字、原文或观察事实；不要把推测写成证据。】
</EvidenceCard>

<InsightCard title="洞察">
  【从证据推出判断，并说明限制条件。】
</InsightCard>

${qualityChecklist(spec)}`
}

function learningTemplate(spec) {
  let body = ''
  if (spec.title === 'course-video-note') {
    body = `<QuoteCard quote="【摘录最关键的一句话或概念表述。】" source="【来源】" />

## 视频学习记录

${fieldTable(spec.fields)}

<Transcript
  items={[
    { speaker: "【讲者】", time: "【时间点】", text: "【关键片段】", src: "2605/raw/course-video.mp4" },
  ]}
  title="关键时间点"
/>

${actionTable(spec.label, '【练习任务或回看动作】')}`
  } else if (spec.title === 'literature-matrix') {
    body = `## 文献矩阵

${fieldTable(spec.fields)}

<ComparisonMatrix
  columns={["研究问题", "方法/样本", "发现", "限制", "可复用点"]}
  rows={[
    { label: "【论文 A】", values: ["【问题】", "【方法】", "【发现】", "【限制】", "【复用点】"] },
    { label: "【论文 B】", values: ["【问题】", "【方法】", "【发现】", "【限制】", "【复用点】"] },
    { label: "【论文 C】", values: ["【问题】", "【方法】", "【发现】", "【限制】", "【复用点】"] },
  ]}
/>

${evidenceInsight('关键论文证据', '共识、冲突与研究缺口')}`
  } else if (spec.title === 'learning-plan') {
    body = `<RatingBar score={3} max={5} label="当前掌握度" />

## 训练计划

${fieldTable(spec.fields)}

<Progress value={40} label="【总体进度】" />

${actionTable(spec.label, '【刻意练习任务】')}`
  } else if (spec.title === 'flashcard') {
    body = `## 主动回忆卡

${fieldTable(spec.fields)}

<RatingBar score={3} max={5} label="掌握程度" />

<Checklist
  items={[
    { text: "【下次复习时间】" },
    { text: "【易错点】" },
    { text: "【迁移情境题】" },
  ]}
/>`
  } else if (['feynman-note', 'concept-explanation', 'problem-solving'].includes(spec.title)) {
    body = `## 理解验证

${fieldTable(spec.fields)}

<ComparisonMatrix
  columns={["原解释/尝试", "问题或反例", "修正版", "迁移场景"]}
  rows={[
    { label: "【轮次 1】", values: ["【原解释或尝试】", "【卡壳点】", "【修正版】", "【新例子或迁移题】"] },
  ]}
/>

${evidenceInsight('来源或题目证据', '理解缺口与修正')}`
  } else {
    body = `<QuoteCard quote="【摘录最关键的一句话或概念表述。】" source="【来源】" />

## 学习记录

${fieldTable(spec.fields)}

<InsightCard title="我的理解">
  【用自己的话解释；如果讲不清，写出卡住的地方。】
</InsightCard>

<Checklist
  items={[
    { text: "【需要复习的问题】" },
    { text: "【可以迁移到工作的做法】" },
  ]}
/>`
  }

  return `<Subtitle>${spec.intro}</Subtitle>

${expertCallout(spec)}

${body}

${qualityChecklist(spec)}`
}

function personalTemplate(spec) {
  let body = ''
  if (spec.title === 'emotion-log') {
    body = `<RatingBar score={3} max={5} label="强度" />

## 情绪记录

${fieldTable(spec.fields)}

<Callout type="note" title="事实、身体信号、解释分开">
  【先写触发事件和身体信号，再写情绪标签和当时解释；不要做人格判断或诊断。】
</Callout>

<Checklist
  items={[
    { text: "【后续观察时间】" },
    { text: "【当下可做的小动作】" },
  ]}
/>`
  } else if (['goal-okr', 'habit-tracking', 'learning-plan'].includes(spec.title)) {
    body = `${coreMetrics()}

## 进度记录

${fieldTable(spec.fields)}

<Progress value={50} label="【当前进度】" />

${riskMatrix('阻塞或摩擦')}

${actionTable(spec.label, '【下一步更小动作】')}`
  } else if (['decision-journal', 'purchase-decision'].includes(spec.title)) {
    body = `## 决策记录

${fieldTable(spec.fields)}

${optionMatrix()}

${decisionRecord(spec, '这次要做什么个人决策？', '【最终选择或暂缓】')}

${riskMatrix('关键假设失败风险')}`
  } else if (['travel-plan', 'family-affairs', 'personal-plan'].includes(spec.title)) {
    body = `## 事实、责任与动线

${fieldTable(spec.fields)}

<Timeline
  items={[
    { time: "【时间/日期】", title: "【关键事项】", desc: "【地点、责任或状态】" },
  ]}
/>

${actionTable(spec.label, '【下一步小行动或跟进】')}

${riskMatrix('约束或待确认风险')}`
  } else {
    body = `<RatingBar score={3} max={5} label="【状态评分】" />

## 记录内容

${fieldTable(spec.fields)}

<Callout type="note" title="事实、感受、解释分开">
  【把事件、感受和判断分开写；不要急着评价自己。】
</Callout>

<Checklist
  items={[
    { text: "【下一步小行动】" },
    { text: "【需要复盘的观察】" },
  ]}
/>`
  }

  return `<Subtitle>${spec.intro}</Subtitle>

${expertCallout(spec)}

${body}

${qualityChecklist(spec)}`
}

function technicalTemplate(spec) {
  let body = ''
  if (spec.title === 'api-doc') {
    body = `## API 契约

${fieldTable(spec.fields)}

<Table
  headers={["位置", "参数", "类型", "必填", "约束"]}
  rows={[
    ["path", "【参数名】", "【类型】", "【是/否】", "【约束】"],
    ["query", "【参数名】", "【类型】", "【是/否】", "【约束】"],
    ["body", "【字段名】", "【类型】", "【是/否】", "【约束】"],
  ]}
/>

<CopyButton text="curl -X GET '【endpoint】' -H 'Authorization: Bearer 【token】'" label="复制请求示例" />

<Table
  headers={["错误码", "原因", "是否可重试", "调用方动作"]}
  rows={[
    ["【HTTP/status】", "【错误原因】", "【是/否】", "【恢复动作】"],
  ]}
/>`
  } else if (spec.title === 'debug-record') {
    body = `## 证据链

${fieldTable(spec.fields)}

${evidenceInsight('关键日志 / trace / metric', '根因判断')}

<Table
  headers={["假设", "验证实验", "结果", "状态"]}
  rows={[
    ["【假设 1】", "【命令、日志或复现步骤】", "【结果】", "confirmed / ruled out / pending"],
  ]}
/>

${actionTable(spec.label, '【补测试、补监控或清理动作】')}`
  } else if (spec.title === 'incident-rca') {
    body = `## 事故时间线

${fieldTable(spec.fields)}

<IncidentTimeline
  items={[
    { time: "【检测时间】", title: "检测到异常", impact: "【用户/业务影响】" },
    { time: "【确认时间】", title: "确认范围", impact: "【影响范围】" },
    { time: "【缓解时间】", title: "开始缓解", impact: "【剩余影响】" },
    { time: "【恢复时间】", title: "恢复完成", impact: "【恢复标准】" },
  ]}
/>

${evidenceInsight('告警、日志、工单或用户反馈', '根因与促成因素')}

${riskMatrix('复发风险')}

${actionTable(spec.label, '【预防动作】')}`
  } else if (['deployment-runbook', 'migration-guide'].includes(spec.title)) {
    body = `## 执行步骤

${fieldTable(spec.fields)}

<Checklist
  items={[
    { text: "【部署/迁移前检查】" },
    { text: "【执行中检查】" },
    { text: "【完成后验证】" },
    { text: "【回滚后验证】" },
  ]}
/>

<CopyButton text="【精确命令或脚本】" label="复制命令" />

${riskMatrix('执行、数据或兼容风险')}

${actionTable(spec.label, '【人工确认、回滚或补验证】')}`
  } else if (spec.title === 'code-review') {
    body = `## 评审发现

${fieldTable(spec.fields)}

<Table
  headers={["发现", "严重度", "证据", "必改项", "验证"]}
  rows={[
    ["【发现】", "high / medium / low", "【文件、函数、测试或行为证据】", "【必须修改什么】", "【验证命令或测试】"],
  ]}
/>

${riskMatrix('行为变化或回归风险')}

${actionTable(spec.label, '【必要修复或补验证】')}`
  } else if (spec.title === 'code-snippet') {
    body = `## 可复用片段

${fieldTable(spec.fields)}

\`\`\`ts
// 【最小可运行代码：包含必要 import、输入示例和预期输出】
\`\`\`

<CopyButton text="【可复制命令或核心片段】" label="复制片段" />

<Callout type="warning" title="边界">
  【写清不适用场景、依赖版本、容易误用的前置条件。】
</Callout>`
  } else {
    body = `## 技术选择与验证

${fieldTable(spec.fields)}

${optionMatrix()}

${decisionRecord(spec, '这份技术文档要固定什么结论？', '【核心设计、提案或架构决策】')}

<Mermaid
  chart={"flowchart LR\\n  A[【输入/调用方】] --> B[【核心模块】]\\n  B --> C[【输出/依赖】]"}
  caption="【架构、数据流或迁移关系】"
/>

${riskMatrix('技术、兼容或上线风险')}`
  }

  return `<Subtitle>${spec.intro}</Subtitle>

${expertCallout(spec)}

<Callout type="warning" title="结论">
  【写清问题、根因或方案结论；同时保留未覆盖风险。】
</Callout>

${body}

${qualityChecklist(spec)}`
}

function contentTemplate(spec) {
  let body = ''
  if (['talk-outline', 'talk-ppt-outline', 'speaker-notes'].includes(spec.title)) {
    body = `## 现场结构

${fieldTable(spec.fields)}

<Timeline
  items={[
    { time: "【分钟】", title: "【段落/幻灯片】", desc: "【信息、证据、转场或讲法提示】" },
  ]}
/>

<QuoteCard quote="【需要准确说出的强调语或转场句。】" source="${spec.label}" />

<Checklist
  items={[
    { text: "【计时已演练】" },
    { text: "【设备和素材已确认】" },
    { text: "【收尾行动已确认】" },
  ]}
/>`
  } else if (['social-plan', 'social-content-plan'].includes(spec.title)) {
    body = `## 分发实验

${fieldTable(spec.fields)}

<Kanban
  columns={[
    { title: "Draft", items: [{ text: "【草稿内容】", tags: ["draft"] }] },
    { title: "Scheduled", items: [{ text: "【排期内容】", tags: ["scheduled"] }] },
    { title: "Published", items: [{ text: "【已发布内容】", tags: ["published"] }] },
    { title: "Measured", items: [{ text: "【复盘内容】", tags: ["metric"] }] },
  ]}
/>

${optionMatrix()}

${actionTable(spec.label, '【发布、复用或复盘动作】')}`
  } else if (spec.title === 'product-copy') {
    body = `## 文案版本

${fieldTable(spec.fields)}

${optionMatrix()}

${evidenceInsight('证明资产', '文案选择理由')}

${decisionRecord(spec, '选择哪个文案版本？', '【最终 headline / CTA / positioning】')}

<CopyButton text="【最终批准的 headline / CTA / short blurb】" label="复制最终文案" />`
  } else if (spec.title === 'interview-record') {
    body = `## 采访材料

${fieldTable(spec.fields)}

<Transcript
  items={[
    { speaker: "【受访者】", time: "【时间点】", text: "【原话片段】", src: "2605/raw/interview.m4a" },
  ]}
  title="关键转写片段"
/>

<QuoteCard quote="【已核验可发布引语。】" source="${spec.label}" />

${evidenceInsight('采访证据', '主题洞察')}`
  } else {
    body = `## 内容结构

${fieldTable(spec.fields)}

${evidenceInsight('事实或来源证据', '核心信息')}

<Cards>
  <Card title="标题" description="【标题候选】" />
  <Card title="导语" description="【开场导语】" />
  <Card title="行动" description="【读者下一步】" />
</Cards>

<Checklist
  items={[
    { text: "事实有来源", checked: false },
    { text: "主张和证据分开", checked: false },
    { text: "发布前检查链接、日期、引用和语气", checked: false },
  ]}
/>`
  }

  return `<Subtitle>${spec.intro}</Subtitle>

${expertCallout(spec)}

<Callout type="note" title="核心信息">
  【写清这份内容要让读者记住什么，以及读者为什么现在需要知道。】
</Callout>

${body}

${qualityChecklist(spec)}`
}

function operationTemplate(spec) {
  let body = ''
  if (['recruiting-interview', 'performance-review'].includes(spec.title)) {
    body = `## 证据与判断

<Flow>
  <StatusBadge status="【当前阶段/校准状态】" tone="warning" />
  <StatusBadge status="【目标状态】" tone="success" />
</Flow>

${fieldTable(spec.fields)}

${evidenceInsight('行为证据', '评估判断')}

${decisionRecord(spec, '这次记录需要形成什么判断？', '【hire / no-hire / hold 或绩效结论】')}

${actionTable(spec.label, '【背调、补面、反馈或成长动作】')}`
  } else if (['event-plan', 'sop'].includes(spec.title)) {
    body = `## 流程与责任

${fieldTable(spec.fields)}

<MilestoneTimeline
  items={[
    { time: "【时间点】", title: "【关键步骤/里程碑】", desc: "【负责人、输入、输出、验收】" },
  ]}
/>

<RACI
  rows={[
    { work: "【关键事项】", responsible: "【R】", accountable: "【A】", consulted: "【C】", informed: "【I】" },
  ]}
/>

<Checklist
  items={[
    { text: "【触发条件已明确】" },
    { text: "【异常路径已明确】" },
    { text: "【验收标准已明确】" },
  ]}
/>

${riskMatrix('现场、流程或异常风险')}`
  } else if (spec.title === 'kpi-tracking') {
    body = `${coreMetrics()}

## 指标控制回路

${fieldTable(spec.fields)}

<Progress value={50} label="【目标达成度】" />

${actionTable(spec.label, '【指标调整动作】')}

${riskMatrix('偏离目标风险')}`
  } else if (spec.title === 'support-ticket') {
    body = `## 工单处理

<Flow>
  <StatusBadge status="【open / blocked / resolved】" tone="warning" />
  <StatusBadge status="【SLA 状态】" tone="neutral" />
</Flow>

${fieldTable(spec.fields)}

<IncidentTimeline
  items={[
    { time: "【时间】", title: "【处理节点】", impact: "【影响或客户状态】" },
  ]}
/>

${evidenceInsight('截图、日志或复现证据', '解决方案与验证')}

${actionTable(spec.label, '【交接、回访或补验证】')}`
  } else if (['customer-profile', 'customer-success', 'customer-success-followup'].includes(spec.title)) {
    body = `## 客户健康与成功计划

<Flow>
  <StatusBadge status="【生命周期/健康状态】" tone="warning" />
  <StatusBadge status="【目标状态】" tone="success" />
</Flow>

${fieldTable(spec.fields)}

${evidenceInsight('客户反馈或使用证据', '价值、风险与机会判断')}

${riskMatrix('续费、扩展或采用风险')}

${actionTable(spec.label, '【下一步成功计划】')}`
  } else {
    body = `<Flow>
  <StatusBadge status="【当前状态】" tone="warning" />
  <StatusBadge status="【目标状态】" tone="success" />
</Flow>

## 运营记录

${fieldTable(spec.fields)}

<RACI
  rows={[
    { work: "【关键事项】", responsible: "【我方负责人】", accountable: "【决策人】", consulted: "【对方/协作方】", informed: "【需同步对象】" },
  ]}
/>

${riskMatrix('合作或运营风险')}

${actionTable(spec.label, '【下一步动作】')}`
  }

  return `<Subtitle>${spec.intro}</Subtitle>

${expertCallout(spec)}

${body}

${qualityChecklist(spec)}`
}

function scenarioTemplate(family, title) {
  const spec = templateSpec(family, title)
  switch (family) {
    case 'meeting-collaboration':
      return meetingTemplate(spec)
    case 'work-reports':
      return workReportTemplate(spec)
    case 'project-docs':
      return projectTemplate(spec)
    case 'research-analysis':
      return researchTemplate(spec)
    case 'learning-notes':
      return learningTemplate(spec)
    case 'personal-journal':
      return personalTemplate(spec)
    case 'technical-docs':
      return technicalTemplate(spec)
    case 'content-creation':
      return contentTemplate(spec)
    case 'hr-operations':
      return operationTemplate(spec)
    default:
      return `<Subtitle>${spec.intro}</Subtitle>

${fieldTable(spec.fields)}`
  }
}

function templatePage(filePath) {
  const rel = path.relative(templateRoot, filePath)
  const family = rel.split(path.sep)[0]
  const title = path.basename(filePath, '.mdx')
  const meta = familyMeta[family] ?? familyMeta['meeting-collaboration']
  const spec = templateSpec(family, title)
  const sources = [
    refs.registry,
    refs.writingRules,
    meta.source,
    refs.componentCatalog,
    refs.componentRecipes,
  ]

  return `${frontmatter({
    tags: ['journal', 'mdx-manual', 'template', family],
    summary: summaryWhen(spec),
    sources,
  })}# ${exampleTitle(family, title)}

<Section density="relaxed">
  ${scenarioTemplate(family, title)}
</Section>

<ReferenceList
  sources={[
    { path: "2605/raw/source.txt", label: "示例原始素材", type: "text" },
  ]}
/>
`
}

function writeRootPages(templateFiles) {
  const componentRows = componentSpecs.map((spec) => [
    spec.name,
    spec.group,
    `components/${spec.name}.mdx`,
  ])
  const familyRows = Object.entries(familyMeta).map(([family, meta]) => [
    family,
    meta.label,
    String(templateFiles.filter((file) => file.includes(`/templates/${family}/`)).length),
  ])

  writeFile(
    path.join(manualRoot, '00-index.mdx'),
    `${frontmatter({
      tags: ['journal', 'mdx-manual', 'index'],
      summary: 'MDX 支持手册首页，覆盖运行时、样式、模板和组件。',
      sources: [refs.mdxRenderer, refs.mdxRuntime, refs.mdxIndex, refs.mdxCss],
    })}# MDX Support Manual

<Subtitle>JournalClaw MDX 支持手册。每个模板和组件都是独立 MDX 文件；组件页包含真实渲染，不再只展示代码块。</Subtitle>

<StatGroup>
  <Stat label="组件页" value={${componentSpecs.length}} />
  <Stat label="模板页" value={${templateFiles.length}} />
  <Stat label="根说明页" value={7} />
</StatGroup>

<Cards>
  <Card title="运行时" description="Rust mdxjs 编译，前端 React runtime 渲染，组件白名单来自 src/components/mdx/index.ts。" />
  <Card title="组件" description="每个组件独立页面：实时渲染、可复制用法、Props、边界和源码。" />
  <Card title="模板" description="每个模板独立页面：按具体 subtype 场景给出可直接套用的记录模板。" />
</Cards>

## 快速入口

<ReferenceList
  sources={[
    { path: "topics/mdx-support-manual/01-runtime-and-syntax.mdx", label: "运行时与语法", type: "file" },
    { path: "topics/mdx-support-manual/04-template-registry.mdx", label: "模板注册表", type: "file" },
    { path: "topics/mdx-support-manual/05-component-selection.mdx", label: "组件选择", type: "file" },
    { path: "topics/mdx-support-manual/components/HtmlPreview.mdx", label: "HtmlPreview 示例", type: "file" },
  ]}
/>

## 覆盖清单

${propsTable([
  ['组件页', `${componentSpecs.length}`, '全部包含实时渲染示例和复制代码。'],
  ['模板页', `${templateFiles.length}`, '全部是可直接套用的场景记录模板。'],
  ['文件链接', 'internal', '本地文件点击后在 JournalClaw 内部打开。'],
])}
`,
  )

  writeFile(
    path.join(manualRoot, '01-runtime-and-syntax.mdx'),
    `${frontmatter({
      tags: ['journal', 'mdx-manual', 'runtime'],
      summary: 'JournalClaw 的 MDX 运行时使用 Rust mdxjs 编译，并在前端以白名单组件渲染。',
      sources: [
        refs.mdxRenderer,
        refs.mdxRuntime,
        projectSource('src-tauri/src/mdx.rs'),
        refs.mdxIndex,
      ],
    })}# Runtime And Syntax

<Subtitle>MDX 文件先去掉 frontmatter，再由 Rust mdxjs 编译，最后在 React 中用白名单组件渲染。</Subtitle>

<Mermaid
  chart={"flowchart LR\\n  File[.mdx 文件] --> Rust[compile_mdx]\\n  Rust --> Runtime[createMdxComponent]\\n  Runtime --> React[React 渲染]"}
  caption="JournalClaw MDX 渲染链路"
/>

<Checklist
  items={[
    { text: "不能 import 任意模块；只能使用组件白名单。", checked: true },
    { text: "Frontmatter 会被剥离，不参与 MDX 编译。", checked: true },
    { text: "编译或渲染失败会显示错误和原始内容。", checked: true },
  ]}
/>

${referenceList([
  { path: refs.mdxRenderer, label: 'MdxRenderer.tsx', type: 'file' },
  { path: refs.mdxRuntime, label: 'mdxRuntime.ts', type: 'file' },
  { path: projectSource('src-tauri/src/mdx.rs'), label: 'mdx.rs', type: 'file' },
])}
`,
  )

  writeFile(
    path.join(manualRoot, '02-style-system.mdx'),
    `${frontmatter({
      tags: ['journal', 'mdx-manual', 'style'],
      summary: 'MDX 视觉系统复用 JournalClaw 的克制阅读风格，并参考轻量 CSS 文档站的语义优先原则。',
      sources: [refs.mdxCss, projectSource('package.json'), projectSource('.impeccable.md')],
    })}# Style System

<Subtitle>样式目标是安静、可读、密度稳定。参考前端 CSS 样式网站的语义 HTML 思路，但视觉上遵循 JournalClaw。</Subtitle>

<Cards>
  <Card title="new.css / water.css" description="低装饰、语义元素优先，适合文档阅读。" />
  <Card title="Pico CSS" description="组件状态克制，交互元素保持可识别。" />
  <Card title="JournalClaw" description="深色质量优先，单一琥珀 accent，避免 AI slop。" />
</Cards>

<Callout type="warning" title="反参考">
  不使用紫蓝渐变、玻璃态、霓虹、装饰性模糊、卡片套卡片或 bounce 动效。
</Callout>

<Progress value={100} label="MDX 组件使用 src/styles/mdx.css 统一样式" />

${referenceList([
  { path: refs.mdxCss, label: 'mdx.css', type: 'file' },
  { path: projectSource('package.json'), label: 'package.json', type: 'file' },
  { path: projectSource('.impeccable.md'), label: '.impeccable.md', type: 'file' },
])}
`,
  )

  writeFile(
    path.join(manualRoot, '03-writing-rules.mdx'),
    `${frontmatter({
      tags: ['journal', 'mdx-manual', 'writing'],
      summary: 'MDX 写作规则：Markdown 优先，组件只用于提升扫描、追溯或校验。',
      sources: [refs.writingRules, refs.componentCatalog, refs.componentRecipes],
    })}# Writing Rules

<Subtitle>MDX 不是装饰系统。组件只在能减少歧义、提升扫描或增强来源校验时使用。</Subtitle>

<DecisionRecord
  question="什么时候用组件？"
  decision="当结构重复、证据需要追溯、状态需要稳定展示时使用；普通段落和列表保持 Markdown。"
  rationale="这能保持阅读沉浸，同时让复杂信息更可靠。"
/>

<Checklist
  items={[
    { text: "summary 写结论、状态或张力，不写“记录了若干内容”。", checked: true },
    { text: "缺失事实写待确认，不补造。", checked: true },
    { text: "每篇保留 sources，重要判断附近放 ReferenceList 或 EvidenceCard。", checked: true },
  ]}
/>

${referenceList([
  { path: refs.writingRules, label: 'writing-rules.md', type: 'file' },
  { path: refs.componentCatalog, label: 'component-catalog.md', type: 'file' },
  { path: refs.componentRecipes, label: 'component-recipes.md', type: 'file' },
])}
`,
  )

  writeFile(
    path.join(manualRoot, '04-template-registry.mdx'),
    `${frontmatter({
      tags: ['journal', 'mdx-manual', 'templates'],
      summary: '模板注册表把 9 个 family 和 104 个模板页组织为独立 MDX。',
      sources: [refs.registry, ...Object.values(familyMeta).map((meta) => meta.source)],
    })}# Template Registry

<Subtitle>先选择 family，再选择 subtype。每个 subtype 都有独立 MDX 页面。</Subtitle>

${propsTable(familyRows)}

<Callout type="tip" title="选择原则">
  按材料要完成的工作选择，不按关键词表面匹配。会议产出技术决策时，主 family 仍通常是 meeting-collaboration。
</Callout>

${referenceList([{ path: refs.registry, label: 'template-registry.md', type: 'file' }])}
`,
  )

  writeFile(
    path.join(manualRoot, '05-component-selection.mdx'),
    `${frontmatter({
      tags: ['journal', 'mdx-manual', 'components'],
      summary: '组件选择页按用途列出 66 个可用 MDX 组件。',
      sources: [refs.componentCatalog, refs.componentRecipes, refs.mdxIndex],
    })}# Component Selection

<Subtitle>组件库是只读 display primitive。先判断信息结构，再选择最少组件。</Subtitle>

${propsTable(componentRows)}

<RiskMatrix
  risks={[
    { risk: "为了好看滥用组件", likelihood: "中", impact: "高", severity: "P2", mitigation: "Markdown 足够时不用组件" },
    { risk: "示例不能真实渲染", likelihood: "已修复", impact: "高", severity: "P1", mitigation: "组件页先给实时渲染" },
  ]}
/>

${referenceList([
  { path: refs.componentCatalog, label: 'component-catalog.md', type: 'file' },
  { path: refs.componentRecipes, label: 'component-recipes.md', type: 'file' },
  { path: refs.mdxIndex, label: 'index.ts', type: 'file' },
])}
`,
  )

  writeFile(
    path.join(manualRoot, '99-coverage-manifest.mdx'),
    `${frontmatter({
      tags: ['journal', 'mdx-manual', 'coverage'],
      summary: '覆盖清单用于确认所有模板和组件均有独立 MDX 文件。',
      sources: [refs.mdxIndex, refs.registry],
    })}# Coverage Manifest

<Subtitle>用于人工检查和后续维护。</Subtitle>

<StatGroup>
  <Stat label="components" value={${componentSpecs.length}} />
  <Stat label="templates" value={${templateFiles.length}} />
  <Stat label="families" value={${Object.keys(familyMeta).length}} />
</StatGroup>

<Checklist
  items={[
    { text: "每个组件页都有实时渲染区。", checked: true },
    { text: "每个模板页都是可直接套用的场景记录模板。", checked: true },
    { text: "本地文件链接在 JournalClaw 内部打开。", checked: true },
  ]}
/>
`,
  )
}

function writeManifest(templateFiles) {
  const templates = templateFiles.map((file) => path.relative(manualRoot, file))
  const components = componentSpecs.map((spec) => `components/${spec.name}.mdx`)
  writeFile(
    path.join(manualRoot, '_manifest.json'),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        root: manualRoot,
        templates: templates.map((file) => ({ file })),
        components: components.map((file) => ({ file })),
      },
      null,
      2,
    ),
  )
}

function main() {
  if (!fs.existsSync(manualRoot)) {
    throw new Error(`Manual root does not exist: ${manualRoot}`)
  }

  const templateFiles = existingTemplateFiles()

  for (const spec of componentSpecs) {
    writeFile(path.join(componentRoot, `${spec.name}.mdx`), componentPage(spec))
  }

  for (const file of templateFiles) {
    writeFile(file, templatePage(file))
  }

  writeRootPages(templateFiles)
  writeManifest(templateFiles)

  console.log(`Wrote ${componentSpecs.length} component pages`)
  console.log(`Wrote ${templateFiles.length} template pages`)
  console.log(`Manual root: ${manualRoot}`)
}

main()
