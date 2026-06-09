# Component Catalog

The public MDX surface is defined by `src/components/mdx/component-manifest.json`. Use Markdown for normal prose, headings, lists, simple tables, and code fences. Add a component only when it improves scanning, comparison, chronology, evidence review, or source navigation.

## Article Structure

### `Toc`

- Purpose: compact article index.
- Props: `items[{ label, title, description? }]`, `heading?` or `title?`.
- Best for: long reports and technical guides with stable sections.
- Avoid: short notes; use Markdown headings alone.

### `Cards`

- Purpose: group a few discrete summaries.
- Props: `items[{ title, description?, meta?, variant? }]`, or `Card` children; `heading?` or `title?`.
- Best for: parallel themes, deliverables, or entry points.
- Avoid: continuous prose or card-heavy page composition; use a list.

### `Hero`

- Purpose: editorial-style article header with oversized title and kicker.
- Props: `title`, `eyebrow?` (or `kicker?`), `subtitle?` (or `lead?`), `meta?`.
- Best for: long-form reading notes, research briefs, and deep-dive entries that need a prominent opening statement.
- Avoid: short daily logs or routine meeting notes; use a heading and paragraph.

### `Card`

- Purpose: one item inside `Cards`, or one standalone summary.
- Props: `title`, `description?`, `meta?`, `image?`, `variant?`.
- Best for: one bounded concept or artifact.
- Avoid: wrapping ordinary sections; use a heading and paragraph.

### `Section`

- Purpose: control vertical density for a real section.
- Props: `children`, `density="compact|default|relaxed"`.
- Best for: grouping a dense or deliberately spacious passage.
- Avoid: wrapping every heading; Markdown usually supplies enough structure.

### `Subtitle`

- Purpose: one low-noise explanatory line below a heading.
- Props: `children`.
- Best for: clarifying scope or reader intent.
- Avoid: repeating the heading.

### `Summary`

- Purpose: close a section or document with a named synthesis.
- Props: `title`, `body?` or `children`.
- Best for: durable conclusions after detailed evidence.
- Avoid: introducing content the article has not established.

### `Cta`

- Purpose: state one explicit next action.
- Props: `title`, `description?`, `action?`.
- Best for: approvals, review requests, or a single handoff.
- Avoid: marketing conversion language; use a checklist for several actions.

### `Faq`

- Purpose: answer repeated reader questions.
- Props: `items[{ question, answer }]`, `heading?` or `title?`.
- Best for: operational guidance with predictable ambiguity.
- Avoid: using questions as decorative section headings.

### `Definition`

- Purpose: pin down one term.
- Props: `term`, `description`.
- Best for: domain language whose meaning affects later reasoning.
- Avoid: familiar words; use prose.

### `AuthorCard`

- Purpose: identify the accountable author or expert context.
- Props: `name`, `role?`, `bio?`.
- Best for: externally shared essays or durable guidance.
- Avoid: routine internal logs where frontmatter already records ownership.

### `Subscribe`

- Purpose: render a publication subscription prompt.
- Props: `title`, `description?`.
- Best for: exported newsletter or publication content only.
- Avoid: internal journal entries and management notes.

## Metrics And Chronology

### `StatGroup`

- Purpose: lay out two to four compact statistics.
- Props: `children`, normally `Stat` elements.
- Best for: first-screen snapshots where labels and values are enough.
- Avoid: metrics that need explanations; use `Metrics`.

### `Stat`

- Purpose: show one compact value.
- Props: `label`, `value`, `suffix?`, `trend="up|down"?`.
- Best for: counts, rates, durations, and deltas inside `StatGroup`.
- Avoid: unlabeled numbers or qualitative status; use prose or `StatusBadge`.

### `Metrics`

- Purpose: show metrics with optional narrative context.
- Props: `items[{ label, value, description? }]`, `heading?` or `title?`.
- Best for: reports where each number needs interpretation.
- Avoid: a terse numeric strip; use `StatGroup`.

### `Steps`

- Purpose: express an ordered procedure or method.
- Props: `items[{ title, description?, meta? }]`, `heading?` or `title?`.
- Best for: setup, rollout, investigation, and learning procedures.
- Avoid: time-based event history; use `Timeline`.

### `Timeline`

- Purpose: show events in chronological order.
- Props: `items[{ time, title, description? }]`, `heading?` or `title?`.
- Best for: incidents, meetings, and historical change.
- Avoid: planned project gates; use `MilestoneTimeline`.

### `MilestoneTimeline`

- Purpose: show planned or tracked project milestones.
- Props: `items[{ time, title, desc? }]`.
- Best for: roadmap checkpoints, releases, and delivery plans.
- Avoid: detailed incident chronology; use `Timeline`.

### `Counter`

- Purpose: emphasize one integer count.
- Props: `count`, `label`.
- Best for: a single count that deserves visual prominence.
- Avoid: several metrics; use `StatGroup`.

### `RatingBar`

- Purpose: show a bounded score.
- Props: `score`, `max?`, `label?`.
- Best for: explicit review rubrics or confidence ratings.
- Avoid: pretending subjective judgment is precise without a stated rubric.

### `StatusBadge`

- Purpose: render a compact state label.
- Props: `status`, `tone="neutral|success|warning|danger"?`.
- Best for: inline draft, blocked, ready, or done states.
- Avoid: explaining why a state exists; add prose or a table column.

## Judgment And Evidence

### `Verdict`

- Purpose: state a bounded judgment and confidence.
- Props: `title`, `summary?`, `confidence?`, `status?`, `variant?`.
- Best for: feasibility, review, or go/no-go conclusions.
- Avoid: unsupported certainty; state evidence and limits first.

### `MythFact`

- Purpose: correct recurring misconceptions.
- Props: `items[{ myth, fact, reason? }]`, `heading?` or `title?`.
- Best for: teaching material with known false beliefs.
- Avoid: manufacturing a straw man to add drama.

### `Quote`

- Purpose: preserve a short attributed excerpt.
- Props: `text`, `author?`, `context?`, `source?`, `url?`.
- Best for: interview evidence or an exact statement that affects interpretation.
- Avoid: long transcripts or unattributed claims; use prose and `ReferenceList`.

### `QuoteCard`

- Purpose: highlight a key statement or insight with visual prominence.
- Props: `text`, `author?`, `source?`, `variant="default|minimal|large|inline"?`.
- Variants:
  - `default`: card with accent bar and attribution.
  - `minimal`: transparent with subtle left border, quieter.
  - `large`: centered, accent-tinted background, for hero-level statements.
  - `inline`: no card background, italic text with accent bar, for inline emphasis.
- Best for: golden quotes, core arguments, or keynote statements that deserve visual weight.
- Avoid: routine evidence citations; use `Quote`. Do not use multiple `large` variants on one page.

### `Callout`

- Purpose: isolate a consequential note, warning, or tip.
- Props: `title?` or `heading?`, `content?` or `children`, `tone?` or `type?`.
- Best for: constraints, caveats, and high-impact operational guidance.
- Avoid: styling ordinary paragraphs.

### `InsightCard`

- Purpose: separate interpretation from source facts.
- Props: `title`, `children`.
- Best for: research, learning, and retrospective insights.
- Avoid: raw evidence; use `Quote`, `SourceCard`, or prose.

### `Cases`

- Purpose: compare compact case/result pairs.
- Props: `items[{ case, result, note? }]`, `heading?` or `title?`.
- Best for: examples that share one analytic frame.
- Avoid: rich case studies; use headings and prose.

### `ProsCons`

- Purpose: place benefits and drawbacks in one visual region.
- Props: `children`.
- Best for: a short balanced tradeoff discussion using headings or lists inside.
- Avoid: option comparison across many dimensions; use `ComparisonMatrix`.

### `ImageText`

- Purpose: pair one image with a concise explanation.
- Props: `image`, `title?`, `text?`, `alt?`, `variant="default|reverse"?`.
- Best for: explaining one screenshot, artifact, or visual result.
- Avoid: ornamental imagery or unavailable local assets.

### `ImageSteps`

- Purpose: explain a procedure through several images.
- Props: `items[{ image?, title, text? }]`.
- Best for: UI walkthroughs when each step has a real screenshot.
- Avoid: text-only procedures; use `Steps`.

### `ImageViewer`

- Purpose: display an inspectable image with caption.
- Props: `src`, `alt?`, `caption?`, `width?`.
- Best for: source screenshots, diagrams, and evidence images.
- Avoid: device frames or decorative stock images.

## Comparison And Management

### `Table`

- Purpose: scan structured rows with stable columns.
- Props: `headers?`, `columns?`, `rows`.
- Best for: actions, risks, evidence, parameters, and ownership.
- Avoid: one or two simple facts; use prose or a list.

### `ComparisonTable`

- Purpose: compare options with flexible primitive values.
- Props: `columns`, `rows[{ label, values }]`, `heading?` or `title?`.
- Best for: compact factual comparisons.
- Avoid: when the first column should be explicitly named `对象`; use `ComparisonMatrix`.

### `ComparisonMatrix`

- Purpose: compare named objects across consistent dimensions.
- Props: `columns`, `rows[{ label, values }]`.
- Best for: product, vendor, design, or architecture options.
- Avoid: recording the final decision; pair with `DecisionRecord`.

### `DecisionRecord`

- Purpose: preserve one decision, alternatives, rationale, owner, and due date.
- Props: `question`, `decision`, `options?`, `rationale?`, `owner?`, `due?`.
- Best for: durable choices whose reasoning may be revisited.
- Avoid: every minor agreement in a meeting.

### `RACI`

- Purpose: make responsibility explicit.
- Props: `rows[{ work, responsible?, accountable?, consulted?, informed? }]`.
- Best for: cross-functional projects and repeatable operations.
- Avoid: a single owner; state the owner directly.

### `Checklist`

- Purpose: show a short set of verifiable checks.
- Props: `items[{ text? or item?, state? or checked? }]`, `heading?` or `title?`.
- Best for: readiness, quality gates, and completion criteria.
- Avoid: ordered procedures; use `Steps`.

### `Kanban`

- Purpose: show work grouped by workflow state.
- Props: `columns[{ title, items[{ text, tags? }] }]`.
- Best for: small planning boards embedded in a status note.
- Avoid: large live backlogs; link to the source system.

### `Toolbox`

- Purpose: list tools and their specific use.
- Props: `items[{ tool, use, link? }]`, `heading?` or `title?`.
- Best for: methods, utilities, or references used in a workflow.
- Avoid: generic resource links; use `ResourceList`.

## Sources And Navigation

### `SourceCard`

- Purpose: link one source artifact with type and note.
- Props: `path`, `label?`, `type?`, `note?`.
- Best for: one important local file or URL.
- Avoid: several sources; use `ReferenceList`.

### `ReferenceList`

- Purpose: list all material supporting a note.
- Props: `sources[{ path, label?, type?, note? }]`.
- Best for: research, meetings, incidents, and generated notes.
- Avoid: invented or inaccessible source paths.

### `ResourceList`

- Purpose: provide titled URL resources.
- Props: `items[{ title, url }]`.
- Best for: external reading or tool links.
- Avoid: local journal files; use `FileCard` or `RelatedEntry`.

### `FileCard`

- Purpose: open one local workspace file.
- Props: `path`, `label?`.
- Best for: attachments and adjacent artifacts.
- Avoid: related journal entries with semantic meaning; use `RelatedEntry`.

### `RelatedEntry`

- Purpose: link another journal entry.
- Props: `path`, `label?`.
- Best for: decisions, prior reviews, and follow-up notes.
- Avoid: identity files; use `RelatedIdentity`.

### `RelatedIdentity`

- Purpose: link a person, project, or concept identity file.
- Props: `path`, `label?`.
- Best for: stable context shared across notes.
- Avoid: ordinary attachments; use `FileCard`.

### `CopyButton`

- Purpose: copy exact reusable text.
- Props: `text`, `label?`, `children?`.
- Best for: commands, prompts, and canonical snippets.
- Avoid: normal prose or any content mutation.

## Technical Media And Diagrams

### `BarChart`

- Purpose: compare categorical magnitudes.
- Props: `data[{ label, value }]`, `title?`, `color?`.
- Best for: ranked or grouped numeric comparison.
- Avoid: trends over time; use `LineChart`.

### `LineChart`

- Purpose: show a numeric trend over ordered points.
- Props: `data[{ label, value }]`, `title?`, `color?`.
- Best for: time series and progress trends.
- Avoid: unordered categories.

### `PieChart`

- Purpose: show a small part-to-whole split.
- Props: `data[{ label, value }]`, `title?`, `color?`.
- Best for: two to five mutually exclusive shares.
- Avoid: precise comparison or many slices; use `BarChart` or `Table`.

### `RadarChart`

- Purpose: compare a profile across common dimensions.
- Props: `data[{ label, value }]`, `title?`, `color?`.
- Best for: one bounded capability or review profile.
- Avoid: unrelated metrics or values with incompatible scales.

### `Mermaid`

- Purpose: render an inspectable technical diagram.
- Props: `chart?` or text `children`, `caption?`.
- Best for: architecture, sequence, state, and dependency diagrams.
- Avoid: diagrams that are simpler as a list or table.

### `InlineMath`

- Purpose: render a short KaTeX formula in prose.
- Props: `math?` or text `children`.
- Best for: symbols and compact equations.
- Avoid: long derivations; use `BlockMath`.

### `BlockMath`

- Purpose: render a display equation.
- Props: `math?` or text `children`.
- Best for: central formulas that need their own line.
- Avoid: formulas unsupported by KaTeX or unexplained notation.

### `HtmlPreview`

- Purpose: render inspectable HTML in the sandbox.
- Props: `html?`, `src?`, `children?`, `title?`, `height?`, `className?`.
- Best for: UI fragments and generated HTML artifacts.
- Avoid: full product demos or untrusted remote scripts.

## Typography And Layout Primitives

### `Columns`

- Purpose: create two to four equal reading columns.
- Props: `cols={2|3|4}`, `children`.
- Best for: short parallel content with comparable weight.
- Avoid: long prose or narrow windows.

### `Column`

- Purpose: provide one child region inside `Columns`.
- Props: `children`.
- Best for: explicit column grouping.
- Avoid: standalone use.

### `Grid`

- Purpose: arrange children in a configurable equal-track grid.
- Props: `children`, `cols?`, `gap?`, `rowGap?`, `stackBelow?`, `className?`.
- Best for: compact technical layouts that need more control than `Columns`.
- Avoid: assuming child span support; no public span component exists.

### `Flow`

- Purpose: wrap short items in a flex row.
- Props: `children`, `gap?`, `justify?`, `align?`, `className?`.
- Best for: labels, badges, or small controls.
- Avoid: primary article structure.

### `Stack`

- Purpose: apply consistent vertical gaps between children.
- Props: `children`, `gap?`.
- Best for: a small repeated component sequence.
- Avoid: wrapping ordinary Markdown paragraphs.

### `Label`

- Purpose: render a compact category label.
- Props: `children`.
- Best for: a short type or state cue.
- Avoid: long text or decorative eyebrows.

### `Divider`

- Purpose: mark a real shift in topic or phase.
- Props: `label?`.
- Best for: separating major article movements.
- Avoid: frequent decorative separators.

### `TagList`

- Purpose: display a compact list of tags.
- Props: `tags`.
- Best for: visible classification or filtering context.
- Avoid: duplicating frontmatter tags without reader value.
