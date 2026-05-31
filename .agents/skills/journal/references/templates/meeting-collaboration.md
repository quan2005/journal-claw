# Meeting Collaboration Templates

## Recognition Signals

- Multiple speakers, agenda, alignment, disagreement, decisions, action items, transcript-like material.
- Use this family for meeting outputs even when the subject is product, design, technical, customer, or HR, unless the user explicitly asks for a standalone specification document.

## Core Templates

### general-meeting

Fields: background, participants, agenda, discussion by topic, aligned items, unresolved items, actions.
Recommended components: `ActionTable`, `DecisionList`, `ReferenceList`.
Use when: a meeting has mixed discussion and decisions without a dominant progress or decision-review shape.
Avoid when: the material is a durable PRD, report, or technical design rather than a meeting record.

### decision-review

Fields: question, disagreement, positions, key evidence, turning point, decision, stability, actions.
Recommended components: `DecisionRecord`, `OptionMatrix`, `ActionTable`, `QuoteCard`.
Use when: people compare options, disagree, allocate resources, or change direction.
Avoid when: the meeting only reports status without a real decision.

### progress-sync

Fields: progress summary, status changes, blockers, next plan, actions, risk board.
Recommended components: `ActionTable`, `RiskMatrix`, `StatusBadge`, `StatGroup`.
Use when: participants report work by person, project, customer, or track.
Avoid when: the material is a polished weekly report rather than meeting notes.

### interview-1on1

Fields: person context, needs, pain points, quotes, signals, follow-up.
Recommended components: `QuoteCard`, `EvidenceCard`, `ActionTable`.
Use when: the material is a 1:1, user interview, customer visit, candidate screen, or stakeholder conversation.
Avoid when: the output should become a customer profile or recruiting evaluation.

### retrospective-incident

Fields: goal, actual result, timeline, cause, impact, lessons, fixes.
Recommended components: `IncidentTimeline`, `RiskMatrix`, `ActionTable`.
Use when: a meeting reviews an incident, project, launch, activity, or phase.
Avoid when: the material is a technical RCA document with logs and root cause detail.

## Subtype Variants

| Subtype | Apply changes |
|---|---|
| daily-standup | Use progress-sync; compress discussion; focus status changes and blockers |
| requirement-review | Use decision-review; add requirement background, acceptance criteria, changed requirements |
| technical-review | Use decision-review; add constraints, architecture options, migration risk |
| design-review | Use decision-review; add design goal, feedback themes, screenshots when present |
| strategic-decision | Use decision-review; emphasize resource allocation, decision stability, hidden risks |
| customer-visit | Use interview-1on1; add customer profile, objections, buying signals |
| brainstorm | Use general-meeting; group ideas by theme and mark selected next experiments |
| training-share | Use learning style; extract concepts, examples, questions, and transferable methods |

## Quality Rules

- Preserve disagreement and unresolved issues.
- Keep at most three quotes per topic.
- Do not include filler utterances.
- Mark speaker uncertainty clearly.
