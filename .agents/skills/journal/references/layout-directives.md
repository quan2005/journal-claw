# Layout Directives

Use Journal layout directives when a note needs stronger visual hierarchy without JSX. Directives work in both `.md` and `.mdx`, render with JournalClaw's native restrained style, and keep AI-generated notes readable as plain text.

## Selection Rules

- Keep ordinary paragraphs, lists, and Markdown tables as Markdown.
- Treat layout directives as the default structured visual layer for `.mdx` notes before considering JSX components.
- Read this file before `component-recipes.md` whenever the task is document formatting, journal cleanup, topic page writing, or visual hierarchy improvement.
- Use 2-5 directive blocks for an ordinary note; complex reports can use more when each block carries information.
- Use at most one `hero` near the top, and only when the note has a strong main judgment or reading entrance.
- Prefer `verdict`, `metrics`, `timeline`, `steps`, `compare`, `quote`, `faq`, `summary`, and `callout` before reaching for JSX components.
- Use MDX JSX components only for richer semantic objects such as `DecisionRecord`, `ActionTable`, `RiskMatrix`, `ReferenceList`, `Transcript`, charts, and copyable exact snippets.
- Do not invent numbers for `metrics`, sources for `quote`, image paths for image modules, or decisions for `verdict`.
- Do not use directives as decoration. Every block must reduce scanning cost or preserve structure.

## Syntax

Start and end each block with triple-colon fences. The closing fence must be an independent `:::` line.

```md
:::name
body
:::

:::name modifier
body
:::

:::name[Title]
body
:::

:::name modifier[Title]{variant=quiet compact=true}
body
:::
```

Rules:

- `name` must be in the catalog below.
- `modifier` is only supported by modules that list modifiers. `callout` supports `note`, `tip`, `info`, `warning`, and `danger`.
- `[Title]` is optional display text.
- `{attrs}` uses simple `key=value` primitives. Use `variant=...` only when the module lists variants.
- Directive fences inside Markdown code blocks are ignored.
- Do not place JSX tags inside directive bodies.

## Body Formats

### fields

Use named `key: value` lines.

```md
:::hero
eyebrow: 周会复盘
title: 先收敛导入体验，再扩展自动化
subtitle: 现阶段最大风险不是功能不足，而是用户不知道系统正在处理什么。
meta: 2026-06-05
:::
```

### rows

Use one row per line and separate columns with `|`.

```md
:::metrics[关键指标]
导入失败率 | 3.2% | 主要来自 PDF 与长音频
平均等待 | 6 分钟 | 用户缺少进度反馈
下周目标 | 1 个入口 | 先统一处理状态
:::
```

### json_object

Use valid JSON object syntax.

```md
:::definition
{
"term": "Layout directive",
"description": "用 Markdown container block 描述稳定排版模块，而不是让 AI 写 JSX。"
}
:::
```

### json_array

Use valid JSON array syntax.

```md
:::resource-list[参考]
[
{ "title": "MDX 运行时", "url": "topics/mdx-support-manual/01-runtime-and-syntax.mdx" },
{ "title": "组件选择", "url": "topics/mdx-support-manual/05-component-selection.mdx" }
]
:::
```

## Catalog

| Category    | Modules                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Opening     | `hero`, `toc`, `cards`, `part`, `label-title`                                                                            |
| Infographic | `metrics`, `compare`, `steps`, `timeline`, `infographic`                                                                 |
| Judgment    | `verdict`, `audience-fit`, `myth-fact`, `manifesto`, `bridge`                                                            |
| Evidence    | `quote`, `image-text`, `image-compare`, `image-annotate`, `image-steps`                                                  |
| Conversion  | `cta`, `faq`, `checklist`, `cases`, `summary`, `notice`, `logos`, `pricing`, `specs`, `toolbox`                          |
| Brand       | `author-card`, `subscribe`, `people`, `series`                                                                           |
| Enhanced    | `callout`, `definition`, `quote-card`, `tweet`, `stat-row`, `question`, `resource-list`, `comparison-table`, `changelog` |

## Module Formats

| Module             | Format      | Minimum content columns or keys |
| ------------------ | ----------- | ------------------------------- |
| `hero`             | fields      | `title`                         |
| `toc`              | rows        | `label`, `title`                |
| `cards`            | rows        | `title`, `description`          |
| `part`             | fields      | `title`                         |
| `label-title`      | fields      | `title`                         |
| `metrics`          | rows        | `label`, `value`, `description` |
| `compare`          | rows        | `item`, `left`, `right`         |
| `steps`            | rows        | `title`, `description`          |
| `timeline`         | rows        | `time`, `title`                 |
| `infographic`      | fields      | `title`                         |
| `verdict`          | fields      | `title`                         |
| `audience-fit`     | rows        | `audience`, `fit`               |
| `myth-fact`        | rows        | `myth`, `fact`                  |
| `manifesto`        | rows        | `principle`                     |
| `bridge`           | fields      | `from`, `to`                    |
| `quote`            | fields      | `text`                          |
| `image-text`       | fields      | `image`                         |
| `image-compare`    | fields      | `before`, `after`               |
| `image-annotate`   | json_object | valid object                    |
| `image-steps`      | json_array  | valid array                     |
| `cta`              | fields      | `title`                         |
| `faq`              | rows        | `question`, `answer`            |
| `checklist`        | rows        | `item`                          |
| `cases`            | rows        | `case`, `result`                |
| `summary`          | fields      | `title`                         |
| `notice`           | fields      | `text`                          |
| `logos`            | rows        | `name`                          |
| `pricing`          | rows        | `plan`, `price`, `note`         |
| `specs`            | rows        | `name`, `value`                 |
| `toolbox`          | rows        | `tool`, `use`                   |
| `author-card`      | fields      | `name`                          |
| `subscribe`        | fields      | `title`                         |
| `people`           | rows        | `name`, `role`                  |
| `series`           | rows        | `title`, `status`               |
| `callout`          | rows        | `content`                       |
| `definition`       | json_object | valid object                    |
| `quote-card`       | fields      | `quote`                         |
| `tweet`            | fields      | `text`                          |
| `stat-row`         | json_array  | valid array                     |
| `question`         | fields      | `text`                          |
| `resource-list`    | json_array  | valid array                     |
| `comparison-table` | json_object | valid object                    |
| `changelog`        | json_array  | valid array                     |

## Recommended Patterns

| Note type        | Useful directive sequence                                                            |
| ---------------- | ------------------------------------------------------------------------------------ |
| Meeting decision | `hero` -> `verdict` -> `people` -> `timeline` or `steps` -> `checklist` -> `summary` |
| Weekly report    | `hero` -> `metrics` -> `timeline` -> `checklist` -> `notice` or `summary`            |
| Research brief   | `hero` -> `verdict` -> `metrics` -> `compare` -> `quote` -> `resource-list`          |
| Technical design | `hero` -> `bridge` -> `specs` -> `steps` -> `callout warning` -> `summary`           |
| Content outline  | `hero` -> `audience-fit` -> `cards` -> `faq` -> `cta`                                |
| Learning note    | `hero` -> `definition` -> `myth-fact` -> `question` -> `resource-list`               |

## Common Failures

- Missing closing `:::`. This turns the rest of the note into a failed block.
- Writing `:::callout urgent`. Use only `note`, `tip`, `info`, `warning`, or `danger`.
- Using too few row columns, such as `metrics` with only `label | value`. Add the description column.
- Using non-JSON bodies for `definition`, `resource-list`, `comparison-table`, `stat-row`, `changelog`, `image-annotate`, or `image-steps`.
- Writing a decorative `hero` for routine daily notes. Use a normal heading or `label-title` instead.
- Using `metrics` without real measurements. Use `cards`, `checklist`, or `summary` for qualitative information.
