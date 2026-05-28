# Journal MDX Format & Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the default journal template to use MDX components and create a `journal` skill with comprehensive MDX component guidance.

**Architecture:** Three changes: (1) rewrite the `journal-create` script's default inline template to use MDX components, (2) create a new `journal` skill at `.claude/skills/journal/SKILL.md` with standard Markdown briefly covered and custom MDX components detailed, (3) update workspace `.claude/CLAUDE.md` to reference the new skill and trim the inline component list.

**Tech Stack:** Bash (journal-create script), Markdown (SKILL.md, CLAUDE.md)

---

### Task 1: Update `journal-create` default template with MDX components

**Files:**
- Modify: `src-tauri/resources/workspace-template/.claude/scripts/journal-create:78-112`

The default template in `journal-create` (used when no `refs/工作日记模版.md` exists) currently uses plain markdown. Replace it with a template that demonstrates MDX component usage.

- [ ] **Step 1: Replace the default template in journal-create**

Replace lines 78-112 (the `cat > "${target_path}" <<MDXEOF ... MDXEOF` block) with:

```bash
  cat > "${target_path}" <<MDXEOF
---
tags: [journal]
summary:
sources:
---

# ${title}

<Subtitle>结论先行，细节在后</Subtitle>

<Section>

## 背景与结论

<Callout type="info" title="核心结论">

（一句话：发生了什么、结论是什么）

</Callout>

</Section>

<Section>

## 关键事实

<Timeline
  items={[
    { time: '', title: '', desc: '' },
  ]}
/>

</Section>

<Section>

## 判断与推理

-

</Section>

<Section>

## 行动与待确认

<Checklist
  items={[
    { text: '', checked: false },
  ]}
/>

</Section>

<Section>

## 关联

<RelatedEntry path="" label="" />

</Section>

*创建时间: ${created_at}*
MDXEOF
```

- [ ] **Step 2: Verify script syntax**

Run: `bash -n src-tauri/resources/workspace-template/.claude/scripts/journal-create`
Expected: no output (syntax OK)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/resources/workspace-template/.claude/scripts/journal-create
git commit -m "feat: update journal-create default template to use MDX components"
```

---

### Task 2: Create `journal` skill with MDX component guidance

**Files:**
- Create: `src-tauri/resources/workspace-template/.claude/skills/journal/SKILL.md`

Create a new skill that teaches the AI how to write MDX journal entries. Standard Markdown syntax gets a brief summary; custom MDX components get a full catalog with usage examples.

- [ ] **Step 1: Create the journal SKILL.md**

Create file `src-tauri/resources/workspace-template/.claude/skills/journal/SKILL.md`:

```markdown
---
name: journal
description: "日志写作指南。用户说"写日志"、"整理成日志"、"帮我记一下"、"记录一下"、"写篇日志"时触发，或在新建/编辑日志条目时加载。提供 MDX 格式规范、标准 Markdown 语法速查、以及完整的自定义 MDX 组件目录和使用指引。"
---

# 日志写作指南

## 契约

| 维度 | 声明 |
|---|---|
| **reads** | `yyMM/raw/*`（原始素材）、`identity/*.md`（人物识别） |
| **writes** | `yyMM/*.mdx`（日志条目） |
| **depends** | `/meeting-minutes`（会议类素材） |

## 格式规范

日志文件为 `.mdx` 格式（Markdown + JSX 组件）。元数据使用 YAML frontmatter：

```yaml
---
tags: [journal, meeting]
summary: 结论先行。背景与约束补充。
sources: [2604/raw/file.m4a]
---
```

- `summary` 要有一句话的实质性结论，不要写"讨论了若干议题"这种空话。
- `tags` 用于分类检索，建议 1-3 个标签。
- `sources` 列出原始素材路径，追加时合并去重。

## 标准 Markdown 语法速查

以下标准语法负责日志的**结构骨架**，足够应对 80% 的排版需求：

| 语法 | 用途 |
|---|---|
| `# ## ### ####` | 标题层级，建议不超过 4 级 |
| `**粗体**` `*斜体*` | 强调 |
| `- 列表项` `1. 有序列表` | 列表 |
| `> 引用` | 引用原文或外部观点 |
| `| 表头 |` | 表格 |
| ` ``` ` 代码块 | 代码、日志片段 |
| `---` | 水平分隔线 |
| `[文本](url)` | 链接 |
| `![alt](url)` | 图片 |

**原则：能用纯 Markdown 表达清楚的，不要用 MDX 组件。** 一条日志建议使用 1-3 个组件，每条都有明确的信息呈现目的。

## 自定义 MDX 组件

当纯文本不足以清晰呈现信息时，使用以下组件。组件为 JSX 语法，在 `.mdx` 文件中直接使用。

---

### 排版组件

**`<Section>`** — 章节容器，控制垂直节奏

```mdx
<Section>

### 标题

内容...

</Section>
```

Props: `density?: 'compact' | 'default' | 'relaxed'`（控制间距，默认 `'default'`）

---

**`<Subtitle>`** — 文章副标题或导语，紧跟 h1 之后

```mdx
# 产品评审会议纪要
<Subtitle>讨论了 Q2 路线图中三个关键决策，最终确定优先级排序</Subtitle>
```

---

**`<Divider label="...">`** — 带标签的分隔线，标记章节切换

```mdx
<Divider label="第二部分" />
```

无 `label` 时渲染为普通 `<hr>`。

---

**`<Label>`** — 内联标签/分类标记

```mdx
<Label>P0 · 本周完成</Label>
```

---

### 布局组件

**`<Split>`** — 双列对比布局

```mdx
<Split>
<div>

**方案 A**
- 优点一
- 优点二

</div>
<div>

**方案 B**
- 优点一
- 优点二

</div>
</Split>
```

---

**`<Columns cols={3}>` + `<Column>`** — 多列等宽布局

```mdx
<Columns cols={3}>
<Column>
<Stat label="日志数" value={47} suffix="篇" />
</Column>
<Column>
<Stat label="会议" value={12} suffix="场" />
</Column>
<Column>
<Stat label="待办" value={8} suffix="项" />
</Column>
</Columns>
```

`cols`: `2 | 3 | 4`

---

**`<Mockup title="...">`** — 浏览器窗口风格的预览框

```mdx
<Mockup title="Dashboard 原型">
  <Card title="今日概览" description="3 篇日志 · 2 项待办" />
</Mockup>
```

---

**`<Placeholder>`** — 占位标记，标注待补充区域

```mdx
<Placeholder>此处待补充 Q2 增长数据</Placeholder>
```

---

**`<DeviceShowcase>`** — 设备展示舞台，包裹多个 `<Phone>`

```mdx
<DeviceShowcase>
  <Phone density="compact">
    <Stat label="今日" value={5} suffix="篇" />
  </Phone>
  <Phone density="compact">
    <Card title="晨会纪要" description="3 项待办" />
  </Phone>
</DeviceShowcase>
```

---

### 数据展示组件

**`<Stat label="..." value={...} trend="up|down" suffix="...">`** — 单指标卡片

```mdx
<Stat label="完成率" value={87} suffix="%" trend="up" />
```

`trend` 可选，显示上/下箭头。`suffix` 可选，显示单位。

---

**`<StatGroup>`** — 指标看板，包裹多个 `<Stat>`

```mdx
<StatGroup>
  <Stat label="项目总数" value={8} />
  <Stat label="完成率" value={87} suffix="%" trend="up" />
  <Stat label="逾期" value={3} suffix="项" trend="down" />
</StatGroup>
```

---

**`<Table headers={[...]} rows={[[...]]}>`** — 数据表格

```mdx
<Table
  headers={['模块', '负责人', '进度']}
  rows={[
    ['AI 引擎', '张明', '85%'],
    ['语音转写', '李华', '100%'],
  ]}
/>
```

---

**`<Timeline items={[{time, title, desc}]}>`** — 垂直时间线

```mdx
<Timeline
  items={[
    { time: '09:00', title: '晨会', desc: '同步昨日进展' },
    { time: '10:30', title: 'AI 引擎评审', desc: '决定采用方案 B' },
    { time: '14:00', title: '设计走查', desc: '深色模式 accent 色对比度不足' },
  ]}
/>
```

`time` 和 `title` 必填，`desc` 选填。

---

**`<TagList tags={[...]}>`** — 标签列表

```mdx
<TagList tags={['React 19', 'Tauri v2', 'TypeScript', 'MDX']} />
```

---

**`<Progress value={0-100} label="...">`** — 进度条

```mdx
<Progress value={72} label="设计系统组件完成度" />
```

---

**`<Avatar name="..." size="sm|md|lg">`** + **`<AvatarGroup>`** — 头像

```mdx
<AvatarGroup>
  <Avatar name="张明" />
  <Avatar name="李华" size="sm" />
  <Avatar name="王芳" size="lg" />
</AvatarGroup>
```

---

### 卡片与列表组件

**`<Cards>` + `<Card title="..." description="..." variant="default|subtle|elevated">`** — 卡片网格

```mdx
<Cards>
  <Card title="语音转写" description="Apple SpeechAnalyzer + WhisperKit" />
  <Card title="AI 摘要" description="内置 LLM 自动生成结构化日志" />
  <Card title="知识库整理" description="周期性 lint 检测矛盾" />
</Cards>
```

---

**`<Options>` + `<Option letter="A" title="..." description="...">`** — 方案对比（纯展示，不含交互）

```mdx
<Options>
  <Option letter="A" title="方案名称" description="方案描述、优缺点" />
  <Option letter="B" title="方案名称" description="方案描述、优缺点" />
</Options>
```

---

**`<Kanban columns={[{title, items:[{text, tags}]}]}>`** — 静态看板

```mdx
<Kanban
  columns={[
    {
      title: '待开始',
      items: [
        { text: '国际化 (i18n)', tags: ['P2'] },
        { text: '插件市场', tags: ['P3'] },
      ],
    },
    {
      title: '进行中',
      items: [
        { text: 'MDX 组件库', tags: ['P0'] },
      ],
    },
    {
      title: '已完成',
      items: [
        { text: 'CSP 安全配置', tags: ['基础设施'] },
      ],
    },
  ]}
/>
```

---

**`<Checklist items={[{text, checked}]}>`** — 任务清单

```mdx
<Checklist
  items={[
    { text: '完成 MDX 运行时', checked: true },
    { text: '端到端测试', checked: false },
    { text: '文档站部署', checked: false },
  ]}
/>
```

---

**`<Counter count={...} label="...">`** — 数字计数器

```mdx
<Counter count={5} label="次会议讨论" />
```

---

**`<RatingBar score={...} max={5} label="...">`** — 星级评分

```mdx
<RatingBar score={4} max={5} label="整体满意度" />
```

`score` 支持小数，自动四舍五入。

---

**`<Stack gap={4}>`** — 垂直弹性布局，控制子元素间距

```mdx
<Stack gap={3}>
  <Stat label="日志" value={5} suffix="篇" />
  <Progress value={72} label="周目标" />
</Stack>
```

`gap`: 引用 `--space-{n}` CSS 变量，默认 4。

---

### 提示与引用组件

**`<Callout type="info|warning|tip|note" title="...">`** — 信息提示框

```mdx
<Callout type="info" title="背景">
  此项目始于 Q1，目前处于二期迭代。
</Callout>

<Callout type="warning" title="风险">
  MDX 运行时使用 `new Function()`，不要在不可信来源加载 .mdx 文件。
</Callout>

<Callout type="tip" title="建议">
  写 .mdx 时优先用纯 Markdown 表达，只在必要时使用组件。
</Callout>

<Callout type="note">
  note 类型无强调色，适合低调补充说明，不打断阅读节奏。
</Callout>
```

| type | 用途 |
|---|---|
| `info` | 背景信息、上下文补充 |
| `warning` | 风险、注意事项、踩坑提醒 |
| `tip` | 建议、最佳实践、技巧 |
| `note` | 低调旁注，不打断节奏 |

---

**`<Quote text="..." source="..." url="...">`** — 引用

```mdx
<Quote
  text="简单是终极的复杂。"
  source="达·芬奇"
/>

<Quote
  text="好的设计是尽可能少的设计。"
  source="Dieter Rams"
  url="https://en.wikipedia.org/wiki/Dieter_Rams"
/>
```

`url` 选填，提供后 source 变为可点击链接。

---

**`<RelatedEntry path="..." label="...">`** — 关联日志链接

```mdx
<RelatedEntry path="2605/25-产品评审会议纪要.md" label="上一篇：产品评审会议纪要" />
```

---

**`<RelatedIdentity path="..." label="...">`** — 关联人物/产品画像链接

```mdx
<RelatedIdentity path="identities/广州-张明.md" label="相关画像：张明（广州·技术负责人）" />
```

---

### 媒体组件

**`<AudioCard src="..." title="...">`** — 音频播放卡片

```mdx
<AudioCard src="2605/raw/demo-audio.m4a" title="产品评审会议录音" />
```

---

**`<VideoCard src="..." title="..." poster="...">`** — 视频播放卡片

```mdx
<VideoCard src="2605/raw/demo.mp4" title="产品演示" poster="2605/raw/poster.png" />
```

---

**`<ImageViewer src="..." alt="..." caption="..." width="...">`** — 图片查看器

```mdx
<ImageViewer
  src="2605/raw/architecture-sketch.png"
  alt="系统架构图"
  caption="JournalClaw 系统架构 v0.16"
/>
```

---

**`<FileCard path="..." label="...">`** — 文件附件卡片

```mdx
<FileCard path="2605/raw/meeting-notes.txt" label="原始会议笔记" />
```

---

### 图表组件

所有图表共用数据格式：`data={[{ label: string, value: number }]}`。数据必须来自真实信息，不可捏造。

---

**`<BarChart data={...} title="...">`** — 柱状图

```mdx
<BarChart
  title="月度日志产出量（篇）"
  data={[
    { label: '1月', value: 34 },
    { label: '2月', value: 28 },
    { label: '3月', value: 45 },
    { label: '4月', value: 52 },
    { label: '5月', value: 47 },
  ]}
/>
```

适合：分类对比、排名、时间序列数据。

---

**`<LineChart data={...} title="...">`** — 折线图

```mdx
<LineChart
  title="API 调用趋势"
  data={[
    { label: 'W1', value: 120 },
    { label: 'W2', value: 145 },
    { label: 'W3', value: 168 },
    { label: 'W4', value: 192 },
  ]}
/>
```

适合：趋势变化、增长曲线。

---

**`<PieChart data={...} title="...">`** — 环形图

```mdx
<PieChart
  title="日志来源分布"
  data={[
    { label: '会议录音', value: 45 },
    { label: '文本粘贴', value: 30 },
    { label: '文件导入', value: 15 },
    { label: '手动创建', value: 10 },
  ]}
/>
```

适合：占比分布。超过 6 项时自动合并低占比项为"其他"。

---

**`<RadarChart data={...} title="...">`** — 雷达图

```mdx
<RadarChart
  title="各模块完成度 (%)"
  data={[
    { label: 'AI引擎', value: 85 },
    { label: '录音', value: 90 },
    { label: '日志浏览', value: 80 },
    { label: '身份画像', value: 60 },
    { label: 'MDX组件', value: 72 },
  ]}
/>
```

适合：多维能力评估、多维度对比。

---

### 图示组件

**`<Mermaid chart="...">`** — Mermaid 流程图/时序图/甘特图

```mdx
<Mermaid
  chart={`flowchart TD
    A[用户操作] --> B{输入类型}
    B -->|拖入文件| C[import_file]
    B -->|录音| D[recorder.rs]
    B -->|粘贴文本| E[import_text]
    C --> F[raw/ 目录]
    D --> F
    E --> F
    F --> G[AI 处理队列]
    G --> H[LLM 引擎]
    H --> I[生成 .mdx 日志]`}
  caption="数据流示意图"
/>
```

支持的图表类型：`flowchart TD/LR`、`sequenceDiagram`、`gantt`、`classDiagram`、`erDiagram`、`pie`、`stateDiagram`。

语法参考：Mermaid DSL 官方文档。

---

**`<CanvasDiagram nodes={[...]} edges={[...]} caption="...">`** — 结构化流程图（Canvas 绘制）

```mdx
<CanvasDiagram
  caption="数据流示意"
  nodes={[
    { id: 'a', label: '用户操作' },
    { id: 'b', label: '输入类型', type: 'decision' },
    { id: 'c', label: 'import_file' },
    { id: 'd', label: 'recorder.rs' },
    { id: 'e', label: 'raw/ 目录' },
  ]}
  edges={[
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c', label: '拖入文件' },
    { from: 'b', to: 'd', label: '录音' },
    { from: 'c', to: 'e' },
    { from: 'd', to: 'e' },
  ]}
/>
```

节点类型（`type`）：`'start'` `'process'` `'decision'` `'input'` `'output'`。不指定默认为 `'process'`。
边标签（`label`）：可选，显示在连线水平段上方。

自动布局：BFS 分层算法，自动处理分支汇合点（junction），水平居中。
交互：支持拖拽平移、Ctrl+滚轮缩放、双指捏合缩放。

CanvasDiagram vs Mermaid 选型：
- **Mermaid**：适合标准流程图、甘特图、时序图，声明式 DSL，布局由 Mermaid 引擎处理。
- **CanvasDiagram**：适合需要精确控制节点关系的场景，数据驱动，自动布局。

---

### 设备模型

**`<Phone model="..." size="..." tone="..." density="...">`** — iPhone 15 Pro 模拟外壳

```mdx
<Phone density="compact">
  <Stack gap={2}>
    <Stat label="今日日志" value={5} suffix="篇" />
    <Progress value={72} label="周目标完成度" />
    <TagList tags={['会议', '设计', '开发']} />
  </Stack>
</Phone>
```

Props:
- `model`: `'iphone-15-pro' | 'iphone-15' | 'generic'`（默认 `'iphone-15-pro'`）
- `size`: `'sm' | 'md' | 'lg' | 'auto'`（默认 `'md'`，分别为 280/320/380/100% 宽）
- `tone`: `'graphite' | 'titanium' | 'black'`（默认 `'graphite'`）
- `density`: `'default' | 'compact' | 'presentation'`（`'compact'` 时内部组件自动缩小）
- `showIsland`: 是否显示灵动岛（默认 `true`）
- `showButtons`: 是否显示侧边按钮（默认 `true`）
- `src` / `alt`: 截图模式，传入图片路径
- `children`: 自定义内容模式（与 `src` 二选一）

在 `<Phone>` 内部，Card、Stat、Progress、TagList 等组件会自动进入 compact 模式，无需手动调整。

---

### 栅格与流式布局

**`<Grid cols={12} gap={16}>` + `<Col span={...}>`** — 12 列经典栅格

```mdx
<Grid cols={12} gap={16}>
  <Col span={8}>
    <Callout type="info" title="主内容区 (span=8)">
      宽列内容...
    </Callout>
  </Col>
  <Col span={4}>
    <Card title="决议" description="双引擎并行" />
  </Col>
</Grid>
```

Props:
- `Grid`: `cols`（默认 12）、`gap`（默认 16，单位 px）、`stackBelow`（低于此宽度时堆叠）
- `Col`: `span`: `1-12 | 'auto' | 'fill'`、`offset`: `0-11`

---

**`<Flow gap={12} justify="start|center|end|between|around|evenly">`** — 弹性流式布局

```mdx
<Flow gap={12}>
  <Avatar name="张明" />
  <Avatar name="李华" />
  <Avatar name="王芳" />
  <Avatar name="陈静" />
</Flow>
```

元素自然流动，空间不够时自动换行。

---

### ProsCons — 优劣对比

```mdx
<ProsCons>
<Pros>

- 优点一
- 优点二

</Pros>
<Cons>

- 缺点一
- 缺点二

</Cons>
</ProsCons>
```

---

## 组件使用原则

1. **一条日志 1-3 个组件**。超过 3 个要反思是否过度设计。
2. **纯 Markdown 优先**。标准标题、列表、表格能表达清楚的，不需要组件。
3. **图表数据必须真实**。不要为好看而捏造数据。
4. **Callout 有明确目的**：info = 背景补充，warning = 风险提示，tip = 建议/最佳实践，note = 不打断节奏的旁注。
5. **Mermaid 适合标准图**（流程图、时序图、甘特图）；**CanvasDiagram 适合自定义布局**的关系图。
6. **Phone 只用于展示移动端效果**，不要滥用。配合 `density="compact"` 让内容自适应。
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/resources/workspace-template/.claude/skills/journal/SKILL.md
git commit -m "feat: add journal skill with MDX component catalog and writing guide"
```

---

### Task 3: Update workspace `.claude/CLAUDE.md` to reference journal skill and trim inline component list

**Files:**
- Modify: `src-tauri/resources/workspace-template/.claude/CLAUDE.md:32-111`

The current CLAUDE.md has a "Skill 触发规则" section (line 32) and an "MDX Components" section (lines 92-111). Add the journal skill to the trigger rules and simplify the inline component list, pointing to the skill for details.

- [ ] **Step 1: Add journal skill to trigger rules section**

Insert after line 33 (`/identity-profiling` 定义...), add:

```markdown
`/journal` 定义日志格式、MDX 语法和全部自定义组件用法。写日志前应加载。
```

- [ ] **Step 2: Replace the MDX Components section (lines 92-111) with a concise reference**

Replace lines 92-111:

```
## MDX Components

When writing `.mdx` journal entries, you can use these components:

**Layout:** `<Split>`, `<Columns cols={2|3|4}>`, `<Column>`, `<Mockup title="...">`, `<Placeholder>`
**Display:** `<ProsCons>`, `<Pros>`, `<Cons>`, `<Stat label="..." value={...} trend="up|down">`, `<StatGroup>`, `<Table headers={[...]} rows={[[...]]}>`, `<Timeline items={[{time, title, desc}]}>`, `<TagList tags={[...]}>`, `<Progress value={0-100} label="...">`, `<Avatar name="..." size="sm|md|lg">`
**Callout:** `<Callout type="info|warning|tip|note" title="...">content</Callout>`, `<Quote text="..." source="..." url="...">`, `<RelatedEntry path="...">`, `<RelatedIdentity path="...">`
**Cards:** `<Cards>`, `<Card title="..." description="...">`, `<Options>`, `<Option letter="A" title="..." description="...">`, `<Kanban columns={[{title, items:[{text, tags}]}]}>`, `<Checklist items={[{text, checked}]}>`, `<Counter count={...} label="...">`, `<RatingBar score={...} max={5} label="...">`
**Media:** `<AudioCard src="...">`, `<VideoCard src="...">`, `<ImageViewer src="..." caption="...">`, `<FileCard path="...">`
**Charts:** `<BarChart data={[{label, value}]} title="...">`, `<LineChart data={[{label, value}]}>`, `<PieChart data={[{label, value}]}>`, `<RadarChart data={[{label, value}]}>`
**Diagrams:** `<Mermaid chart="...">` — Mermaid DSL (flowchart, sequenceDiagram, gantt, etc.)
**Typography:** `<Section>`, `<Subtitle>`, `<Label>`, `<Divider label="...">`

### Rules

1. Use components to present information more clearly — not for decoration
2. Prefer plain markdown when it suffices; reach for components when text alone is insufficient
3. Charts require real data from the conversation; don't fabricate values
4. Callout type: `info` for context, `warning` for caveats, `tip` for actionable advice, `note` for asides
5. Mermaid: use `flowchart TD` for decisions, `sequenceDiagram` for interactions, `gantt` for timelines
```

With:

```markdown
## MDX 组件

写 `.mdx` 日志时使用 MDX 内置组件。完整组件目录和详细用法见 `/journal` skill。

### 快速索引

| 分类 | 组件 |
|---|---|
| 排版 | `Section` `Subtitle` `Label` `Divider` |
| 布局 | `Split` `Columns` `Column` `Mockup` `Placeholder` `DeviceShowcase` |
| 展示 | `Stat` `StatGroup` `Table` `Timeline` `TagList` `Progress` `Avatar` `AvatarGroup` `ProsCons` `Pros` `Cons` |
| 提示 | `Callout` `Quote` `RelatedEntry` `RelatedIdentity` |
| 卡片 | `Cards` `Card` `Options` `Option` `Kanban` `Checklist` `Counter` `RatingBar` `Stack` |
| 媒体 | `AudioCard` `VideoCard` `ImageViewer` `FileCard` |
| 图表 | `BarChart` `LineChart` `PieChart` `RadarChart` |
| 图示 | `Mermaid` `CanvasDiagram` |
| 设备 | `Phone` |
| 栅格 | `Grid` `Col` `Flow` |

### 核心原则

1. 一条日志 1-3 个组件，纯 Markdown 优先
2. 图表数据必须真实，不可捏造
3. Callout: `info`=背景, `warning`=风险, `tip`=建议, `note`=旁注
4. Mermaid vs CanvasDiagram：标准流程图/Gantt/时序图用 Mermaid；自定义关系图用 CanvasDiagram
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/resources/workspace-template/.claude/CLAUDE.md
git commit -m "feat: add journal skill reference and simplify MDX component index"
```

---

## Verification

1. `bash -n src-tauri/resources/workspace-template/.claude/scripts/journal-create` — shell syntax OK
2. `npx tsc --noEmit` — no TypeScript errors (these are resource files, no TS impact, but verify anyway)
3. Verify `cargo build` succeeds — the `include_str!()` macros in `ai_processor.rs` still resolve
4. Manually verify the new SKILL.md renders correctly in a markdown previewer
