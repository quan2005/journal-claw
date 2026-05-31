# HR Operations Templates

## Recognition Signals

- Candidate, performance, operation process, SOP, customer status, KPI, ticket, partner.
- Choose this family for people operations, customer operations, and repeatable process records.

## Core Templates

### recruiting-interview

Fields: role, candidate context, questions, evidence, strengths, risks, decision, follow-up.
Recommended components: `EvidenceCard`, `DecisionRecord`, `ActionTable`, `StatusBadge`.
Use when: evaluating candidates or interview notes.
Avoid when: interview is user research or content creation.

### performance-review

Fields: period, goals, evidence, strengths, gaps, feedback, growth plan.
Recommended components: `EvidenceCard`, `ActionTable`, `Progress`.
Use when: reviewing employee performance.
Avoid when: it is personal self-review; use personal-journal.

### sop

Fields: purpose, scope, roles, procedure, exceptions, checklist, revision history.
Recommended components: `RACI`, `Checklist`, `ActionTable`.
Use when: documenting a repeatable process.
Avoid when: it is an engineering runbook; use technical-docs.

### event-plan

Fields: goal, audience, timeline, roles, budget, risks, checklist.
Recommended components: `MilestoneTimeline`, `RACI`, `RiskMatrix`, `ActionTable`.
Use when: planning events or operations activities.
Avoid when: it is a marketing content plan; use content-creation.

### customer-profile

Fields: customer context, usage, needs, objections, value, risk, next action.
Recommended components: `EvidenceCard`, `RiskMatrix`, `ActionTable`, `StatusBadge`.
Use when: maintaining customer or account knowledge.
Avoid when: it is a single meeting transcript; use meeting-collaboration.

### kpi-tracking

Fields: metric, current value, target, trend, interpretation, action.
Recommended components: `StatGroup`, `LineChart`, `ActionTable`.
Use when: tracking operations or business metrics.
Avoid when: metrics belong to a broader work report.

## Subtype Variants

| Subtype | Apply changes |
|---|---|
| support-ticket | Add issue, reproduction, handling process, result |
| partner-communication | Add cooperation goal, resources, division of work |
| customer-success-followup | Add usage, value delivered, risk, renewal or expansion signal |

## Quality Rules

- Record evidence for judgments about people or customers.
- Make next owner and follow-up explicit.
- Keep sensitive details minimal and useful.
