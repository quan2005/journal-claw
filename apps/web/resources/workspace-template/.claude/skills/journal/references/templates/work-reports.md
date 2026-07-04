# Work Reports Templates

## Recognition Signals

- Periodic updates, completed work, blockers, metrics, OKR/KPI language, next plan.
- Choose this family when the note is meant to summarize work status for review.

## Core Templates

### daily-report

Fields: completed today, key facts, blockers, tomorrow plan, actions.
Recommended components: `ActionTable`, `StatusBadge`, `Progress`.
Use when: the material summarizes one workday.
Avoid when: the material is a personal diary with feelings as the main point.

### weekly-report

Fields: weekly outcomes, project progress, metrics, risks, next week plan.
Recommended components: `StatGroup`, `RiskMatrix`, `ActionTable`, `StatusBadge`.
Use when: the material summarizes a work week or recurring team update.
Avoid when: the material is a meeting transcript; use meeting-collaboration first.

### monthly-quarterly-report

Fields: goals, key metrics, major changes, risks, decisions, next period focus.
Recommended components: `StatGroup`, `LineChart`, `RiskMatrix`, `DecisionList`.
Use when: the material covers month, quarter, or reporting-cycle outcomes.
Avoid when: the material is a project retrospective with lessons and root causes.

### okr-tracking

Fields: objective, key results, current progress, confidence, blockers, next actions.
Recommended components: `Progress`, `StatGroup`, `ActionTable`, `RiskMatrix`.
Use when: OKR, KPI, or target language is central.
Avoid when: goals are personal; use personal-journal goal-okr.

### project-progress

Fields: milestone status, latest progress, risks, dependencies, requested support.
Recommended components: `MilestoneTimeline`, `StatusBadge`, `RiskMatrix`, `ActionTable`.
Use when: a project status report is needed.
Avoid when: the material defines project scope or requirements; use project-docs.

## Subtype Variants

| Subtype             | Apply changes                                               |
| ------------------- | ----------------------------------------------------------- |
| status-report       | Compress narrative; prioritize status, blocker, next action |
| performance-review  | Add evidence, impact, growth points, manager feedback       |
| executive-summary   | Put conclusion and risk first; remove low-level details     |
| risk-focused-report | Lead with `RiskMatrix`; add mitigation owner and deadline   |

## Quality Rules

- Status change matters more than static status.
- Preserve numbers, dates, owners, and deadlines.
- Separate completed work from planned work.
