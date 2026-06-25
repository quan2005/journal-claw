import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractPascalCaseJsxTags } from './validate-journal-mdx-examples.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const workspaceRoot = '/Users/yanwu/Documents/journal'
const manualRoot = path.join(workspaceRoot, 'topics/mdx-support-manual')
const componentRoot = path.join(manualRoot, 'components')
const templateRoot = path.join(manualRoot, 'templates')
const skillExampleRoot = path.join(repoRoot, '.agents/skills/journal/references/template-examples')
const catalogPath = path.join(repoRoot, '.agents/skills/journal/references/component-catalog.md')
const manifestPath = path.join(repoRoot, 'apps/web/src/components/mdx/component-manifest.json')
const imagePath = '/Users/yanwu/Projects/github/journal/src/assets/wechat-qrcode.png'

const projectSource = (relativePath) => `../../Projects/github/journal/${relativePath}`
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).filter(
  (component) => component.public !== false,
)
const publicNames = manifest.map((component) => component.jsxName)
const publicSet = new Set(publicNames)

function walk(directory, extension) {
  if (!fs.existsSync(directory)) return []
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) return walk(entryPath, extension)
      return entry.name.endsWith(extension) ? [entryPath] : []
    })
    .sort()
}

function parseCatalog() {
  const source = fs.readFileSync(catalogPath, 'utf8')
  const entries = new Map()
  const sectionPattern = /^### `([A-Z][A-Za-z0-9_]*)`\n([\s\S]*?)(?=^### `|^## |(?![\s\S]))/gm

  for (const match of source.matchAll(sectionPattern)) {
    const [, name, body] = match
    const value = (label) => body.match(new RegExp(`^- ${label}: (.+)$`, 'm'))?.[1]?.trim() ?? ''
    entries.set(name, {
      purpose: value('Purpose'),
      props: value('Props'),
      best: value('Best for'),
      avoid: value('Avoid'),
    })
  }

  return entries
}

const catalog = parseCatalog()

const sourceGroups = [
  {
    names: ['Toc', 'Cards', 'Card'],
    source: 'apps/web/src/components/mdx/layout/opening.tsx',
  },
  {
    names: ['Metrics', 'Steps', 'Timeline'],
    source: 'apps/web/src/components/mdx/layout/infographic.tsx',
  },
  {
    names: ['Verdict', 'MythFact'],
    source: 'apps/web/src/components/mdx/layout/judgment.tsx',
  },
  {
    names: ['Quote', 'ImageText', 'ImageSteps'],
    source: 'apps/web/src/components/mdx/layout/evidence.tsx',
  },
  {
    names: ['Cta', 'Faq', 'Checklist', 'Cases', 'Summary', 'Toolbox'],
    source: 'apps/web/src/components/mdx/layout/conversion.tsx',
  },
  {
    names: ['AuthorCard', 'Subscribe'],
    source: 'apps/web/src/components/mdx/layout/brand.tsx',
  },
  {
    names: ['Callout', 'Definition', 'ResourceList', 'ComparisonTable'],
    source: 'apps/web/src/components/mdx/layout/enhanced.tsx',
  },
  {
    names: ['Columns', 'Column'],
    source: 'apps/web/src/components/mdx/layout.tsx',
  },
  {
    names: ['ProsCons', 'Stat', 'StatGroup', 'Table', 'TagList'],
    source: 'apps/web/src/components/mdx/display.tsx',
  },
  {
    names: ['RelatedEntry', 'RelatedIdentity'],
    source: 'apps/web/src/components/mdx/callout.tsx',
  },
  {
    names: ['Kanban', 'Counter', 'RatingBar', 'Stack'],
    source: 'apps/web/src/components/mdx/cards.tsx',
  },
  {
    names: ['ImageViewer', 'FileCard'],
    source: 'apps/web/src/components/mdx/media.tsx',
  },
  {
    names: ['BarChart', 'LineChart', 'PieChart', 'RadarChart'],
    source: 'apps/web/src/components/mdx/charts.tsx',
  },
  {
    names: ['Mermaid'],
    source: 'apps/web/src/components/mdx/mermaid.tsx',
  },
  {
    names: ['InlineMath', 'BlockMath'],
    source: 'apps/web/src/components/mdx/math.tsx',
  },
  {
    names: ['Section', 'Subtitle', 'Label', 'Divider'],
    source: 'apps/web/src/components/mdx/typography.tsx',
  },
  {
    names: ['HtmlPreview'],
    source: 'apps/web/src/components/mdx/html-preview.tsx',
  },
  {
    names: ['Grid', 'Flow'],
    source: 'apps/web/src/components/mdx/grid.tsx',
  },
  {
    names: [
      'DecisionRecord',
      'StatusBadge',
      'ComparisonMatrix',
      'RACI',
      'MilestoneTimeline',
      'InsightCard',
    ],
    source: 'apps/web/src/components/mdx/semantic.tsx',
  },
  {
    names: ['SourceCard', 'ReferenceList', 'CopyButton'],
    source: 'apps/web/src/components/mdx/source.tsx',
  },
]

const componentSources = new Map(
  sourceGroups.flatMap((group) => group.names.map((name) => [name, group.source])),
)

const componentExamples = {
  Toc: `<Toc heading="目录" items={[{ label: '01', title: '结论', description: '先看核心判断' }]} />`,
  Cards: `<Cards heading="主题"><Card title="证据" description="来源与判断分开。" /></Cards>`,
  Card: `<Card title="单个主题" description="只承载一个边界清晰的信息块。" />`,
  Metrics: `<Metrics heading="样本" items={[{ label: '访谈', value: 8, description: '覆盖首月用户' }]} />`,
  Steps: `<Steps heading="执行顺序" items={[{ title: '准备输入' }, { title: '运行验证' }]} />`,
  Timeline: `<Timeline heading="事件" items={[{ time: '10:12', title: '告警触发', description: '队列等待超过阈值' }]} />`,
  Verdict: `<Verdict title="可以进入验证" summary="主要边界已经明确。" confidence="高" status="ready" />`,
  MythFact: `<MythFact items={[{ myth: '组件越多越专业', fact: '结构越贴近任务越可靠', reason: '装饰会增加维护面' }]} />`,
  Quote: `<Quote text="Use Markdown first." source="component-recipes.md" context="组件选择原则" />`,
  ImageText: `<ImageText image="${imagePath}" title="图片与解释" text="说明图片为何影响当前判断。" alt="示例图片" />`,
  ImageSteps: `<ImageSteps items={[{ image: '${imagePath}', title: '确认状态', text: '只记录画面支持的事实。' }]} />`,
  Cta: `<Cta title="进入验证" description="运行白名单、编译和真实渲染检查。" action="验证全部内容" />`,
  Faq: `<Faq heading="常见问题" items={[{ question: '何时用 Metrics？', answer: '每项数字需要解释时。' }]} />`,
  Checklist: `<Checklist heading="关闭条件" items={[{ text: '回归测试通过', state: 'done' }, { text: '真实渲染已检查', state: 'todo' }]} />`,
  Cases: `<Cases heading="案例" items={[{ case: '未知组件', result: '局部错误', note: '其余文档继续渲染' }]} />`,
  Summary: `<Summary title="核心结论" body="Markdown 写主线，组件只稳定关键结构。" />`,
  Toolbox: `<Toolbox items={[{ tool: 'Validator', use: '检查组件白名单', link: 'scripts/validate-journal-mdx-examples.mjs' }]} />`,
  AuthorCard: `<AuthorCard name="JournalClaw Maintainers" role="内容与运行时维护" bio="保持日志可追溯、可阅读。" />`,
  Subscribe: `<Subscribe title="持续维护一份内容源" description="修改 skill 示例后重新生成手册。" />`,
  Callout: `<Callout tone="warning" title="未知信息">缺少事实时写“待确认”，不要推断。</Callout>`,
  Definition: `<Definition term="可追溯日志" description="结论可以返回来源，并看清解释和决定过程。" />`,
  ResourceList: `<ResourceList items={[{ title: 'Component catalog', url: '.agents/skills/journal/references/component-catalog.md' }]} />`,
  ComparisonTable: `<ComparisonTable columns={['紧凑', '带解释']} rows={[{ label: '指标', values: ['StatGroup', 'Metrics'] }]} />`,
  Columns: `<Columns cols={2}><Column><Callout title="主线">结论。</Callout></Column><Column><Callout title="证据">来源。</Callout></Column></Columns>`,
  Column: `<Columns><Column><Callout title="一列">Column 应在 Columns 中使用。</Callout></Column><Column><Callout title="二列">并列内容保持简短。</Callout></Column></Columns>`,
  ProsCons: `<ProsCons><Table headers={['收益', '限制']} rows={[['结构稳定', '不适合普通正文']]} /></ProsCons>`,
  Stat: `<Stat label="完成项" value={12} trend="up" />`,
  StatGroup: `<StatGroup><Stat label="完成项" value={12} /><Stat label="风险" value={3} /></StatGroup>`,
  Table: `<Table headers={['行动', '负责人']} rows={[['补齐验证', '维护者']]} />`,
  TagList: `<TagList tags={['journal', 'mdx', 'traceable']} />`,
  RelatedEntry: `<RelatedEntry path="2606/09-mdx-component-rewrite.mdx" label="相关日志" />`,
  RelatedIdentity: `<RelatedIdentity path="identities/JournalClaw.md" label="JournalClaw" />`,
  Kanban: `<Kanban columns={[{ title: 'Doing', items: [{ text: '编译全部 MDX', tags: ['verify'] }] }, { title: 'Done', items: [{ text: '重写示例' }] }]} />`,
  Counter: `<Counter count={61} label="public components" />`,
  RatingBar: `<RatingBar score={4} max={5} label="验证完成度" />`,
  Stack: `<Stack gap={3}><Counter count={61} label="components" /><TagList tags={['MDX', 'manual']} /></Stack>`,
  ImageViewer: `<ImageViewer src="${imagePath}" alt="示例图片" caption="仓库内已存在的图片资源" width="220px" />`,
  FileCard: `<FileCard path=".agents/skills/journal/references/component-catalog.md" label="组件目录" />`,
  BarChart: `<BarChart title="数量比较" data={[{ label: 'Components', value: 61 }, { label: 'Templates', value: 104 }]} />`,
  LineChart: `<LineChart title="迁移进度" data={[{ label: 'M1', value: 40 }, { label: 'M2', value: 80 }, { label: 'M3', value: 100 }]} />`,
  PieChart: `<PieChart title="内容结构" data={[{ label: 'Markdown', value: 75 }, { label: 'Components', value: 25 }]} />`,
  RadarChart: `<RadarChart title="质量维度" data={[{ label: '可追溯', value: 5 }, { label: '可扫描', value: 4 }, { label: '克制', value: 5 }]} />`,
  Mermaid: `<Mermaid chart={"flowchart LR\\n  Raw[素材] --> Note[日志]\\n  Note --> Verify[验证]"} caption="整理链路" />`,
  InlineMath: `<p>覆盖率：<InlineMath math="C = n_{used} / n_{public}" /></p>`,
  BlockMath: `<BlockMath math="C = 61 / 61 = 1" />`,
  Section: `<Section density="relaxed"><Subtitle>一个完整阅读区块。</Subtitle><p>普通正文保持 Markdown。</p></Section>`,
  Subtitle: `<Subtitle>用于说明当前章节的范围，不重复标题。</Subtitle>`,
  Label: `<Label>MDX</Label>`,
  Divider: `<Divider label="证据与判断" />`,
  HtmlPreview: `<HtmlPreview title="HTML 片段" height={200} html={"<main class='j-stack'><h1>Preview</h1><p>Sandbox content.</p></main>"} />`,
  Grid: `<Grid cols={3} gap={12}><Callout title="Manifest">白名单。</Callout><Callout title="Validator">校验。</Callout><Callout title="Runtime">渲染。</Callout></Grid>`,
  Flow: `<Flow gap={8}><StatusBadge status="ready" tone="success" /><StatusBadge status="verify" tone="warning" /></Flow>`,
  DecisionRecord: `<DecisionRecord question="是否维护第二份模板正文" decision="不维护" options={[{ label: '内嵌', tradeoff: '容易漂移' }, { label: '读取 skill', tradeoff: '单一来源' }]} rationale="手册是生成呈现层。" />`,
  StatusBadge: `<StatusBadge status="ready" tone="success" />`,
  ComparisonMatrix: `<ComparisonMatrix columns={['适合', '不适合']} rows={[{ label: 'Steps', values: ['有序过程', '历史事件'] }, { label: 'Timeline', values: ['历史事件', '执行步骤'] }]} />`,
  RACI: `<RACI rows={[{ work: '维护组件清单', responsible: 'Runtime owner', accountable: 'Maintainer', consulted: 'Tests', informed: 'Authors' }]} />`,
  MilestoneTimeline: `<MilestoneTimeline items={[{ time: 'M1', title: '运行时收敛', desc: '固定清单与降级边界。' }, { time: 'M2', title: '内容重写', desc: '统一示例与手册。' }]} />`,
  InsightCard: `<InsightCard title="解释">白名单解决稳定渲染，Markdown 优先避免作者被组件牵着走。</InsightCard>`,
  SourceCard: `<SourceCard path="src/components/mdx/component-manifest.json" label="公共组件清单" type="file" note="唯一白名单" />`,
  ReferenceList: `<ReferenceList sources={[{ path: 'src/components/mdx/component-manifest.json', label: 'Manifest', type: 'file' }, { path: '.agents/skills/journal/references/component-catalog.md', label: 'Catalog', type: 'file' }]} />`,
  CopyButton: `<CopyButton text="node scripts/validate-journal-mdx-examples.mjs" label="复制校验命令" />`,
}

function validateMetadata() {
  const metadataNames = new Set(Object.keys(componentExamples))
  const sourceNames = new Set(componentSources.keys())
  const catalogNames = new Set(catalog.keys())

  const missing = publicNames.filter(
    (name) => !metadataNames.has(name) || !sourceNames.has(name) || !catalogNames.has(name),
  )
  const extra = [...new Set([...metadataNames, ...sourceNames, ...catalogNames])].filter(
    (name) => !publicSet.has(name),
  )

  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Component metadata mismatch. Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}.`,
    )
  }

  for (const name of publicNames) {
    const unknown = extractPascalCaseJsxTags(componentExamples[name]).filter(
      (tag) => !publicSet.has(tag),
    )
    if (unknown.length > 0) {
      throw new Error(`Unknown JSX in ${name} example: ${[...new Set(unknown)].join(', ')}`)
    }
  }
}

function frontmatter({ tags, summary, sources }) {
  return `---
tags: ${JSON.stringify(tags)}
summary: ${JSON.stringify(summary)}
sources: ${JSON.stringify(sources)}
---

`
}

function codeFence(code) {
  return `\`\`\`mdx
${code.trim()}
\`\`\``
}

function validateMdxContent(content, label) {
  const unknown = extractPascalCaseJsxTags(content).filter((tag) => !publicSet.has(tag))
  if (unknown.length > 0) {
    throw new Error(`Unknown JSX in ${label}: ${[...new Set(unknown)].join(', ')}`)
  }
}

function writeMdx(filePath, content) {
  validateMdxContent(content, path.relative(manualRoot, filePath))
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${content.trimEnd()}\n`)
}

function componentPage(component) {
  const name = component.jsxName
  const metadata = catalog.get(name)
  const source = componentSources.get(name)
  const example = componentExamples[name]
  const sourcePath = projectSource(source)

  return `${frontmatter({
    tags: ['journal', 'mdx-manual', 'component', component.category],
    summary: `${name} 的实时渲染、核心 props、适用场景和使用边界。`,
    sources: [
      sourcePath,
      projectSource('apps/web/src/components/mdx/index.ts'),
      projectSource('.agents/skills/journal/references/component-catalog.md'),
    ],
  })}# ${name}

<Subtitle>${metadata.purpose}</Subtitle>

## 实时渲染

${example}

## 可复制用法

${codeFence(example)}

## API

<Table
  headers={['项目', '说明']}
  rows={[
    ['核心 props', ${JSON.stringify(metadata.props)}],
    ['最适合', ${JSON.stringify(metadata.best)}],
    ['避免', ${JSON.stringify(metadata.avoid)}],
  ]}
/>

## 实现来源

<ReferenceList
  sources={[
    { path: ${JSON.stringify(sourcePath)}, label: ${JSON.stringify(path.basename(source))}, type: 'file' },
    { path: ${JSON.stringify(projectSource('apps/web/src/components/mdx/index.ts'))}, label: 'MDX registry', type: 'file' },
  ]}
/>
`
}

function templateFiles() {
  return walk(skillExampleRoot, '.mdx')
}

function copyTemplate(sourcePath) {
  const relativePath = path.relative(skillExampleRoot, sourcePath)
  const content = fs.readFileSync(sourcePath, 'utf8')
  writeMdx(path.join(templateRoot, relativePath), content)
  return relativePath
}

function rootPages(templatePaths) {
  const familyCounts = new Map()
  for (const relativePath of templatePaths) {
    const family = relativePath.split(path.sep)[0]
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1)
  }

  const componentRows = manifest.map((component) => [
    component.jsxName,
    component.category,
    `components/${component.jsxName}.mdx`,
  ])
  const familyRows = [...familyCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([family, count]) => [family, count, `templates/${family}/`])

  return {
    '00-index.mdx': `${frontmatter({
      tags: ['journal', 'mdx-manual', 'index'],
      summary: `MDX 支持手册覆盖 ${manifest.length} 个公共组件和 ${templatePaths.length} 个 subtype 示例。`,
      sources: [
        projectSource('apps/web/src/components/mdx/component-manifest.json'),
        projectSource('.agents/skills/journal/references/template-examples'),
      ],
    })}# MDX Support Manual

<Subtitle>组件页由 manifest 与组件目录生成；模板页直接复制 journal skill 的 durable examples。</Subtitle>

<StatGroup>
  <Stat label="公共组件" value={${manifest.length}} />
  <Stat label="Subtype 示例" value={${templatePaths.length}} />
  <Stat label="家族" value={${familyCounts.size}} />
</StatGroup>

<Cards
  items={[
    { title: '运行时', description: 'Rust mdxjs 编译，React 白名单渲染。' },
    { title: '组件', description: '每个组件有独立实时示例与边界。' },
    { title: '模板', description: '正文来自 journal skill，不再维护第二份内容。' },
  ]}
/>

<ReferenceList
  sources={[
    { path: 'topics/mdx-support-manual/01-runtime-and-syntax.mdx', label: '运行时与语法', type: 'file' },
    { path: 'topics/mdx-support-manual/02-component-selection.mdx', label: '组件选择', type: 'file' },
    { path: 'topics/mdx-support-manual/03-template-registry.mdx', label: '模板注册表', type: 'file' },
  ]}
/>
`,
    '01-runtime-and-syntax.mdx': `${frontmatter({
      tags: ['journal', 'mdx-manual', 'runtime'],
      summary: 'MDX 经过 Rust 编译后由 React 白名单运行时渲染，未知组件只影响局部。',
      sources: [
        projectSource('src-tauri/src/mdx.rs'),
        projectSource('src/components/MdxRenderer.tsx'),
        projectSource('apps/web/src/components/mdx/index.ts'),
      ],
    })}# Runtime And Syntax

<Mermaid
  chart={"flowchart LR\\n  File[MDX file] --> Rust[mdxjs compile]\\n  Rust --> React[React runtime]\\n  React --> Registry[61 component registry]"}
  caption="JournalClaw MDX 渲染链路"
/>

<Checklist
  items={[
    { text: 'Frontmatter 在编译前剥离', state: 'done' },
    { text: '作者只能使用 public registry', state: 'done' },
    { text: '未知组件降级为局部错误', state: 'done' },
  ]}
/>
`,
    '02-component-selection.mdx': `${frontmatter({
      tags: ['journal', 'mdx-manual', 'components'],
      summary: `组件选择页列出 manifest 中的 ${manifest.length} 个公共组件。`,
      sources: [
        projectSource('.agents/skills/journal/references/component-catalog.md'),
        projectSource('.agents/skills/journal/references/component-recipes.md'),
      ],
    })}# Component Selection

<Subtitle>先写 Markdown 主线，再选择能减少歧义的最少组件。</Subtitle>

<Table headers={['组件', '类别', '页面']} rows={${JSON.stringify(componentRows)}} />
`,
    '03-template-registry.mdx': `${frontmatter({
      tags: ['journal', 'mdx-manual', 'templates'],
      summary: `模板注册表覆盖 ${familyCounts.size} 个家族和 ${templatePaths.length} 个 subtype。`,
      sources: [
        projectSource('.agents/skills/journal/references/template-registry.md'),
        projectSource('.agents/skills/journal/references/template-examples'),
      ],
    })}# Template Registry

<Subtitle>先按材料要完成的工作选择家族，再进入具体 subtype 示例。</Subtitle>

<Table headers={['家族', 'Subtype 数量', '目录']} rows={${JSON.stringify(familyRows)}} />

<Callout tone="note" title="单一内容源">
  templates 下的页面直接来自 journal skill；修改示例后重新运行生成器即可。
</Callout>
`,
    '04-writing-rules.mdx': `${frontmatter({
      tags: ['journal', 'mdx-manual', 'writing'],
      summary: 'MDX 写作坚持 Markdown 优先、来源可追溯、未知项不补造。',
      sources: [
        projectSource('.agents/skills/journal/references/writing-rules.md'),
        projectSource('.agents/skills/journal/references/component-recipes.md'),
      ],
    })}# Writing Rules

<DecisionRecord
  question="什么时候使用组件"
  decision="只有在组件能改善扫描、比较、时间线、证据或导航时使用"
  rationale="普通段落、列表、简单表格和代码继续使用 Markdown。"
/>

<Checklist
  items={[
    { text: 'summary 写具体结论', state: 'done' },
    { text: '来源路径真实存在或明确待补', state: 'done' },
    { text: '缺少事实时写待确认', state: 'done' },
  ]}
/>
`,
    '99-coverage-manifest.mdx': `${frontmatter({
      tags: ['journal', 'mdx-manual', 'coverage'],
      summary: '覆盖页记录组件、模板和家族数量，便于生成后核对。',
      sources: [projectSource('apps/web/src/components/mdx/component-manifest.json')],
    })}# Coverage Manifest

<Metrics
  items={[
    { label: '公共组件', value: ${manifest.length}, description: '每项一个独立组件页' },
    { label: 'Subtype 示例', value: ${templatePaths.length}, description: '直接来自 journal skill' },
    { label: '家族', value: ${familyCounts.size}, description: '每项有独立路由指南' },
  ]}
/>

<Checklist
  items={[
    { text: '组件元数据与 manifest 完全一致', state: 'done' },
    { text: '组件示例只使用 public registry', state: 'done' },
    { text: '模板正文没有第二份内嵌副本', state: 'done' },
  ]}
/>
`,
  }
}

function writeManifest(templatePaths) {
  fs.writeFileSync(
    path.join(manualRoot, '_manifest.json'),
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        root: manualRoot,
        counts: {
          components: manifest.length,
          templates: templatePaths.length,
          families: new Set(templatePaths.map((file) => file.split(path.sep)[0])).size,
        },
        components: manifest.map((component) => ({
          name: component.jsxName,
          file: `components/${component.jsxName}.mdx`,
        })),
        templates: templatePaths.map((file) => ({
          file: `templates/${file.split(path.sep).join('/')}`,
          source: `.agents/skills/journal/references/template-examples/${file
            .split(path.sep)
            .join('/')}`,
        })),
      },
      null,
      2,
    )}\n`,
  )
}

function main() {
  validateMetadata()

  const examples = templateFiles()
  if (examples.length !== 104) {
    throw new Error(`Expected 104 subtype examples, found ${examples.length}.`)
  }

  fs.rmSync(manualRoot, { recursive: true, force: true })
  fs.mkdirSync(componentRoot, { recursive: true })
  fs.mkdirSync(templateRoot, { recursive: true })

  for (const component of manifest) {
    writeMdx(path.join(componentRoot, `${component.jsxName}.mdx`), componentPage(component))
  }

  const templatePaths = examples.map(copyTemplate)
  for (const [fileName, content] of Object.entries(rootPages(templatePaths))) {
    writeMdx(path.join(manualRoot, fileName), content)
  }
  writeManifest(templatePaths)

  console.log(`Wrote ${manifest.length} component pages`)
  console.log(`Wrote ${templatePaths.length} template pages`)
  console.log(`Manual root: ${manualRoot}`)
}

main()
