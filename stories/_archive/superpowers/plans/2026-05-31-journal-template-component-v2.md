# Journal Template Component v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate JournalClaw's note-writing intelligence into one `/journal` skill with broad template coverage, semantic read-only MDX components, and verification for both AI template selection and rendering quality.

**Architecture:** `/journal` becomes the single router skill and progressively loads reference files for template families and component recipes. Existing MDX components remain the foundation; new semantic components cover repeated structures such as actions, decisions, risks, sources, transcripts, evidence, comparisons, RACI, and status. `/meeting-minutes` is migrated into the journal meeting family and removed from generated workspaces.

**Tech Stack:** Tauri v2, Rust workspace template installation, React 19, TypeScript, Vitest, MDX runtime via existing Rust `mdxjs` compilation, CSS in `src/styles/mdx.css`.

---

## File Structure

Create or modify these files:

- Modify `src-tauri/src/ai_processor.rs`: install `/journal` references, stop installing `/meeting-minutes`, and clean stale meeting-minutes directories during startup.
- Modify `src-tauri/resources/workspace-template/.claude/CLAUDE.md`: mention `/journal` as the only note-writing skill.
- Modify `src-tauri/resources/workspace-template/.claude/skills/journal/SKILL.md`: turn it into a compact router that loads references.
- Delete `src-tauri/resources/workspace-template/.claude/skills/meeting-minutes/**`: old skill source.
- Create `src-tauri/resources/workspace-template/.claude/skills/journal/references/template-registry.md`: family and subtype routing map.
- Create `src-tauri/resources/workspace-template/.claude/skills/journal/references/writing-rules.md`: shared writing rules.
- Create `src-tauri/resources/workspace-template/.claude/skills/journal/references/component-catalog.md`: component catalog.
- Create `src-tauri/resources/workspace-template/.claude/skills/journal/references/component-recipes.md`: component usage recipes.
- Create `src-tauri/resources/workspace-template/.claude/skills/journal/references/templates/*.md`: 9 family template guides.
- Create `src-tauri/resources/workspace-template/.claude/skills/journal/references/examples/*.mdx`: sample outputs.
- Mirror the journal skill tree under `.agents/skills/journal/**` and delete `.agents/skills/meeting-minutes/**`.
- Create `src/components/mdx/semantic.tsx`: semantic display components.
- Create `src/components/mdx/source.tsx`: sources, references, transcripts, and timestamp links.
- Modify `src/components/mdx/index.ts`: export new components and add them to `mdxComponents`.
- Modify `src/components/MdxRenderer.tsx`: handle timestamp seek and copy affordance click events.
- Modify `src/styles/mdx.css`: add semantic component and light-interaction styles.
- Create `src/tests/MdxSemanticComponents.test.tsx`: frontend component tests.
- Modify `src/tests/MdxRenderer.test.tsx`: add timestamp seek/copy event tests.
- Create `docs/superpowers/examples/journal-v2-showcase.mdx`: rendering showcase.
- Create `docs/superpowers/examples/journal-v2-replay-samples.md`: AI replay sample prompts.

---

### Task 1: Add Rust tests for journal skill install and meeting-minutes cleanup

**Files:**

- Modify: `src-tauri/src/ai_processor.rs`

- [ ] **Step 1: Write the failing test**

In `src-tauri/src/ai_processor.rs`, inside the existing `#[cfg(test)] mod tests`, add this test after `ensure_workspace_dot_claude_creates_structure`:

```rust
    #[cfg(unix)]
    #[test]
    fn ensure_workspace_dot_claude_installs_journal_and_removes_meeting_minutes() {
        let tmp = std::env::temp_dir().join("journal_dot_claude_skill_v2_test");
        std::fs::create_dir_all(&tmp).unwrap();
        let dot_claude = tmp.join(".claude");
        let stale_meeting = dot_claude.join("skills").join("meeting-minutes");
        std::fs::create_dir_all(&stale_meeting).unwrap();
        std::fs::write(stale_meeting.join("SKILL.md"), "old meeting skill").unwrap();

        ensure_workspace_dot_claude(tmp.to_str().unwrap());

        let journal_dir = dot_claude.join("skills").join("journal");
        assert!(journal_dir.join("SKILL.md").exists(), "journal skill should be installed");
        assert!(
            journal_dir.join("references").join("template-registry.md").exists(),
            "journal registry should be installed"
        );
        assert!(
            journal_dir
                .join("references")
                .join("templates")
                .join("meeting-collaboration.md")
                .exists(),
            "meeting templates should live under journal references"
        );
        assert!(
            !stale_meeting.exists(),
            "old meeting-minutes skill should be removed during workspace initialization"
        );

        std::fs::remove_dir_all(&tmp).ok();
    }
```

- [ ] **Step 2: Run the failing Rust test**

Run:

```bash
cd src-tauri && cargo test ensure_workspace_dot_claude_installs_journal_and_removes_meeting_minutes
```

Expected: FAIL because `template-registry.md` is not installed and stale `meeting-minutes` is not removed.

- [ ] **Step 3: Commit the failing test**

```bash
git add src-tauri/src/ai_processor.rs
git commit -m "test: cover journal skill installation"
```

---

### Task 2: Install journal reference files and remove meeting-minutes startup installation

**Files:**

- Modify: `src-tauri/src/ai_processor.rs`
- Delete: `src-tauri/resources/workspace-template/.claude/skills/meeting-minutes/SKILL.md`
- Delete: `src-tauri/resources/workspace-template/.claude/skills/meeting-minutes/references/templates/alignment.md`
- Delete: `src-tauri/resources/workspace-template/.claude/skills/meeting-minutes/references/templates/argumentation-chain.md`
- Delete: `src-tauri/resources/workspace-template/.claude/skills/meeting-minutes/references/templates/knowledge-distillation.md`
- Delete: `src-tauri/resources/workspace-template/.claude/skills/meeting-minutes/references/templates/progress-tracking.md`

- [ ] **Step 1: Add journal constants and reusable skill writer**

In `src-tauri/src/ai_processor.rs`, after the identity-profiling constants and before the old meeting-minutes constants, add:

```rust
// ── Journal skill template ─────────────────────
const SKILL_JOURNAL_MD: &str =
    include_str!("../resources/workspace-template/.claude/skills/journal/SKILL.md");
const SKILL_JOURNAL_REFERENCE_FILES: &[(&str, &str)] = &[
    (
        "references/template-registry.md",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/template-registry.md"),
    ),
    (
        "references/writing-rules.md",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/writing-rules.md"),
    ),
    (
        "references/component-catalog.md",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/component-catalog.md"),
    ),
    (
        "references/component-recipes.md",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/component-recipes.md"),
    ),
    (
        "references/templates/meeting-collaboration.md",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/templates/meeting-collaboration.md"),
    ),
    (
        "references/templates/work-reports.md",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/templates/work-reports.md"),
    ),
    (
        "references/templates/project-docs.md",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/templates/project-docs.md"),
    ),
    (
        "references/templates/research-analysis.md",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/templates/research-analysis.md"),
    ),
    (
        "references/templates/learning-notes.md",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/templates/learning-notes.md"),
    ),
    (
        "references/templates/personal-journal.md",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/templates/personal-journal.md"),
    ),
    (
        "references/templates/technical-docs.md",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/templates/technical-docs.md"),
    ),
    (
        "references/templates/content-creation.md",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/templates/content-creation.md"),
    ),
    (
        "references/templates/hr-operations.md",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/templates/hr-operations.md"),
    ),
    (
        "references/examples/meeting-decision.mdx",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/examples/meeting-decision.mdx"),
    ),
    (
        "references/examples/weekly-report.mdx",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/examples/weekly-report.mdx"),
    ),
    (
        "references/examples/prd-review.mdx",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/examples/prd-review.mdx"),
    ),
    (
        "references/examples/deep-reading.mdx",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/examples/deep-reading.mdx"),
    ),
    (
        "references/examples/incident-review.mdx",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/examples/incident-review.mdx"),
    ),
    (
        "references/examples/personal-review.mdx",
        include_str!("../resources/workspace-template/.claude/skills/journal/references/examples/personal-review.mdx"),
    ),
];
```

Then add this helper below the constants and before `ensure_workspace_dot_claude`:

```rust
fn write_embedded_skill_tree(skill_dir: &std::path::Path, skill_md: &str, files: &[(&str, &str)]) {
    if let Err(e) = std::fs::create_dir_all(skill_dir) {
        eprintln!(
            "[ai_processor] warn: failed to create skill dir {}: {}",
            skill_dir.display(),
            e
        );
        return;
    }

    let _ = std::fs::write(skill_dir.join("SKILL.md"), skill_md);
    for (relative_path, content) in files {
        let target = skill_dir.join(relative_path);
        if let Some(parent) = target.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::write(target, content);
    }
}
```

- [ ] **Step 2: Remove old meeting-minutes constants**

Delete the full block that starts with:

```rust
// ── Meeting Minutes skill template ─────────────
const SKILL_MEETING_MINUTES_MD: &str =
```

and ends after:

```rust
const SKILL_MEETING_MINUTES_PROGRESS: &str = include_str!(
    "../resources/workspace-template/.claude/skills/meeting-minutes/references/templates/progress-tracking.md"
);
```

- [ ] **Step 3: Install journal and remove stale meeting-minutes**

In `ensure_workspace_dot_claude`, after the identity-profiling block and before the lint block, replace the whole `// ── Meeting Minutes skill template` block with:

```rust
    // ── Journal skill template ─────────────────────
    let journal_dir = dot_claude.join("skills").join("journal");
    write_embedded_skill_tree(&journal_dir, SKILL_JOURNAL_MD, SKILL_JOURNAL_REFERENCE_FILES);

    // Meeting minutes was merged into /journal in v2. Remove stale installed copies.
    let old_meeting_dir = dot_claude.join("skills").join("meeting-minutes");
    if old_meeting_dir.exists() {
        let _ = std::fs::remove_dir_all(&old_meeting_dir);
    }
```

- [ ] **Step 4: Delete old meeting-minutes resource files**

Run:

```bash
rm -rf src-tauri/resources/workspace-template/.claude/skills/meeting-minutes
```

Expected: directory no longer exists.

- [ ] **Step 5: Run Rust test**

Run:

```bash
cd src-tauri && cargo test ensure_workspace_dot_claude_installs_journal_and_removes_meeting_minutes
```

Expected: PASS after journal reference files are created in Task 3. If it fails at this point because reference files are not created yet, leave the failure and continue to Task 3 before committing this task.

- [ ] **Step 6: Commit**

Commit only after Task 3 files exist and the test passes:

```bash
git add src-tauri/src/ai_processor.rs src-tauri/resources/workspace-template/.claude/skills
git commit -m "feat: install journal skill references"
```

---

### Task 3: Create journal router skill and shared references

**Files:**

- Modify: `src-tauri/resources/workspace-template/.claude/skills/journal/SKILL.md`
- Create: `src-tauri/resources/workspace-template/.claude/skills/journal/references/template-registry.md`
- Create: `src-tauri/resources/workspace-template/.claude/skills/journal/references/writing-rules.md`
- Create: `src-tauri/resources/workspace-template/.claude/skills/journal/references/component-catalog.md`
- Create: `src-tauri/resources/workspace-template/.claude/skills/journal/references/component-recipes.md`

- [ ] **Step 1: Replace journal SKILL.md with router content**

Replace `src-tauri/resources/workspace-template/.claude/skills/journal/SKILL.md` with:

````markdown
---
name: journal
description: '统一笔记整理 skill。用户提交录音、粘贴文本、文件、网页素材、会议纪要、读书笔记、研究材料、工作汇报、技术记录、个人复盘，或说写日志/整理成日志/帮我记一下/记录一下时触发。先识别笔记家族和子类型，再按需加载 references 中的模板与组件规则，生成高质量 .mdx 日志。'
---

# Journal Skill

## Contract

| Field      | Rule                                                                           |
| ---------- | ------------------------------------------------------------------------------ |
| reads      | `yyMM/raw/*`, existing `yyMM/*.mdx`, `identity/*.md`, `todos.md` when relevant |
| writes     | `yyMM/*.mdx`; `identity/*.md` only after loading `/identity-profiling`         |
| format     | Markdown-first `.mdx` with YAML frontmatter                                    |
| references | load only the registry and the relevant family/template/component files        |

## Required Flow

1. Read the submitted material and identify time, people, products, topics, evidence, decisions, actions, risks, and uncertainty.
2. Read `references/template-registry.md`.
3. Classify exactly one primary family and one subtype. If uncertain, choose the closest family and mark uncertainty in the note.
4. Load the relevant `references/templates/{family}.md`.
5. Load `references/writing-rules.md` for source, quote, summary, uncertainty, and append rules.
6. Load `references/component-recipes.md` only when semantic components improve clarity.
7. Create or append a `.mdx` entry. On append, merge `sources` and update `summary`.
8. Load `/identity-profiling` before creating or editing identity files.

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
````

Rules:

- `summary` must state a concrete conclusion or useful state, not "讨论了若干问题".
- `tags` should be 1-4 tags. The first tag should usually be `journal`.
- `sources` must list raw material paths and merge existing values when appending.

## Component Boundary

Use Markdown first. Use MDX components only when they make dense information easier to scan or verify.

Allowed component interactions are read-only: collapse, copy, jump, source expansion, and audio/video timestamp seek.

Forbidden:

- editable form controls
- embedded AI action buttons
- mutating todos or note state from MDX components
- decorative component use

````

- [ ] **Step 2: Create template registry**

Create `src-tauri/resources/workspace-template/.claude/skills/journal/references/template-registry.md` with this exact table:

```markdown
# Template Registry

Use this registry before loading a family template. Pick one primary family and one subtype.

| Family | Subtypes | Recognition signals | Reference |
|---|---|---|---|
| meeting-collaboration | general-meeting, decision-review, progress-sync, interview-1on1, retrospective, incident-review, brainstorm, training-share | multiple speakers, agenda, discussion, disagreement, decisions, action items, meeting transcript | `templates/meeting-collaboration.md` |
| work-reports | daily-report, weekly-report, monthly-report, quarterly-report, okr-tracking, status-report, performance-review, project-progress | periodic work summary, completed work, blockers, metrics, next plan, OKR/KPI language | `templates/work-reports.md` |
| project-docs | project-plan, charter, prd, user-story, requirement-pool, technical-proposal, test-plan, release-checklist, roadmap, milestone-plan, changelog, project-retrospective | project scope, requirements, milestones, owners, dependencies, release, product planning | `templates/project-docs.md` |
| research-analysis | market-research, competitor-analysis, data-analysis, swot, user-research, feasibility, risk-assessment, experiment-report, business-analysis | research question, findings, data, evidence, user sample, market, competitor, hypothesis | `templates/research-analysis.md` |
| learning-notes | deep-reading, book-note, paper-note, course-video-note, knowledge-card, cornell-note, feynman-note, concept-explanation, problem-solving, literature-matrix, learning-plan, flashcard | source-based learning, author/speaker, concept, theorem, paper, course, chapter, examples | `templates/learning-notes.md` |
| personal-journal | daily-journal, emotion-log, goal-okr, review-journal, decision-journal, habit-tracking, travel-plan, purchase-decision, family-affairs | personal reflection, mood, habits, travel, buying decision, family matter, personal goal | `templates/personal-journal.md` |
| technical-docs | technical-design, api-doc, debug-record, architecture-doc, incident-rca, rfc, deployment-runbook, code-review, code-snippet, migration-guide | API, architecture, logs, commands, stack traces, root cause, RFC, deployment, review | `templates/technical-docs.md` |
| content-creation | article-draft, talk-outline, social-plan, product-copy, press-release, announcement, interview-record, speaker-notes, newsletter-brief | draft, audience, message, outline, copy, publishing, interview, announcement | `templates/content-creation.md` |
| hr-operations | recruiting-interview, performance-review, event-plan, sop, customer-profile, kpi-tracking, support-ticket, partner-communication, customer-success | candidate, performance, operation process, SOP, customer status, KPI, ticket, partner | `templates/hr-operations.md` |

Classification rules:

- Prefer the material's job-to-be-done over surface keywords.
- If a meeting produces a technical decision, primary family stays `meeting-collaboration` unless the output should be a standalone technical design.
- If a document is both project and report, choose `work-reports` for periodic status and `project-docs` for durable project specification.
- If a learning note contains personal reflection, choose `learning-notes` unless the main purpose is a personal review.
````

- [ ] **Step 3: Create writing rules**

Create `src-tauri/resources/workspace-template/.claude/skills/journal/references/writing-rules.md`:

```markdown
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
- Use 1-3 components for ordinary notes.
- Complex reports may use more components when each one carries clear information.
- Do not use components for decoration.

## Append Behavior

- Append to same-day same-topic entries.
- Update `summary` after append.
- Preserve prior content unless the new material corrects it with evidence.
```

- [ ] **Step 4: Create component catalog**

Create `src-tauri/resources/workspace-template/.claude/skills/journal/references/component-catalog.md` with:

```markdown
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

| Component                                  | Use when                                                           |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `ActionTable`                              | actions have owner, deadline, source, or status                    |
| `DecisionRecord`, `DecisionList`           | a note must preserve decision context and tradeoffs                |
| `RiskMatrix`                               | risks need likelihood, impact, severity, and mitigation            |
| `SourceCard`, `ReferenceList`              | source traceability is important                                   |
| `Transcript`, `TimestampLink`              | transcript excerpts or media timestamps matter                     |
| `InsightCard`, `EvidenceCard`, `QuoteCard` | research, learning, interview, and evidence-heavy notes            |
| `ComparisonMatrix`, `OptionMatrix`         | evaluating products, options, competitors, or technical approaches |
| `MilestoneTimeline`, `IncidentTimeline`    | project milestones or incidents need sequence                      |
| `RACI`                                     | project or operation roles must be explicit                        |
| `StatusBadge`                              | compact state labels improve scanning                              |

## Rule

If a Markdown table is enough, use Markdown. Use semantic components when they prevent ambiguity, improve evidence review, or make repeated structures more stable.
```

- [ ] **Step 5: Create component recipes**

Create `src-tauri/resources/workspace-template/.claude/skills/journal/references/component-recipes.md`:

````markdown
# Component Recipes

## Decision Review

Use:

```mdx
<DecisionRecord
  question="是否采用方案 B"
  decision="先采用方案 B 做两周试点"
  owner="张三"
  due="下周五"
  options={[
    { label: '方案 A', tradeoff: '成本低，但无法覆盖企业客户权限' },
    { label: '方案 B', tradeoff: '实现更重，但能支撑后续审计需求' },
  ]}
  rationale="企业客户审计需求已经进入本季度目标，短期实现成本可以接受。"
/>
```
````

## Action Extraction

Use `ActionTable` only when there are at least two actions or owner/deadline/source fields matter.

```mdx
<ActionTable
  items={[
    { action: '补齐权限边界说明', owner: '李四', due: '周三', status: 'open', source: '需求评审' },
  ]}
/>
```

## Research Evidence

Use `EvidenceCard` for source-backed facts and `InsightCard` for interpretation.

```mdx
<EvidenceCard title="用户流失集中在导入阶段" source="用户访谈 03">
  5 位受访者中有 3 位提到首次导入材料时不知道系统处理进度。
</EvidenceCard>
```

## Incident Review

Use `IncidentTimeline` plus `RiskMatrix`.

```mdx
<IncidentTimeline
  items={[{ time: '10:12', title: '告警触发', impact: '导入任务排队时间超过 10 分钟' }]}
/>
```

## Source Traceability

Use `ReferenceList` near the end when a note relies on multiple sources.

```mdx
<ReferenceList
  sources={[
    { path: '2605/raw/meeting.m4a', label: '会议录音', type: 'audio' },
    { path: '2605/raw/notes.txt', label: '粘贴文本', type: 'text' },
  ]}
/>
```

````

- [ ] **Step 6: Run Rust test again**

Run:

```bash
cd src-tauri && cargo test ensure_workspace_dot_claude_installs_journal_and_removes_meeting_minutes
````

Expected: PASS after Tasks 2 and 3 are complete.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/resources/workspace-template/.claude/skills/journal src-tauri/src/ai_processor.rs
git commit -m "feat: add journal skill reference library"
```

---

### Task 4: Create the 9 family template files and examples

**Files:**

- Create: `src-tauri/resources/workspace-template/.claude/skills/journal/references/templates/meeting-collaboration.md`
- Create: `src-tauri/resources/workspace-template/.claude/skills/journal/references/templates/work-reports.md`
- Create: `src-tauri/resources/workspace-template/.claude/skills/journal/references/templates/project-docs.md`
- Create: `src-tauri/resources/workspace-template/.claude/skills/journal/references/templates/research-analysis.md`
- Create: `src-tauri/resources/workspace-template/.claude/skills/journal/references/templates/learning-notes.md`
- Create: `src-tauri/resources/workspace-template/.claude/skills/journal/references/templates/personal-journal.md`
- Create: `src-tauri/resources/workspace-template/.claude/skills/journal/references/templates/technical-docs.md`
- Create: `src-tauri/resources/workspace-template/.claude/skills/journal/references/templates/content-creation.md`
- Create: `src-tauri/resources/workspace-template/.claude/skills/journal/references/templates/hr-operations.md`
- Create: six files under `src-tauri/resources/workspace-template/.claude/skills/journal/references/examples/`

- [ ] **Step 1: Create `meeting-collaboration.md`**

Use the current meeting templates as source material:

- Move the core guidance from `.agents/skills/meeting-minutes/references/templates/argumentation-chain.md` into core template `decision-review`.
- Move `.agents/skills/meeting-minutes/references/templates/progress-tracking.md` into core template `progress-sync`.
- Move `.agents/skills/meeting-minutes/references/templates/alignment.md` into core template `general-meeting`.
- Move `.agents/skills/meeting-minutes/references/templates/knowledge-distillation.md` into variant `training-share`.

The resulting file must contain these sections:

```markdown
# Meeting Collaboration Templates

## Recognition Signals

- Multiple speakers, agenda, alignment, disagreement, decisions, action items, transcript-like material.
- Use this family for meeting outputs even when the subject is product, design, technical, customer, or HR, unless the user explicitly asks for a standalone specification document.

## Core Templates

### general-meeting

Fields: background, participants, agenda, discussion by topic, aligned items, unresolved items, actions.
Recommended components: `ActionTable`, `DecisionList`, `ReferenceList`.

### decision-review

Fields: question, disagreement, positions, key evidence, turning point, decision, stability, actions.
Recommended components: `DecisionRecord`, `OptionMatrix`, `ActionTable`, `QuoteCard`.

### progress-sync

Fields: progress summary, status changes, blockers, next plan, actions, risk board.
Recommended components: `ActionTable`, `RiskMatrix`, `StatusBadge`, `StatGroup`.

### interview-1on1

Fields: person context, needs, pain points, quotes, signals, follow-up.
Recommended components: `QuoteCard`, `EvidenceCard`, `ActionTable`.

### retrospective-incident

Fields: goal, actual result, timeline, cause, impact, lessons, fixes.
Recommended components: `IncidentTimeline`, `RiskMatrix`, `ActionTable`.

## Subtype Variants

| Subtype            | Apply changes                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------ |
| daily-standup      | Use progress-sync; compress discussion; focus status changes and blockers                  |
| requirement-review | Use decision-review; add requirement background, acceptance criteria, changed requirements |
| technical-review   | Use decision-review; add constraints, architecture options, migration risk                 |
| design-review      | Use decision-review; add design goal, feedback themes, screenshots when present            |
| strategic-decision | Use decision-review; emphasize resource allocation, decision stability, hidden risks       |
| customer-visit     | Use interview-1on1; add customer profile, objections, buying signals                       |
| brainstorm         | Use general-meeting; group ideas by theme and mark selected next experiments               |
| training-share     | Use learning style; extract concepts, examples, questions, and transferable methods        |

## Quality Rules

- Preserve disagreement and unresolved issues.
- Keep at most three quotes per topic.
- Do not include filler utterances.
- Mark speaker uncertainty clearly.
```

- [ ] **Step 2: Create the remaining eight family files**

Create each file with the same section contract: `Recognition Signals`, `Core Templates`, `Subtype Variants`, `Quality Rules`.

Use these exact family/core mappings:

```markdown
# Work Reports Templates

Core templates: daily-report, weekly-report, monthly-quarterly-report, okr-tracking, project-progress.
Variants: status-report, performance-review, executive-summary, risk-focused-report.
Recommended components: `StatGroup`, `Progress`, `ActionTable`, `RiskMatrix`, `StatusBadge`.

# Project Docs Templates

Core templates: project-plan, prd, technical-proposal, release-checklist, project-retrospective.
Variants: charter, user-story, requirement-pool, roadmap, test-plan, milestone-plan, changelog.
Recommended components: `MilestoneTimeline`, `RACI`, `DecisionList`, `RiskMatrix`, `ActionTable`.

# Research Analysis Templates

Core templates: market-research, competitor-analysis, data-analysis, user-research, risk-assessment.
Variants: swot, feasibility-analysis, experiment-report, business-analysis.
Recommended components: `InsightCard`, `EvidenceCard`, `ComparisonMatrix`, `RiskMatrix`, `BarChart`, `LineChart`.

# Learning Notes Templates

Core templates: deep-reading, book-note, paper-note, course-video-note, knowledge-card.
Variants: cornell-note, feynman-note, concept-explanation, problem-solving, literature-matrix, learning-plan, flashcard.
Recommended components: `QuoteCard`, `InsightCard`, `EvidenceCard`, `Transcript`, `ReferenceList`.

# Personal Journal Templates

Core templates: daily-journal, review-journal, goal-okr, decision-journal, personal-plan.
Variants: morning-journal, evening-journal, emotion-log, habit-tracking, travel-plan, purchase-decision, family-affairs.
Recommended components: `DecisionRecord`, `ComparisonMatrix`, `Progress`, `Checklist`, `ActionTable`.

# Technical Docs Templates

Core templates: technical-design, api-doc, debug-record, incident-rca, rfc-architecture.
Variants: deployment-runbook, code-review, code-snippet, migration-guide.
Recommended components: `DecisionRecord`, `IncidentTimeline`, `RiskMatrix`, `SourceCard`, `Mermaid`, `CanvasDiagram`.

# Content Creation Templates

Core templates: article-draft, talk-ppt-outline, social-content-plan, product-copy, interview-record.
Variants: press-release, announcement, speaker-notes, newsletter-brief.
Recommended components: `QuoteCard`, `ReferenceList`, `Checklist`, `Timeline`, `InsightCard`.

# HR Operations Templates

Core templates: recruiting-interview, performance-review, sop, event-plan, customer-profile, kpi-tracking.
Variants: support-ticket, partner-communication, customer-success-followup.
Recommended components: `RACI`, `StatusBadge`, `ActionTable`, `RiskMatrix`, `EvidenceCard`.
```

For each core template, include these four lines:

```markdown
Fields: primary sections for this template.
Recommended components: component list from the family mapping.
Use when: concrete trigger signals.
Avoid when: neighboring family that should take precedence.
```

- [ ] **Step 3: Create example MDX files**

Create these six files with short but valid examples:

```text
src-tauri/resources/workspace-template/.claude/skills/journal/references/examples/meeting-decision.mdx
src-tauri/resources/workspace-template/.claude/skills/journal/references/examples/weekly-report.mdx
src-tauri/resources/workspace-template/.claude/skills/journal/references/examples/prd-review.mdx
src-tauri/resources/workspace-template/.claude/skills/journal/references/examples/deep-reading.mdx
src-tauri/resources/workspace-template/.claude/skills/journal/references/examples/incident-review.mdx
src-tauri/resources/workspace-template/.claude/skills/journal/references/examples/personal-review.mdx
```

Each example must include frontmatter, one `#` heading, at least one semantic component, and a `sources` field.

Use this minimal pattern for `meeting-decision.mdx`:

```mdx
---
tags: [journal, meeting]
summary: 团队决定先以方案 B 做两周试点，因为审计需求比短期实现成本更关键。
sources: [2605/raw/product-review.txt]
---

# 产品权限评审

<DecisionRecord
  question="权限模型是否进入本轮迭代"
  decision="采用方案 B 做两周试点"
  owner="张三"
  due="下周五"
  options={[
    { label: '方案 A', tradeoff: '实现快，但无法覆盖企业审计' },
    { label: '方案 B', tradeoff: '实现更重，但能支撑审计需求' },
  ]}
  rationale="企业客户审计需求已经进入本季度目标，试点可以控制风险。"
/>
```

- [ ] **Step 4: Verify resource files are referenced by Rust includes**

Run:

```bash
cd src-tauri && cargo test ensure_workspace_dot_claude_installs_journal_and_removes_meeting_minutes
```

Expected: PASS and no `include_str!` missing-file compiler error.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/resources/workspace-template/.claude/skills/journal src-tauri/src/ai_processor.rs
git commit -m "feat: add journal template families"
```

---

### Task 5: Mirror built-in journal skill into repo-local `.agents` and update prompt rules

**Files:**

- Modify: `.agents/skills/journal/**`
- Delete: `.agents/skills/meeting-minutes/**`
- Modify: `src-tauri/resources/workspace-template/.claude/CLAUDE.md`

- [ ] **Step 1: Mirror the resource journal skill into `.agents`**

Run:

```bash
rm -rf .agents/skills/journal
cp -R src-tauri/resources/workspace-template/.claude/skills/journal .agents/skills/journal
rm -rf .agents/skills/meeting-minutes
```

Expected:

```bash
test -f .agents/skills/journal/SKILL.md
test -f .agents/skills/journal/references/template-registry.md
test ! -e .agents/skills/meeting-minutes
```

- [ ] **Step 2: Update `.claude/CLAUDE.md` skill trigger text**

In `src-tauri/resources/workspace-template/.claude/CLAUDE.md`, replace:

```markdown
`/journal` 定义日志格式、MDX 语法和全部自定义组件用法。写日志前应加载。
`/meeting-minutes` 会议类素材（录音转写、会议纪要、飞书妙记等）使用此技能整理。`/meeting-minutes` 已内置 `/journal`。
```

with:

```markdown
`/journal` 是唯一的笔记整理 skill，覆盖会议、汇报、项目、研究、学习、个人、技术、内容、人事运营等素材。写日志或整理素材前应加载，并按需读取其 `references/` 中的模板家族与组件规则。
```

- [ ] **Step 3: Remove stale meeting-minutes references**

Run:

```bash
rg -n "meeting-minutes|会议纪要整理" src-tauri/resources/workspace-template .agents src-tauri/src
```

Expected: no matches except in deleted-file diffs before commit. If a match remains in docs or tests that intentionally describes migration history, leave it only outside runtime resources.

- [ ] **Step 4: Run Rust tests**

```bash
cd src-tauri && cargo test ensure_workspace_dot_claude_installs_journal_and_removes_meeting_minutes
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .agents/skills src-tauri/resources/workspace-template/.claude/CLAUDE.md src-tauri/resources/workspace-template/.claude/skills src-tauri/src/ai_processor.rs
git commit -m "refactor: merge meeting minutes into journal skill"
```

---

### Task 6: Add tests for semantic MDX components

**Files:**

- Create: `src/tests/MdxSemanticComponents.test.tsx`

- [ ] **Step 1: Create failing component tests**

Create `src/tests/MdxSemanticComponents.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  ActionTable,
  DecisionRecord,
  RiskMatrix,
  StatusBadge,
  RACI,
  ComparisonMatrix,
  InsightCard,
  EvidenceCard,
} from '../components/mdx'
import { ReferenceList, Transcript, TimestampLink } from '../components/mdx'

describe('semantic MDX components', () => {
  it('renders actions with owner, due date, source, and status', () => {
    render(
      <ActionTable
        items={[
          { action: '补齐权限说明', owner: '张三', due: '周三', source: '评审会', status: 'open' },
        ]}
      />,
    )

    expect(screen.getByText('补齐权限说明')).toBeTruthy()
    expect(screen.getByText('张三')).toBeTruthy()
    expect(screen.getByText('周三')).toBeTruthy()
    expect(screen.getByText('评审会')).toBeTruthy()
    expect(screen.getByText('open')).toBeTruthy()
  })

  it('renders a decision record with options and rationale', () => {
    render(
      <DecisionRecord
        question="是否采用方案 B"
        decision="先做两周试点"
        owner="李四"
        due="下周五"
        options={[
          { label: '方案 A', tradeoff: '快，但审计不足' },
          { label: '方案 B', tradeoff: '慢，但覆盖审计' },
        ]}
        rationale="企业客户审计需求优先。"
      />,
    )

    expect(screen.getByText('是否采用方案 B')).toBeTruthy()
    expect(screen.getByText('先做两周试点')).toBeTruthy()
    expect(screen.getByText('企业客户审计需求优先。')).toBeTruthy()
  })

  it('renders risk matrix and status badge', () => {
    render(
      <>
        <StatusBadge status="blocked" />
        <RiskMatrix
          risks={[
            { risk: '上线延期', likelihood: 'medium', impact: 'high', mitigation: '缩小首版范围' },
          ]}
        />
      </>,
    )

    expect(screen.getByText('blocked')).toBeTruthy()
    expect(screen.getByText('上线延期')).toBeTruthy()
    expect(screen.getByText('缩小首版范围')).toBeTruthy()
  })

  it('renders RACI and comparison matrices', () => {
    render(
      <>
        <RACI
          rows={[
            {
              work: '发布审批',
              responsible: '张三',
              accountable: '李四',
              consulted: '王五',
              informed: '团队',
            },
          ]}
        />
        <ComparisonMatrix
          columns={['价格', '风险']}
          rows={[
            { label: '方案 A', values: ['低', '高'] },
            { label: '方案 B', values: ['中', '低'] },
          ]}
        />
      </>,
    )

    expect(screen.getByText('发布审批')).toBeTruthy()
    expect(screen.getByText('方案 B')).toBeTruthy()
  })

  it('renders insight and evidence cards', () => {
    render(
      <>
        <InsightCard title="导入进度需要更明确">用户关注处理是否卡住。</InsightCard>
        <EvidenceCard title="访谈证据" source="用户访谈 03">
          3 位用户提到导入反馈不足。
        </EvidenceCard>
      </>,
    )

    expect(screen.getByText('导入进度需要更明确')).toBeTruthy()
    expect(screen.getByText('用户访谈 03')).toBeTruthy()
  })

  it('renders references, transcript, and timestamp links', () => {
    render(
      <>
        <ReferenceList
          sources={[{ path: '2605/raw/meeting.m4a', label: '会议录音', type: 'audio' }]}
        />
        <Transcript items={[{ speaker: '张三', time: '00:12', text: '这里需要先试点。' }]} />
        <TimestampLink src="2605/raw/meeting.m4a" time="00:12">
          跳到 00:12
        </TimestampLink>
      </>,
    )

    expect(screen.getByText('会议录音')).toBeTruthy()
    expect(screen.getByText('张三')).toBeTruthy()
    expect(screen.getByText('这里需要先试点。')).toBeTruthy()
    expect(screen.getByText('跳到 00:12')).toBeTruthy()
  })

  it('allows transcript details to expand and collapse', () => {
    render(
      <Transcript items={[{ speaker: '张三', time: '00:12', text: '长转写内容' }]} collapsible />,
    )
    const details = screen.getByText('转写片段').closest('details')
    expect(details?.hasAttribute('open')).toBe(false)
    fireEvent.click(screen.getByText('转写片段'))
    expect(details?.hasAttribute('open')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
npx vitest run src/tests/MdxSemanticComponents.test.tsx
```

Expected: FAIL because the new components are not exported yet.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/tests/MdxSemanticComponents.test.tsx
git commit -m "test: cover journal v2 semantic components"
```

---

### Task 7: Implement semantic display components

**Files:**

- Create: `src/components/mdx/semantic.tsx`
- Modify: `src/components/mdx/index.ts`
- Modify: `src/styles/mdx.css`

- [ ] **Step 1: Create `semantic.tsx`**

Create `src/components/mdx/semantic.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Table } from './display'

export type ActionStatus = 'open' | 'doing' | 'blocked' | 'done' | string

export interface ActionItem {
  action: string
  owner?: string
  due?: string
  source?: string
  status?: ActionStatus
}

export function StatusBadge({
  status,
  tone = 'neutral',
}: {
  status: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  return <span className={`mdx-status-badge mdx-status-badge--${tone}`}>{status}</span>
}

export function ActionTable({ items }: { items: ActionItem[] }) {
  return (
    <Table
      headers={['行动', '负责人', '截止', '来源', '状态']}
      rows={items.map((item) => [
        item.action,
        item.owner ?? '待确认',
        item.due ?? '待确认',
        item.source ?? '',
        item.status ?? 'open',
      ])}
    />
  )
}

export interface DecisionOption {
  label: string
  tradeoff?: string
}

export function DecisionRecord({
  question,
  decision,
  owner,
  due,
  options = [],
  rationale,
}: {
  question: string
  decision: string
  owner?: string
  due?: string
  options?: DecisionOption[]
  rationale?: string
}) {
  return (
    <section className="mdx-decision-record">
      <div className="mdx-decision-question">{question}</div>
      <div className="mdx-decision-answer">{decision}</div>
      {(owner || due) && (
        <div className="mdx-decision-meta">
          {owner && <span>负责人: {owner}</span>}
          {due && <span>截止: {due}</span>}
        </div>
      )}
      {options.length > 0 && (
        <div className="mdx-decision-options">
          {options.map((option) => (
            <div key={option.label} className="mdx-decision-option">
              <strong>{option.label}</strong>
              {option.tradeoff && <span>{option.tradeoff}</span>}
            </div>
          ))}
        </div>
      )}
      {rationale && <p className="mdx-decision-rationale">{rationale}</p>}
    </section>
  )
}

export function DecisionList({
  decisions,
}: {
  decisions: React.ComponentProps<typeof DecisionRecord>[]
}) {
  return (
    <div className="mdx-decision-list">
      {decisions.map((decision, index) => (
        <DecisionRecord key={`${decision.question}-${index}`} {...decision} />
      ))}
    </div>
  )
}

export interface RiskItem {
  risk: string
  likelihood?: string
  impact?: string
  severity?: string
  mitigation?: string
}

export function RiskMatrix({ risks }: { risks: RiskItem[] }) {
  return (
    <Table
      headers={['风险', '概率', '影响', '严重度', '应对']}
      rows={risks.map((risk) => [
        risk.risk,
        risk.likelihood ?? '待评估',
        risk.impact ?? '待评估',
        risk.severity ?? '',
        risk.mitigation ?? '待确认',
      ])}
    />
  )
}

export function ComparisonMatrix({
  columns,
  rows,
}: {
  columns: string[]
  rows: { label: string; values: string[] }[]
}) {
  return (
    <Table
      headers={['对象', ...columns]}
      rows={rows.map((row) => [row.label, ...columns.map((_, index) => row.values[index] ?? '')])}
    />
  )
}

export const OptionMatrix = ComparisonMatrix

export function RACI({
  rows,
}: {
  rows: {
    work: string
    responsible?: string
    accountable?: string
    consulted?: string
    informed?: string
  }[]
}) {
  return (
    <Table
      headers={['事项', 'R', 'A', 'C', 'I']}
      rows={rows.map((row) => [
        row.work,
        row.responsible ?? '',
        row.accountable ?? '',
        row.consulted ?? '',
        row.informed ?? '',
      ])}
    />
  )
}

export function MilestoneTimeline({
  items,
}: {
  items: { time: string; title: string; desc?: string }[]
}) {
  return (
    <div className="mdx-semantic-timeline">
      {items.map((item) => (
        <div key={`${item.time}-${item.title}`} className="mdx-semantic-timeline-item">
          <span>{item.time}</span>
          <strong>{item.title}</strong>
          {item.desc && <p>{item.desc}</p>}
        </div>
      ))}
    </div>
  )
}

export function IncidentTimeline({
  items,
}: {
  items: { time: string; title: string; impact?: string; desc?: string }[]
}) {
  return (
    <div className="mdx-semantic-timeline mdx-incident-timeline">
      {items.map((item) => (
        <div key={`${item.time}-${item.title}`} className="mdx-semantic-timeline-item">
          <span>{item.time}</span>
          <strong>{item.title}</strong>
          {item.impact && <p>影响: {item.impact}</p>}
          {item.desc && <p>{item.desc}</p>}
        </div>
      ))}
    </div>
  )
}

function SemanticCard({
  className,
  title,
  meta,
  children,
}: {
  className: string
  title: string
  meta?: string
  children: ReactNode
}) {
  return (
    <aside className={`mdx-semantic-card ${className}`}>
      <div className="mdx-semantic-card-title">{title}</div>
      {meta && <div className="mdx-semantic-card-meta">{meta}</div>}
      <div className="mdx-semantic-card-body">{children}</div>
    </aside>
  )
}

export function InsightCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SemanticCard className="mdx-insight-card" title={title}>
      {children}
    </SemanticCard>
  )
}

export function EvidenceCard({
  title,
  source,
  children,
}: {
  title: string
  source?: string
  children: ReactNode
}) {
  return (
    <SemanticCard className="mdx-evidence-card" title={title} meta={source}>
      {children}
    </SemanticCard>
  )
}

export function QuoteCard({ quote, source }: { quote: string; source?: string }) {
  return (
    <SemanticCard className="mdx-quote-card" title="引用" meta={source}>
      <blockquote>{quote}</blockquote>
    </SemanticCard>
  )
}
```

- [ ] **Step 2: Export semantic components**

In `src/components/mdx/index.ts`, add:

```ts
export {
  ActionTable,
  DecisionRecord,
  DecisionList,
  RiskMatrix,
  StatusBadge,
  ComparisonMatrix,
  OptionMatrix,
  RACI,
  MilestoneTimeline,
  IncidentTimeline,
  InsightCard,
  EvidenceCard,
  QuoteCard,
} from './semantic'
```

Then import them into the component map:

```ts
import {
  ActionTable,
  DecisionRecord,
  DecisionList,
  RiskMatrix,
  StatusBadge,
  ComparisonMatrix,
  OptionMatrix,
  RACI,
  MilestoneTimeline,
  IncidentTimeline,
  InsightCard,
  EvidenceCard,
  QuoteCard,
} from './semantic'
```

Add these names to `mdxComponents`.

- [ ] **Step 3: Add semantic CSS**

Append to `src/styles/mdx.css`:

```css
.mdx-status-badge {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 2px 7px;
  border: 1px solid var(--mdx-border);
  border-radius: 4px;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  background: var(--mdx-surface);
}
.mdx-status-badge--success {
  color: var(--status-success);
}
.mdx-status-badge--warning {
  color: var(--status-warning);
}
.mdx-status-badge--danger {
  color: var(--status-danger);
}

.mdx-decision-record,
.mdx-semantic-card {
  margin: var(--space-5) 0;
  padding: var(--space-4);
  border: 1px solid var(--mdx-border);
  border-radius: var(--mdx-radius);
  background: var(--mdx-surface);
}
.mdx-decision-question,
.mdx-semantic-card-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--item-text);
}
.mdx-decision-answer {
  margin-top: var(--space-2);
  color: var(--mdx-accent);
  font-weight: var(--font-medium);
}
.mdx-decision-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-2);
  color: var(--text-secondary);
  font-size: var(--text-xs);
}
.mdx-decision-options {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
.mdx-decision-option {
  display: grid;
  gap: 2px;
  padding: var(--space-2) var(--space-3);
  border-left: 2px solid var(--mdx-border);
  background: var(--mdx-surface-muted);
}
.mdx-decision-option span,
.mdx-decision-rationale,
.mdx-semantic-card-body {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: 1.7;
}
.mdx-decision-list {
  display: grid;
  gap: var(--space-3);
}
.mdx-semantic-card-meta {
  margin-top: var(--space-1);
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}
.mdx-semantic-timeline {
  display: grid;
  gap: var(--space-3);
  margin: var(--space-5) 0;
  border-left: 1px solid var(--mdx-border);
  padding-left: var(--space-4);
}
.mdx-semantic-timeline-item {
  display: grid;
  gap: 2px;
}
.mdx-semantic-timeline-item span {
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}
.mdx-semantic-timeline-item strong {
  color: var(--item-text);
  font-size: var(--text-sm);
}
.mdx-semantic-timeline-item p {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-sm);
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/tests/MdxSemanticComponents.test.tsx
```

Expected: tests for semantic components pass except source/transcript tests, which pass after Task 8.

- [ ] **Step 5: Commit**

Commit after Task 8 if source/transcript tests still fail. If all tests in this file pass now, commit:

```bash
git add src/components/mdx/semantic.tsx src/components/mdx/index.ts src/styles/mdx.css src/tests/MdxSemanticComponents.test.tsx
git commit -m "feat: add semantic MDX components"
```

---

### Task 8: Implement source, transcript, timestamp, and copy interactions

**Files:**

- Create: `src/components/mdx/source.tsx`
- Modify: `src/components/mdx/index.ts`
- Modify: `src/components/MdxRenderer.tsx`
- Modify: `src/styles/mdx.css`
- Modify: `src/tests/MdxRenderer.test.tsx`

- [ ] **Step 1: Create `source.tsx`**

Create `src/components/mdx/source.tsx`:

```tsx
import type { ReactNode } from 'react'

export interface ReferenceSource {
  path: string
  label?: string
  type?: 'audio' | 'video' | 'file' | 'text' | 'url' | string
  note?: string
}

export function SourceCard({ path, label, type = 'file', note }: ReferenceSource) {
  const isUrl = /^https?:\/\//i.test(path)
  const attrs = isUrl ? { href: path } : { 'data-filepath': path }
  return (
    <a className="mdx-source-card" {...attrs}>
      <span className="mdx-source-type">{type}</span>
      <span className="mdx-source-label">{label ?? path}</span>
      {note && <span className="mdx-source-note">{note}</span>}
    </a>
  )
}

export function ReferenceList({ sources }: { sources: ReferenceSource[] }) {
  return (
    <div className="mdx-reference-list">
      {sources.map((source) => (
        <SourceCard key={`${source.path}-${source.label ?? ''}`} {...source} />
      ))}
    </div>
  )
}

export function TimestampLink({
  src,
  time,
  children,
}: {
  src: string
  time: string | number
  children?: ReactNode
}) {
  return (
    <a className="mdx-timestamp-link" data-media-src={src} data-media-time={time}>
      {children ?? String(time)}
    </a>
  )
}

export interface TranscriptItem {
  speaker?: string
  time?: string
  text: string
  src?: string
}

export function Transcript({
  items,
  collapsible = false,
  title = '转写片段',
}: {
  items: TranscriptItem[]
  collapsible?: boolean
  title?: string
}) {
  const body = (
    <div className="mdx-transcript-body">
      {items.map((item, index) => (
        <div key={`${item.time ?? index}-${item.speaker ?? ''}`} className="mdx-transcript-item">
          <div className="mdx-transcript-meta">
            {item.speaker && <span>{item.speaker}</span>}
            {item.time && item.src ? (
              <TimestampLink src={item.src} time={item.time}>
                {item.time}
              </TimestampLink>
            ) : item.time ? (
              <span>{item.time}</span>
            ) : null}
          </div>
          <p>{item.text}</p>
        </div>
      ))}
    </div>
  )

  if (collapsible) {
    return (
      <details className="mdx-transcript">
        <summary>{title}</summary>
        {body}
      </details>
    )
  }

  return (
    <section className="mdx-transcript">
      <div className="mdx-transcript-title">{title}</div>
      {body}
    </section>
  )
}
```

- [ ] **Step 2: Export source components**

In `src/components/mdx/index.ts`, add:

```ts
export { SourceCard, ReferenceList, Transcript, TimestampLink } from './source'
```

Import these components and add them to `mdxComponents`:

```ts
import { SourceCard, ReferenceList, Transcript, TimestampLink } from './source'
```

- [ ] **Step 3: Add timestamp handling to `MdxRenderer`**

In `MdxRenderer.tsx`, inside `handleClick`, immediately after the `if (!anchor) return` line, add:

```tsx
const mediaSrc = anchor.getAttribute('data-media-src')
const mediaTime = anchor.getAttribute('data-media-time')
if (mediaSrc && mediaTime) {
  e.preventDefault()
  const seconds = parseMediaTime(mediaTime)
  const media = document.querySelector<HTMLMediaElement>(
    `audio[src="${CSS.escape(mediaSrc)}"], video[src="${CSS.escape(mediaSrc)}"]`,
  )
  if (media) {
    media.currentTime = seconds
    void media.play().catch(() => undefined)
  }
  window.dispatchEvent(
    new CustomEvent('mdx-media-seek', {
      detail: { src: mediaSrc, time: mediaTime, seconds },
    }),
  )
  return
}
```

Add this helper above the component:

```tsx
function parseMediaTime(value: string): number {
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value)
  const parts = value.split(':').map((part) => Number(part))
  if (parts.some((part) => Number.isNaN(part))) return 0
  return parts.reduce((total, part) => total * 60 + part, 0)
}
```

In `src/tests/setup.ts`, ensure `CSS.escape` exists by extending the CSS mock:

```ts
    escape: (value: string) => value.replace(/"/g, '\\"'),
```

- [ ] **Step 4: Add renderer interaction test**

In `src/tests/MdxRenderer.test.tsx`, add this test to `describe('MdxRenderer', ...)`:

```tsx
it('dispatches media seek events from timestamp links', async () => {
  const compiledTimestamp = `import { jsx as _jsx } from "react/jsx-runtime";
function _createMdxContent(props) {
  const {TimestampLink} = props.components || {};
  return _jsx(TimestampLink, {src: "2605/raw/meeting.m4a", time: "00:12", children: "jump"});
}
function MDXContent(props = {}) {
  return _createMdxContent(props);
}
export default MDXContent;`
  vi.mocked(compileMdx).mockResolvedValue(compiledTimestamp)
  const handler = vi.fn()
  window.addEventListener('mdx-media-seek', handler)

  render(
    <MdxRenderer content="<TimestampLink src='2605/raw/meeting.m4a' time='00:12'>jump</TimestampLink>" />,
  )

  await waitFor(() => screen.getByText('jump'))
  screen.getByText('jump').click()

  expect(handler).toHaveBeenCalled()
  expect(handler.mock.calls[0][0].detail.seconds).toBe(12)
  window.removeEventListener('mdx-media-seek', handler)
})
```

- [ ] **Step 5: Add source CSS**

Append to `src/styles/mdx.css`:

```css
.mdx-reference-list {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-5) 0;
}
.mdx-source-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-1) var(--space-3);
  align-items: center;
  padding: var(--space-3);
  border: 1px solid var(--mdx-border);
  border-radius: var(--mdx-radius-sm);
  background: var(--mdx-surface);
  color: inherit;
  text-decoration: none;
}
.mdx-source-type {
  font-size: var(--text-xs);
  color: var(--mdx-accent);
  text-transform: uppercase;
}
.mdx-source-label {
  color: var(--item-text);
  font-size: var(--text-sm);
}
.mdx-source-note {
  grid-column: 2;
  color: var(--text-secondary);
  font-size: var(--text-xs);
}
.mdx-timestamp-link {
  color: var(--mdx-accent);
  cursor: pointer;
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--mdx-accent) 28%, transparent);
}
.mdx-transcript {
  margin: var(--space-5) 0;
  padding: var(--space-4);
  border: 1px solid var(--mdx-border);
  border-radius: var(--mdx-radius);
  background: var(--mdx-surface);
}
.mdx-transcript summary,
.mdx-transcript-title {
  cursor: pointer;
  color: var(--item-text);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}
.mdx-transcript-body {
  display: grid;
  gap: var(--space-3);
  margin-top: var(--space-3);
}
.mdx-transcript-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}
.mdx-transcript-item p {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: 1.7;
}
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/tests/MdxSemanticComponents.test.tsx src/tests/MdxRenderer.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/mdx/source.tsx src/components/mdx/semantic.tsx src/components/mdx/index.ts src/components/MdxRenderer.tsx src/styles/mdx.css src/tests/MdxSemanticComponents.test.tsx src/tests/MdxRenderer.test.tsx src/tests/setup.ts
git commit -m "feat: add journal source and interaction MDX components"
```

---

### Task 9: Add showcase and replay samples

**Files:**

- Create: `docs/superpowers/examples/journal-v2-showcase.mdx`
- Create: `docs/superpowers/examples/journal-v2-replay-samples.md`

- [ ] **Step 1: Create showcase MDX**

Create `docs/superpowers/examples/journal-v2-showcase.mdx` with:

```mdx
---
tags: [journal, showcase]
summary: Journal v2 showcase covers semantic components, source traceability, transcript seeking, and long evidence display.
sources: [2605/raw/showcase.txt]
---

# Journal v2 Component Showcase

<Subtitle>Semantic, read-only MDX components for high-quality notes.</Subtitle>

<DecisionRecord
  question="是否将会议 skill 合并进 journal"
  decision="合并，journal 成为唯一笔记整理 skill"
  owner="产品"
  due="v2"
  options={[
    { label: '保留独立 meeting-minutes', tradeoff: '触发清晰，但模板会漂移' },
    { label: '合并进 journal', tradeoff: '路由统一，但需要更好的 registry' },
  ]}
  rationale="所有笔记类型都应复用同一套模板和组件规则。"
/>

<ActionTable
  items={[
    {
      action: '安装 journal references',
      owner: 'Agent',
      due: 'Task 2',
      source: 'plan',
      status: 'open',
    },
    {
      action: '清理 meeting-minutes',
      owner: 'Agent',
      due: 'Task 5',
      source: 'plan',
      status: 'open',
    },
  ]}
/>

<RiskMatrix
  risks={[
    {
      risk: 'AI 过度使用组件',
      likelihood: 'medium',
      impact: 'medium',
      severity: 'P2',
      mitigation: 'Markdown-first writing rules',
    },
    {
      risk: '模板库过大',
      likelihood: 'medium',
      impact: 'high',
      severity: 'P1',
      mitigation: 'Progressive reference loading',
    },
  ]}
/>

<ReferenceList
  sources={[
    { path: '2605/raw/showcase.txt', label: 'Showcase raw material', type: 'text' },
    { path: '2605/raw/meeting.m4a', label: 'Meeting audio', type: 'audio' },
  ]}
/>

<Transcript
  collapsible
  items={[
    {
      speaker: '张三',
      time: '00:12',
      src: '2605/raw/meeting.m4a',
      text: '先把模板体系和组件体系一起设计，不要再分散维护。',
    },
  ]}
/>

<ComparisonMatrix
  columns={['优点', '风险']}
  rows={[
    { label: 'Template-first', values: ['AI 产出立刻稳定', '组件表达不足'] },
    { label: 'Co-design', values: ['模板和组件互相约束', '实施范围更大'] },
  ]}
/>

<RACI
  rows={[
    {
      work: '模板 registry',
      responsible: 'Agent',
      accountable: '用户',
      consulted: '现有 skill',
      informed: '未来 UI',
    },
  ]}
/>
```

- [ ] **Step 2: Create replay samples**

Create `docs/superpowers/examples/journal-v2-replay-samples.md`:

```markdown
# Journal v2 Replay Samples

Use these samples to verify template selection. Each sample should be submitted as pasted text or raw material and checked against the expected family/subtype.

| Expected family       | Expected subtype     | Sample prompt                                                                                             |
| --------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| meeting-collaboration | decision-review      | "张三和李四评审权限方案，A 快但不支持审计，B 慢但支持企业客户，最后决定 B 先试点两周，张三周五前补方案。" |
| work-reports          | weekly-report        | "本周完成录音转写接入，MDX 渲染仍有两个阻塞，下周重点是组件测试和深色模式。"                              |
| project-docs          | prd                  | "新需求：用户拖入 PDF 后自动生成摘要。目标用户是知识工作者，验收标准是能保留来源并生成待办。"             |
| research-analysis     | competitor-analysis  | "竞品 A 支持网页剪藏但没有本地语音，竞品 B 支持语音但导出弱。我们的机会是本地隐私和来源追踪。"            |
| learning-notes        | book-note            | "读《设计心理学》第一章，核心观点是可见性和反馈决定用户是否知道下一步怎么做。"                            |
| personal-journal      | decision-journal     | "我在考虑买一台显示器，A 便宜但色准一般，B 贵但护眼和色彩更好，主要用于长时间阅读。"                      |
| technical-docs        | debug-record         | "导入队列偶发卡住，日志显示 task completed 后没有 emit journal-updated，怀疑事件发送路径提前返回。"       |
| content-creation      | talk-ppt-outline     | "准备一个 20 分钟分享，主题是 AI 笔记模板系统，听众是产品和工程团队。"                                    |
| hr-operations         | recruiting-interview | "候选人做过 Tauri 和 React 项目，系统设计强，但 Rust 实战不足，需要追加一次 pair 编程。"                  |
```

- [ ] **Step 3: Run formatting check for docs**

Run:

```bash
rg -n "TO[D]O|TB[D]|待[定]|占[位]" docs/superpowers/examples src-tauri/resources/workspace-template/.claude/skills/journal || true
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/examples
git commit -m "docs: add journal v2 showcase and replay samples"
```

---

### Task 10: Full verification and final cleanup

**Files:**

- Modify only if verification finds issues.

- [ ] **Step 1: Run frontend component tests**

```bash
npx vitest run src/tests/MdxSemanticComponents.test.tsx src/tests/MdxRenderer.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run Rust workspace initialization tests**

```bash
cd src-tauri && cargo test ensure_workspace_dot_claude
```

Expected: PASS.

- [ ] **Step 3: Run broader frontend tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Run build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Search stale meeting-minutes runtime references**

```bash
rg -n "meeting-minutes|会议纪要整理" src-tauri/resources/workspace-template .agents src-tauri/src src/components src/tests
```

Expected: no runtime references. Historical references in `docs/superpowers/specs/2026-05-31-journal-template-component-v2-design.md` are acceptable.

- [ ] **Step 6: Verify generated workspace tree manually**

Run a temporary initialization test by using the Rust unit test output or a small debug-only check. The required tree is:

```text
.claude/skills/journal/SKILL.md
.claude/skills/journal/references/template-registry.md
.claude/skills/journal/references/templates/meeting-collaboration.md
.claude/skills/journal/references/templates/hr-operations.md
```

Expected: all files exist, `.claude/skills/meeting-minutes` does not exist.

- [ ] **Step 7: Commit verification fixes**

If any fixes were required:

```bash
git add <changed-files>
git commit -m "fix: stabilize journal template component v2"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review Checklist

- Spec coverage: skill consolidation, template registry, 9 families, semantic components, light interactions, migration, replay samples, and rendering showcase are each mapped to tasks.
- Placeholder scan: this plan intentionally avoids unfinished-marker terms and unspecified deferred steps.
- Type consistency: component names in tests, exports, catalog, recipes, and examples match the implementation snippets.
- Scope check: the plan is large but cohesive; every task contributes to the same AI note-generation pipeline and can be verified independently.
