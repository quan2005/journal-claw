# Journal Template and Component v2 Design

## Context

JournalClaw already supports `.mdx` journal entries and a first generation MDX component library. The current system also has separate note-writing guidance in `/journal` and meeting-specific guidance in `/meeting-minutes`.

The v2 goal is not to add a template picker UI. It is to make the built-in AI writer better: when the user submits recordings, pasted text, files, or prompts, the AI should identify the note type, load the right template family, use a small set of high-value MDX components, and produce a stable, high-quality journal entry.

Current repository observations:

- `src/components/mdx/` already contains a broad first generation component set: layout, typography, display, cards, media, charts, Mermaid, canvas diagrams, devices, grid, and flow.
- `src-tauri/resources/workspace-template/.claude/skills/journal/SKILL.md` exists, and `.claude/CLAUDE.md` tells the AI to use `/journal`.
- `src-tauri/src/ai_processor.rs` currently installs `meeting-minutes` but does not install `journal`. This mismatch must be fixed as part of v2.
- `meeting-minutes` currently owns four useful meeting templates: argumentation chain, progress tracking, knowledge distillation, and alignment.
- The supplied template taxonomy covers 9 note families and 61 subtypes. v2 should treat all 9 families as first-class.

## Confirmed Decisions

1. v2 uses template-component co-design. Each note family defines templates and drives only the components it needs.
2. `/journal` becomes the single built-in note-writing skill for all note types.
3. `/meeting-minutes` is hard-deleted. Its templates migrate into `/journal` as the meeting collaboration family.
4. The system is AI-first. No template picker UI is included in v2.
5. The template model is family-based: 9 families, each with 2-5 core templates and subtype variants.
6. All 9 taxonomy families are first-class, including personal life notes.
7. Components use a mixed strategy: keep existing generic components, add semantic components only for high-frequency, error-prone, or high-value structures.
8. MDX components may have read-only light interactions: collapse, copy, jump, source expansion, and audio/video timestamp seek.
9. MDX components must not mutate note content, update todos, store per-component state in files, or trigger embedded AI operations.
10. Verification must cover both AI template selection and component rendering.

## Goals

- Improve AI-generated note quality across meeting, work, project, research, learning, personal, technical, content, and operations scenarios.
- Keep `/journal/SKILL.md` short enough to load cheaply while making rich templates available through references.
- Reduce template drift by using family templates plus variants instead of 61 fully independent templates.
- Give the AI stable semantic components for decisions, actions, risks, sources, evidence, comparisons, timelines, and transcripts.
- Preserve JournalClaw's reading-oriented product posture: quiet, precise, low-decoration, and optimized for review rather than creation.

## Non-Goals

- No user-facing template picker or template management UI in v2.
- No editable MDX form controls such as `TextField`, `DatePicker`, `TagPicker`, `PersonPicker`, or `PrioritySelect`.
- No embedded AI action components such as `AIRewrite`, `AIExtractActions`, `AIFlashcards`, or `AIBacklinkSuggest`.
- No wholesale replacement of existing Markdown rendering or existing MDX components.
- No one-off component that serves only a single low-frequency subtype.

## Skill Architecture

`/journal` should become a router plus a reference library.

```text
.claude/skills/journal/
  SKILL.md
  references/
    template-registry.md
    component-catalog.md
    component-recipes.md
    writing-rules.md
    templates/
      meeting-collaboration.md
      work-reports.md
      project-docs.md
      research-analysis.md
      learning-notes.md
      personal-journal.md
      technical-docs.md
      content-creation.md
      hr-operations.md
    examples/
      meeting-decision.mdx
      weekly-report.mdx
      prd-review.mdx
      deep-reading.mdx
      incident-review.mdx
      personal-review.mdx
```

`SKILL.md` responsibilities:

- Declare the `/journal` contract: reads raw materials and identity files, writes `.mdx` journal entries, updates sources on append.
- Define the classification flow.
- Tell the AI to read `template-registry.md` first, then load only the relevant family file.
- Tell the AI to load `component-recipes.md` only when a semantic component is useful.
- Keep a compact quick index of supported components and note families.
- State hard boundaries: no invented facts, no decorative component use, no editable MDX controls.

Reference file responsibilities:

- `template-registry.md`: maps note family, subtype, recognition signals, core template, and reference file.
- `component-catalog.md`: lists supported MDX components, props, safe usage, and aliases.
- `component-recipes.md`: explains common compositions, such as decision review, action extraction, research evidence, and incident timeline.
- `writing-rules.md`: reusable writing standards for summary quality, sources, uncertainty, quotes, tags, append behavior, and component restraint.
- `templates/*.md`: family-specific templates and variants.

## Template Model

Each family file should share the same structure:

```text
# Family Name

## Recognition Signals
## Core Templates
## Subtype Variants
## Recommended Components
## Output Skeletons
## Quality Rules
## Example Fragments
```

Core templates are complete structures. Variants are delta instructions: field additions, field removals, emphasis changes, and recommended component changes. This keeps coverage broad while avoiding 61 duplicated templates.

### Family Coverage

| Family                | Core templates                                                                               | Variants covered                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Meeting collaboration | General meeting, decision/review, progress sync, interview/1:1, retrospective/incident       | Daily standup, requirement review, technical review, design review, strategic decision, 1:1, customer visit, brainstorm, training share |
| Work reports          | Daily report, weekly report, monthly/quarterly report, OKR tracking, project progress report | Status report, performance review, executive summary, risk-focused report                                                               |
| Project docs          | Project plan, PRD, technical proposal, release checklist, project retrospective              | Charter, user story, requirement pool, roadmap, test plan, milestone plan, changelog                                                    |
| Research analysis     | Market research, competitor analysis, data analysis, user research, risk assessment          | SWOT, feasibility analysis, experiment report, business analysis                                                                        |
| Learning notes        | Deep reading, book note, paper note, course/video note, knowledge card                       | Cornell note, Feynman note, concept explanation, problem solving, literature matrix, learning plan, flashcard                           |
| Personal journal      | Daily journal, review journal, goal/OKR, decision journal, personal plan                     | Morning/evening journal, emotion log, habit tracking, travel plan, purchase decision, family affairs                                    |
| Technical docs        | Technical design, API doc, debug record, incident RCA, RFC/architecture doc                  | Deployment runbook, code review record, code snippet note, migration guide                                                              |
| Content creation      | Article draft, talk/PPT outline, social content plan, product copy, interview record         | Press release, announcement, speaker notes, newsletter brief                                                                            |
| HR and operations     | Interview record, performance review, SOP, event plan, customer profile, KPI tracking        | Recruiting pipeline, customer success follow-up, support ticket, partner communication                                                  |

### Meeting Migration

The current `/meeting-minutes` templates map into `/journal/references/templates/meeting-collaboration.md`:

- `argumentation-chain.md` becomes the decision/review core template.
- `progress-tracking.md` becomes the progress sync core template.
- `knowledge-distillation.md` becomes the training share / lecture variant under meeting collaboration and the course/video variant under learning notes.
- `alignment.md` becomes the general alignment and small meeting template.

After migration, `/meeting-minutes` should not appear in available skills, and existing installed copies should be removed on startup.

## Component Strategy

Existing generic components remain the base layer:

- Typography: `Section`, `Subtitle`, `Label`, `Divider`
- Layout: `Split`, `Columns`, `Column`, `Grid`, `Col`, `Flow`, `Stack`
- Display: `Stat`, `StatGroup`, `Table`, `Timeline`, `TagList`, `Progress`, `Avatar`, `AvatarGroup`
- Cards and lists: `Cards`, `Card`, `Options`, `Option`, `Kanban`, `Checklist`, `Counter`, `RatingBar`
- Context: `Callout`, `Quote`, `RelatedEntry`, `RelatedIdentity`
- Media and diagrams: `AudioCard`, `VideoCard`, `ImageViewer`, `FileCard`, `BarChart`, `LineChart`, `PieChart`, `RadarChart`, `Mermaid`, `CanvasDiagram`, `Phone`, `DeviceShowcase`

New semantic components should be added only when they satisfy at least one criterion:

- Used by at least two note families.
- Used by a high-frequency note type.
- Prevents recurring malformed or low-quality AI output.
- Improves readability of long evidence, action, source, or decision sections.

### Priority Components

| Component                                    | Purpose                                               | Primary families                                              |
| -------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| `ActionTable`                                | Action, owner, due date, source, status               | Meeting, work reports, project docs, HR operations            |
| `DecisionRecord` / `DecisionList`            | Problem, options, tradeoffs, final decision, owner    | Meeting, project docs, technical docs, personal decisions     |
| `RiskMatrix`                                 | Risk, likelihood, impact, severity, mitigation        | Work reports, project docs, research, technical docs          |
| `SourceCard` / `ReferenceList`               | Source materials, URLs, files, recordings, confidence | All families                                                  |
| `Transcript` / `TimestampLink`               | Readable transcript excerpts and media seek links     | Meeting, learning, content creation, customer/user interviews |
| `InsightCard` / `EvidenceCard` / `QuoteCard` | Separate insight, evidence, and source quote          | Research, learning, content, interviews                       |
| `ComparisonMatrix` / `OptionMatrix`          | Structured comparison and option evaluation           | Research, project, technical, personal purchase/decision      |
| `MilestoneTimeline` / `IncidentTimeline`     | Project milestone and incident sequence               | Project docs, technical docs, operations                      |
| `RACI`                                       | Responsible, accountable, consulted, informed         | Project docs, HR operations                                   |
| `StatusBadge`                                | Compact semantic state label                          | Work reports, project docs, HR operations                     |

### Light Interaction Rules

Allowed interactions:

- Collapse and expand long transcript, evidence, source, or appendix sections.
- Copy quote, code, table row, or source path.
- Jump to related entry, identity, file, or heading.
- Seek audio or video to a timestamp.
- Expand source context without modifying content.

Forbidden interactions:

- Editing note text or frontmatter.
- Checking off tasks or changing todo status.
- Triggering AI operations from inside an MDX component.
- Persisting component UI state to the journal file.

## AI Workflow

The `/journal` execution flow should be:

```text
Read material
→ Extract time, people, products, topics, decisions, actions, evidence, uncertainty
→ Load /journal if not already loaded
→ Read template-registry.md
→ Classify family and subtype
→ Load templates/{family}.md
→ Load component-recipes.md only when semantic components improve clarity
→ Decide whether to append or create a new .mdx entry
→ Write Markdown-first content with selected MDX components
→ Update frontmatter summary, tags, and sources
→ Load /identity-profiling only if identity files need changes
```

Classification must prefer specific signals over keyword matching. For example:

- Multiple speakers plus decisions or action items should route to meeting collaboration.
- Numeric progress, blockers, and next plans should route to work reports or project docs depending on whether the material is periodic or project-specific.
- Arguments, evidence, citations, and findings should route to research analysis or learning notes depending on source type.
- Logs, environment details, commands, stack traces, and root cause language should route to technical docs.
- Feelings, personal goals, habits, travel, or purchase comparison should route to personal journal.

If classification is uncertain, the AI should pick the closest family, label uncertainty in the note, and avoid fabricating missing fields.

## Installation and Migration

Resource template changes:

- Add `/journal` installation constants and write logic in `src-tauri/src/ai_processor.rs`.
- Install `/journal/SKILL.md`, `references/`, `references/templates/`, and `references/examples/`.
- Remove `/meeting-minutes` include constants and write logic.
- Delete `src-tauri/resources/workspace-template/.claude/skills/meeting-minutes/`.
- Update `src-tauri/resources/workspace-template/.claude/CLAUDE.md` to mention only `/journal` for note writing.
- Mirror built-in skill changes in `.agents/skills/` for repository-local agent work.

Migration behavior:

- On startup, `ensure_workspace_dot_claude` should remove `.claude/skills/meeting-minutes`.
- Existing user journal entries are not rewritten.
- Existing `.mdx` component APIs should remain compatible.
- User-owned workspace files outside `.claude/` must not be overwritten.

## Testing and Verification

### Unit and Build Checks

- `npm test`
- `npm run build`
- `cd src-tauri && cargo test`

Rust tests should cover:

- `/journal` skill is installed by `ensure_workspace_dot_claude`.
- `/meeting-minutes` directory is removed by startup initialization.
- Skill reference files are present in the generated workspace template.

Frontend tests should cover:

- New semantic components render with minimal props.
- Empty data, long text, and invalid optional fields degrade cleanly.
- Light interactions work without mutating journal content.
- Existing MDX components still render.

### AI Template Selection Replay

Prepare sample raw materials for all 9 families. For each sample, verify:

- Correct family and subtype are selected.
- Only relevant reference files are loaded.
- Summary is substantive and not generic.
- Sources are preserved.
- Components are useful, not decorative.
- Uncertainty is visible when source material is incomplete.

### Component Showcase

Create a v2 showcase `.mdx` entry that exercises:

- All new semantic components.
- Long transcript/evidence collapse.
- Copyable quote/source/code affordances.
- Timestamp seek links.
- Deep and light themes.
- Narrow and wide viewport layouts.
- Empty and error states where applicable.

Use Playwright or the in-app browser to inspect screenshots for overlap, illegible text, excessive color, and component crowding.

## Implementation Phases

1. **Spec and plan**: finalize this design, then create a step-by-step implementation plan.
2. **Skill consolidation**: install `/journal`, migrate meeting templates, delete `/meeting-minutes`, update `.claude/CLAUDE.md`.
3. **Template v2**: create registry, writing rules, 9 family files, variants, and examples.
4. **Component v2 foundation**: implement high-priority semantic components and shared interaction helpers.
5. **Component recipes**: document when to use new semantic components versus existing generic components.
6. **AI workflow tuning**: update `/journal/SKILL.md` routing and reference-loading protocol.
7. **Migration tests**: verify workspace initialization installs and cleans the right skills.
8. **Rendering verification**: build showcase and inspect screenshots across themes and widths.
9. **AI replay verification**: run representative sample materials through the built-in agent path and review outputs.

## Risks and Mitigations

| Risk                                                  | Mitigation                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Template library becomes too large for every prompt   | Keep `SKILL.md` compact and require progressive reference loading                           |
| AI overuses components                                | Put Markdown-first rules in `writing-rules.md` and family templates                         |
| New semantic components duplicate existing components | Require each new component to map to repeated template needs                                |
| Meeting migration breaks old behavior                 | Preserve the four current meeting structures inside journal before deleting meeting-minutes |
| Personal templates dilute professional positioning    | Keep visual treatment restrained and reuse the same source/action/evidence discipline       |
| Light interactions become hidden editing features     | Forbid any component file mutation, todo mutation, or AI operation trigger                  |

## Acceptance Criteria

- `/journal` is installed into generated workspaces and appears as the note-writing skill.
- `/meeting-minutes` is no longer installed and existing installed copies are removed on startup.
- `/journal` references include a registry, component catalog, component recipes, writing rules, and all 9 family template files.
- All 9 note families are first-class and have core templates plus subtype variants.
- New semantic components cover actions, decisions, risks, sources, transcripts, evidence, comparisons, milestones/incidents, RACI, and status.
- Existing MDX entries and existing components remain compatible.
- Sample replay confirms family/subtype selection across all 9 families.
- Showcase rendering confirms new components are readable in dark and light themes and at narrow and wide widths.
