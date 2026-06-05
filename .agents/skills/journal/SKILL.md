---
name: journal
description: '统一笔记整理 skill。用户提交录音、粘贴文本、文件、网页素材、会议纪要、读书笔记、研究材料、工作汇报、技术记录、个人复盘，或说写日志/整理成日志/帮我记一下/记录一下时触发。先识别笔记家族和子类型，再按需加载 references 中的模板与组件规则，生成高质量 .mdx 日志。'
---

# Journal Skill

## Contract

| Field      | Rule                                                                                   |
| ---------- | -------------------------------------------------------------------------------------- |
| reads      | `yyMM/raw/*`, existing `yyMM/*.mdx`, `identity/*.md`, `todos.md` when relevant         |
| writes     | `yyMM/*.mdx`; `identity/*.md` only after loading `/identity-profiling`                 |
| format     | Markdown-first `.mdx` with YAML frontmatter; layout directives before JSX              |
| references | load only the registry and the relevant family/template/example/layout/component files |

## Output Format Priority

Default to a JournalClaw-renderable `.mdx` document for durable notes, meeting minutes, research briefs, technical records, manuals, and topic pages.

1. Markdown first: use normal headings, paragraphs, lists, tables, and code fences for ordinary structure.
2. Layout directives second: when the note needs a stronger reading entrance, comparison, timeline, steps, verdict, quote, resource list, notice, or final summary, read `references/layout-directives.md` and use directive blocks.
3. MDX JSX last: read `references/component-recipes.md` only when a semantic component carries information the directive catalog cannot express, such as decision records, action tables, risk matrices, source traceability, transcripts, charts, or copyable exact text.

Ordinary notes usually need 2-5 information-bearing directive blocks. Do not use layout directives or JSX as decoration.

## Required Flow

1. Read the submitted material and identify time, people, products, topics, evidence, decisions, actions, risks, and uncertainty.
2. Read `references/template-registry.md`.
3. Classify exactly one primary family and one subtype. If uncertain, choose the closest family and mark uncertainty in the note.
4. Load the relevant `references/templates/{family}.md`.
5. When available, load only the matching `references/template-examples/{family}/{subtype}.mdx` as the concrete structure reference.
6. Load `references/writing-rules.md` for source, quote, summary, uncertainty, and append rules.
7. Load `references/layout-directives.md` when the note needs stronger visual hierarchy, comparisons, timelines, decisions, evidence blocks, or end summaries. Prefer layout directives before JSX components.
8. Load `references/component-recipes.md` only when semantic MDX components improve clarity beyond layout directives.
9. Create or append a `.mdx` entry. On append, merge `sources` and update `summary`.
10. Load `/identity-profiling` before creating or editing identity files.

Template example rule:

- Use `template-examples` as ready-to-use structure, fields, components, expert calibration, and quality checks.
- Do not copy the example frontmatter literally. Replace `tags`, `summary`, and `sources` with the actual note metadata.
- Load only the exact `{family}/{subtype}.mdx` example unless comparing neighboring subtypes is necessary.

## Families

| Family                | Reference                                       |
| --------------------- | ----------------------------------------------- |
| meeting-collaboration | `references/templates/meeting-collaboration.md` |
| work-reports          | `references/templates/work-reports.md`          |
| project-docs          | `references/templates/project-docs.md`          |
| research-analysis     | `references/templates/research-analysis.md`     |
| learning-notes        | `references/templates/learning-notes.md`        |
| personal-journal      | `references/templates/personal-journal.md`      |
| technical-docs        | `references/templates/technical-docs.md`        |
| content-creation      | `references/templates/content-creation.md`      |
| hr-operations         | `references/templates/hr-operations.md`         |

## Frontmatter

```yaml
---
tags: [journal]
summary: 结论先行的一句话摘要
sources: [2605/raw/source.txt]
---
```

Rules:

- `summary` must state a concrete conclusion or useful state, not "讨论了若干问题".
- `tags` should be 1-4 tags. The first tag should usually be `journal`.
- `sources` must list raw material paths and merge existing values when appending.

## Component Boundary

Use Markdown first. Use layout directives for repeatable document rhythm. Use MDX components only when they make dense information easier to scan or verify beyond what directives can express.

Allowed component interactions are read-only: collapse, copy, jump, source expansion, and audio/video timestamp seek.

Forbidden:

- editable form controls
- embedded AI action buttons
- mutating todos or note state from MDX components
- decorative component use
