# Learning Notes Templates

## Recognition Signals

- Source-based learning, author/speaker, concept, theorem, paper, course, chapter, examples.
- Choose this family when the note should become reusable knowledge.

## Core Templates

### deep-reading

Fields: source, core thesis, argument, evidence, assumptions, critique, application.
Recommended components: `QuoteCard`, `EvidenceCard`, `InsightCard`, `ReferenceList`.
Use when: analyzing a long article, essay, or lecture.
Avoid when: the output is a publishable article draft; use content-creation.

### book-note

Fields: book metadata, chapter summary, key quotes, concepts, personal applications.
Recommended components: `QuoteCard`, `InsightCard`, `ReferenceList`.
Use when: recording book reading.
Avoid when: the note only captures a single concept; use knowledge-card.

### paper-note

Fields: research question, method, findings, limitations, citations, reuse.
Recommended components: `EvidenceCard`, `ComparisonMatrix`, `ReferenceList`.
Use when: reading academic or technical papers.
Avoid when: comparing many papers; use literature-matrix variant.

### course-video-note

Fields: source, timestamps, key ideas, examples, questions, practice tasks.
Recommended components: `Transcript`, `TimestampLink`, `InsightCard`, `ActionTable`.
Use when: learning from a course, video, podcast, or share session.
Avoid when: it is a meeting share with team decisions; use meeting-collaboration.

### knowledge-card

Fields: concept, definition, example, counterexample, application, related notes.
Recommended components: `InsightCard`, `EvidenceCard`, `RelatedEntry`.
Use when: distilling durable concepts.
Avoid when: the source context matters more than the concept.

## Subtype Variants

| Subtype             | Apply changes                                 |
| ------------------- | --------------------------------------------- |
| cornell-note        | Split cues, notes, summary, questions         |
| feynman-note        | Explain simply, find gaps, refine explanation |
| concept-explanation | Add definition, examples, non-examples        |
| problem-solving     | Add problem, attempts, solution, reflection   |
| literature-matrix   | Use `ComparisonMatrix` for papers             |
| learning-plan       | Add goals, resources, schedule, progress      |
| flashcard           | Write question, answer, hint, mastery level   |

## Quality Rules

- Organize by logic, not source order, when source order is messy.
- Distinguish author's claim from your interpretation.
- Keep examples concrete.
