# Journal Layout Directives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add catalog-driven layout directives so `.md` and `.mdx` JournalClaw documents can render high-quality structured reading blocks without authors writing JSX.

**Architecture:** Keep the current renderers intact for documents with no layout directives. Add a shared `src/lib/journalLayout` parser, validator, catalog, and MDX transform, then render validated `JournalBlock` objects through one React component layer used by both Markdown and MDX. Phase 1 ships the mechanism plus the first 10 modules; the full 43-module catalog is registered from the start and unimplemented modules degrade through `ComingSoonBlock`.

**Tech Stack:** Tauri v2, React 19, TypeScript, Vitest, ReactMarkdown, existing `compileMdx` IPC, existing Journal design tokens in `src/styles/markdown.css` and `src/styles/mdx.css`.

---

## Scope

This plan implements Phase 1 from `/Users/yanwu/Downloads/2026-06-04-journal-layout-directives-design.md`.

In scope:

- Catalog registry for all 43 module names and aliases.
- Directive parser for Docusaurus-style triple-colon container blocks outside fenced code.
- Schema validation for `fields`, `rows`, `json_object`, and `json_array`.
- `.md` mixed segment renderer.
- `.mdx` pre-compile directive transform into whitelisted `JournalBlock` components.
- Local block errors, unknown module errors, and `ComingSoonBlock`.
- First 10 rendered modules: `callout`, `hero`, `cards`, `metrics`, `steps`, `timeline`, `verdict`, `quote`, `image-text`, `faq`.

Out of scope:

- Sidebar/category docs navigation.
- Docusaurus site export.
- User-authored JavaScript inside `.md` directives.
- Copying visual CSS from `md2wechat-skill`.
- New package dependencies unless an implementation subagent proves the hand parser is insufficient.

## File Structure

Create or modify these files:

- Create `src/lib/journalLayout/types.ts`: shared layout directive data types.
- Create `src/lib/journalLayout/catalog.ts`: full 43-module registry and lookup helpers.
- Create `src/lib/journalLayout/parse.ts`: directive scanner, source segmentation, and attribute parser.
- Create `src/lib/journalLayout/validate.ts`: body parsing and schema validation.
- Create `src/lib/journalLayout/transformMdx.ts`: safe `.mdx` source transform before `compileMdx`.
- Create `src/lib/journalLayout/index.ts`: public exports.
- Create `src/components/journal-blocks/BlockError.tsx`: localized error banner.
- Create `src/components/journal-blocks/UnknownBlock.tsx`: unknown module renderer.
- Create `src/components/journal-blocks/ComingSoonBlock.tsx`: registered but unimplemented module renderer.
- Create `src/components/journal-blocks/JournalBlockRenderer.tsx`: renderer switch for validated blocks.
- Create `src/components/journal-blocks/JournalLayoutMarkdownRenderer.tsx`: mixed `.md` segment renderer.
- Create `src/components/journal-blocks/opening.tsx`: `hero`, `cards`.
- Create `src/components/journal-blocks/infographic.tsx`: `metrics`, `steps`, `timeline`.
- Create `src/components/journal-blocks/judgment.tsx`: `verdict`.
- Create `src/components/journal-blocks/evidence.tsx`: `quote`, `image-text`.
- Create `src/components/journal-blocks/conversion.tsx`: `faq`.
- Create `src/components/journal-blocks/enhanced.tsx`: `callout`.
- Create `src/styles/journal-blocks.css`: restrained Journal-native block styling.
- Modify `src/lib/markdown.tsx`: route directive-bearing `.md` through mixed segment renderer.
- Modify `src/components/MdxRenderer.tsx`: transform directives before `compileMdx`.
- Modify `src/components/mdx/index.ts`: register `JournalBlock` and `JournalBlockError` for transformed MDX.
- Create `src/tests/journalLayoutCatalog.test.ts`.
- Create `src/tests/journalLayoutParse.test.ts`.
- Create `src/tests/journalLayoutValidate.test.ts`.
- Create `src/tests/JournalLayoutMarkdownRenderer.test.tsx`.
- Create `src/tests/JournalBlockRenderer.test.tsx`.
- Modify `src/tests/MdxRenderer.test.tsx`.
- Create `docs/superpowers/examples/journal-layout-directives-phase1.mdx`: manual visual fixture.

## External References Checked

- `md2wechat-skill` layout tree groups modules by `brand`, `conversion`, `evidence`, `infographic`, `judgment`, and `opening`.
- Docusaurus admonitions use triple-colon containers, optional titles, optional attributes, and parsing/rendering customization.
- MDX component mapping supports replacing JSX element names with locally supplied React components.

---

### Task 1: Add Layout Catalog and Types

**Files:**
- Create: `src/lib/journalLayout/types.ts`
- Create: `src/lib/journalLayout/catalog.ts`
- Create: `src/lib/journalLayout/index.ts`
- Create: `src/tests/journalLayoutCatalog.test.ts`

- [ ] **Step 1: Write the failing catalog test**

Create `src/tests/journalLayoutCatalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  IMPLEMENTED_LAYOUT_MODULES,
  JOURNAL_LAYOUT_MODULES,
  getLayoutModuleSpec,
  resolveLayoutModuleName,
} from '../lib/journalLayout'

describe('journal layout catalog', () => {
  it('registers the complete 43-module catalog', () => {
    expect(JOURNAL_LAYOUT_MODULES).toHaveLength(43)
    expect(new Set(JOURNAL_LAYOUT_MODULES.map((spec) => spec.name)).size).toBe(43)
  })

  it('marks exactly the phase 1 renderer modules as implemented', () => {
    expect(IMPLEMENTED_LAYOUT_MODULES).toEqual([
      'callout',
      'hero',
      'cards',
      'metrics',
      'steps',
      'timeline',
      'verdict',
      'quote',
      'image-text',
      'faq',
    ])
  })

  it('resolves aliases without changing canonical names', () => {
    expect(resolveLayoutModuleName('admonition')).toBe('callout')
    expect(resolveLayoutModuleName('stat-row')).toBe('stat-row')
    expect(getLayoutModuleSpec('admonition')?.name).toBe('callout')
  })

  it('stores schema data used by validation', () => {
    expect(getLayoutModuleSpec('hero')).toMatchObject({
      bodyFormat: 'fields',
      requiredFields: ['title'],
      implemented: true,
    })
    expect(getLayoutModuleSpec('resource-list')).toMatchObject({
      bodyFormat: 'json_array',
      implemented: false,
    })
  })
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx vitest run src/tests/journalLayoutCatalog.test.ts
```

Expected: FAIL with an import error for `../lib/journalLayout`.

- [ ] **Step 3: Add shared types**

Create `src/lib/journalLayout/types.ts`:

```ts
export type LayoutCategory =
  | 'opening'
  | 'infographic'
  | 'judgment'
  | 'evidence'
  | 'conversion'
  | 'brand'
  | 'enhanced'

export type LayoutBodyFormat = 'fields' | 'rows' | 'json_object' | 'json_array'

export type LayoutPrimitive = string | number | boolean
export type LayoutAttrs = Record<string, LayoutPrimitive | LayoutPrimitive[]>

export interface LayoutModuleSpec {
  name: string
  category: LayoutCategory
  bodyFormat: LayoutBodyFormat
  renderer: string
  implemented: boolean
  aliases?: string[]
  modifiers?: string[]
  requiredFields?: string[]
  optionalFields?: string[]
  columns?: string[]
  minColumns?: number
  variants?: string[]
  description: string
  whenToUse?: string
  antiPattern?: string
}

export type ParsedBlockBody =
  | { format: 'fields'; fields: Record<string, string> }
  | { format: 'rows'; rows: string[][] }
  | { format: 'json_object'; value: Record<string, unknown> }
  | { format: 'json_array'; value: unknown[] }

export interface SourceRange {
  startLine: number
  endLine: number
}

export interface RawJournalBlock {
  name: string
  title?: string
  modifier?: string
  attrs: LayoutAttrs
  bodyRaw: string
  source: string
  sourceRange: SourceRange
}

export interface JournalBlock {
  name: string
  title?: string
  modifier?: string
  attrs: LayoutAttrs
  body: ParsedBlockBody
  source: string
  sourceRange: SourceRange
}

export interface LayoutIssue {
  kind: 'syntax' | 'catalog' | 'schema' | 'runtime'
  message: string
  hint: string
  source?: string
  sourceRange: SourceRange
  blockName?: string
}

export type LayoutSegment =
  | { kind: 'markdown'; value: string; sourceRange: SourceRange }
  | { kind: 'block'; block: JournalBlock }
  | { kind: 'error'; issue: LayoutIssue }

export type RawLayoutSegment =
  | { kind: 'markdown'; value: string; sourceRange: SourceRange }
  | { kind: 'raw_block'; block: RawJournalBlock }
  | { kind: 'error'; issue: LayoutIssue }

export interface RawLayoutParseResult {
  segments: RawLayoutSegment[]
  containsLayout: boolean
}

export interface LayoutParseResult {
  segments: LayoutSegment[]
  containsLayout: boolean
}
```

- [ ] **Step 4: Add the full catalog**

Create `src/lib/journalLayout/catalog.ts`:

```ts
import type { LayoutModuleSpec } from './types'

const specs = [
  {
    name: 'hero',
    category: 'opening',
    bodyFormat: 'fields',
    renderer: 'hero',
    implemented: true,
    requiredFields: ['title'],
    optionalFields: ['eyebrow', 'subtitle', 'meta'],
    variants: ['default', 'quiet', 'accent'],
    description: 'Opening block for the main judgment and reading entrance.',
  },
  {
    name: 'toc',
    category: 'opening',
    bodyFormat: 'rows',
    renderer: 'toc',
    implemented: false,
    minColumns: 2,
    columns: ['label', 'title', 'description'],
    description: 'Compact table of contents for long notes.',
  },
  {
    name: 'cards',
    category: 'opening',
    bodyFormat: 'rows',
    renderer: 'cards',
    implemented: true,
    minColumns: 2,
    columns: ['title', 'description', 'meta', 'variant'],
    variants: ['default', 'subtle', 'accent'],
    description: 'Small grouped cards for sections, options, or themes.',
  },
  {
    name: 'part',
    category: 'opening',
    bodyFormat: 'fields',
    renderer: 'part',
    implemented: false,
    requiredFields: ['title'],
    optionalFields: ['label', 'subtitle'],
    description: 'Large section divider for major document parts.',
  },
  {
    name: 'label-title',
    category: 'opening',
    bodyFormat: 'fields',
    renderer: 'label-title',
    implemented: false,
    requiredFields: ['title'],
    optionalFields: ['label', 'subtitle'],
    description: 'Compact label plus title block.',
  },
  {
    name: 'metrics',
    category: 'infographic',
    bodyFormat: 'rows',
    renderer: 'metrics',
    implemented: true,
    minColumns: 3,
    columns: ['label', 'value', 'description'],
    description: 'Metric grid for compact quantitative summaries.',
  },
  {
    name: 'compare',
    category: 'infographic',
    bodyFormat: 'rows',
    renderer: 'compare',
    implemented: false,
    minColumns: 3,
    columns: ['item', 'left', 'right'],
    description: 'Side-by-side comparison rows.',
  },
  {
    name: 'steps',
    category: 'infographic',
    bodyFormat: 'rows',
    renderer: 'steps',
    implemented: true,
    minColumns: 2,
    columns: ['title', 'description', 'meta'],
    description: 'Ordered process or action sequence.',
  },
  {
    name: 'timeline',
    category: 'infographic',
    bodyFormat: 'rows',
    renderer: 'timeline',
    implemented: true,
    minColumns: 2,
    columns: ['time', 'title', 'description'],
    description: 'Time-ordered milestones or events.',
  },
  {
    name: 'infographic',
    category: 'infographic',
    bodyFormat: 'fields',
    renderer: 'infographic',
    implemented: false,
    requiredFields: ['title'],
    optionalFields: ['summary', 'value'],
    description: 'Single visual summary block.',
  },
  {
    name: 'verdict',
    category: 'judgment',
    bodyFormat: 'fields',
    renderer: 'verdict',
    implemented: true,
    requiredFields: ['title'],
    optionalFields: ['summary', 'confidence', 'status'],
    variants: ['default', 'success', 'warning', 'danger'],
    description: 'Decision or judgment block.',
  },
  {
    name: 'audience-fit',
    category: 'judgment',
    bodyFormat: 'rows',
    renderer: 'audience-fit',
    implemented: false,
    minColumns: 2,
    columns: ['audience', 'fit', 'reason'],
    description: 'Who this fits and why.',
  },
  {
    name: 'myth-fact',
    category: 'judgment',
    bodyFormat: 'rows',
    renderer: 'myth-fact',
    implemented: false,
    minColumns: 2,
    columns: ['myth', 'fact', 'reason'],
    description: 'Myth versus fact explanation.',
  },
  {
    name: 'manifesto',
    category: 'judgment',
    bodyFormat: 'rows',
    renderer: 'manifesto',
    implemented: false,
    minColumns: 1,
    columns: ['principle', 'detail'],
    description: 'Principle list for a strong point of view.',
  },
  {
    name: 'bridge',
    category: 'judgment',
    bodyFormat: 'fields',
    renderer: 'bridge',
    implemented: false,
    requiredFields: ['from', 'to'],
    optionalFields: ['why'],
    description: 'Transition from one mental model to another.',
  },
  {
    name: 'quote',
    category: 'evidence',
    bodyFormat: 'fields',
    renderer: 'quote',
    implemented: true,
    requiredFields: ['text'],
    optionalFields: ['source', 'url'],
    description: 'Quoted evidence with optional source.',
  },
  {
    name: 'image-text',
    category: 'evidence',
    bodyFormat: 'fields',
    renderer: 'image-text',
    implemented: true,
    requiredFields: ['image'],
    optionalFields: ['title', 'text', 'alt'],
    variants: ['default', 'reverse'],
    description: 'Image plus explanatory text.',
  },
  {
    name: 'image-compare',
    category: 'evidence',
    bodyFormat: 'fields',
    renderer: 'image-compare',
    implemented: false,
    requiredFields: ['before', 'after'],
    optionalFields: ['title', 'caption'],
    description: 'Before and after image comparison.',
  },
  {
    name: 'image-annotate',
    category: 'evidence',
    bodyFormat: 'json_object',
    renderer: 'image-annotate',
    implemented: false,
    description: 'Annotated image evidence.',
  },
  {
    name: 'image-steps',
    category: 'evidence',
    bodyFormat: 'json_array',
    renderer: 'image-steps',
    implemented: false,
    description: 'Image sequence with step captions.',
  },
  {
    name: 'cta',
    category: 'conversion',
    bodyFormat: 'fields',
    renderer: 'cta',
    implemented: false,
    requiredFields: ['title'],
    optionalFields: ['description', 'action'],
    description: 'Private/team knowledge-base call to action.',
  },
  {
    name: 'faq',
    category: 'conversion',
    bodyFormat: 'rows',
    renderer: 'faq',
    implemented: true,
    minColumns: 2,
    columns: ['question', 'answer'],
    description: 'Question and answer list.',
  },
  {
    name: 'checklist',
    category: 'conversion',
    bodyFormat: 'rows',
    renderer: 'checklist',
    implemented: false,
    minColumns: 1,
    columns: ['item', 'state'],
    description: 'Read-only checklist.',
  },
  {
    name: 'cases',
    category: 'conversion',
    bodyFormat: 'rows',
    renderer: 'cases',
    implemented: false,
    minColumns: 2,
    columns: ['case', 'result', 'note'],
    description: 'Case examples.',
  },
  {
    name: 'summary',
    category: 'conversion',
    bodyFormat: 'fields',
    renderer: 'summary',
    implemented: false,
    requiredFields: ['title'],
    optionalFields: ['body'],
    description: 'End summary block.',
  },
  {
    name: 'notice',
    category: 'conversion',
    bodyFormat: 'fields',
    renderer: 'notice',
    implemented: false,
    requiredFields: ['text'],
    optionalFields: ['title'],
    description: 'Small notice block.',
  },
  {
    name: 'logos',
    category: 'conversion',
    bodyFormat: 'rows',
    renderer: 'logos',
    implemented: false,
    minColumns: 1,
    columns: ['name', 'meta'],
    description: 'Restrained logo/name row.',
  },
  {
    name: 'pricing',
    category: 'conversion',
    bodyFormat: 'rows',
    renderer: 'pricing',
    implemented: false,
    minColumns: 3,
    columns: ['plan', 'price', 'note'],
    description: 'Private evaluation pricing table.',
  },
  {
    name: 'specs',
    category: 'conversion',
    bodyFormat: 'rows',
    renderer: 'specs',
    implemented: false,
    minColumns: 2,
    columns: ['name', 'value', 'note'],
    description: 'Specification list.',
  },
  {
    name: 'toolbox',
    category: 'conversion',
    bodyFormat: 'rows',
    renderer: 'toolbox',
    implemented: false,
    minColumns: 2,
    columns: ['tool', 'use', 'link'],
    description: 'Tools and references.',
  },
  {
    name: 'author-card',
    category: 'brand',
    bodyFormat: 'fields',
    renderer: 'author-card',
    implemented: false,
    requiredFields: ['name'],
    optionalFields: ['role', 'bio'],
    description: 'Author or owner context.',
  },
  {
    name: 'subscribe',
    category: 'brand',
    bodyFormat: 'fields',
    renderer: 'subscribe',
    implemented: false,
    requiredFields: ['title'],
    optionalFields: ['description'],
    description: 'Private follow or subscription prompt.',
  },
  {
    name: 'people',
    category: 'brand',
    bodyFormat: 'rows',
    renderer: 'people',
    implemented: false,
    minColumns: 2,
    columns: ['name', 'role', 'note'],
    description: 'People involved in a topic.',
  },
  {
    name: 'series',
    category: 'brand',
    bodyFormat: 'rows',
    renderer: 'series',
    implemented: false,
    minColumns: 2,
    columns: ['title', 'status', 'path'],
    description: 'Series navigation for related notes.',
  },
  {
    name: 'callout',
    category: 'enhanced',
    bodyFormat: 'rows',
    renderer: 'callout',
    implemented: true,
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
    implemented: false,
    description: 'Term and definition object.',
  },
  {
    name: 'quote-card',
    category: 'enhanced',
    bodyFormat: 'fields',
    renderer: 'quote-card',
    implemented: false,
    requiredFields: ['quote'],
    optionalFields: ['source'],
    description: 'Card-style quote.',
  },
  {
    name: 'tweet',
    category: 'enhanced',
    bodyFormat: 'fields',
    renderer: 'tweet',
    implemented: false,
    requiredFields: ['text'],
    optionalFields: ['author', 'url'],
    description: 'Read-only social post excerpt.',
  },
  {
    name: 'stat-row',
    category: 'enhanced',
    bodyFormat: 'json_array',
    renderer: 'stat-row',
    implemented: false,
    description: 'Dense statistic row.',
  },
  {
    name: 'question',
    category: 'enhanced',
    bodyFormat: 'fields',
    renderer: 'question',
    implemented: false,
    requiredFields: ['text'],
    optionalFields: ['context'],
    description: 'Question block.',
  },
  {
    name: 'resource-list',
    category: 'enhanced',
    bodyFormat: 'json_array',
    renderer: 'resource-list',
    implemented: false,
    description: 'Structured resource list.',
  },
  {
    name: 'comparison-table',
    category: 'enhanced',
    bodyFormat: 'json_object',
    renderer: 'comparison-table',
    implemented: false,
    description: 'Structured comparison table.',
  },
  {
    name: 'changelog',
    category: 'enhanced',
    bodyFormat: 'json_array',
    renderer: 'changelog',
    implemented: false,
    description: 'Changelog entries.',
  },
] satisfies LayoutModuleSpec[]

export const JOURNAL_LAYOUT_MODULES: readonly LayoutModuleSpec[] = specs
export const IMPLEMENTED_LAYOUT_MODULES = specs
  .filter((spec) => spec.implemented)
  .map((spec) => spec.name)

const moduleByName = new Map<string, LayoutModuleSpec>()
const aliasByName = new Map<string, string>()

for (const spec of specs) {
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
```

- [ ] **Step 5: Add public exports**

Create `src/lib/journalLayout/index.ts`:

```ts
export * from './types'
export * from './catalog'
export * from './parse'
export * from './validate'
export * from './transformMdx'
```

The `parse`, `validate`, and `transformMdx` files do not exist yet; TypeScript will fail until later tasks create them.

- [ ] **Step 6: Run the catalog test**

Run:

```bash
npx vitest run src/tests/journalLayoutCatalog.test.ts
```

Expected: FAIL because `parse`, `validate`, and `transformMdx` exports are not present yet. This confirms Task 1 must continue into the public export contract before the first green run.

- [ ] **Step 7: Add temporary export targets with empty modules**

Create `src/lib/journalLayout/parse.ts`:

```ts
export {}
```

Create `src/lib/journalLayout/validate.ts`:

```ts
export {}
```

Create `src/lib/journalLayout/transformMdx.ts`:

```ts
export {}
```

- [ ] **Step 8: Run the catalog test again**

Run:

```bash
npx vitest run src/tests/journalLayoutCatalog.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/journalLayout src/tests/journalLayoutCatalog.test.ts
git commit -m "feat: add journal layout catalog"
```

---

### Task 2: Add Directive Parser

**Files:**
- Modify: `src/lib/journalLayout/parse.ts`
- Create: `src/tests/journalLayoutParse.test.ts`

- [ ] **Step 1: Write parser tests**

Create `src/tests/journalLayoutParse.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseRawJournalLayout } from '../lib/journalLayout'

describe('parseRawJournalLayout', () => {
  it('parses name, modifier, title, attrs, body, source, and line range', () => {
    const result = parseRawJournalLayout(`# Before

:::metrics compact[Key Results]{columns=2 tone=accent}
Structure | 43 modules | catalog-driven
Effort | -42% | no JSX required
:::

After`)

    expect(result.containsLayout).toBe(true)
    expect(result.segments).toHaveLength(3)
    const block = result.segments[1]
    expect(block.kind).toBe('raw_block')
    if (block.kind !== 'raw_block') throw new Error('expected raw block')
    expect(block.block).toMatchObject({
      name: 'metrics',
      modifier: 'compact',
      title: 'Key Results',
      attrs: { columns: 2, tone: 'accent' },
      bodyRaw: 'Structure | 43 modules | catalog-driven\nEffort | -42% | no JSX required',
      sourceRange: { startLine: 3, endLine: 6 },
    })
  })

  it('ignores directives inside fenced code blocks', () => {
    const result = parseRawJournalLayout(`Text

\`\`\`md
:::callout tip
inside code
:::
\`\`\`
`)

    expect(result.containsLayout).toBe(false)
    expect(result.segments).toEqual([
      {
        kind: 'markdown',
        value: `Text

\`\`\`md
:::callout tip
inside code
:::
\`\`\`
`,
        sourceRange: { startLine: 1, endLine: 8 },
      },
    ])
  })

  it('returns a local syntax error for an unclosed directive', () => {
    const result = parseRawJournalLayout(`Intro

:::hero
title: Missing close`)

    expect(result.containsLayout).toBe(true)
    expect(result.segments.at(-1)).toMatchObject({
      kind: 'error',
      issue: {
        kind: 'syntax',
        blockName: 'hero',
        message: 'Directive is not closed.',
        sourceRange: { startLine: 3, endLine: 4 },
      },
    })
  })

  it('parses multiple directives without swallowing surrounding markdown', () => {
    const result = parseRawJournalLayout(`A

:::callout tip
one
:::

B

:::verdict
title: Ship it
:::

C`)

    expect(result.segments.map((segment) => segment.kind)).toEqual([
      'markdown',
      'raw_block',
      'markdown',
      'raw_block',
      'markdown',
    ])
  })

  it('reports malformed opening lines as syntax errors', () => {
    const result = parseRawJournalLayout(`:::hero[bad title
title: Broken
:::`)

    expect(result.containsLayout).toBe(true)
    expect(result.segments[0]).toMatchObject({
      kind: 'error',
      issue: {
        kind: 'syntax',
        message: 'Directive opening line is malformed.',
        hint: 'Use :::name modifier[title]{key=value}.',
      },
    })
  })
})
```

- [ ] **Step 2: Run parser tests to verify failure**

Run:

```bash
npx vitest run src/tests/journalLayoutParse.test.ts
```

Expected: FAIL because `parseRawJournalLayout` is not exported.

- [ ] **Step 3: Implement parser**

Replace `src/lib/journalLayout/parse.ts` with:

```ts
import type { LayoutAttrs, LayoutIssue, RawJournalBlock, RawLayoutParseResult } from './types'

const OPENING_RE =
  /^\s*:::([A-Za-z][A-Za-z0-9_-]*)(?:\s+([A-Za-z][A-Za-z0-9_-]*))?(?:\[([^\]\n]*)\])?(?:\{([^}\n]*)\})?\s*$/
const CLOSING_RE = /^\s*:::\s*$/
const FENCE_RE = /^\s*(```+|~~~+)/

function lineNumberAt(lines: string[], index: number): number {
  return index + 1
}

function makeMarkdown(value: string, startLine: number, endLine: number) {
  return {
    kind: 'markdown' as const,
    value,
    sourceRange: { startLine, endLine },
  }
}

function makeIssue({
  message,
  hint,
  source,
  startLine,
  endLine,
  blockName,
}: {
  message: string
  hint: string
  source?: string
  startLine: number
  endLine: number
  blockName?: string
}): LayoutIssue {
  return {
    kind: 'syntax',
    message,
    hint,
    source,
    sourceRange: { startLine, endLine },
    blockName,
  }
}

function parsePrimitive(value: string): string | number | boolean {
  const trimmed = value.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function splitAttrTokens(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null

  for (const char of input) {
    if (quote) {
      current += char
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      current += char
      quote = char
      continue
    }
    if (char === ',' || /\s/.test(char)) {
      if (current.trim()) tokens.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  if (current.trim()) tokens.push(current.trim())
  return tokens
}

export function parseDirectiveAttrs(input?: string): {
  attrs: LayoutAttrs
  error?: string
} {
  if (!input?.trim()) return { attrs: {} }

  const attrs: LayoutAttrs = {}
  for (const token of splitAttrTokens(input)) {
    const eq = token.indexOf('=')
    if (eq <= 0) {
      return { attrs: {}, error: `Attribute "${token}" must use key=value.` }
    }

    const key = token.slice(0, eq).trim()
    const value = token.slice(eq + 1).trim()
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) {
      return { attrs: {}, error: `Attribute key "${key}" is invalid.` }
    }
    if (!value) {
      return { attrs: {}, error: `Attribute "${key}" is missing a value.` }
    }

    attrs[key] = value.includes(',') ? value.split(',').map(parsePrimitive) : parsePrimitive(value)
  }

  return { attrs }
}

function parseOpeningLine(line: string, lineNumber: number): RawJournalBlock | LayoutIssue {
  const match = line.match(OPENING_RE)
  if (!match) {
    return makeIssue({
      message: 'Directive opening line is malformed.',
      hint: 'Use :::name modifier[title]{key=value}.',
      source: line,
      startLine: lineNumber,
      endLine: lineNumber,
    })
  }

  const [, name, modifier, title, attrsRaw] = match
  const attrsResult = parseDirectiveAttrs(attrsRaw)
  if (attrsResult.error) {
    return makeIssue({
      message: attrsResult.error,
      hint: 'Use primitive attribute values such as columns=2 compact=true tone=accent.',
      source: line,
      startLine: lineNumber,
      endLine: lineNumber,
      blockName: name,
    })
  }

  return {
    name: name.toLowerCase(),
    modifier,
    title,
    attrs: attrsResult.attrs,
    bodyRaw: '',
    source: line,
    sourceRange: { startLine: lineNumber, endLine: lineNumber },
  }
}

function lineLooksLikeDirectiveOpening(line: string): boolean {
  return /^\s*:::[^\s:]/.test(line)
}

export function parseRawJournalLayout(source: string): RawLayoutParseResult {
  const lines = source.split('\n')
  const segments: RawLayoutParseResult['segments'] = []
  let markdownStart = 0
  let i = 0
  let inFence = false
  let containsLayout = false

  const flushMarkdown = (exclusiveEnd: number) => {
    if (exclusiveEnd <= markdownStart) return
    const value = lines.slice(markdownStart, exclusiveEnd).join('\n')
    if (!value) return
    segments.push(
      makeMarkdown(
        value,
        lineNumberAt(lines, markdownStart),
        lineNumberAt(lines, Math.max(markdownStart, exclusiveEnd - 1)),
      ),
    )
  }

  while (i < lines.length) {
    const line = lines[i]
    if (FENCE_RE.test(line)) {
      inFence = !inFence
      i += 1
      continue
    }

    if (inFence || !lineLooksLikeDirectiveOpening(line)) {
      i += 1
      continue
    }

    containsLayout = true
    flushMarkdown(i)

    const startLine = lineNumberAt(lines, i)
    const parsed = parseOpeningLine(line, startLine)
    let closeIndex = -1
    for (let j = i + 1; j < lines.length; j += 1) {
      if (CLOSING_RE.test(lines[j])) {
        closeIndex = j
        break
      }
    }

    if ('kind' in parsed) {
      const endIndex = closeIndex >= 0 ? closeIndex : i
      segments.push({ kind: 'error', issue: parsed })
      i = endIndex + 1
      markdownStart = i
      continue
    }

    if (closeIndex === -1) {
      segments.push({
        kind: 'error',
        issue: makeIssue({
          message: 'Directive is not closed.',
          hint: 'Add a closing ::: line after the directive body.',
          source: lines.slice(i).join('\n'),
          startLine,
          endLine: lineNumberAt(lines, lines.length - 1),
          blockName: parsed.name,
        }),
      })
      markdownStart = lines.length
      break
    }

    const bodyRaw = lines.slice(i + 1, closeIndex).join('\n').trim()
    const sourceText = lines.slice(i, closeIndex + 1).join('\n')
    segments.push({
      kind: 'raw_block',
      block: {
        ...parsed,
        bodyRaw,
        source: sourceText,
        sourceRange: { startLine, endLine: lineNumberAt(lines, closeIndex) },
      },
    })

    i = closeIndex + 1
    markdownStart = i
  }

  flushMarkdown(lines.length)

  if (!containsLayout) {
    return {
      containsLayout: false,
      segments: [
        makeMarkdown(source, source ? 1 : 0, source ? source.split('\n').length : 0),
      ],
    }
  }

  return { containsLayout, segments }
}
```

- [ ] **Step 4: Run parser tests**

Run:

```bash
npx vitest run src/tests/journalLayoutParse.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run catalog tests to catch export regressions**

Run:

```bash
npx vitest run src/tests/journalLayoutCatalog.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/journalLayout/parse.ts src/tests/journalLayoutParse.test.ts
git commit -m "feat: parse journal layout directives"
```

---

### Task 3: Add Body Parser and Schema Validator

**Files:**
- Modify: `src/lib/journalLayout/validate.ts`
- Create: `src/tests/journalLayoutValidate.test.ts`

- [ ] **Step 1: Write validator tests**

Create `src/tests/journalLayoutValidate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseJournalLayout } from '../lib/journalLayout'

describe('parseJournalLayout validation', () => {
  it('validates fields bodies', () => {
    const result = parseJournalLayout(`:::hero
eyebrow: Deep note
title: Structure before style
subtitle: Blocks define reading rhythm
:::`)

    expect(result.segments[0]).toMatchObject({
      kind: 'block',
      block: {
        name: 'hero',
        body: {
          format: 'fields',
          fields: {
            eyebrow: 'Deep note',
            title: 'Structure before style',
            subtitle: 'Blocks define reading rhythm',
          },
        },
      },
    })
  })

  it('reports missing required fields locally', () => {
    const result = parseJournalLayout(`:::hero
subtitle: Missing title
:::`)

    expect(result.segments[0]).toMatchObject({
      kind: 'error',
      issue: {
        kind: 'schema',
        message: 'hero is missing required field "title".',
      },
    })
  })

  it('validates rows bodies and minimum columns', () => {
    const result = parseJournalLayout(`:::metrics
Structure | 43 modules | catalog
Effort | -42% | less JSX
:::`)

    expect(result.segments[0]).toMatchObject({
      kind: 'block',
      block: {
        name: 'metrics',
        body: {
          format: 'rows',
          rows: [
            ['Structure', '43 modules', 'catalog'],
            ['Effort', '-42%', 'less JSX'],
          ],
        },
      },
    })
  })

  it('reports rows with too few columns', () => {
    const result = parseJournalLayout(`:::metrics
Only label | 1
:::`)

    expect(result.segments[0]).toMatchObject({
      kind: 'error',
      issue: {
        kind: 'schema',
        message: 'metrics row 1 expected at least 3 columns, got 2.',
      },
    })
  })

  it('validates json object bodies', () => {
    const result = parseJournalLayout(`:::definition
{"term":"Catalog","description":"Single source of truth"}
:::`)

    expect(result.segments[0]).toMatchObject({
      kind: 'block',
      block: {
        name: 'definition',
        body: {
          format: 'json_object',
          value: { term: 'Catalog', description: 'Single source of truth' },
        },
      },
    })
  })

  it('reports invalid json array shape', () => {
    const result = parseJournalLayout(`:::resource-list
{"title":"Not an array"}
:::`)

    expect(result.segments[0]).toMatchObject({
      kind: 'error',
      issue: {
        kind: 'schema',
        message: 'resource-list body must be a JSON array.',
      },
    })
  })

  it('reports unknown modules and unknown modifiers', () => {
    const unknown = parseJournalLayout(`:::made-up
text
:::`)
    expect(unknown.segments[0]).toMatchObject({
      kind: 'error',
      issue: {
        kind: 'catalog',
        message: 'Unknown layout module "made-up".',
      },
    })

    const badModifier = parseJournalLayout(`:::callout urgent
text
:::`)
    expect(badModifier.segments[0]).toMatchObject({
      kind: 'error',
      issue: {
        kind: 'schema',
        message: 'callout modifier "urgent" is not supported.',
      },
    })
  })
})
```

- [ ] **Step 2: Run validator tests to verify failure**

Run:

```bash
npx vitest run src/tests/journalLayoutValidate.test.ts
```

Expected: FAIL because `parseJournalLayout` is not exported.

- [ ] **Step 3: Implement validator**

Replace `src/lib/journalLayout/validate.ts` with:

```ts
import { getLayoutModuleSpec, resolveLayoutModuleName } from './catalog'
import { parseRawJournalLayout } from './parse'
import type {
  JournalBlock,
  LayoutIssue,
  LayoutParseResult,
  ParsedBlockBody,
  RawJournalBlock,
} from './types'

function issue(
  block: RawJournalBlock,
  kind: LayoutIssue['kind'],
  message: string,
  hint: string,
): LayoutIssue {
  return {
    kind,
    message,
    hint,
    source: block.source,
    sourceRange: block.sourceRange,
    blockName: block.name,
  }
}

function parseFields(bodyRaw: string): Record<string, string> {
  const fields: Record<string, string> = {}
  let activeKey = ''

  for (const rawLine of bodyRaw.split(/\r?\n/)) {
    if (!rawLine.trim()) continue
    const match = rawLine.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/)
    if (match) {
      activeKey = match[1]
      fields[activeKey] = match[2].trim()
      continue
    }
    if (activeKey && /^\s+/.test(rawLine)) {
      fields[activeKey] = `${fields[activeKey]} ${rawLine.trim()}`.trim()
    }
  }

  return fields
}

function parseRows(bodyRaw: string): string[][] {
  return bodyRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('|').map((cell) => cell.trim()))
}

function parseJsonObject(bodyRaw: string): Record<string, unknown> {
  const value = JSON.parse(bodyRaw)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('body must be a JSON object')
  }
  return value as Record<string, unknown>
}

function parseJsonArray(bodyRaw: string): unknown[] {
  const value = JSON.parse(bodyRaw)
  if (!Array.isArray(value)) throw new Error('body must be a JSON array')
  return value
}

function parseBody(block: RawJournalBlock): ParsedBlockBody | LayoutIssue {
  const spec = getLayoutModuleSpec(block.name)
  if (!spec) {
    return issue(
      block,
      'catalog',
      `Unknown layout module "${block.name}".`,
      'Use a module from the Journal Layout Catalog.',
    )
  }

  const canonicalName = resolveLayoutModuleName(block.name) ?? block.name
  const normalizedBlock = { ...block, name: canonicalName }

  if (spec.modifiers && block.modifier && !spec.modifiers.includes(block.modifier)) {
    return issue(
      normalizedBlock,
      'schema',
      `${canonicalName} modifier "${block.modifier}" is not supported.`,
      `Use one of: ${spec.modifiers.join(', ')}.`,
    )
  }

  const variant = block.attrs.variant
  if (spec.variants && typeof variant === 'string' && !spec.variants.includes(variant)) {
    return issue(
      normalizedBlock,
      'schema',
      `${canonicalName} variant "${variant}" is not supported.`,
      `Use one of: ${spec.variants.join(', ')}.`,
    )
  }

  try {
    if (spec.bodyFormat === 'fields') {
      const fields = parseFields(block.bodyRaw)
      for (const field of spec.requiredFields ?? []) {
        if (!fields[field]) {
          return issue(
            normalizedBlock,
            'schema',
            `${canonicalName} is missing required field "${field}".`,
            `Add "${field}: ..." inside the directive body.`,
          )
        }
      }
      return { format: 'fields', fields }
    }

    if (spec.bodyFormat === 'rows') {
      const rows = parseRows(block.bodyRaw)
      const minColumns = spec.minColumns ?? 1
      for (const [index, row] of rows.entries()) {
        if (row.length < minColumns) {
          return issue(
            normalizedBlock,
            'schema',
            `${canonicalName} row ${index + 1} expected at least ${minColumns} columns, got ${row.length}.`,
            `Use pipe-separated columns: ${(spec.columns ?? ['value']).join(' | ')}.`,
          )
        }
      }
      return { format: 'rows', rows }
    }

    if (spec.bodyFormat === 'json_object') {
      try {
        return { format: 'json_object', value: parseJsonObject(block.bodyRaw) }
      } catch {
        return issue(
          normalizedBlock,
          'schema',
          `${canonicalName} body must be a JSON object.`,
          'Use an object such as {"term":"Catalog","description":"..."}.',
        )
      }
    }

    try {
      return { format: 'json_array', value: parseJsonArray(block.bodyRaw) }
    } catch {
      return issue(
        normalizedBlock,
        'schema',
        `${canonicalName} body must be a JSON array.`,
        'Use an array such as [{"title":"Reference","url":"https://example.com"}].',
      )
    }
  } catch (error) {
    return issue(
      normalizedBlock,
      'schema',
      error instanceof Error ? error.message : String(error),
      'Check the directive body format.',
    )
  }
}

export function validateJournalBlock(block: RawJournalBlock): JournalBlock | LayoutIssue {
  const parsedBody = parseBody(block)
  if ('kind' in parsedBody) return parsedBody

  const canonicalName = resolveLayoutModuleName(block.name) ?? block.name
  return {
    name: canonicalName,
    title: block.title,
    modifier: block.modifier,
    attrs: block.attrs,
    body: parsedBody,
    source: block.source,
    sourceRange: block.sourceRange,
  }
}

export function parseJournalLayout(source: string): LayoutParseResult {
  const raw = parseRawJournalLayout(source)
  return {
    containsLayout: raw.containsLayout,
    segments: raw.segments.map((segment) => {
      if (segment.kind === 'markdown') return segment
      if (segment.kind === 'error') return segment

      const validated = validateJournalBlock(segment.block)
      if ('kind' in validated) return { kind: 'error', issue: validated }
      return { kind: 'block', block: validated }
    }),
  }
}
```

- [ ] **Step 4: Run validator tests**

Run:

```bash
npx vitest run src/tests/journalLayoutValidate.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run parser and catalog tests**

Run:

```bash
npx vitest run src/tests/journalLayoutCatalog.test.ts src/tests/journalLayoutParse.test.ts src/tests/journalLayoutValidate.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/journalLayout/validate.ts src/tests/journalLayoutValidate.test.ts
git commit -m "feat: validate journal layout directives"
```

---

### Task 4: Add Shared Block Renderers and Styles

**Files:**
- Create: `src/components/journal-blocks/BlockError.tsx`
- Create: `src/components/journal-blocks/UnknownBlock.tsx`
- Create: `src/components/journal-blocks/ComingSoonBlock.tsx`
- Create: `src/components/journal-blocks/JournalBlockRenderer.tsx`
- Create: `src/components/journal-blocks/opening.tsx`
- Create: `src/components/journal-blocks/infographic.tsx`
- Create: `src/components/journal-blocks/judgment.tsx`
- Create: `src/components/journal-blocks/evidence.tsx`
- Create: `src/components/journal-blocks/conversion.tsx`
- Create: `src/components/journal-blocks/enhanced.tsx`
- Create: `src/styles/journal-blocks.css`
- Create: `src/tests/JournalBlockRenderer.test.tsx`

- [ ] **Step 1: Write renderer tests**

Create `src/tests/JournalBlockRenderer.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JournalBlockRenderer } from '../components/journal-blocks/JournalBlockRenderer'
import type { JournalBlock, LayoutIssue } from '../lib/journalLayout'

function block(overrides: Partial<JournalBlock>): JournalBlock {
  return {
    name: 'hero',
    attrs: {},
    body: { format: 'fields', fields: { title: 'Directive design' } },
    source: ':::hero\ntitle: Directive design\n:::',
    sourceRange: { startLine: 1, endLine: 3 },
    ...overrides,
  }
}

describe('JournalBlockRenderer', () => {
  it('renders implemented hero blocks', () => {
    render(
      <JournalBlockRenderer
        block={block({
          body: {
            format: 'fields',
            fields: {
              eyebrow: 'Journal Layout',
              title: 'Structure before style',
              subtitle: 'Modules define reading rhythm',
            },
          },
        })}
      />,
    )

    expect(screen.getByText('Journal Layout')).toBeTruthy()
    expect(screen.getByText('Structure before style')).toBeTruthy()
    expect(screen.getByText('Modules define reading rhythm')).toBeTruthy()
  })

  it('renders callout body rows with modifier tone', () => {
    render(
      <JournalBlockRenderer
        block={block({
          name: 'callout',
          modifier: 'tip',
          title: 'Use this',
          body: { format: 'rows', rows: [['Keep prose calm and precise.']] },
        })}
      />,
    )

    expect(screen.getByText('Use this')).toBeTruthy()
    expect(screen.getByText('Keep prose calm and precise.')).toBeTruthy()
  })

  it('renders registered modules without a renderer as coming soon', () => {
    render(
      <JournalBlockRenderer
        block={block({
          name: 'definition',
          body: { format: 'json_object', value: { term: 'Catalog' } },
        })}
      />,
    )

    expect(screen.getByText('definition layout block is registered')).toBeTruthy()
  })

  it('renders localized block errors', () => {
    const issue: LayoutIssue = {
      kind: 'schema',
      blockName: 'metrics',
      message: 'metrics row 2 expected at least 3 columns, got 2.',
      hint: 'Use pipe-separated columns.',
      source: ':::metrics\nA | B\n:::',
      sourceRange: { startLine: 12, endLine: 14 },
    }

    render(<JournalBlockRenderer issue={issue} />)

    expect(screen.getByText('metrics block failed')).toBeTruthy()
    expect(screen.getByText('Line 12-14: metrics row 2 expected at least 3 columns, got 2.')).toBeTruthy()
    expect(screen.getByText('Use pipe-separated columns.')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run renderer tests to verify failure**

Run:

```bash
npx vitest run src/tests/JournalBlockRenderer.test.tsx
```

Expected: FAIL because `JournalBlockRenderer` does not exist.

- [ ] **Step 3: Add error renderers**

Create `src/components/journal-blocks/BlockError.tsx`:

```tsx
import type { LayoutIssue } from '../../lib/journalLayout'

export function BlockError({ issue }: { issue: LayoutIssue }) {
  const title = `${issue.blockName ?? 'layout'} block failed`
  return (
    <aside className="journal-block journal-block-error" role="note">
      <div className="journal-block-error-title">{title}</div>
      <div className="journal-block-error-message">
        Line {issue.sourceRange.startLine}-{issue.sourceRange.endLine}: {issue.message}
      </div>
      <div className="journal-block-error-hint">{issue.hint}</div>
      {issue.source && (
        <pre className="journal-block-error-source">
          <code>{issue.source}</code>
        </pre>
      )}
    </aside>
  )
}
```

Create `src/components/journal-blocks/UnknownBlock.tsx`:

```tsx
import type { JournalBlock } from '../../lib/journalLayout'

export function UnknownBlock({ block }: { block: JournalBlock }) {
  return (
    <aside className="journal-block journal-block-error" role="note">
      <div className="journal-block-error-title">Unknown layout block</div>
      <div className="journal-block-error-message">
        Line {block.sourceRange.startLine}-{block.sourceRange.endLine}: {block.name} is not in the
        Journal Layout Catalog.
      </div>
      <div className="journal-block-error-hint">Use a registered layout module name.</div>
      <pre className="journal-block-error-source">
        <code>{block.source}</code>
      </pre>
    </aside>
  )
}
```

Create `src/components/journal-blocks/ComingSoonBlock.tsx`:

```tsx
import type { JournalBlock } from '../../lib/journalLayout'

export function ComingSoonBlock({ block }: { block: JournalBlock }) {
  return (
    <aside className="journal-block journal-block-coming-soon" role="note">
      <div className="journal-block-kicker">{block.name}</div>
      <div className="journal-block-coming-title">{block.name} layout block is registered</div>
      <div className="journal-block-coming-body">
        This module is recognized by the catalog and will render as a dedicated Journal block when
        its renderer is enabled.
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Add rendered module components**

Create `src/components/journal-blocks/opening.tsx`:

```tsx
import type { JournalBlock } from '../../lib/journalLayout'

function fields(block: JournalBlock): Record<string, string> {
  return block.body.format === 'fields' ? block.body.fields : {}
}

function rows(block: JournalBlock): string[][] {
  return block.body.format === 'rows' ? block.body.rows : []
}

export function HeroBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  return (
    <section className="journal-block journal-block-hero">
      {data.eyebrow && <div className="journal-block-kicker">{data.eyebrow}</div>}
      <h1>{data.title}</h1>
      {data.subtitle && <p>{data.subtitle}</p>}
      {data.meta && <div className="journal-block-meta">{data.meta}</div>}
    </section>
  )
}

export function CardsBlock({ block }: { block: JournalBlock }) {
  return (
    <section className="journal-block journal-block-cards" aria-label={block.title ?? 'Cards'}>
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      <div className="journal-block-card-grid">
        {rows(block).map(([title, description, meta, variant], index) => (
          <article
            key={`${title}-${index}`}
            className={`journal-layout-card ${variant === 'accent' ? 'journal-layout-card-accent' : ''}`}
          >
            <h3>{title}</h3>
            {description && <p>{description}</p>}
            {meta && <div className="journal-block-meta">{meta}</div>}
          </article>
        ))}
      </div>
    </section>
  )
}
```

Create `src/components/journal-blocks/infographic.tsx`:

```tsx
import type { JournalBlock } from '../../lib/journalLayout'

function rows(block: JournalBlock): string[][] {
  return block.body.format === 'rows' ? block.body.rows : []
}

export function MetricsBlock({ block }: { block: JournalBlock }) {
  return (
    <section className="journal-block journal-block-metrics" aria-label={block.title ?? 'Metrics'}>
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      <div className="journal-block-metric-grid">
        {rows(block).map(([label, value, description], index) => (
          <div key={`${label}-${index}`} className="journal-block-metric">
            <div className="journal-block-metric-value">{value}</div>
            <div className="journal-block-metric-label">{label}</div>
            {description && <div className="journal-block-metric-desc">{description}</div>}
          </div>
        ))}
      </div>
    </section>
  )
}

export function StepsBlock({ block }: { block: JournalBlock }) {
  return (
    <section className="journal-block journal-block-steps" aria-label={block.title ?? 'Steps'}>
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      {rows(block).map(([title, description, meta], index) => (
        <div key={`${title}-${index}`} className="journal-block-step">
          <div className="journal-block-step-index">{String(index + 1).padStart(2, '0')}</div>
          <div>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
            {meta && <div className="journal-block-meta">{meta}</div>}
          </div>
        </div>
      ))}
    </section>
  )
}

export function TimelineBlock({ block }: { block: JournalBlock }) {
  return (
    <section className="journal-block journal-block-timeline" aria-label={block.title ?? 'Timeline'}>
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      {rows(block).map(([time, title, description], index) => (
        <div key={`${time}-${title}-${index}`} className="journal-block-timeline-item">
          <time>{time}</time>
          <div>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
        </div>
      ))}
    </section>
  )
}
```

Create `src/components/journal-blocks/judgment.tsx`:

```tsx
import type { JournalBlock } from '../../lib/journalLayout'

export function VerdictBlock({ block }: { block: JournalBlock }) {
  const fields = block.body.format === 'fields' ? block.body.fields : {}
  const variant = typeof block.attrs.variant === 'string' ? block.attrs.variant : 'default'
  return (
    <section className={`journal-block journal-block-verdict journal-block-verdict-${variant}`}>
      <div className="journal-block-kicker">{fields.status ?? block.title ?? 'Verdict'}</div>
      <h2>{fields.title}</h2>
      {fields.summary && <p>{fields.summary}</p>}
      {fields.confidence && <div className="journal-block-meta">Confidence: {fields.confidence}</div>}
    </section>
  )
}
```

Create `src/components/journal-blocks/evidence.tsx`:

```tsx
import { convertFileSrc } from '@tauri-apps/api/core'
import type { JournalBlock } from '../../lib/journalLayout'
import { resolveRelativePath } from '../../lib/markdownUtils'

function fields(block: JournalBlock): Record<string, string> {
  return block.body.format === 'fields' ? block.body.fields : {}
}

function resolveImage(src: string, entryPath?: string): string {
  if (!src || src.startsWith('http')) return src
  if (!entryPath) return convertFileSrc(src)
  const entryDir = entryPath.substring(0, entryPath.lastIndexOf('/'))
  return convertFileSrc(src.startsWith('/') ? src : resolveRelativePath(entryDir, decodeURIComponent(src)))
}

export function QuoteBlock({ block }: { block: JournalBlock }) {
  const data = fields(block)
  return (
    <blockquote className="journal-block journal-block-quote">
      <p>{data.text}</p>
      {data.source && (
        <cite>
          {data.url ? <a href={data.url}>{data.source}</a> : data.source}
        </cite>
      )}
    </blockquote>
  )
}

export function ImageTextBlock({
  block,
  entryPath,
}: {
  block: JournalBlock
  entryPath?: string
}) {
  const data = fields(block)
  const variant = block.attrs.variant === 'reverse' ? ' journal-block-image-text-reverse' : ''
  return (
    <section className={`journal-block journal-block-image-text${variant}`}>
      <img src={resolveImage(data.image, entryPath)} alt={data.alt ?? data.title ?? ''} />
      <div>
        {data.title && <h3>{data.title}</h3>}
        {data.text && <p>{data.text}</p>}
      </div>
    </section>
  )
}
```

Create `src/components/journal-blocks/conversion.tsx`:

```tsx
import type { JournalBlock } from '../../lib/journalLayout'

export function FaqBlock({ block }: { block: JournalBlock }) {
  const rows = block.body.format === 'rows' ? block.body.rows : []
  return (
    <section className="journal-block journal-block-faq" aria-label={block.title ?? 'FAQ'}>
      {block.title && <div className="journal-block-section-title">{block.title}</div>}
      {rows.map(([question, answer], index) => (
        <details key={`${question}-${index}`} className="journal-block-faq-item">
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>
      ))}
    </section>
  )
}
```

Create `src/components/journal-blocks/enhanced.tsx`:

```tsx
import type { JournalBlock } from '../../lib/journalLayout'

const labels: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  info: 'Info',
  warning: 'Warning',
  danger: 'Danger',
}

export function CalloutBlock({ block }: { block: JournalBlock }) {
  const tone = block.modifier ?? 'note'
  const rows = block.body.format === 'rows' ? block.body.rows : []
  const content = rows.map((row) => row.join(' | ')).join('\n')
  return (
    <aside className={`journal-block journal-block-callout journal-block-callout-${tone}`}>
      <div className="journal-block-callout-title">{block.title ?? labels[tone] ?? 'Note'}</div>
      <div className="journal-block-callout-body">{content}</div>
    </aside>
  )
}
```

- [ ] **Step 5: Add renderer switch**

Create `src/components/journal-blocks/JournalBlockRenderer.tsx`:

```tsx
import type { JournalBlock, LayoutIssue } from '../../lib/journalLayout'
import { getLayoutModuleSpec } from '../../lib/journalLayout'
import '../../styles/journal-blocks.css'
import { BlockError } from './BlockError'
import { ComingSoonBlock } from './ComingSoonBlock'
import { CardsBlock, HeroBlock } from './opening'
import { MetricsBlock, StepsBlock, TimelineBlock } from './infographic'
import { VerdictBlock } from './judgment'
import { ImageTextBlock, QuoteBlock } from './evidence'
import { FaqBlock } from './conversion'
import { CalloutBlock } from './enhanced'

export function JournalBlockRenderer({
  block,
  issue,
  entryPath,
}: {
  block?: JournalBlock
  issue?: LayoutIssue
  entryPath?: string
}) {
  if (issue) return <BlockError issue={issue} />
  if (!block) return null

  const spec = getLayoutModuleSpec(block.name)
  if (!spec?.implemented) return <ComingSoonBlock block={block} />

  switch (block.name) {
    case 'callout':
      return <CalloutBlock block={block} />
    case 'hero':
      return <HeroBlock block={block} />
    case 'cards':
      return <CardsBlock block={block} />
    case 'metrics':
      return <MetricsBlock block={block} />
    case 'steps':
      return <StepsBlock block={block} />
    case 'timeline':
      return <TimelineBlock block={block} />
    case 'verdict':
      return <VerdictBlock block={block} />
    case 'quote':
      return <QuoteBlock block={block} />
    case 'image-text':
      return <ImageTextBlock block={block} entryPath={entryPath} />
    case 'faq':
      return <FaqBlock block={block} />
    default:
      return <ComingSoonBlock block={block} />
  }
}
```

- [ ] **Step 6: Add styles**

Create `src/styles/journal-blocks.css`:

```css
.journal-block {
  width: 100%;
  max-width: 100%;
  margin: var(--space-5) 0;
  color: var(--md-text, var(--item-text));
}

.journal-block h1,
.journal-block h2,
.journal-block h3,
.journal-block p {
  margin: 0;
}

.journal-block-kicker,
.journal-block-section-title,
.journal-block-meta {
  color: var(--item-meta);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.journal-block-kicker,
.journal-block-section-title {
  margin-bottom: var(--space-2);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.journal-block-meta {
  margin-top: var(--space-2);
}

.journal-block-hero {
  padding: var(--space-7) 0 var(--space-5);
  border-bottom: 1px solid var(--divider);
}

.journal-block-hero h1 {
  max-width: var(--journal-prose-max);
  color: var(--journal-title-color);
  font-family: var(--font-serif);
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  line-height: 1.25;
}

.journal-block-hero p {
  max-width: var(--journal-prose-max);
  margin-top: var(--space-3);
  color: var(--item-meta);
  font-size: var(--text-md);
  line-height: 1.7;
}

.journal-block-card-grid,
.journal-block-metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-3);
}

.journal-layout-card,
.journal-block-metric,
.journal-block-coming-soon,
.journal-block-error,
.journal-block-callout,
.journal-block-verdict {
  border: 1px solid var(--divider);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-secondary) 86%, var(--bg) 14%);
}

.journal-layout-card,
.journal-block-metric,
.journal-block-coming-soon,
.journal-block-error,
.journal-block-callout,
.journal-block-verdict {
  padding: var(--space-4);
}

.journal-layout-card-accent {
  border-color: color-mix(in srgb, var(--record-btn) 42%, var(--divider));
}

.journal-layout-card h3,
.journal-block-step h3,
.journal-block-timeline-item h3,
.journal-block-image-text h3 {
  color: var(--journal-title-color);
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  line-height: 1.35;
}

.journal-layout-card p,
.journal-block-step p,
.journal-block-timeline-item p,
.journal-block-image-text p {
  margin-top: var(--space-2);
  color: var(--item-meta);
  font-size: var(--text-sm);
  line-height: 1.65;
}

.journal-block-metric-value {
  color: var(--journal-title-color);
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  line-height: 1.1;
}

.journal-block-metric-label {
  margin-top: var(--space-2);
  color: var(--md-text);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.journal-block-metric-desc {
  margin-top: var(--space-1);
  color: var(--item-meta);
  font-size: var(--text-xs);
  line-height: 1.55;
}

.journal-block-step,
.journal-block-timeline-item {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  gap: var(--space-4);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--divider);
}

.journal-block-step-index,
.journal-block-timeline-item time {
  color: var(--record-btn);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

.journal-block-verdict h2 {
  color: var(--journal-title-color);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

.journal-block-verdict p {
  margin-top: var(--space-2);
  color: var(--item-meta);
  line-height: 1.7;
}

.journal-block-quote {
  max-width: var(--journal-prose-max);
  padding: var(--space-4) 0 var(--space-4) var(--space-4);
  border-left: 2px solid var(--record-btn);
}

.journal-block-quote p {
  color: var(--journal-title-color);
  font-family: var(--font-serif);
  font-size: var(--text-lg);
  line-height: 1.65;
}

.journal-block-quote cite {
  display: block;
  margin-top: var(--space-3);
  color: var(--item-meta);
  font-size: var(--text-sm);
  font-style: normal;
}

.journal-block-image-text {
  display: grid;
  grid-template-columns: minmax(180px, 0.85fr) minmax(0, 1fr);
  gap: var(--space-5);
  align-items: start;
}

.journal-block-image-text-reverse {
  grid-template-columns: minmax(0, 1fr) minmax(180px, 0.85fr);
}

.journal-block-image-text-reverse img {
  order: 2;
}

.journal-block-image-text img {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--divider);
}

.journal-block-faq-item {
  border-top: 1px solid var(--divider);
  padding: var(--space-3) 0;
}

.journal-block-faq-item summary {
  cursor: pointer;
  color: var(--journal-title-color);
  font-weight: var(--font-medium);
}

.journal-block-faq-item p {
  margin-top: var(--space-2);
  color: var(--item-meta);
  line-height: 1.65;
}

.journal-block-callout {
  max-width: var(--journal-prose-max);
  border-left: 3px solid var(--record-btn);
}

.journal-block-callout-warning,
.journal-block-callout-danger {
  border-left-color: var(--status-danger);
}

.journal-block-callout-title,
.journal-block-coming-title,
.journal-block-error-title {
  color: var(--journal-title-color);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.journal-block-callout-body,
.journal-block-coming-body,
.journal-block-error-message,
.journal-block-error-hint {
  margin-top: var(--space-2);
  color: var(--item-meta);
  font-size: var(--text-sm);
  line-height: 1.6;
}

.journal-block-error {
  border-color: color-mix(in srgb, var(--status-danger) 36%, var(--divider));
}

.journal-block-error-title {
  color: var(--status-danger);
}

.journal-block-error-source {
  margin: var(--space-3) 0 0;
  padding: var(--space-3);
  overflow-x: auto;
  border-radius: 6px;
  background: var(--md-pre-bg);
  color: var(--md-pre-text);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  line-height: 1.55;
  white-space: pre-wrap;
}

@media (max-width: 720px) {
  .journal-block-image-text,
  .journal-block-image-text-reverse {
    grid-template-columns: 1fr;
  }

  .journal-block-image-text-reverse img {
    order: 0;
  }
}
```

- [ ] **Step 7: Run renderer tests**

Run:

```bash
npx vitest run src/tests/JournalBlockRenderer.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/journal-blocks src/styles/journal-blocks.css src/tests/JournalBlockRenderer.test.tsx
git commit -m "feat: render journal layout blocks"
```

---

### Task 5: Integrate Directives into Markdown Rendering

**Files:**
- Create: `src/components/journal-blocks/JournalLayoutMarkdownRenderer.tsx`
- Modify: `src/lib/markdown.tsx`
- Create: `src/tests/JournalLayoutMarkdownRenderer.test.tsx`

- [ ] **Step 1: Write Markdown integration tests**

Create `src/tests/JournalLayoutMarkdownRenderer.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderMarkdown } from '../lib/markdown'

describe('Journal layout directives in Markdown', () => {
  it('renders markdown before and after a layout block', () => {
    render(
      renderMarkdown(
        `# Plain heading

:::callout tip[Careful]
Keep this renderer quiet.
:::

After block`,
        '/tmp/journal/2606/04-layout.md',
      ),
    )

    expect(screen.getByText('Plain heading')).toBeTruthy()
    expect(screen.getByText('Careful')).toBeTruthy()
    expect(screen.getByText('Keep this renderer quiet.')).toBeTruthy()
    expect(screen.getByText('After block')).toBeTruthy()
  })

  it('keeps directive-looking text inside code fences on the markdown path', () => {
    const { container } = render(
      renderMarkdown(
        `\`\`\`md
:::callout tip
not a block
:::
\`\`\``,
        '/tmp/journal/2606/04-code.md',
      ),
    )

    expect(container.querySelector('.journal-block')).toBeFalsy()
    expect(container.textContent).toContain('not a block')
  })

  it('renders local errors without dropping the rest of the document', () => {
    render(
      renderMarkdown(
        `Before

:::metrics
Only label | one value
:::

After`,
        '/tmp/journal/2606/04-error.md',
      ),
    )

    expect(screen.getByText('Before')).toBeTruthy()
    expect(screen.getByText('metrics block failed')).toBeTruthy()
    expect(screen.getByText('After')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run Markdown integration tests to verify failure**

Run:

```bash
npx vitest run src/tests/JournalLayoutMarkdownRenderer.test.tsx
```

Expected: FAIL because `renderMarkdown` still treats `:::` as ordinary Markdown.

- [ ] **Step 3: Add the mixed segment renderer**

Create `src/components/journal-blocks/JournalLayoutMarkdownRenderer.tsx`:

```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { createMarkdownComponents, type MarkdownComponentsOptions } from '../../lib/markdownComponents'
import type { LayoutParseResult } from '../../lib/journalLayout'
import { JournalBlockRenderer } from './JournalBlockRenderer'

function MarkdownSegment({
  value,
  entryPath,
  imgResolver,
}: {
  value: string
  entryPath: string
  imgResolver?: MarkdownComponentsOptions['imgResolver']
}) {
  if (!value.trim()) return null
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { detect: false }]]}
      components={createMarkdownComponents({
        entryPath,
        ...(imgResolver ? { imgResolver } : {}),
      })}
    >
      {value}
    </ReactMarkdown>
  )
}

export function JournalLayoutMarkdownRenderer({
  parseResult,
  entryPath,
  imgResolver,
}: {
  parseResult: LayoutParseResult
  entryPath: string
  imgResolver?: MarkdownComponentsOptions['imgResolver']
}) {
  return (
    <div className="md-content mdx-content journal-layout-content">
      {parseResult.segments.map((segment, index) => {
        if (segment.kind === 'markdown') {
          return (
            <MarkdownSegment
              key={`markdown-${index}`}
              value={segment.value}
              entryPath={entryPath}
              imgResolver={imgResolver}
            />
          )
        }
        if (segment.kind === 'error') {
          return <JournalBlockRenderer key={`error-${index}`} issue={segment.issue} />
        }
        return (
          <JournalBlockRenderer
            key={`block-${segment.block.name}-${segment.block.sourceRange.startLine}-${index}`}
            block={segment.block}
            entryPath={entryPath}
          />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Route directive Markdown through the segment renderer**

Modify `src/lib/markdown.tsx`.

Add imports:

```tsx
import { JournalLayoutMarkdownRenderer } from '../components/journal-blocks/JournalLayoutMarkdownRenderer'
import { parseJournalLayout } from './journalLayout'
```

Inside `renderMarkdown`, after `const isMdx = absolutePath?.endsWith('.mdx')` and before the `.mdx` branch, add:

```tsx
  const layoutParse = cleaned.includes(':::') ? parseJournalLayout(cleaned) : null
  const hasLayoutSegments =
    layoutParse?.containsLayout &&
    layoutParse.segments.some((segment) => segment.kind === 'block' || segment.kind === 'error')
```

Then, after the `.mdx` branch and before `componentsOpts`, add:

```tsx
  if (hasLayoutSegments && layoutParse) {
    return (
      <div className="md-body">
        <JournalLayoutMarkdownRenderer
          parseResult={layoutParse}
          entryPath={absolutePath}
          {...(options?.imgResolver ? { imgResolver: options.imgResolver } : {})}
        />
      </div>
    )
  }
```

The order keeps `.mdx` in `MdxRenderer`; Task 6 adds the `.mdx` transform there.

- [ ] **Step 5: Run Markdown integration tests**

Run:

```bash
npx vitest run src/tests/JournalLayoutMarkdownRenderer.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run existing Markdown regression tests**

Run:

```bash
npx vitest run src/tests/MarkdownRenderer.test.tsx src/tests/MdxRenderer.test.tsx
```

Expected: PASS. Mermaid code fences still render as diagrams in `MarkdownRenderer`; `.mdx` still compiles through `MdxRenderer`.

- [ ] **Step 7: Commit**

```bash
git add src/components/journal-blocks/JournalLayoutMarkdownRenderer.tsx src/lib/markdown.tsx src/tests/JournalLayoutMarkdownRenderer.test.tsx
git commit -m "feat: render journal layout directives in markdown"
```

---

### Task 6: Transform Directives Before MDX Compilation

**Files:**
- Modify: `src/lib/journalLayout/transformMdx.ts`
- Modify: `src/components/MdxRenderer.tsx`
- Modify: `src/components/mdx/index.ts`
- Modify: `src/tests/MdxRenderer.test.tsx`

- [ ] **Step 1: Add MDX transform tests**

Append these tests to `src/tests/MdxRenderer.test.tsx` inside `describe('MdxRenderer', () => { ... })`:

```tsx
  it('transforms layout directives before compiling MDX', async () => {
    vi.mocked(compileMdx).mockResolvedValue(compiledParagraph)

    render(
      <MdxRenderer
        content={`Before

:::callout tip[MDX Tip]
Use the same directive syntax.
:::

After`}
        entryPath="/tmp/journal/2606/04-layout.mdx"
      />,
    )

    await waitFor(() => {
      expect(compileMdx).toHaveBeenCalled()
    })

    const compiledSource = vi.mocked(compileMdx).mock.calls[0][0]
    expect(compiledSource).toContain('Before')
    expect(compiledSource).toContain('<JournalBlock block={')
    expect(compiledSource).toContain('"name":"callout"')
    expect(compiledSource).toContain('"title":"MDX Tip"')
    expect(compiledSource).toContain('After')
  })

  it('transforms invalid layout directives into local MDX error components', async () => {
    vi.mocked(compileMdx).mockResolvedValue(compiledParagraph)

    render(
      <MdxRenderer
        content={`:::metrics
Only label | one value
:::`}
      />,
    )

    await waitFor(() => {
      expect(compileMdx).toHaveBeenCalled()
    })

    const compiledSource = vi.mocked(compileMdx).mock.calls[0][0]
    expect(compiledSource).toContain('<JournalBlockError issue={')
    expect(compiledSource).toContain('metrics row 1 expected at least 3 columns, got 2.')
  })
```

- [ ] **Step 2: Run MDX tests to verify failure**

Run:

```bash
npx vitest run src/tests/MdxRenderer.test.tsx
```

Expected: FAIL because `MdxRenderer` passes raw directive syntax to `compileMdx`.

- [ ] **Step 3: Implement MDX transform**

Replace `src/lib/journalLayout/transformMdx.ts` with:

```ts
import { parseJournalLayout } from './validate'
import type { JournalBlock, LayoutIssue } from './types'

function jsxObject(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
}

function blockToJsx(block: JournalBlock): string {
  return `<JournalBlock block={${jsxObject(block)}} />`
}

function issueToJsx(issue: LayoutIssue): string {
  return `<JournalBlockError issue={${jsxObject(issue)}} />`
}

export function transformMdxDirectives(source: string): string {
  if (!source.includes(':::')) return source

  const parsed = parseJournalLayout(source)
  if (!parsed.containsLayout) return source

  return parsed.segments
    .map((segment) => {
      if (segment.kind === 'markdown') return segment.value
      if (segment.kind === 'error') return issueToJsx(segment.issue)
      return blockToJsx(segment.block)
    })
    .join('\n\n')
}
```

- [ ] **Step 4: Register MDX components for transformed directives**

Modify `src/components/mdx/index.ts`.

Add imports near the component map imports:

```ts
import { JournalBlockRenderer } from '../journal-blocks/JournalBlockRenderer'
import { BlockError } from '../journal-blocks/BlockError'
import type { JournalBlock as JournalBlockData, LayoutIssue } from '../../lib/journalLayout'
```

Add component functions before `export const mdxComponents = {`:

```tsx
function JournalBlock({ block }: { block: JournalBlockData }) {
  return <JournalBlockRenderer block={block} />
}

function JournalBlockError({ issue }: { issue: LayoutIssue }) {
  return <BlockError issue={issue} />
}
```

Add both names to `mdxComponents`:

```ts
  JournalBlock,
  JournalBlockError,
```

Also export them near the top-level exports:

```ts
export { JournalBlockRenderer }
```

- [ ] **Step 5: Transform content in MdxRenderer before compile and source extraction**

Modify `src/components/MdxRenderer.tsx`.

Add import:

```ts
import { transformMdxDirectives } from '../lib/journalLayout'
```

Inside `MdxRenderer`, replace:

```ts
  const cacheKey = `${entryPath ?? ''}\0${content}`
```

with:

```ts
  const transformedContent = useMemo(() => transformMdxDirectives(content), [content])
  const cacheKey = `${entryPath ?? ''}\0${transformedContent}`
```

Replace:

```ts
  const componentSources = useMemo(() => extractMdxComponentSources(content), [content])
```

with:

```ts
  const componentSources = useMemo(
    () => extractMdxComponentSources(transformedContent),
    [transformedContent],
  )
```

Replace the `compileMdx` call:

```ts
    compileMdx(content, entryPath)
```

with:

```ts
    compileMdx(transformedContent, entryPath)
```

Update the dependency array for the compile effect from:

```ts
  }, [cacheKey, content, entryPath])
```

to:

```ts
  }, [cacheKey, transformedContent, entryPath])
```

In the compile-error fallback, keep showing the original author source. Leave these lines unchanged:

```tsx
            <pre className="mdx-fallback">{content}</pre>
```

- [ ] **Step 6: Run MDX tests**

Run:

```bash
npx vitest run src/tests/MdxRenderer.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run layout unit tests**

Run:

```bash
npx vitest run src/tests/journalLayoutCatalog.test.ts src/tests/journalLayoutParse.test.ts src/tests/journalLayoutValidate.test.ts src/tests/JournalBlockRenderer.test.tsx src/tests/JournalLayoutMarkdownRenderer.test.tsx src/tests/MdxRenderer.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/journalLayout/transformMdx.ts src/components/MdxRenderer.tsx src/components/mdx/index.ts src/tests/MdxRenderer.test.tsx
git commit -m "feat: transform journal layout directives in mdx"
```

---

### Task 7: Add Phase 1 Visual Fixture and Regression Verification

**Files:**
- Create: `docs/superpowers/examples/journal-layout-directives-phase1.mdx`

- [ ] **Step 1: Add visual fixture**

Create `docs/superpowers/examples/journal-layout-directives-phase1.mdx`:

```mdx
---
summary: Journal layout directives phase 1 visual fixture
tags: [journal-layout, mdx, directives]
---

# Journal Layout Directives Phase 1

:::hero
eyebrow: Journal Layout
title: Structure before style
subtitle: Layout directives give Markdown and MDX the same calm document rhythm without JSX.
:::

:::callout tip[Use directives for repeatable structure]
The block syntax is compact enough for AI-generated notes and readable enough for hand-authored notes.
:::

:::metrics[Key Results]
Module catalog | 43 modules | Full registry from day one
Phase 1 renderers | 10 blocks | High-frequency reading modules first
Default path | unchanged | Plain Markdown keeps the current renderer
:::

:::cards[Reading map]
Opening | Hero and card blocks establish the point of view | private knowledge base | accent
Evidence | Quote and image-text blocks keep proof close to claims | restrained | default
Action | FAQ and steps reduce scanning cost | ready to use | default
:::

:::steps[Implementation sequence]
Catalog | Register all modules and aliases | shared source of truth
Parser | Split Markdown into ordinary content and blocks | ignores code fences
Renderer | Use one block component layer for md and mdx | local errors
:::

:::timeline[Milestones]
Phase 1 | Shared engine and first 10 blocks | current work
Phase 2 | Opening, judgment, evidence, infographic expansion | next planned slice
Phase 3 | Conversion, brand, enhanced modules | full catalog coverage
:::

:::verdict
status: Recommendation
title: Ship Phase 1 behind syntax detection
summary: Documents without directives should stay on the current render paths; directive documents opt into mixed segment rendering.
confidence: High
:::

:::quote
text: The module system should make documents prettier while staying native to JournalClaw.
source: Layout directive design
:::

:::image-text
image: ../images/screenshot-20260330-205220.png
title: Image and text stay inspectable
text: Evidence modules should help readers inspect the actual artifact, not hide it behind decorative effects.
alt: Journal screenshot
:::

:::faq[Operational questions]
Does plain Markdown change? | No. Files without directives keep the existing render path.
Can MDX still use JSX? | Yes. Directives are transformed before MDX compilation, then existing MDX components remain registered.
Can a broken block break the page? | No. The failing block renders a local error and the rest of the document remains readable.
:::
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
npx vitest run src/tests/journalLayoutCatalog.test.ts src/tests/journalLayoutParse.test.ts src/tests/journalLayoutValidate.test.ts src/tests/JournalBlockRenderer.test.tsx src/tests/JournalLayoutMarkdownRenderer.test.tsx src/tests/MdxRenderer.test.tsx src/tests/MarkdownRenderer.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full frontend test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS. The build runs `tsc`, `npm run build:magicui`, and `vite build`.

- [ ] **Step 5: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with `0 errors`. If unrelated warnings exist, record them in the final implementation notes and do not change unrelated files.

- [ ] **Step 6: Manual app check in Tauri shell**

Run:

```bash
npm run tauri dev
```

Open or import the fixture content from `docs/superpowers/examples/journal-layout-directives-phase1.mdx` in the app. Check:

- Dark mode: no purple-blue gradients, no glassmorphism, no decorative blur, no card nesting.
- Light mode: borders and muted surfaces still read as quiet ink-cyan neutrals.
- Narrow width: `image-text`, `metrics`, and `cards` do not overlap.
- Broken block sample: changing one metrics row to `Only | two` shows a local `metrics block failed` error and surrounding Markdown remains visible.
- Plain `.md` sample with no `:::` keeps the old render path and Mermaid still renders through the existing test-covered path.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/examples/journal-layout-directives-phase1.mdx
git commit -m "docs: add journal layout directives fixture"
```

---

## Self-Review

Spec coverage:

- `.md` and `.mdx` both use the same catalog, parser, validator, and block renderer: Tasks 1, 2, 3, 4, 5, and 6.
- No-directive Markdown keeps existing behavior: Task 5 only routes when parsing finds block or error segments.
- Code fences are ignored by the directive parser: Task 2 test and implementation.
- Catalog-driven module lookup, aliases, schema validation, and renderer lookup: Tasks 1 and 3.
- Full 43-module catalog with Phase 1 renderers for 10 modules: Tasks 1 and 4.
- `.mdx` directives transform before MDX compile into whitelisted components only: Task 6.
- Localized errors for syntax, catalog, schema, and renderer failures: Tasks 2, 3, and 4.
- Visual direction uses existing Journal tokens and avoids slop patterns: Task 4 CSS and Task 7 manual checks.
- Regression coverage for Markdown, MDX, Mermaid, local errors, and code-fence behavior: Tasks 2, 5, 6, and 7.

Placeholder scan:

- The plan avoids placeholder markers and includes concrete files, snippets, commands, and expected results.
- Registered but unimplemented modules are not placeholders; they are deliberate `ComingSoonBlock` behavior required by the catalog-first architecture.

Type consistency:

- `RawJournalBlock`, `JournalBlock`, `LayoutIssue`, `RawLayoutSegment`, and `LayoutSegment` are defined in Task 1 and reused consistently in parser, validator, renderers, and MDX transform.
- Public exports come from `src/lib/journalLayout/index.ts` and are used by all tests and components.
