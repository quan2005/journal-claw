# Template Registry

Use this registry before loading a family template. Pick one primary family and one subtype.

After classification, load the matching concrete example when it exists:
`template-examples/{family}/{subtype}.mdx`.

Use example pages as structural references only. Replace their frontmatter, source paths, placeholders, and sample wording with the actual material.

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
- If a meeting produces a technical decision, primary family stays `meeting-collaboration` unless the user explicitly asks for a standalone technical design.
- If a document is both project and report, choose `work-reports` for periodic status and `project-docs` for durable project specification.
- If a learning note contains personal reflection, choose `learning-notes` unless the main purpose is a personal review.
