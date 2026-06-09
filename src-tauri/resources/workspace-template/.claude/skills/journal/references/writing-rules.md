# Writing Rules

## Summary

- One sentence.
- State the strongest useful conclusion, status, or unresolved tension.
- Avoid generic summaries such as "讨论了项目进展".

## Source Handling

- Preserve raw material paths in frontmatter `sources`.
- On append, merge and deduplicate existing sources.
- In body text, use `SourceCard` or `ReferenceList` only when source traceability is central to the note.

## Uncertainty

- Mark uncertain speaker identity, date, number, or conclusion inline.
- Do not invent missing dates, people, metrics, or decisions.
- Use "待确认" sections for open questions.

## Quotes

- Keep quotes only when they change interpretation or preserve evidence.
- Clean transcription mistakes when meaning is clear.
- Do not preserve filler such as "嗯", "对对对", or repeated false starts.

## Component Restraint

- Markdown headings, lists, and tables should carry most structure.
- Use typed JSX components for visual rhythm, scan hierarchy, comparisons, timelines, steps, verdicts, quotes, resource lists, notices, and final summaries.
- Use 0-5 information-bearing components for ordinary structured notes when stronger hierarchy is useful.
- Complex reports may use more components when each one carries clear information.
- Do not use components for decoration.

## Append Behavior

- Append to same-day same-topic entries.
- Update `summary` after append.
- Preserve prior content unless the new material corrects it with evidence.
