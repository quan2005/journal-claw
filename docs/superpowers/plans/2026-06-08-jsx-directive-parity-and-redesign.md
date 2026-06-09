# JSX Directive Parity And Component Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make JSX the only authoring syntax by exposing all 43 directive modules as typed JSX components, redesigning every JSX component to the stronger directive visual language, migrating existing content safely, and removing directive parsing from the render path.

**Architecture:** Keep the current directive renderer as the temporary canonical visual implementation, then add typed JSX adapters that feed the same internal `JournalBlock` model so parity is exact rather than visually approximated. Existing JSX components are then refactored to reuse the same markup, width tiers, tokens, and responsive rules. A one-time migration service converts legacy directives to JSX with Rust `mdxjs` validation and backups; only after the workspace and repository scan clean does the runtime stop parsing directives.

**Tech Stack:** Tauri v2, React 19, TypeScript, Rust, `mdxjs`, Vitest, Testing Library, existing Journal design tokens, Playwright/Computer Use for real Tauri visual verification.

---

## Scope And Delivery Gates

This is one sequential migration program, not two independent rewrites. Each milestone must ship working software:

1. **JSX parity:** all 43 directive names have canonical PascalCase JSX equivalents and render through the current directive-quality renderer.
2. **JSX redesign:** all pre-existing JSX components use the same quiet, open, information-first design language.
3. **Content migration:** repository references and user workspace files convert to JSX with backups and compile validation.
4. **Directive retirement:** `.md` and `.mdx` render paths no longer parse `:::` blocks; the parser remains available only to the explicit migration utility.

Do not delete directive runtime support before all of these checks pass:

```text
43/43 directive modules mapped to JSX
43/43 parity fixtures rendered
0 repository-authored directive documents
0 active workspace directive documents
all converted .mdx files pass Rust mdxjs validation
dark and light galleries pass desktop and narrow-window review
```

The current verified workspace snapshot contains 12 content files with directives after excluding `.claude/`; treat this as migration input, not as a hard-coded test count.

## Canonical JSX API

All layout components use these shared conventions:

```ts
export interface LayoutBaseProps {
  heading?: string
  variant?: string
  tone?: string
  className?: string
}
```

- `heading` is the optional block heading previously written in directive brackets.
- `title` remains component content when the directive schema contains a `title` field.
- Row directives become `items={[...]}`.
- JSON-array directives become `items={[...]}`.
- JSON-object directives expose their object keys as direct props.
- `variant` maps from directive attributes.
- `tone` maps from directive modifiers.
- Existing prop aliases remain accepted during migration but disappear from generated documentation.

| Directive          | Canonical JSX     | Canonical props                                                                     |
| ------------------ | ----------------- | ----------------------------------------------------------------------------------- |
| `hero`             | `Hero`            | `title`, `eyebrow?`, `subtitle?`, `meta?`, `variant?`                               |
| `toc`              | `Toc`             | `heading?`, `items: { label; title; description? }[]`                               |
| `cards`            | `Cards`           | `heading?`, `items?: { title; description?; meta?; variant? }[]`, `children?`       |
| `part`             | `Part`            | `title`, `label?`, `subtitle?`                                                      |
| `label-title`      | `LabelTitle`      | `title`, `label?`, `subtitle?`                                                      |
| `metrics`          | `Metrics`         | `heading?`, `items: { label; value; description? }[]`                               |
| `compare`          | `Compare`         | `heading?`, `items: { item; left; right }[]`                                        |
| `steps`            | `Steps`           | `heading?`, `items: { title; description?; meta? }[]`                               |
| `timeline`         | `Timeline`        | `heading?`, `items: { time; title; description?; desc? }[]`                         |
| `infographic`      | `Infographic`     | `title`, `summary?`, `value?`                                                       |
| `verdict`          | `Verdict`         | `title`, `summary?`, `confidence?`, `status?`, `variant?`                           |
| `audience-fit`     | `AudienceFit`     | `heading?`, `items: { audience; fit; reason? }[]`                                   |
| `myth-fact`        | `MythFact`        | `heading?`, `items: { myth; fact; reason? }[]`                                      |
| `manifesto`        | `Manifesto`       | `heading?`, `items: { principle; detail? }[]`                                       |
| `bridge`           | `Bridge`          | `from`, `to`, `why?`                                                                |
| `quote`            | `Quote`           | `text`, `author?`, `context?`, `source?`, `url?`                                    |
| `image-text`       | `ImageText`       | `image`, `title?`, `text?`, `alt?`, `variant?`                                      |
| `image-compare`    | `ImageCompare`    | `before`, `after`, `title?`, `caption?`                                             |
| `image-annotate`   | `ImageAnnotate`   | `title?`, `image`, `alt?`, `notes: string[]`                                        |
| `image-steps`      | `ImageSteps`      | `items: { image; title; text?; alt? }[]`                                            |
| `cta`              | `Cta`             | `title`, `description?`, `action?`                                                  |
| `faq`              | `Faq`             | `heading?`, `items: { question; answer }[]`                                         |
| `checklist`        | `Checklist`       | `heading?`, `items: { text; state?; checked? }[]`                                   |
| `cases`            | `Cases`           | `heading?`, `items: { case; result; note? }[]`                                      |
| `summary`          | `Summary`         | `title`, `body?: string`, `children?`                                               |
| `notice`           | `Notice`          | `text`, `title?`, `tone?`                                                           |
| `logos`            | `Logos`           | `heading?`, `items: { name; meta? }[]`                                              |
| `pricing`          | `Pricing`         | `heading?`, `items: { plan; price; note? }[]`                                       |
| `specs`            | `Specs`           | `heading?`, `items: { name; value; note? }[]`                                       |
| `toolbox`          | `Toolbox`         | `heading?`, `items: { tool; use; link? }[]`                                         |
| `author-card`      | `AuthorCard`      | `name`, `role?`, `bio?`                                                             |
| `subscribe`        | `Subscribe`       | `title`, `description?`                                                             |
| `people`           | `People`          | `heading?`, `items: { name; role?; note? }[]`                                       |
| `series`           | `Series`          | `heading?`, `items: { title; status?; path? }[]`                                    |
| `callout`          | `Callout`         | `heading?`, `tone?`, `content?`, `children?`; compatibility aliases `title`, `type` |
| `definition`       | `Definition`      | `term`, `description`                                                               |
| `quote-card`       | `QuoteCard`       | `quote`, `source?`                                                                  |
| `tweet`            | `Tweet`           | `text`, `author?`, `url?`                                                           |
| `stat-row`         | `StatRow`         | `items: { value; label; description? }[]`                                           |
| `question`         | `Question`        | `text`, `context?`                                                                  |
| `resource-list`    | `ResourceList`    | `heading?`, `items: { title; url; type?; note? }[]`                                 |
| `comparison-table` | `ComparisonTable` | `heading?`, `columns: string[]`, `rows: { label; values: string[] }[]`              |
| `changelog`        | `Changelog`       | `heading?`, `items: { date; title; note? }[]`                                       |

## Visual Contract

All JSX components must follow these rules:

```text
Widths: prose = --journal-prose-max, content = --journal-content-max, wide = 100%
Section rhythm: 8-12px inside groups, 32-48px between sections
Typography: hierarchy from size and weight; accent is not body text
Surfaces: transparent by default; framed only for true controls, previews, and repeated cards
Borders: 1px divider; radius <= 8px; no decorative shadow
Accent: amber only for active state, semantic marker, or primary value
Motion: transform/opacity only, <= 300ms, reduced-motion respected
Responsive: no horizontal text clipping; structured tables may scroll
Nesting: no card inside card
```

Component-family design mapping:

| JSX family                      | Directive-quality source                               |
| ------------------------------- | ------------------------------------------------------ |
| headings and document structure | `hero`, `part`, `label-title`, `toc`, `summary`        |
| metrics and progress            | `metrics`, `stat-row`, `steps`                         |
| comparisons and tables          | `compare`, `audience-fit`, `comparison-table`, `specs` |
| decisions and judgment          | `verdict`, `myth-fact`, `bridge`, `manifesto`          |
| evidence and sources            | `quote`, `image-*`, `resource-list`                    |
| people and identity             | `author-card`, `people`, `series`                      |
| notices and actions             | `callout`, `notice`, `checklist`, `faq`, `cta`         |

## File Structure

Create:

- `src/components/mdx/component-manifest.json`: machine-readable public JSX catalog and directive mapping.
- `src/components/mdx/layout/types.ts`: typed props for the 43 canonical components.
- `src/components/mdx/layout/blockFactory.tsx`: JSX-props-to-`JournalBlock` adapters.
- `src/components/mdx/layout/opening.tsx`: `Hero`, `Toc`, `Cards`, `Part`, `LabelTitle`.
- `src/components/mdx/layout/infographic.tsx`: `Metrics`, `Compare`, `Steps`, `Timeline`, `Infographic`.
- `src/components/mdx/layout/judgment.tsx`: `Verdict`, `AudienceFit`, `MythFact`, `Manifesto`, `Bridge`.
- `src/components/mdx/layout/evidence.tsx`: `Quote`, `ImageText`, `ImageCompare`, `ImageAnnotate`, `ImageSteps`.
- `src/components/mdx/layout/conversion.tsx`: conversion-family components.
- `src/components/mdx/layout/brand.tsx`: brand-family components.
- `src/components/mdx/layout/enhanced.tsx`: enhanced-family components.
- `src/components/mdx/context.tsx`: entry-path context and local asset resolution.
- `src/styles/mdx-layout.css`: canonical 43-component styles moved from `journal-blocks.css`.
- `src/styles/mdx-semantic.css`: optimized decisions, actions, evidence, sources, and transcripts.
- `src/styles/mdx-media.css`: optimized media, charts, diagrams, math, and previews.
- `src/tests/MdxLayoutManifest.test.ts`.
- `src/tests/MdxLayoutParity.test.tsx`.
- `src/tests/MdxComponentDesign.test.ts`.
- `src/tests/fixtures/mdxLayoutFixtures.tsx`.
- `docs/superpowers/examples/jsx-component-gallery.mdx`.
- `src/lib/legacyDirectives/toJsx.ts`: explicit legacy conversion utility.
- `src/lib/legacyDirectives/index.ts`.
- `src/tests/legacyDirectiveToJsx.test.ts`.
- `src-tauri/src/directive_migration.rs`: scan, backup, validate, and write migration commands.
- `src/lib/directiveMigration.ts`: frontend migration orchestration.
- `src/tests/directiveMigration.test.ts`.

Modify:

- `src/components/mdx/index.ts`: register all canonical JSX names and compatibility aliases.
- `src/components/MdxRenderer.tsx`: provide `entryPath` context; eventually stop transforming directives.
- `src/lib/journalLayout/catalog.ts`: add `jsxName` during parity phase.
- `src/lib/journalLayout/types.ts`: add `jsxName` to `LayoutModuleSpec`.
- `src/components/mdx/*.tsx`: delegate overlapping components and apply shared visual primitives.
- `src/styles/mdx.css`: retain wrapper/error/base rules and import the three focused component stylesheets.
- `src/styles/journal-blocks.css`: shrink during parity; delete after styles move.
- `src/lib/markdown.tsx`: remove directive routing at retirement.
- `src/settings/components/SectionGeneral.tsx`: add explicit legacy syntax migration control.
- `src/lib/tauri.ts`, `src/types.ts`, `src-tauri/src/main.rs`: migration IPC.
- `src/locales/en.ts`, `src/locales/zh.ts`: migration copy.
- `.agents/skills/journal/SKILL.md` and mirrored workspace-template skill files: JSX-only authoring rules.
- `.agents/skills/journal/references/component-catalog.md`: full canonical catalog.
- `.agents/skills/journal/references/component-recipes.md`: canonical recipes.
- `.agents/skills/journal/references/writing-rules.md`: remove directive preference.
- `scripts/build-mdx-support-manual.mjs`: generate from the manifest and remove hard-coded counts.
- `src-tauri/src/ai_processor.rs`, `src-tauri/src/llm/prompt.rs`, `src-tauri/resources/workspace-template/CLAUDE.md`: JSX-only prompts.

Delete at retirement:

- `src/lib/journalLayout/transformMdx.ts`
- `src/components/journal-blocks/JournalLayoutMarkdownRenderer.tsx`
- `.agents/skills/journal/references/layout-directives.md`
- `src-tauri/resources/workspace-template/.claude/skills/journal/references/layout-directives.md`
- `docs/superpowers/examples/journal-layout-directives-phase1.mdx`

---

### Task 1: Establish The Canonical Component Manifest

**Files:**

- Create: `src/components/mdx/component-manifest.json`
- Modify: `src/lib/journalLayout/types.ts`
- Modify: `src/lib/journalLayout/catalog.ts`
- Create: `src/tests/MdxLayoutManifest.test.ts`

- [ ] **Step 1: Write the failing manifest test**

```ts
import manifest from '../components/mdx/component-manifest.json'
import { JOURNAL_LAYOUT_MODULES } from '../lib/journalLayout'
import { mdxComponents } from '../components/mdx'

it('maps every directive module to a registered canonical JSX component', () => {
  const layout = manifest.filter((item) => item.kind === 'layout')
  expect(layout).toHaveLength(43)
  expect(new Set(layout.map((item) => item.directive))).toEqual(
    new Set(JOURNAL_LAYOUT_MODULES.map((item) => item.name)),
  )

  for (const item of layout) {
    expect(item.jsxName in mdxComponents, `${item.jsxName} must be registered`).toBe(true)
  }
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npx vitest run src/tests/MdxLayoutManifest.test.ts
```

Expected: FAIL because `component-manifest.json` and the new JSX names do not exist.

- [ ] **Step 3: Create the complete layout portion of the manifest**

Use this exact directive-to-JSX mapping:

```json
[
  ["hero", "Hero", "opening"],
  ["toc", "Toc", "opening"],
  ["cards", "Cards", "opening"],
  ["part", "Part", "opening"],
  ["label-title", "LabelTitle", "opening"],
  ["metrics", "Metrics", "infographic"],
  ["compare", "Compare", "infographic"],
  ["steps", "Steps", "infographic"],
  ["timeline", "Timeline", "infographic"],
  ["infographic", "Infographic", "infographic"],
  ["verdict", "Verdict", "judgment"],
  ["audience-fit", "AudienceFit", "judgment"],
  ["myth-fact", "MythFact", "judgment"],
  ["manifesto", "Manifesto", "judgment"],
  ["bridge", "Bridge", "judgment"],
  ["quote", "Quote", "evidence"],
  ["image-text", "ImageText", "evidence"],
  ["image-compare", "ImageCompare", "evidence"],
  ["image-annotate", "ImageAnnotate", "evidence"],
  ["image-steps", "ImageSteps", "evidence"],
  ["cta", "Cta", "conversion"],
  ["faq", "Faq", "conversion"],
  ["checklist", "Checklist", "conversion"],
  ["cases", "Cases", "conversion"],
  ["summary", "Summary", "conversion"],
  ["notice", "Notice", "conversion"],
  ["logos", "Logos", "conversion"],
  ["pricing", "Pricing", "conversion"],
  ["specs", "Specs", "conversion"],
  ["toolbox", "Toolbox", "conversion"],
  ["author-card", "AuthorCard", "brand"],
  ["subscribe", "Subscribe", "brand"],
  ["people", "People", "brand"],
  ["series", "Series", "brand"],
  ["callout", "Callout", "enhanced"],
  ["definition", "Definition", "enhanced"],
  ["quote-card", "QuoteCard", "enhanced"],
  ["tweet", "Tweet", "enhanced"],
  ["stat-row", "StatRow", "enhanced"],
  ["question", "Question", "enhanced"],
  ["resource-list", "ResourceList", "enhanced"],
  ["comparison-table", "ComparisonTable", "enhanced"],
  ["changelog", "Changelog", "enhanced"]
]
```

Store each tuple as an object with `kind`, `directive`, `jsxName`, and `category`. Add the existing non-layout JSX components with `kind: "specialized"` so the same manifest becomes the documentation and coverage source.

- [ ] **Step 4: Add `jsxName` to the temporary directive catalog**

```ts
export interface LayoutModuleSpec {
  name: string
  jsxName: string
  category: LayoutCategory
  // existing fields remain unchanged
}
```

Populate `jsxName` from the table above. This field is temporary coupling used for parity and migration.

- [ ] **Step 5: Run the focused test**

Run:

```bash
npx vitest run src/tests/MdxLayoutManifest.test.ts src/tests/journalLayoutCatalog.test.ts
```

Expected: catalog tests pass; manifest test still fails only for JSX names not yet registered.

- [ ] **Step 6: Commit**

```bash
git add src/components/mdx/component-manifest.json src/lib/journalLayout/types.ts src/lib/journalLayout/catalog.ts src/tests/MdxLayoutManifest.test.ts
git commit -m "test: define canonical JSX component manifest"
```

---

### Task 2: Add MDX Runtime Context For Entry-Relative Assets

**Files:**

- Create: `src/components/mdx/context.tsx`
- Modify: `src/components/MdxRenderer.tsx`
- Test: `src/tests/MdxRenderer.test.tsx`

- [ ] **Step 1: Write the failing context test**

Render an `ImageText` or `FileCard` component through `MdxRenderer` with `entryPath="/workspace/2606/08-note.mdx"` and assert that `images/a.png` resolves against `/workspace/2606/`.

- [ ] **Step 2: Run the test and verify it fails**

```bash
npx vitest run src/tests/MdxRenderer.test.tsx
```

Expected: FAIL because MDX components do not receive `entryPath`.

- [ ] **Step 3: Add the runtime context**

```tsx
import { createContext, useContext, type ReactNode } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { resolveRelativePath } from '../../lib/markdownUtils'

interface MdxRuntimeValue {
  entryPath?: string
}

const MdxRuntimeContext = createContext<MdxRuntimeValue>({})

export function MdxRuntimeProvider({
  entryPath,
  children,
}: MdxRuntimeValue & { children: ReactNode }) {
  return <MdxRuntimeContext.Provider value={{ entryPath }}>{children}</MdxRuntimeContext.Provider>
}

export function useMdxRuntime() {
  return useContext(MdxRuntimeContext)
}

export function useMdxAsset(src: string): string {
  const { entryPath } = useMdxRuntime()
  if (!src || /^https?:\/\//i.test(src)) return src
  if (!entryPath) return convertFileSrc(src)
  const entryDir = entryPath.substring(0, entryPath.lastIndexOf('/'))
  return convertFileSrc(src.startsWith('/') ? src : resolveRelativePath(entryDir, src))
}
```

- [ ] **Step 4: Wrap compiled content with the provider**

```tsx
<MdxRuntimeProvider entryPath={entryPath}>
  <Content components={components} />
</MdxRuntimeProvider>
```

- [ ] **Step 5: Run the test**

```bash
npx vitest run src/tests/MdxRenderer.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/mdx/context.tsx src/components/MdxRenderer.tsx src/tests/MdxRenderer.test.tsx
git commit -m "feat: provide MDX entry path context"
```

---

### Task 3: Add Typed JSX-To-Layout Adapters

**Files:**

- Create: `src/components/mdx/layout/types.ts`
- Create: `src/components/mdx/layout/blockFactory.tsx`
- Test: `src/tests/MdxLayoutParity.test.tsx`

- [ ] **Step 1: Add shared types from the Canonical JSX API table**

Define every component prop type explicitly. Shared collection types must use these names:

```ts
export interface LayoutBaseProps {
  heading?: string
  variant?: string
  tone?: string
  className?: string
}

export interface MetricItem {
  label: string
  value: string | number
  description?: string
}

export interface TimelineItem {
  time: string
  title: string
  description?: string
  desc?: string
}

export interface ChecklistItem {
  text: string
  state?: 'todo' | 'doing' | 'blocked' | 'done' | 'checked'
  checked?: boolean
}

export interface ResourceItem {
  title: string
  url: string
  type?: string
  note?: string
}
```

The remaining interfaces must match the API table exactly; do not expose raw `JournalBlock`, `fields`, `rows`, or `data` props to MDX authors.

- [ ] **Step 2: Write failing factory tests**

```tsx
it('converts JSX row items to the directive-compatible block model', () => {
  expect(
    rowsBlock(
      'metrics',
      '关键指标',
      [{ label: '完成度', value: 72, description: '本周' }],
      ['label', 'value', 'description'],
    ),
  ).toMatchObject({
    name: 'metrics',
    title: '关键指标',
    body: { format: 'rows', rows: [['完成度', '72', '本周']] },
  })
})
```

- [ ] **Step 3: Implement the factories**

```tsx
import { createElement, type ComponentType, type ReactElement } from 'react'
import type { JournalBlock, LayoutAttrs } from '../../../lib/journalLayout'
import { JournalBlockRenderer } from '../../journal-blocks/JournalBlockRenderer'

const sourceRange = { startLine: 0, endLine: 0 }

function value(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function fieldsBlock(
  name: string,
  fields: Record<string, unknown>,
  attrs: LayoutAttrs = {},
  modifier?: string,
): JournalBlock {
  return {
    name,
    attrs,
    modifier,
    body: {
      format: 'fields',
      fields: Object.fromEntries(
        Object.entries(fields)
          .filter(([, fieldValue]) => fieldValue !== undefined)
          .map(([key, fieldValue]) => [key, value(fieldValue)]),
      ),
    },
    source: '',
    sourceRange,
  }
}

export function rowsBlock<T extends object>(
  name: string,
  heading: string | undefined,
  items: T[],
  columns: readonly (keyof T)[],
  attrs: LayoutAttrs = {},
  modifier?: string,
): JournalBlock {
  return {
    name,
    title: heading,
    attrs,
    modifier,
    body: {
      format: 'rows',
      rows: items.map((item) => columns.map((column) => value(item[column]))),
    },
    source: '',
    sourceRange,
  }
}

export function objectBlock(
  name: string,
  object: Record<string, unknown>,
  heading?: string,
): JournalBlock {
  return {
    name,
    title: heading,
    attrs: {},
    body: { format: 'json_object', value: object },
    source: '',
    sourceRange,
  }
}

export function arrayBlock(name: string, items: unknown[], heading?: string): JournalBlock {
  return {
    name,
    title: heading,
    attrs: {},
    body: { format: 'json_array', value: items },
    source: '',
    sourceRange,
  }
}

export function renderLayoutBlock(block: JournalBlock): ReactElement {
  return createElement(JournalBlockRenderer as ComponentType<{ block: JournalBlock }>, { block })
}
```

- [ ] **Step 4: Run the factory test**

```bash
npx vitest run src/tests/MdxLayoutParity.test.tsx
```

Expected: PASS for factory tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/mdx/layout/types.ts src/components/mdx/layout/blockFactory.tsx src/tests/MdxLayoutParity.test.tsx
git commit -m "feat: add typed JSX layout adapters"
```

---

### Task 4: Register All 43 Canonical JSX Components

**Files:**

- Create: `src/components/mdx/layout/opening.tsx`
- Create: `src/components/mdx/layout/infographic.tsx`
- Create: `src/components/mdx/layout/judgment.tsx`
- Create: `src/components/mdx/layout/evidence.tsx`
- Create: `src/components/mdx/layout/conversion.tsx`
- Create: `src/components/mdx/layout/brand.tsx`
- Create: `src/components/mdx/layout/enhanced.tsx`
- Modify: `src/components/mdx/index.ts`
- Test: `src/tests/MdxLayoutManifest.test.ts`

- [ ] **Step 1: Implement the opening family**

Each component must return `renderLayoutBlock(...)`. Use `heading` only for collection headings:

```tsx
export function Hero(props: HeroProps) {
  return renderLayoutBlock(
    fieldsBlock(
      'hero',
      {
        title: props.title,
        eyebrow: props.eyebrow,
        subtitle: props.subtitle,
        meta: props.meta,
      },
      props.variant ? { variant: props.variant } : {},
    ),
  )
}

export function Toc({ heading, items }: TocProps) {
  return renderLayoutBlock(rowsBlock('toc', heading, items, ['label', 'title', 'description']))
}

export function Cards({ heading, items = [], children, ...props }: CardsProps) {
  if (children) return <div className="journal-block-card-grid">{children}</div>
  return renderLayoutBlock(
    rowsBlock('cards', heading, items, ['title', 'description', 'meta', 'variant'], {
      variant: props.variant ?? 'default',
    }),
  )
}

export function Part(props: PartProps) {
  return renderLayoutBlock(fieldsBlock('part', props))
}

export function LabelTitle(props: LabelTitleProps) {
  return renderLayoutBlock(fieldsBlock('label-title', props))
}
```

- [ ] **Step 2: Implement the remaining six families**

Use these exact conversion modes:

```text
rowsBlock:
Metrics, Compare, Steps, Timeline, AudienceFit, MythFact, Manifesto,
Faq, Checklist, Cases, Logos, Pricing, Specs, Toolbox, People, Series

fieldsBlock:
Infographic, Verdict, Bridge, Quote, ImageText, ImageCompare,
Cta, Summary, Notice, AuthorCard, Subscribe, QuoteCard, Tweet, Question

objectBlock:
ImageAnnotate, Definition, ComparisonTable

arrayBlock:
ImageSteps, StatRow, ResourceList, Changelog

custom fields/rows compatibility:
Callout accepts children/content plus title/type aliases.
Cards accepts items or children.
Timeline accepts description or desc.
Checklist maps checked=true to state=done.
```

The row-column order must be exactly the order in `src/lib/journalLayout/catalog.ts`.

- [ ] **Step 3: Replace overlapping old exports**

`Cards`, `Timeline`, `Quote`, `Checklist`, `Callout`, and `QuoteCard` must be exported only once from `src/components/mdx/index.ts`. Point those public names to the new canonical implementations. Preserve old prop aliases inside the canonical component rather than exporting two components with one name.

- [ ] **Step 4: Register every canonical component**

Add the 43 names to `mdxComponents`. Remove neither specialized JSX components nor compatibility components in this task.

- [ ] **Step 5: Run manifest and compile tests**

```bash
npx vitest run src/tests/MdxLayoutManifest.test.ts src/tests/MdxRenderer.test.tsx
npm run build
```

Expected: 43/43 manifest mappings registered and TypeScript build passes.

- [ ] **Step 6: Commit**

```bash
git add src/components/mdx/layout src/components/mdx/index.ts src/tests/MdxLayoutManifest.test.ts
git commit -m "feat: expose all layout modules as JSX"
```

---

### Task 5: Prove Directive And JSX Render Parity

**Files:**

- Create: `src/tests/fixtures/mdxLayoutFixtures.tsx`
- Expand: `src/tests/MdxLayoutParity.test.tsx`
- Modify: `src/tests/JournalBlockRenderer.test.tsx`

- [ ] **Step 1: Create one valid fixture for each of the 43 modules**

Each fixture contains:

```ts
interface LayoutParityFixture {
  directive: string
  jsxName: string
  jsxProps: Record<string, unknown>
  legacyBlock: JournalBlock
  requiredSelector: string
}
```

Use real values, including Chinese text, long text, empty optional fields, relative image paths, and at least one mobile-stressing label.

- [ ] **Step 2: Write the parity test**

```tsx
for (const fixture of layoutParityFixtures) {
  it(`${fixture.directive} JSX uses the legacy-quality renderer`, () => {
    const Component = mdxComponents[fixture.jsxName as keyof typeof mdxComponents]
    const jsx = render(createElement(Component, fixture.jsxProps))
    const legacy = render(<JournalBlockRenderer block={fixture.legacyBlock} />)

    expect(jsx.container.querySelector(fixture.requiredSelector)).toBeTruthy()
    expect(jsx.container.innerHTML).toBe(legacy.container.innerHTML)
  })
}
```

- [ ] **Step 3: Run the test and fix adapter mismatches**

```bash
npx vitest run src/tests/MdxLayoutParity.test.tsx
```

Expected: 43 parity cases pass.

- [ ] **Step 4: Commit**

```bash
git add src/tests/fixtures/mdxLayoutFixtures.tsx src/tests/MdxLayoutParity.test.tsx src/tests/JournalBlockRenderer.test.tsx
git commit -m "test: lock JSX layout parity"
```

---

### Task 6: Move Directive-Quality Styles Into The MDX Style System

**Files:**

- Create: `src/styles/mdx-layout.css`
- Modify: `src/styles/mdx.css`
- Modify: `src/styles/journal-blocks.css`
- Modify: `src/components/journal-blocks/JournalBlockRenderer.tsx`
- Create: `src/tests/MdxComponentDesign.test.ts`

- [ ] **Step 1: Write failing style ownership tests**

```ts
it('loads canonical layout styles from the MDX style system', () => {
  expect(mdxCss).toContain("@import './mdx-layout.css'")
  expect(layoutCss).toContain('.journal-block-hero')
  expect(layoutCss).toContain('.journal-block-quote')
  expect(layoutCss).toContain('@media (max-width: 720px)')
})
```

- [ ] **Step 2: Move all visual rules from `journal-blocks.css`**

Move component selectors to `mdx-layout.css` without changing computed output. Keep only temporary legacy error/unknown selectors in `journal-blocks.css`.

- [ ] **Step 3: Import focused styles once**

At the top of `mdx.css`:

```css
@import './mdx-layout.css';
@import './mdx-semantic.css';
@import './mdx-media.css';
```

Create empty `mdx-semantic.css` and `mdx-media.css` in this task so imports resolve; populate them in Tasks 8 and 9.

- [ ] **Step 4: Run style and component tests**

```bash
npx vitest run src/tests/journalBlockStyles.test.ts src/tests/MdxComponentDesign.test.ts src/tests/MdxLayoutParity.test.tsx
```

Expected: computed contracts and 43 parity cases pass.

- [ ] **Step 5: Commit**

```bash
git add src/styles/mdx.css src/styles/mdx-layout.css src/styles/mdx-semantic.css src/styles/mdx-media.css src/styles/journal-blocks.css src/components/journal-blocks/JournalBlockRenderer.tsx src/tests/MdxComponentDesign.test.ts
git commit -m "refactor: make layout styles part of MDX"
```

---

### Task 7: Redesign Generic Typography, Layout, And Display JSX

**Files:**

- Modify: `src/components/mdx/typography.tsx`
- Modify: `src/components/mdx/layout.tsx`
- Modify: `src/components/mdx/grid.tsx`
- Modify: `src/components/mdx/display.tsx`
- Modify: `src/components/mdx/cards.tsx`
- Modify: `src/styles/mdx-layout.css`
- Test: `src/tests/MdxSemanticComponents.test.tsx`
- Test: `src/tests/MdxComponentDesign.test.ts`

- [ ] **Step 1: Add failing structural tests**

Lock these mappings:

```text
Section -> open section rhythm, never a framed card
Subtitle -> prose width and item-meta color
Label -> kicker typography
Divider -> divider token, no decorative label capsule
Split/Columns/Grid -> stable responsive tracks and <=720px stacking
Stat/StatGroup -> journal-block-metric and journal-block-metric-grid
Table -> journal-block-table-grid semantics and horizontal overflow
Timeline -> canonical Timeline component
Cards/Card -> journal-block-card-grid and journal-layout-card
Checklist -> canonical Checklist component
```

- [ ] **Step 2: Delegate overlapping components**

Use direct delegation:

```tsx
export function StatGroup({ children }: { children: ReactNode }) {
  return (
    <div className="journal-block journal-block-content journal-block-metric-grid">{children}</div>
  )
}

export function Stat({ label, value, suffix, trend }: StatProps) {
  return (
    <div className="journal-block-metric">
      <div className="journal-block-metric-value">
        {value}
        {suffix && <small>{suffix}</small>}
        {trend && <span className="mdx-stat-trend">{trend === 'up' ? '↑' : '↓'}</span>}
      </div>
      <div className="journal-block-metric-label">{label}</div>
    </div>
  )
}
```

`Timeline`, `Cards`, and `Checklist` must call their canonical layout components rather than retain separate visual markup.

- [ ] **Step 3: Remove invalid dynamic CSS from Grid**

Delete the unused `--mdx-grid-stack` string containing an `@media` rule. Use container classes:

```tsx
<div
  className={clsx('mdx-grid', stackBelow && 'mdx-grid--stackable', className)}
  style={{ '--mdx-grid-cols': cols, '--mdx-grid-gap': `${gap}px` } as CSSProperties}
>
```

Use the stable repository breakpoint:

```css
@media (max-width: 720px) {
  .mdx-grid--stackable,
  .mdx-split,
  .mdx-columns {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

- [ ] **Step 4: Apply the visual contract to the remaining generic components**

Apply exact families:

```text
ProsCons/Pros/Cons -> Compare/MythFact open two-column grammar
TagList -> restrained chips with no filled accent background
Progress -> 4px track, item-meta label, amber fill
Avatar/AvatarGroup -> People identity grammar
Options/Option -> ordered row grammar
Kanban -> full-width columns with flat surfaces
Counter/RatingBar -> metric grammar; no stars as decorative body copy
Stack -> spacing-only primitive
Placeholder -> Notice grammar with neutral tone
```

- [ ] **Step 5: Run focused tests**

```bash
npx vitest run src/tests/MdxSemanticComponents.test.tsx src/tests/MdxComponentDesign.test.ts
```

Expected: all generic components satisfy the shared selectors and responsive contracts.

- [ ] **Step 6: Commit**

```bash
git add src/components/mdx/typography.tsx src/components/mdx/layout.tsx src/components/mdx/grid.tsx src/components/mdx/display.tsx src/components/mdx/cards.tsx src/styles/mdx-layout.css src/tests/MdxSemanticComponents.test.tsx src/tests/MdxComponentDesign.test.ts
git commit -m "feat: align generic JSX with Journal layout design"
```

---

### Task 8: Redesign Semantic, Evidence, Source, And Transcript JSX

**Files:**

- Modify: `src/components/mdx/semantic.tsx`
- Modify: `src/components/mdx/source.tsx`
- Modify: `src/components/mdx/callout.tsx`
- Modify: `src/styles/mdx-semantic.css`
- Test: `src/tests/MdxSemanticComponents.test.tsx`
- Test: `src/tests/MdxRenderer.test.tsx`

- [ ] **Step 1: Write failing semantic structure tests**

Assert:

```text
ActionTable/RiskMatrix/RACI -> shared wide table grammar
DecisionRecord -> Verdict + Compare grammar, not a card
DecisionList -> separated records, no nested cards
InsightCard/EvidenceCard -> open evidence rows with top divider
QuoteCard -> canonical quote-card renderer
ReferenceList/SourceCard -> canonical resource-list rows
Transcript -> speaker/time rail plus readable text
CopyButton -> icon button with accessible name and copied state
RelatedEntry/RelatedIdentity -> resource-row link grammar
```

- [ ] **Step 2: Delegate canonical equivalents**

```tsx
export const OptionMatrix = ComparisonTable

export function QuoteCard(props: QuoteCardProps) {
  return <CanonicalQuoteCard {...props} />
}

export function ReferenceList({ sources }: { sources: ReferenceSource[] }) {
  return (
    <ResourceList
      items={sources.map((source) => ({
        title: source.label ?? source.path,
        url: source.path,
        type: source.type,
        note: source.note,
      }))}
    />
  )
}
```

- [ ] **Step 3: Replace semantic card framing**

Use open sections:

```css
.mdx-decision-record,
.mdx-semantic-card,
.mdx-transcript {
  width: 100%;
  margin: var(--space-5) 0;
  padding: var(--space-4) 0;
  border: 0;
  border-top: 1px solid var(--divider);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
```

Retain a framed surface only for actual copy controls and collapsible transcript controls.

- [ ] **Step 4: Preserve read-only interactions**

Keep these existing DOM contracts unchanged:

```text
data-filepath
data-md-link
data-media-src
data-media-time
data-copy-text
```

Add copied-state text through `aria-live`; do not mutate journal content.

- [ ] **Step 5: Run focused tests**

```bash
npx vitest run src/tests/MdxSemanticComponents.test.tsx src/tests/MdxRenderer.test.tsx
```

Expected: rendering and click contracts pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/mdx/semantic.tsx src/components/mdx/source.tsx src/components/mdx/callout.tsx src/styles/mdx-semantic.css src/tests/MdxSemanticComponents.test.tsx src/tests/MdxRenderer.test.tsx
git commit -m "feat: redesign semantic JSX components"
```

---

### Task 9: Redesign Media, Charts, Math, And Preview JSX

**Files:**

- Modify: `src/components/mdx/media.tsx`
- Modify: `src/components/mdx/charts.tsx`
- Modify: `src/components/mdx/chart-frame.tsx`
- Modify: `src/components/mdx/mermaid.tsx`
- Modify: `src/components/mdx/math.tsx`
- Modify: `src/components/mdx/html-preview.tsx`
- Modify: `src/components/mdx/device-mockups.tsx`
- Modify: `src/components/mdx/layout.tsx`
- Modify: `src/styles/mdx-media.css`
- Test: `src/tests/MdxSemanticComponents.test.tsx`
- Test: `src/tests/MdxRendererSuspense.test.tsx`

- [ ] **Step 1: Write failing visual-structure tests**

Lock these contracts:

```text
AudioCard/VideoCard -> compact media header plus unframed native control
ImageViewer -> figure with stable aspect behavior and caption
FileCard -> resource row, not standalone card
ChartFrame -> wide unframed figure with title/caption
Mermaid -> same wide figure grammar and local error state
InlineMath/BlockMath -> typography-first, no decorative surface
HtmlPreview -> framed tool surface with stable height
PhonePreview/MacPreview -> true preview frames; no outer decorative card
```

- [ ] **Step 2: Resolve local assets through `useMdxAsset`**

Apply `useMdxAsset` to:

```text
AudioCard.src
VideoCard.src
VideoCard.poster
ImageViewer.src
PhonePreview.src
ImageText/ImageCompare/ImageAnnotate/ImageSteps images
```

- [ ] **Step 3: Apply focused media styles**

```css
.mdx-chart,
.mdx-diagram-frame,
.mdx-media-card,
.mdx-image {
  width: 100%;
  max-width: 100%;
  margin: var(--space-5) 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.mdx-html-preview,
.mdx-device-v2,
.mdx-mac-preview {
  border: 1px solid var(--divider);
  border-radius: 8px;
  overflow: hidden;
}
```

- [ ] **Step 4: Run focused tests**

```bash
npx vitest run src/tests/MdxSemanticComponents.test.tsx src/tests/MdxRendererSuspense.test.tsx
```

Expected: lazy components, local asset resolution, and fallback states pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/mdx/media.tsx src/components/mdx/charts.tsx src/components/mdx/chart-frame.tsx src/components/mdx/mermaid.tsx src/components/mdx/math.tsx src/components/mdx/html-preview.tsx src/components/mdx/device-mockups.tsx src/components/mdx/layout.tsx src/styles/mdx-media.css src/tests/MdxSemanticComponents.test.tsx src/tests/MdxRendererSuspense.test.tsx
git commit -m "feat: redesign rich MDX components"
```

---

### Task 10: Build A Complete JSX Visual Gallery

**Files:**

- Create: `docs/superpowers/examples/jsx-component-gallery.mdx`
- Modify: `scripts/build-mdx-support-manual.mjs`
- Test: `src/tests/MdxLayoutManifest.test.ts`

- [ ] **Step 1: Generate one live section per manifest component**

The gallery must contain every canonical and specialized component exactly once, using realistic content rather than lorem ipsum. Use section headings matching `component-manifest.json`.

- [ ] **Step 2: Make the manual generator manifest-driven**

Replace hard-coded component counts:

```js
const componentManifest = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'src/components/mdx/component-manifest.json'), 'utf8'),
)

const publicComponents = componentManifest.filter((item) => item.public !== false)
```

Generate component index rows and counts from `publicComponents`. Keep component examples in a keyed map and fail generation when any public component lacks an example:

```js
const missingExamples = publicComponents.filter((item) => !componentExamples[item.jsxName])
if (missingExamples.length > 0) {
  throw new Error(
    `Missing component examples: ${missingExamples.map((item) => item.jsxName).join(', ')}`,
  )
}
```

- [ ] **Step 3: Add gallery compile coverage**

Read the gallery in a Vitest test and pass it to the mocked `compileMdx` path. Assert every manifest JSX name appears in either the gallery or its documented compatibility-alias list.

- [ ] **Step 4: Run generation and tests**

```bash
node scripts/build-mdx-support-manual.mjs
npx vitest run src/tests/MdxLayoutManifest.test.ts src/tests/MdxRenderer.test.tsx
```

Expected: generator reports the manifest-derived component count and no missing examples.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/examples/jsx-component-gallery.mdx scripts/build-mdx-support-manual.mjs src/tests/MdxLayoutManifest.test.ts
git commit -m "docs: add complete JSX component gallery"
```

---

### Task 11: Add Directive-To-JSX Conversion

**Files:**

- Create: `src/lib/legacyDirectives/toJsx.ts`
- Create: `src/lib/legacyDirectives/index.ts`
- Move: `src/lib/journalLayout/parse.ts` to `src/lib/legacyDirectives/parse.ts`
- Move: `src/lib/journalLayout/validate.ts` to `src/lib/legacyDirectives/validate.ts`
- Test: `src/tests/legacyDirectiveToJsx.test.ts`
- Modify: `src/lib/journalLayout/index.ts`

- [ ] **Step 1: Write conversion tests**

Use exact outputs:

```ts
expect(
  convertLegacyDirectives(`:::metrics[关键指标]
完成度 | 72% | 本周
风险 | 2 | 待处理
:::`),
).toContain(
  '<Metrics heading={"关键指标"} items={[{"label":"完成度","value":"72%","description":"本周"},{"label":"风险","value":"2","description":"待处理"}]} />',
)
```

Also cover:

```text
all 43 directive modules
aliases admonition and note -> Callout
modifier -> tone
variant attribute -> variant
multiline fields
JSON object and array bodies
directives inside fenced code remain unchanged
malformed directives return a conversion error with source lines
```

- [ ] **Step 2: Implement manifest-driven serialization**

```ts
function jsxProp(name: string, value: unknown): string {
  return `${name}={${JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}}`
}

function blockToCanonicalJsx(block: JournalBlock): string {
  const spec = getLayoutModuleSpec(block.name)
  if (!spec) throw new Error(`Unknown directive: ${block.name}`)

  const props: Record<string, unknown> = {}
  if (block.title) props.heading = block.title
  if (block.modifier) props.tone = block.modifier
  Object.assign(props, block.attrs)

  if (block.body.format === 'fields') Object.assign(props, block.body.fields)
  if (block.body.format === 'rows') {
    props.items = block.body.rows.map((row) =>
      Object.fromEntries((spec.columns ?? []).map((column, index) => [column, row[index] ?? ''])),
    )
  }
  if (block.body.format === 'json_object') Object.assign(props, block.body.value)
  if (block.body.format === 'json_array') props.items = block.body.value

  const serialized = Object.entries(props)
    .filter(([, propValue]) => propValue !== '' && propValue !== undefined)
    .map(([name, propValue]) => jsxProp(name, propValue))
    .join(' ')

  return `<${spec.jsxName}${serialized ? ` ${serialized}` : ''} />`
}
```

- [ ] **Step 3: Keep temporary compatibility re-exports**

`src/lib/journalLayout/index.ts` may re-export the moved parser during Tasks 11-13 so runtime tests remain green. Mark the import path with a comment explaining it is removed in Task 14.

- [ ] **Step 4: Run conversion tests**

```bash
npx vitest run src/tests/legacyDirectiveToJsx.test.ts src/tests/journalLayoutParse.test.ts src/tests/journalLayoutValidate.test.ts
```

Expected: all 43 conversion fixtures and existing parser tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/legacyDirectives src/lib/journalLayout src/tests/legacyDirectiveToJsx.test.ts src/tests/journalLayoutParse.test.ts src/tests/journalLayoutValidate.test.ts
git commit -m "feat: add legacy directive to JSX conversion"
```

---

### Task 12: Add Safe Workspace Migration

**Files:**

- Create: `src-tauri/src/directive_migration.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src/lib/tauri.ts`
- Modify: `src/types.ts`
- Create: `src/lib/directiveMigration.ts`
- Modify: `src/settings/components/SectionGeneral.tsx`
- Modify: `src/locales/en.ts`
- Modify: `src/locales/zh.ts`
- Create: `src/tests/directiveMigration.test.ts`

- [ ] **Step 1: Add Rust scan/apply tests**

Test these rules:

```text
scan only .md and .mdx
exclude raw, .claude, .Codex, node_modules, and migration backups
detect opening :::name lines outside fenced code
validate converted content with mdx::validate_mdx_document
write backup before mutation
rename converted .md to .mdx
reject an existing destination
leave source untouched when validation fails
```

- [ ] **Step 2: Add IPC models**

```rust
#[derive(serde::Serialize)]
pub struct LegacyDirectiveFile {
    pub path: String,
    pub relative_path: String,
    pub extension: String,
}

#[derive(serde::Deserialize)]
pub struct ApplyDirectiveMigrationRequest {
    pub source_path: String,
    pub destination_path: String,
    pub content: String,
}

#[derive(serde::Serialize)]
pub struct ApplyDirectiveMigrationResult {
    pub destination_path: String,
    pub backup_path: String,
}
```

- [ ] **Step 3: Implement safe apply order**

The Rust command must:

```text
1. resolve both paths under the configured workspace
2. call validate_mdx_document(content, destination_path)
3. create .Codex/migrations/directive-to-jsx/<timestamp>/<relative-source>
4. copy the original file to the backup
5. write destination through a temporary sibling file
6. atomically rename the temporary file
7. remove the old .md only after a successful .mdx write
8. emit journal-updated
```

- [ ] **Step 4: Add typed frontend wrappers**

```ts
export const scanLegacyDirectiveFiles = () =>
  invoke<LegacyDirectiveFile[]>('scan_legacy_directive_files')

export const applyDirectiveMigration = (request: ApplyDirectiveMigrationRequest) =>
  invoke<ApplyDirectiveMigrationResult>('apply_directive_migration', { request })
```

- [ ] **Step 5: Add orchestration**

`src/lib/directiveMigration.ts` must:

```text
scan candidates
read each source
convert through convertLegacyDirectives
compile through compileMdx before apply
return preview results without writing
apply only selected valid files
report converted/skipped/failed arrays
```

- [ ] **Step 6: Add an explicit General settings control**

Use one row with:

```text
title: Migrate legacy note syntax
status: candidate count or "No legacy syntax found"
primary command: Preview migration
confirmation command: Migrate N files
result: backup location and per-file failures
```

Do not run migration automatically.

- [ ] **Step 7: Run frontend and Rust tests**

```bash
npx vitest run src/tests/directiveMigration.test.ts
cd src-tauri && cargo test directive_migration
```

Expected: preview makes no writes; apply validates and backs up.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/directive_migration.rs src-tauri/src/main.rs src/lib/tauri.ts src/types.ts src/lib/directiveMigration.ts src/settings/components/SectionGeneral.tsx src/locales/en.ts src/locales/zh.ts src/tests/directiveMigration.test.ts
git commit -m "feat: add safe directive migration"
```

---

### Task 13: Migrate Documentation, Skills, Prompts, And Repository Examples

**Files:**

- Modify: `.agents/skills/journal/SKILL.md`
- Modify: `.agents/skills/journal/references/component-catalog.md`
- Modify: `.agents/skills/journal/references/component-recipes.md`
- Modify: `.agents/skills/journal/references/writing-rules.md`
- Modify: `.agents/skills/journal/references/template-examples/**/*.mdx`
- Modify: `src-tauri/resources/workspace-template/.claude/skills/journal/SKILL.md`
- Modify: `src-tauri/resources/workspace-template/.claude/skills/journal/references/component-catalog.md`
- Modify: `src-tauri/resources/workspace-template/.claude/skills/journal/references/component-recipes.md`
- Modify: `src-tauri/resources/workspace-template/.claude/skills/journal/references/writing-rules.md`
- Modify: `src-tauri/resources/workspace-template/CLAUDE.md`
- Modify: `src-tauri/src/ai_processor.rs`
- Modify: `src-tauri/src/llm/prompt.rs`
- Delete: `.agents/skills/journal/references/layout-directives.md`
- Delete: `src-tauri/resources/workspace-template/.claude/skills/journal/references/layout-directives.md`
- Delete: `docs/superpowers/examples/journal-layout-directives-phase1.mdx`

- [ ] **Step 1: Change the journal skill contract**

Replace the authoring order with:

```text
1. Markdown for ordinary prose, headings, lists, and simple tables.
2. Canonical JSX components for structured visual or semantic objects.
3. Do not emit ::: layout directives; they are legacy syntax.
4. Use 2-5 information-bearing components in an ordinary note.
5. Components remain read-only except copy, jump, collapse, and media seek.
```

- [ ] **Step 2: Replace directive examples with canonical JSX**

Convert every repository directive document with `convertLegacyDirectives`, then run Rust MDX validation. Preserve frontmatter and prose byte-for-byte outside converted blocks.

- [ ] **Step 3: Update embedded skill installation**

Remove `layout-directives.md` from `SKILL_JOURNAL_REFERENCE_FILES` and replace Rust assertions with checks for the JSX-only component catalog.

- [ ] **Step 4: Update the LLM prompt**

Use this instruction:

```text
写日志或整理素材前应加载 /journal。普通内容优先使用 Markdown；需要稳定的结构化展示时，从 references/component-catalog.md 选择白名单 JSX 组件。不要生成 ::: layout directives。普通条目通常使用 2-5 个承载信息的组件，不要为了装饰使用组件。
```

- [ ] **Step 5: Verify zero repository directive documents**

```bash
rg -l '^:::[A-Za-z]' .agents src-tauri/resources docs/superpowers/examples -g '*.md' -g '*.mdx'
```

Expected: no output.

- [ ] **Step 6: Run skill and compile tests**

```bash
npm test
cd src-tauri && cargo test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add .agents/skills/journal src-tauri/resources/workspace-template src-tauri/src/ai_processor.rs src-tauri/src/llm/prompt.rs docs/superpowers/examples
git commit -m "docs: make JSX the only journal component syntax"
```

---

### Task 14: Migrate The Active Workspace And Verify Backups

**Files:**

- User workspace selected in JournalClaw settings
- Backup destination: `<workspace>/.Codex/migrations/directive-to-jsx/<timestamp>/`

- [ ] **Step 1: Run migration preview**

Expected for the currently verified workspace snapshot: 12 candidate content files after excluded directories. Re-scan at execution time and use the live count.

- [ ] **Step 2: Inspect three representative conversions**

Inspect:

```text
one normal journal entry
one all-43-module demo
one long research brief containing quote and comparison components
```

Confirm frontmatter, prose, relative paths, and Unicode text remain intact.

- [ ] **Step 3: Apply migration**

Apply only files that pass `compileMdx`. Leave failed files unchanged and list them in the result.

- [ ] **Step 4: Verify the workspace**

```bash
find /Users/yanwu/Documents/journal -type f \( -name '*.md' -o -name '*.mdx' \) \
  -not -path '*/.claude/*' -not -path '*/.Codex/*' -not -path '*/raw/*' \
  -print0 | xargs -0 rg -l '^:::[A-Za-z]'
```

Expected: no output.

- [ ] **Step 5: Open representative converted entries in the real Tauri app**

Verify preview/source switching, Cmd+F, copy, links, images, and component rendering.

This task changes user content and is not committed to the repository.

---

### Task 15: Remove Directive Parsing From Runtime Rendering

**Files:**

- Modify: `src/components/MdxRenderer.tsx`
- Modify: `src/lib/markdown.tsx`
- Modify: `src/components/mdx/index.ts`
- Modify: `src/lib/journalLayout/index.ts`
- Delete: `src/lib/journalLayout/transformMdx.ts`
- Delete: `src/components/journal-blocks/JournalLayoutMarkdownRenderer.tsx`
- Delete: `src/tests/JournalLayoutMarkdownRenderer.test.tsx`
- Modify: `src/tests/MdxRenderer.test.tsx`
- Modify: `src/tests/journalLayoutParse.test.ts`
- Modify: `src/tests/journalLayoutValidate.test.ts`

- [ ] **Step 1: Write failing retirement tests**

```ts
it('passes MDX source directly to compileMdx without directive transformation', async () => {
  render(<MdxRenderer content="<Hero title={'JSX only'} />" />)
  await waitFor(() => expect(compileMdx).toHaveBeenCalledWith("<Hero title={'JSX only'} />", undefined))
})

it('renders .md files through normal Markdown even when they contain ::: text', () => {
  const result = renderMarkdown(':::hero\\ntitle: legacy\\n:::', '/workspace/08-note.md')
  expect(result.type).not.toBe(JournalLayoutMarkdownRenderer)
})
```

- [ ] **Step 2: Remove MDX transformation**

Delete:

```ts
const transformedContent = useMemo(() => transformMdxDirectives(content), [content])
```

Use `content` for cache keys, source extraction, and `compileMdx`.

- [ ] **Step 3: Remove Markdown directive routing**

Delete `parseJournalLayout` and `JournalLayoutMarkdownRenderer` imports and the `hasLayoutSegments` branch from `src/lib/markdown.tsx`.

- [ ] **Step 4: Remove internal runtime components from the MDX whitelist**

Delete `JournalBlock` and `JournalBlockError` from `mdxComponents`. Canonical JSX components continue to use `JournalBlockRenderer` internally through `blockFactory.tsx`; authors can no longer instantiate raw internal blocks.

- [ ] **Step 5: Keep parser tests only under legacy migration**

Move parser/validator tests to import `src/lib/legacyDirectives`. They validate migration behavior, not render behavior.

- [ ] **Step 6: Run retirement tests**

```bash
npx vitest run src/tests/MdxRenderer.test.tsx src/tests/legacyDirectiveToJsx.test.ts src/tests/journalLayoutParse.test.ts src/tests/journalLayoutValidate.test.ts
```

Expected: JSX compiles directly; legacy parser is reachable only from migration modules.

- [ ] **Step 7: Commit**

```bash
git add src/components/MdxRenderer.tsx src/lib/markdown.tsx src/components/mdx/index.ts src/lib/journalLayout src/lib/legacyDirectives src/tests
git commit -m "refactor: retire directive runtime syntax"
```

---

### Task 16: Full Verification And Real-Render Review

**Files:**

- Review: `docs/superpowers/examples/jsx-component-gallery.mdx`
- Review: converted workspace entries

- [ ] **Step 1: Run focused frontend tests**

```bash
npx vitest run \
  src/tests/MdxLayoutManifest.test.ts \
  src/tests/MdxLayoutParity.test.tsx \
  src/tests/MdxComponentDesign.test.ts \
  src/tests/MdxSemanticComponents.test.tsx \
  src/tests/MdxRenderer.test.tsx \
  src/tests/MdxRendererSuspense.test.tsx \
  src/tests/legacyDirectiveToJsx.test.ts \
  src/tests/directiveMigration.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the complete verification suite**

```bash
npm test
npm run build
npm run lint
npm run format:check
cd src-tauri && cargo fmt --check
cd src-tauri && cargo test
git diff --check
```

Expected: no errors. Existing lint warnings must be reported separately and must not increase.

- [ ] **Step 3: Start the real application**

```bash
npm run tauri dev
```

Open `jsx-component-gallery.mdx` through JournalClaw, not a standalone Vite probe.

- [ ] **Step 4: Review four render matrices**

```text
dark theme, wide detail panel
dark theme, narrow detail panel
light theme, wide detail panel
light theme, narrow detail panel
```

Check:

```text
no text overlap or clipping
no card-inside-card
no unintended amber body text
stable widths and table scrolling
relative media loads
copy, link, timestamp, collapse, and preview controls work
source/preview switching and Cmd+F remain intact
```

- [ ] **Step 5: Run final syntax scans**

```bash
rg -n "transformMdxDirectives|JournalLayoutMarkdownRenderer|layout directives before JSX" src src-tauri .agents
rg -l '^:::[A-Za-z]' .agents src-tauri/resources docs/superpowers/examples -g '*.md' -g '*.mdx'
```

Expected: no runtime references and no repository-authored directives.

- [ ] **Step 6: Commit final verification fixtures**

```bash
git add docs/superpowers/examples/jsx-component-gallery.mdx scripts/build-mdx-support-manual.mjs
git commit -m "test: verify JSX-only component system"
```

## Self-Review

**Spec coverage**

- JSX support for every directive: Tasks 1-5.
- Directive-quality rendering for canonical JSX: Tasks 4-6.
- Deep optimization of all existing JSX families: Tasks 7-9.
- Documentation and generator consistency: Tasks 10 and 13.
- Safe migration before removal: Tasks 11, 12, and 14.
- Directive runtime deletion: Task 15.
- Real Tauri render verification: Task 16.

**Type consistency**

- `heading` always means the former directive bracket title.
- `title` remains content when present in the component schema.
- collections use `items`.
- directive modifiers map to `tone`.
- directive attributes map to direct JSX props.
- `TimelineItem` accepts `description` canonically and `desc` only as a compatibility alias.

**No hidden second syntax**

After Task 15, authors have Markdown plus one structured syntax: whitelisted JSX. `src/lib/legacyDirectives` is an explicit migration utility and is not imported by Markdown or MDX rendering.
