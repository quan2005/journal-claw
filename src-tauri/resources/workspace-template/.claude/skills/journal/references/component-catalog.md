# Component Catalog

## Existing Generic Components

| Group              | Components                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography         | `Section`, `Subtitle`, `Label`, `Divider`                                                                                                                     |
| Layout             | `Split`, `Columns`, `Column`, `Grid`, `Col`, `Flow`, `Stack`                                                                                                  |
| Display            | `Stat`, `StatGroup`, `Table`, `Timeline`, `TagList`, `Progress`, `Avatar`, `AvatarGroup`                                                                      |
| Lists and cards    | `Cards`, `Card`, `Options`, `Option`, `Kanban`, `Checklist`, `Counter`, `RatingBar`                                                                           |
| Context            | `Callout`, `Quote`, `RelatedEntry`, `RelatedIdentity`                                                                                                         |
| Media and diagrams | `AudioCard`, `VideoCard`, `ImageViewer`, `FileCard`, `BarChart`, `LineChart`, `PieChart`, `RadarChart`, `Mermaid`, `CanvasDiagram`, `Phone`, `DeviceShowcase` |

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
