# Journal MDX Examples Rewrite Design

## Goal

Rebuild every Journal MDX usage guide and example around the 61-component public registry, including the restored `StatGroup`, so generated notes, handbook pages, subtype templates, and the all-components demo use only supported components and demonstrate credible article structures.

## Scope

This rewrite covers:

- `.agents/skills/journal/references/component-catalog.md`
- `.agents/skills/journal/references/component-recipes.md`
- `.agents/skills/journal/references/templates/*.md`
- all 104 files under `.agents/skills/journal/references/template-examples/`
- `.agents/skills/journal/references/examples/*.mdx`
- `scripts/build-mdx-support-manual.mjs`
- `docs/superpowers/examples/journal-v2-showcase.mdx`
- `docs/superpowers/examples/jsx-component-gallery.mdx`
- `docs/superpowers/examples/jsx-all-components-demo.mdx`
- generated handbook output under `/Users/yanwu/Documents/journal/topics/mdx-support-manual/`

Runtime component behavior is not redesigned in this work. The current public registry and component implementations are the source of truth.

## Source Of Truth

The rewrite must derive component availability from:

1. `src/components/mdx/component-manifest.json`
2. `src/components/mdx/index.ts`
3. the exported component TypeScript implementations
4. `src/lib/journalLayout/catalog.ts` for canonical layout directives

The target contract contains 61 public components:

- 22 canonical layout components
- 39 specialized or generic components

`Stat` and `Steps` remain public components. `StatGroup` is restored as a specialized display component before the documentation and examples are rewritten.

Documentation and examples must not maintain an independent handwritten allowlist that can drift from the manifest.

## Content Principles

### Markdown First

Headings, paragraphs, ordinary lists, simple tables, and code fences remain Markdown. Components are used only when they improve scanning, comparison, evidence review, chronology, or source traceability.

A normal subtype example should usually contain 0-5 information-bearing components. More components are acceptable only for intrinsically dense formats such as architecture documents, research matrices, incident reviews, or dashboards.

### No Mechanical Substitution

Retired components are not replaced name-for-name. Each document is reconsidered from its user task:

- action and risk structures may become Markdown tables or `Table`
- evidence may become prose, `Quote`, `Callout`, `SourceCard`, or `ReferenceList`
- multiple decisions become separate `DecisionRecord` blocks only when each decision matters
- progress may become `Metrics`, `StatusBadge`, `MilestoneTimeline`, or plain prose
- media transcripts become summarized excerpts plus source references
- product-page and device-preview structures are removed rather than imitated

### High-Frequency Components

The rewrite treats these components as first-class article primitives:

- `StatGroup` groups two to four compact `Stat` children when the reader needs a quick numeric snapshot
- `Stat` renders one compact value, label, optional suffix, and optional trend
- `Steps` renders an ordered procedure, workflow, method, or rollout sequence

The restored API is:

```mdx
<StatGroup>
  <Stat label="完成项" value={12} />
  <Stat label="风险" value={3} />
</StatGroup>
```

`StatGroup` accepts only `children` and provides layout. It does not duplicate `Metrics` headings, descriptions, or item-array API.

Use `Metrics` when each metric needs an explanation or the group needs a heading. Use `StatGroup` when compactness is more important than narrative context. Use `Steps` for ordered actions, not chronology; chronological events continue to use `Timeline` or `MilestoneTimeline`.

### User-Task-Specific Structure

Each of the 104 subtype examples must have a distinct structure appropriate to its job. Shared family conventions are allowed, but examples must not be generated from one universal skeleton.

Examples:

- `meeting-collaboration/brainstorm` emphasizes viewpoints, relationships, convergence, and experiments
- `meeting-collaboration/general-meeting` emphasizes agenda, decisions, unresolved issues, and actions
- `technical-docs/incident-rca` emphasizes impact, timeline, evidence, root cause, corrective actions, and verification
- `learning-notes/book-note` emphasizes thesis, arguments, excerpts, interpretation, and application
- `personal-journal/emotion-log` emphasizes events, body signals, feelings, interpretations, and a small next action
- `content-creation/article-draft` emphasizes audience, thesis, outline, evidence gaps, and publication checks

## Template Example Contract

### Required

Every subtype example keeps:

- valid YAML frontmatter
- a concrete one-sentence `summary`
- `tags`
- `sources`
- a clear H1
- subtype-specific writing prompts or example content
- explicit handling of unknown facts without fabrication

### Conditional

`专业校准` is retained only when an expert lens materially improves the subtype. It should be rewritten as a concise operational rule, not ornamental authority.

`质量检查` is retained when the subtype has meaningful failure modes, such as unsupported claims, missing owners, absent verification, unclear decisions, or unsafe operational steps. It may be shortened or omitted for lightweight personal and content notes.

### Forbidden

- decorative component use
- component-heavy landing-page composition
- invented facts or sources
- generic placeholders repeated unchanged across many subtypes
- retired or unregistered component names
- JSX props not supported by the actual TypeScript component
- a component merely restating the heading immediately above it

## Component Catalog

`component-catalog.md` will become the concise public API guide.

For every registered component it must state:

- component name
- purpose
- essential props
- best-fit article scenarios
- when not to use it
- simpler Markdown or component alternative

Components are grouped by reader task rather than only implementation folder:

- article structure
- metrics and chronology
- judgment and evidence
- comparison and management
- sources and navigation
- technical media and diagrams
- typography and layout primitives

The catalog must distinguish components that share names or behavior through the canonical public export.

## Component Recipes

`component-recipes.md` will document small, proven combinations rather than isolated API samples.

Required recipe families:

1. conclusion plus evidence
2. meeting decision plus actions
3. project status plus risks
4. option comparison plus decision
5. incident timeline plus corrective actions
6. research findings plus limitations
7. technical explanation plus diagram and verification
8. learning note plus application
9. article outline plus source checks
10. source traceability and local-file navigation

Each recipe must include:

- the reader problem
- the minimum useful component set
- a valid MDX example
- a simpler Markdown alternative
- misuse guidance

## Family Reference Files

The nine files under `references/templates/` remain routing guides, not full examples.

Each subtype entry will provide:

- classification signal
- expected output
- required information
- recommended components chosen from the current registry
- a link to the concrete subtype example

Recommendations must be specific. For example, `Table` should explain whether it represents actions, risks, evidence, or comparison rather than appearing as a generic default.

## Manual Generator

`scripts/build-mdx-support-manual.mjs` remains the reproducible source for the workspace handbook, but it must be reorganized around explicit data contracts:

### Component Specs

Component pages are derived from the manifest and a reviewed metadata map containing descriptions, props, examples, and boundaries. Generation must fail if:

- a manifest component lacks metadata
- metadata names a component absent from the manifest
- an example contains an unregistered PascalCase JSX tag

### Subtype Templates

The generator should read the durable subtype examples from `.agents/skills/journal/references/template-examples/` instead of maintaining a second large set of template strings.

This makes the skill examples the durable source and the handbook a generated presentation of those examples.

### Generated Output

The generator may recreate only its owned directory:

`/Users/yanwu/Documents/journal/topics/mdx-support-manual/`

It must produce:

- index and runtime guidance pages
- one component page per public component
- one template page per registered subtype
- a coverage manifest

## All-Components Demo

`docs/superpowers/examples/jsx-all-components-demo.mdx` will be rewritten as a real long-form technical article rather than a disconnected component grid.

Requirements:

- all 61 public components appear at least once
- every component uses valid current props
- the document remains readable as one coherent article
- layout and typography primitives support the article rather than dominate it
- charts, Mermaid, math, file navigation, sources, and HTML preview use inspectable example data
- no retired component appears
- no unavailable local asset is required
- duplicate public names are counted by the manifest contract, not implementation files

The article may contain clearly labeled demonstration sections, but it must avoid a marketing landing-page structure.

## Other Showcases

`jsx-component-gallery.mdx` becomes a shorter category-oriented visual smoke document.

`journal-v2-showcase.mdx` becomes a realistic semantic journal example, not a comprehensive API catalog.

These files must not duplicate the all-components demo.

## Validation

### Registry Validation

Add or extend tests/scripts to verify:

- every PascalCase JSX tag in owned examples exists in `mdxComponents`
- the all-components demo covers every manifest component
- the all-components demo contains no unknown component
- component catalog entries exactly match the manifest
- family recommendations contain only registered components

### MDX Compilation

Compile:

- all 104 subtype examples
- all skill example files
- all three showcase/demo files
- generated handbook MDX files

Compilation should use the same Rust `mdxjs` path used by JournalClaw where practical. Prettier parsing alone is not sufficient.

### Product Verification

Run:

- focused Vitest tests for registry and example coverage
- full `npm test`
- `npm run build`
- `npm run lint`
- `npm run format:check`
- Rust MDX compilation tests
- `git diff --check`

The demo should also be opened through the real `.md-content.mdx-content` rendering chain for a visual smoke check. Unknown-component fallback must not appear.

## Migration And Compatibility

Existing user-authored notes may still contain retired component names. They remain readable because `MdxRenderer` localizes unknown components and continues rendering surrounding content.

This rewrite does not silently rewrite user workspace notes outside the generated handbook directory.

## Completion Criteria

The work is complete when:

1. all documentation describes only the target 61-component surface
2. all 104 subtype examples have distinct, task-appropriate structures
3. the generator reads subtype examples from the skill reference tree
4. the all-components demo covers all 61 components with valid props
5. no owned example contains a retired or unknown component
6. all owned MDX compiles through the Journal MDX toolchain
7. the generated handbook is refreshed successfully
8. tests, build, lint, formatting, and diff checks pass
