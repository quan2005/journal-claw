# Component Catalog

62 public components. Markdown tables/lists first; JSX only when structure adds clarity.

## Layout

| Component | Purpose              | Props                                                                     |
| --------- | -------------------- | ------------------------------------------------------------------------- |
| `Columns` | Multi-column wrapper | `cols?: 2\|3\|4`                                                          |
| `Column`  | Column child         | children                                                                  |
| `Grid`    | CSS grid             | `cols?: number`, `gap?: number`, `rowGap?: number`, `stackBelow?: number` |
| `Flow`    | Flexbox wrap         | `gap?: number`, `justify?`, `align?`                                      |
| `Stack`   | Vertical flex        | `gap?: number`                                                            |

## Typography

| Component  | Purpose         | Props                                       |
| ---------- | --------------- | ------------------------------------------- |
| `Section`  | Spacing wrapper | `density?: 'compact'\|'default'\|'relaxed'` |
| `Subtitle` | Styled subtitle | children                                    |
| `Label`    | Inline label    | children                                    |
| `Divider`  | Horizontal rule | `label?: string`                            |

## Opening (layout)

| Component | Purpose           | Props                                                     |
| --------- | ----------------- | --------------------------------------------------------- |
| `Card`    | Card block        | **`title`** `description?`, `image?`, `meta?`, `variant?` |
| `Cards`   | Card grid         | `title?`, `items?: CardItem[]`, children                  |
| `Toc`     | Table of contents | **`items: {label, title, description?}[]`** `title?`      |

## Infographic (layout)

| Component  | Purpose              | Props                                                |
| ---------- | -------------------- | ---------------------------------------------------- |
| `Metrics`  | KPI grid             | **`items: {label, value, description?}[]`** `title?` |
| `Steps`    | Numbered steps       | **`items: {title, description?, meta?}[]`** `title?` |
| `Timeline` | Chronological events | **`items: {time, title, description?}[]`** `title?`  |

## Judgment (layout)

| Component  | Purpose         | Props                                                        |
| ---------- | --------------- | ------------------------------------------------------------ |
| `MythFact` | Myth vs fact    | **`items: {myth, fact, reason?}[]`** `title?`                |
| `Verdict`  | Conclusion card | **`title`** `summary?`, `confidence?`, `status?`, `variant?` |

## Evidence (layout)

| Component    | Purpose                   | Props                                               |
| ------------ | ------------------------- | --------------------------------------------------- |
| `Quote`      | Blockquote                | **`text`** `author?`, `context?`, `source?`, `url?` |
| `ImageSteps` | Steps with images         | **`items: {title, image?, text?}[]`**               |
| `ImageText`  | Image + text side-by-side | **`image`** `title?`, `text?`, `alt?`, `variant?`   |

## Conversion (layout)

| Component   | Purpose              | Props                                                                        |
| ----------- | -------------------- | ---------------------------------------------------------------------------- |
| `Cases`     | Case study rows      | **`items: {case, result, note?}[]`** `title?`                                |
| `Checklist` | Checklist with state | **`items: {text?, state?: 'todo'\|'done'\|'checked', checked?}[]`** `title?` |
| `Cta`       | Call to action       | **`title`** `description?`, `action?`                                        |
| `Faq`       | FAQ accordion        | **`items: {question, answer}[]`** `title?`                                   |
| `Summary`   | Summary block        | **`title`** `body?`, children                                                |
| `Toolbox`   | Tool list            | **`items: {tool, use, link?}[]`** `title?`                                   |

## Brand (layout)

| Component    | Purpose            | Props                      |
| ------------ | ------------------ | -------------------------- |
| `AuthorCard` | Author attribution | **`name`** `role?`, `bio?` |
| `Subscribe`  | Subscription CTA   | **`title`** `description?` |

## Enhanced (layout)

| Component         | Purpose              | Props                                                                               |
| ----------------- | -------------------- | ----------------------------------------------------------------------------------- |
| `Callout`         | Admonition box       | `title?`, `tone?: 'note'\|'tip'\|'info'\|'warning'\|'danger'`, `content?`, children |
| `ComparisonTable` | Multi-column compare | **`columns: string[]`**, **`rows: {label, values}[]`** `title?`                     |
| `Definition`      | Term definition      | **`term`**, **`description`**                                                       |
| `ResourceList`    | Resource links       | **`items: {title, url}[]`**                                                         |

## Display

| Component   | Purpose           | Props                                                      |
| ----------- | ----------------- | ---------------------------------------------------------- |
| `Stat`      | Single KPI        | **`label`**, **`value`** `trend?: 'up'\|'down'`, `suffix?` |
| `StatGroup` | Row of Stats      | children                                                   |
| `ProsCons`  | Pros/cons wrapper | children                                                   |
| `Table`     | Data table        | `columns?: (string\|{key,title})[]`, `rows?: array[]`      |
| `TagList`   | Tag chips         | **`tags: string[]`**                                       |

## Context

| Component         | Purpose               | Props               |
| ----------------- | --------------------- | ------------------- |
| `RelatedEntry`    | Link to journal entry | **`path`** `label?` |
| `RelatedIdentity` | Link to identity      | **`path`** `label?` |

## Cards & Lists

| Component   | Purpose         | Props                                            |
| ----------- | --------------- | ------------------------------------------------ |
| `Kanban`    | Kanban board    | **`columns: {title, items: {text, tags?}[]}[]`** |
| `Counter`   | Numeric counter | **`count`**, **`label`**                         |
| `RatingBar` | Star rating     | **`score`** `max?`, `label?`                     |

## Media

| Component     | Purpose            | Props                                  |
| ------------- | ------------------ | -------------------------------------- |
| `ImageViewer` | Image with caption | **`src`** `alt?`, `caption?`, `width?` |
| `FileCard`    | File reference     | **`path`** `label?`                    |

## Charts (lazy)

All share: **`data: {label, value}[]`** `title?`, `color?`

`BarChart` · `LineChart` · `PieChart` · `RadarChart`

## Diagrams & Math

| Component    | Purpose         | Props                          |
| ------------ | --------------- | ------------------------------ |
| `Mermaid`    | Mermaid diagram | `chart?`, `caption?`, children |
| `InlineMath` | Inline KaTeX    | `math?`, children              |
| `BlockMath`  | Block KaTeX     | `math?`, children              |

## Preview

| Component     | Purpose               | Props                                          |
| ------------- | --------------------- | ---------------------------------------------- |
| `HtmlPreview` | Sandboxed HTML iframe | `src?`, `html?`, `title?`, `height?`, children |

## Semantic

| Component           | Purpose               | Props                                                                                           |
| ------------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| `DecisionRecord`    | Decision log (ADR)    | **`question`**, **`decision`** `owner?`, `due?`, `options?: {label, tradeoff?}[]`, `rationale?` |
| `StatusBadge`       | Status pill           | **`status`** `tone?: 'neutral'\|'success'\|'warning'\|'danger'`                                 |
| `ComparisonMatrix`  | Comparison table      | **`columns: string[]`**, **`rows: {label, values: string[]}[]`**                                |
| `RACI`              | Responsibility matrix | **`rows: {work, responsible?, accountable?, consulted?, informed?}[]`**                         |
| `MilestoneTimeline` | Milestone timeline    | **`items: {time, title, desc?}[]`**                                                             |
| `InsightCard`       | Highlighted insight   | **`title`** + children                                                                          |

## Sources

| Component       | Purpose           | Props                                                                          |
| --------------- | ----------------- | ------------------------------------------------------------------------------ |
| `SourceCard`    | Source reference  | **`path`** `label?`, `type?: 'audio'\|'video'\|'file'\|'text'\|'url'`, `note?` |
| `ReferenceList` | Source list       | **`sources: {path, label?, type?, note?}[]`**                                  |
| `CopyButton`    | Copy to clipboard | **`text`** `label?`                                                            |

---

## HtmlPreview Sandbox Preset

Sandboxed iframe injects Journal preset. Use semantic HTML (`main`, `article`, `section`, `h1`-`h4`, `p`, `ul`, `table`, `blockquote`, `button`).

Tabler Icons: `<i class="ti ti-clock" aria-hidden="true"></i>`

| Pattern         | Classes                                                        |
| --------------- | -------------------------------------------------------------- |
| vertical rhythm | `stack`, `j-stack`, `section`, `j-section`, `compact`          |
| horizontal      | `cluster`, `j-cluster`, `toolbar`, `j-toolbar`                 |
| responsive      | `grid`, `j-grid`, `two-col`, `j-two-col`, `split`              |
| framed          | `card`, `j-card`, `surface`, `j-surface`, `raised`             |
| labels          | `badge`, `j-badge`, `tag`, `success`, `warning`, `danger`      |
| notes           | `callout`, `j-callout`, `info`, `success`                      |
| metrics         | `kpi`, `j-kpi`, `kpi-item`, `kpi-value`, `kpi-label`           |
| sequence        | `timeline`, `timeline-item`, `flow`, `flow-node`, `flow-arrow` |
| utilities       | `muted`, `center`, `full-bleed`, `sr-only`                     |

Rules: no CSS reset; unprefixed classes for fragments, `j-` aliases in full docs; Tabler icons (`ti ti-*`); tokens (`--j-bg`, `--j-surface`, `--j-text`, `--j-muted`, `--j-accent`, `--j-border`, `--j-radius`) for custom CSS; scope custom CSS narrowly.

---

## Rule

Markdown table is enough → use Markdown. Use components when they prevent ambiguity, improve evidence review, or stabilize repeated structures.
