# Technical Docs Templates

## Recognition Signals

- API, architecture, logs, commands, stack traces, root cause, RFC, deployment, review.
- Choose this family when the note must help future technical work.

## Core Templates

### technical-design

Fields: context, requirements, constraints, architecture, data flow, tradeoffs, rollout, risks.
Recommended components: `DecisionRecord`, `RiskMatrix`, `Mermaid`, `HtmlPreview`.
Use when: designing implementation.
Avoid when: the note is a meeting about the design; use meeting-collaboration unless a standalone doc is requested.

### api-doc

Fields: endpoint, auth, params, request, response, errors, examples.
Recommended components: `Table`, `SourceCard`, `CodeBlock` via Markdown fences.
Use when: describing API contract.
Avoid when: debugging an API issue; use debug-record.

### debug-record

Fields: symptom, environment, logs, hypotheses, experiments, result, fix, regression test.
Recommended components: `EvidenceCard`, `ActionTable`, `ReferenceList`.
Use when: investigating a bug.
Avoid when: the issue caused user-facing incident; use incident-rca.

### incident-rca

Fields: summary, impact, timeline, root cause, detection, resolution, preventive actions.
Recommended components: `IncidentTimeline`, `RiskMatrix`, `ActionTable`.
Use when: reviewing production or operational incidents.
Avoid when: it is a general project retrospective.

### rfc-architecture

Fields: problem, proposal, alternatives, decision, compatibility, migration, open questions.
Recommended components: `DecisionRecord`, `OptionMatrix`, `RiskMatrix`, `Mermaid`.
Use when: seeking durable technical agreement.
Avoid when: it is just implementation notes.

## Subtype Variants

| Subtype | Apply changes |
|---|---|
| deployment-runbook | Add environment, commands, validation, rollback |
| code-review | Add files, risks, findings, required fixes |
| code-snippet | Add code, use case, caveats, related files |
| migration-guide | Add before/after, steps, compatibility, rollback |

## Quality Rules

- Preserve exact commands, error messages, versions, and file paths.
- Separate hypothesis from confirmed cause.
- Include verification evidence for fixes.
