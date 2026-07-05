# Project Docs Templates

## Recognition Signals

- Project scope, requirements, milestones, owners, dependencies, release, product planning.
- Choose this family for durable project artifacts rather than meeting records.

## Core Templates

### project-plan

Fields: goal, scope, out of scope, stakeholders, milestones, risks, actions.
Recommended components: `MilestoneTimeline`, `RACI`, `RiskMatrix`, `ActionTable`.
Use when: starting or restructuring a project.
Avoid when: reporting progress only; use work-reports.

### prd

Fields: background, users, problem, user stories, requirements, acceptance criteria, metrics.
Recommended components: `DecisionList`, `ActionTable`, `ReferenceList`.
Use when: defining product behavior or feature requirements.
Avoid when: comparing market competitors; use research-analysis.

### technical-proposal

Fields: context, constraints, options, decision, architecture, rollout, risks.
Recommended components: `DecisionRecord`, `OptionMatrix`, `RiskMatrix`, `Mermaid`.
Use when: project docs contain implementation tradeoffs.
Avoid when: it is a pure engineering RFC; use technical-docs.

### release-checklist

Fields: version, scope, impact, checks, rollback, owners, communication.
Recommended components: `Checklist`, `ActionTable`, `RiskMatrix`, `StatusBadge`.
Use when: preparing launch or production release.
Avoid when: writing a public changelog; use content-creation or project-docs changelog variant.

### project-retrospective

Fields: goal, actual result, what worked, what failed, root causes, lessons, follow-up.
Recommended components: `InsightCard`, `EvidenceCard`, `ActionTable`, `RiskMatrix`.
Use when: reviewing a project or phase.
Avoid when: the event was an operational incident; use technical-docs incident-rca.

## Subtype Variants

| Subtype          | Apply changes                                        |
| ---------------- | ---------------------------------------------------- |
| charter          | Add authority, budget, sponsor, decision rights      |
| user-story       | Use user, scenario, need, value, acceptance criteria |
| requirement-pool | Use table grouped by source, priority, status        |
| roadmap          | Use Now / Next / Later and dependencies              |
| test-plan        | Add scope, cases, environment, acceptance criteria   |
| milestone-plan   | Lead with `MilestoneTimeline`                        |
| changelog        | Group by added, changed, fixed, breaking             |

## Quality Rules

- Make scope boundaries explicit.
- Every risk needs an owner or mitigation when known.
- Requirements must be testable when possible.
