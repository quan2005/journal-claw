import type { LayoutModuleSpec } from './types'

export const LAYOUT_JSX_NAMES = {
  toc: 'Toc',
  cards: 'Cards',
  hero: 'Hero',
  metrics: 'Metrics',
  steps: 'Steps',
  timeline: 'Timeline',
  verdict: 'Verdict',
  'myth-fact': 'MythFact',
  quote: 'Quote',
  'quote-card': 'QuoteCard',
  'compare': 'Compare',
  'image-text': 'ImageText',
  'image-steps': 'ImageSteps',
  cta: 'Cta',
  faq: 'Faq',
  checklist: 'Checklist',
  cases: 'Cases',
  summary: 'Summary',
  toolbox: 'Toolbox',
  'author-card': 'AuthorCard',
  subscribe: 'Subscribe',
  callout: 'Callout',
  definition: 'Definition',
  'resource-list': 'ResourceList',
  'comparison-table': 'ComparisonTable',
} as const satisfies Record<string, string>

const specs = [
  {
    name: 'toc',
    category: 'opening',
    bodyFormat: 'rows',
    renderer: 'toc',
    minColumns: 2,
    columns: ['label', 'title', 'description'],
    description: 'Compact table of contents for long notes.',
  },
  {
    name: 'cards',
    category: 'opening',
    bodyFormat: 'rows',
    renderer: 'cards',
    minColumns: 2,
    columns: ['title', 'description', 'meta', 'variant'],
    variants: ['default', 'subtle', 'accent'],
    description: 'Small grouped cards for sections, options, or themes.',
  },
  {
    name: 'hero',
    category: 'opening',
    bodyFormat: 'json_object',
    renderer: 'hero',
    description: 'Prominent article header with title, subtitle, metadata, background, and tags.',
  },
  {
    name: 'metrics',
    category: 'infographic',
    bodyFormat: 'rows',
    renderer: 'metrics',
    minColumns: 3,
    columns: ['label', 'value', 'description'],
    description: 'Metric grid for compact quantitative summaries.',
  },
  {
    name: 'steps',
    category: 'infographic',
    bodyFormat: 'rows',
    renderer: 'steps',
    minColumns: 2,
    columns: ['title', 'description', 'meta'],
    description: 'Ordered process or action sequence.',
  },
  {
    name: 'timeline',
    category: 'infographic',
    bodyFormat: 'rows',
    renderer: 'timeline',
    minColumns: 2,
    columns: ['time', 'title', 'description'],
    description: 'Time-ordered milestones or events.',
  },
  {
    name: 'verdict',
    category: 'judgment',
    bodyFormat: 'fields',
    renderer: 'verdict',
    requiredFields: ['title'],
    optionalFields: ['summary', 'confidence', 'status'],
    variants: ['default', 'success', 'warning', 'danger'],
    description: 'Decision or judgment block.',
  },
  {
    name: 'myth-fact',
    category: 'judgment',
    bodyFormat: 'rows',
    renderer: 'myth-fact',
    minColumns: 2,
    columns: ['myth', 'fact', 'reason'],
    description: 'Myth versus fact explanation.',
  },
  {
    name: 'quote',
    category: 'evidence',
    bodyFormat: 'fields',
    renderer: 'quote',
    requiredFields: ['text'],
    optionalFields: ['author', 'context', 'source', 'url'],
    description: 'Quoted evidence with optional author, context, and source.',
  },
  {
    name: 'quote-card',
    category: 'evidence',
    bodyFormat: 'fields',
    renderer: 'quote-card',
    requiredFields: ['text'],
    optionalFields: ['author', 'source'],
    variants: ['default', 'minimal', 'large', 'inline'],
    description: 'Prominent quote card for key statements with visual variants.',
  },
  {
    name: 'compare',
    category: 'evidence',
    bodyFormat: 'json_object',
    renderer: 'compare',
    description: 'Side-by-side comparison cards with VS marker for contrasting perspectives.',
  },
  {
    name: 'image-text',
    category: 'evidence',
    bodyFormat: 'fields',
    renderer: 'image-text',
    requiredFields: ['image'],
    optionalFields: ['title', 'text', 'alt'],
    variants: ['default', 'reverse'],
    description: 'Image plus explanatory text.',
  },
  {
    name: 'image-steps',
    category: 'evidence',
    bodyFormat: 'json_array',
    renderer: 'image-steps',
    description: 'Image sequence with step captions.',
  },
  {
    name: 'cta',
    category: 'conversion',
    bodyFormat: 'fields',
    renderer: 'cta',
    requiredFields: ['title'],
    optionalFields: ['description', 'action'],
    description: 'Private or team knowledge-base call to action.',
  },
  {
    name: 'faq',
    category: 'conversion',
    bodyFormat: 'rows',
    renderer: 'faq',
    minColumns: 2,
    columns: ['question', 'answer'],
    description: 'FAQ item list.',
  },
  {
    name: 'checklist',
    category: 'conversion',
    bodyFormat: 'rows',
    renderer: 'checklist',
    minColumns: 1,
    columns: ['item', 'state'],
    description: 'Read-only checklist.',
  },
  {
    name: 'cases',
    category: 'conversion',
    bodyFormat: 'rows',
    renderer: 'cases',
    minColumns: 2,
    columns: ['case', 'result', 'note'],
    description: 'Case examples.',
  },
  {
    name: 'summary',
    category: 'conversion',
    bodyFormat: 'fields',
    renderer: 'summary',
    requiredFields: ['title'],
    optionalFields: ['body'],
    description: 'End summary block.',
  },
  {
    name: 'toolbox',
    category: 'conversion',
    bodyFormat: 'rows',
    renderer: 'toolbox',
    minColumns: 2,
    columns: ['tool', 'use', 'link'],
    description: 'Tools and references.',
  },
  {
    name: 'author-card',
    category: 'brand',
    bodyFormat: 'fields',
    renderer: 'author-card',
    requiredFields: ['name'],
    optionalFields: ['role', 'bio'],
    description: 'Author or owner context.',
  },
  {
    name: 'subscribe',
    category: 'brand',
    bodyFormat: 'fields',
    renderer: 'subscribe',
    requiredFields: ['title'],
    optionalFields: ['description'],
    description: 'Private follow or subscription prompt.',
  },
  {
    name: 'callout',
    category: 'enhanced',
    bodyFormat: 'rows',
    renderer: 'callout',
    aliases: ['admonition', 'note'],
    modifiers: ['note', 'tip', 'info', 'warning', 'danger'],
    minColumns: 1,
    columns: ['content'],
    description: 'Docusaurus-style admonition block with Journal styling.',
  },
  {
    name: 'definition',
    category: 'enhanced',
    bodyFormat: 'json_object',
    renderer: 'definition',
    description: 'Term and definition object.',
  },
  {
    name: 'resource-list',
    category: 'enhanced',
    bodyFormat: 'json_array',
    renderer: 'resource-list',
    description: 'Structured resource list.',
  },
  {
    name: 'comparison-table',
    category: 'enhanced',
    bodyFormat: 'json_object',
    renderer: 'comparison-table',
    description: 'Structured comparison table.',
  },
] satisfies Array<Omit<LayoutModuleSpec, 'implemented' | 'jsxName'>>

export const IMPLEMENTED_LAYOUT_MODULES = specs.map((spec) => spec.name)

const implemented = new Set<string>(IMPLEMENTED_LAYOUT_MODULES)

export const JOURNAL_LAYOUT_MODULES: readonly LayoutModuleSpec[] = specs.map((spec) => ({
  ...spec,
  jsxName: LAYOUT_JSX_NAMES[spec.name as keyof typeof LAYOUT_JSX_NAMES],
  implemented: implemented.has(spec.name),
}))

const moduleByName = new Map<string, LayoutModuleSpec>()
const aliasByName = new Map<string, string>()

for (const spec of JOURNAL_LAYOUT_MODULES) {
  moduleByName.set(spec.name, spec)
  for (const alias of spec.aliases ?? []) {
    aliasByName.set(alias, spec.name)
  }
}

export function resolveLayoutModuleName(name: string): string | undefined {
  const normalized = name.trim().toLowerCase()
  if (moduleByName.has(normalized)) return normalized
  return aliasByName.get(normalized)
}

export function getLayoutModuleSpec(name: string): LayoutModuleSpec | undefined {
  const canonical = resolveLayoutModuleName(name)
  return canonical ? moduleByName.get(canonical) : undefined
}
