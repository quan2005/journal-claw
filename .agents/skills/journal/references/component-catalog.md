# Component Catalog

## Existing Generic Components

| Group              | Components                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography         | `Section`, `Subtitle`, `Label`, `Divider`                                                                                                                     |
| Layout             | `Split`, `Columns`, `Column`, `Grid`, `Col`, `Flow`, `Stack`                                                                                                  |
| Display            | `Stat`, `StatGroup`, `Table`, `Timeline`, `TagList`, `Progress`, `Avatar`, `AvatarGroup`                                                                      |
| Lists and cards    | `Cards`, `Card`, `Options`, `Option`, `Kanban`, `Checklist`, `Counter`, `RatingBar`                                                                           |
| Context            | `Callout`, `Quote`, `RelatedEntry`, `RelatedIdentity`                                                                                                         |
| Media and diagrams | `AudioCard`, `VideoCard`, `ImageViewer`, `FileCard`, `BarChart`, `LineChart`, `PieChart`, `RadarChart`, `Mermaid` |
| Preview and devices | `HtmlPreview`, `PhonePreview`, `MacPreview` |

## Preview HTML Style Preset

`HtmlPreview` and raw HTML file previews run inside `SandboxPreview`, which injects a Journal preview preset. Prefer semantic HTML first: `main`, `article`, `section`, `h1`-`h4`, `p`, `ul`, `table`, `blockquote`, `button`, and form controls render with readable defaults.

Tabler Icons webfont is preloaded in the sandbox. Use the standard public class syntax for small UI glyphs: `<i class="ti ti-clock" aria-hidden="true"></i>`, `<i class="ti ti-chart-pie" aria-hidden="true"></i>`, `<i class="ti ti-layout-grid" aria-hidden="true"></i>`.

Use preset classes only when structure needs help:

| Pattern | Classes |
|---|---|
| vertical rhythm | `stack`, `j-stack`, `section`, `j-section`, `compact` |
| horizontal grouping | `cluster`, `j-cluster`, `toolbar`, `j-toolbar` |
| responsive layout | `grid`, `j-grid`, `two-col`, `j-two-col`, `split` |
| framed content | `card`, `j-card`, `surface`, `j-surface`, `raised` |
| compact labels | `badge`, `j-badge`, `tag`, `success`, `warning`, `danger` |
| emphasized notes | `callout`, `j-callout`, `info`, `success` |
| metrics | `kpi`, `j-kpi`, `kpi-item`, `kpi-value`, `kpi-label` |
| sequence | `timeline`, `timeline-item`, `flow`, `flow-node`, `flow-arrow` |
| utilities | `muted`, `center`, `full-bleed`, `sr-only` |

Rules for AI-generated HTML:

- Do not emit a full CSS reset, theme palette, or large inline style block for common document/card/table/button styling.
- Use the unprefixed classes for short fragments; use `j-` prefixed aliases inside complete HTML documents when name collisions are possible.
- For icons, prefer Tabler class names (`ti ti-*`) instead of custom icon fonts, emoji, or inline SVG.
- Use Journal tokens when custom CSS is necessary: `--j-bg`, `--j-surface`, `--j-text`, `--j-muted`, `--j-accent`, `--j-border`, `--j-radius`, plus compatibility tokens like `--color-text-secondary`.
- Keep custom CSS scoped to the smallest necessary class or id.

## Semantic Components

| Component                                  | Use when                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `ActionTable`                              | actions have owner, deadline, source, or status                                                 |
| `DecisionRecord`, `DecisionList`           | a note must preserve decision context and tradeoffs                                             |
| `RiskMatrix`                               | risks need likelihood, impact, severity, and mitigation                                         |
| `SourceCard`, `ReferenceList`              | source traceability is important                                                                |
| `Transcript`, `TimestampLink`              | transcript excerpts or media timestamps matter                                                  |
| `CopyButton`                               | exact quotes, prompts, commands, or reusable snippets should be copied without editing the note |
| `InsightCard`, `EvidenceCard`, `QuoteCard` | research, learning, interview, and evidence-heavy notes                                         |
| `ComparisonMatrix`, `OptionMatrix`         | evaluating products, options, competitors, or technical approaches                              |
| `MilestoneTimeline`, `IncidentTimeline`    | project milestones or incidents need sequence                                                   |
| `RACI`                                     | project or operation roles must be explicit                                                     |
| `StatusBadge`                              | compact state labels improve scanning                                                           |

## Rule

If a Markdown table is enough, use Markdown. Use semantic components when they prevent ambiguity, improve evidence review, or make repeated structures more stable.
