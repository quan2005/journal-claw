# Journal MDX Examples Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Journal's MDX guidance, 104 subtype examples, handbook generator, and component demos around the restored 61-component public registry.

**Architecture:** Restore `StatGroup` at the public runtime boundary first, then make the manifest the validation source for every owned MDX artifact. Rewrite subtype examples by family with distinct task-specific structures, and simplify the handbook generator so it consumes those durable skill examples instead of maintaining a second template corpus.

**Tech Stack:** React 19, TypeScript, Tauri v2, Rust `mdxjs`, Vitest, MDX, Node.js generator scripts.

---

### Task 1: Restore `StatGroup` And Lock The 61-Component Registry

**Files:**

- Modify: `src/components/mdx/display.tsx`
- Modify: `src/components/mdx/index.ts`
- Modify: `src/components/mdx/component-manifest.json`
- Modify: `src/tests/MdxLayoutManifest.test.tsx`
- Modify: `src/tests/MdxSemanticComponents.test.tsx`

- [ ] Add a failing test asserting `StatGroup` exists in `mdxComponents`, appears in the manifest, and renders multiple `Stat` children.
- [ ] Run the focused tests and confirm they fail because `StatGroup` is absent.
- [ ] Restore the previous `StatGroup({ children })` implementation using `.mdx-stat-group`.
- [ ] Export and register `StatGroup`, then add it to the manifest as a specialized display component.
- [ ] Run focused tests and confirm the registry contains 61 public components.

### Task 2: Add Owned-MDX Registry And Coverage Validation

**Files:**

- Create: `scripts/validate-journal-mdx-examples.mjs`
- Create: `src/tests/JournalMdxExamples.test.ts`

- [ ] Add a failing test that scans owned skill examples and docs for PascalCase JSX tags and reports tags absent from the manifest.
- [ ] Add a failing assertion that `docs/superpowers/examples/jsx-all-components-demo.mdx` covers every manifest component.
- [ ] Implement a reusable validator that reads the manifest, scans MDX tags, validates family recommendations, and reports missing or unknown components.
- [ ] Add a component-catalog marker contract so every manifest component has one catalog entry.
- [ ] Run the focused test and confirm the current stale examples/demo fail for the expected reasons.

### Task 3: Rewrite Component Catalog, Recipes, And Family Routing Guides

**Files:**

- Rewrite: `.agents/skills/journal/references/component-catalog.md`
- Rewrite: `.agents/skills/journal/references/component-recipes.md`
- Rewrite: `.agents/skills/journal/references/templates/content-creation.md`
- Rewrite: `.agents/skills/journal/references/templates/hr-operations.md`
- Rewrite: `.agents/skills/journal/references/templates/learning-notes.md`
- Rewrite: `.agents/skills/journal/references/templates/meeting-collaboration.md`
- Rewrite: `.agents/skills/journal/references/templates/personal-journal.md`
- Rewrite: `.agents/skills/journal/references/templates/project-docs.md`
- Rewrite: `.agents/skills/journal/references/templates/research-analysis.md`
- Rewrite: `.agents/skills/journal/references/templates/technical-docs.md`
- Rewrite: `.agents/skills/journal/references/templates/work-reports.md`

- [ ] Document all 61 public components with actual props, use cases, non-use cases, and alternatives.
- [ ] Write the ten approved task-oriented recipes with valid MDX and Markdown alternatives.
- [ ] Rewrite each family routing guide with subtype-specific signals, required information, precise component recommendations, and example links.
- [ ] Run the registry validator and fix every catalog/recommendation mismatch.

### Task 4: Rewrite Meeting, Work Report, And Project Examples

**Files:**

- Rewrite: `.agents/skills/journal/references/template-examples/meeting-collaboration/*.mdx`
- Rewrite: `.agents/skills/journal/references/template-examples/work-reports/*.mdx`
- Rewrite: `.agents/skills/journal/references/template-examples/project-docs/*.mdx`

- [ ] Rewrite every meeting subtype around its distinct collaboration job.
- [ ] Rewrite every report subtype around its cadence, audience, metrics, risks, and next decisions.
- [ ] Rewrite every project subtype around scope, milestones, ownership, evidence, acceptance, or change impact.
- [ ] Keep frontmatter valid and use `StatGroup`, `Stat`, and `Steps` where their compact/ordered semantics are the best fit.
- [ ] Run Prettier and the owned-MDX validator for these families.

### Task 5: Rewrite Research, Learning, And Personal Examples

**Files:**

- Rewrite: `.agents/skills/journal/references/template-examples/research-analysis/*.mdx`
- Rewrite: `.agents/skills/journal/references/template-examples/learning-notes/*.mdx`
- Rewrite: `.agents/skills/journal/references/template-examples/personal-journal/*.mdx`

- [ ] Rewrite research subtypes around question, method, evidence, findings, limits, and follow-up.
- [ ] Rewrite learning subtypes around source, thesis/concept, understanding checks, practice, and recall.
- [ ] Rewrite personal subtypes with lighter structures and no forced expert framing.
- [ ] Use components only when they improve comparison, evidence review, chronology, or compact state.
- [ ] Run Prettier and the owned-MDX validator for these families.

### Task 6: Rewrite Technical, Content, And Operations Examples

**Files:**

- Rewrite: `.agents/skills/journal/references/template-examples/technical-docs/*.mdx`
- Rewrite: `.agents/skills/journal/references/template-examples/content-creation/*.mdx`
- Rewrite: `.agents/skills/journal/references/template-examples/hr-operations/*.mdx`

- [ ] Rewrite technical subtypes around contracts, evidence, execution steps, architecture, validation, and rollback.
- [ ] Rewrite content subtypes around audience, message, structure, source gaps, production, and publication checks.
- [ ] Rewrite HR/operations subtypes around evidence, state, responsibility, process, risk, and follow-up.
- [ ] Keep sensitive judgments evidence-based and explicitly mark unknowns.
- [ ] Run Prettier and the owned-MDX validator for these families.

### Task 7: Rewrite Shared Examples And All Component Demos

**Files:**

- Rewrite: `.agents/skills/journal/references/examples/incident-review.mdx`
- Rewrite: `.agents/skills/journal/references/examples/personal-review.mdx`
- Rewrite: `.agents/skills/journal/references/examples/weekly-report.mdx`
- Rewrite: `docs/superpowers/examples/journal-v2-showcase.mdx`
- Rewrite: `docs/superpowers/examples/jsx-component-gallery.mdx`
- Rewrite: `docs/superpowers/examples/jsx-all-components-demo.mdx`

- [ ] Rewrite the three skill examples as concise, realistic notes.
- [ ] Make `journal-v2-showcase.mdx` one realistic semantic journal entry.
- [ ] Make `jsx-component-gallery.mdx` a category-oriented visual smoke page.
- [ ] Make `jsx-all-components-demo.mdx` a coherent long-form technical article using every one of the 61 components with valid props.
- [ ] Run the validator and confirm exact all-components coverage with no unknown tags.

### Task 8: Refactor The Handbook Generator To Consume Skill Examples

**Files:**

- Rewrite: `scripts/build-mdx-support-manual.mjs`

- [ ] Replace embedded subtype template bodies with reads from `.agents/skills/journal/references/template-examples/`.
- [ ] Keep a reviewed metadata entry for every manifest component and fail on missing or extra metadata.
- [ ] Validate component example JSX against the manifest before writing files.
- [ ] Generate one component page per manifest component, one template page per registry subtype, root guidance pages, and `_manifest.json`.
- [ ] Regenerate `/Users/yanwu/Documents/journal/topics/mdx-support-manual/` and confirm the output counts match the registry.

### Task 9: Compile Every Owned And Generated MDX File

**Files:**

- Modify: `src-tauri/src/mdx.rs`

- [ ] Add or update a Rust test that compiles all 104 subtype examples, shared examples, and docs showcases through `compile_mdx_source`.
- [ ] Compile every generated handbook `.mdx` file.
- [ ] Report file paths and compiler errors together so failures are actionable.
- [ ] Run the focused Rust test and fix every invalid MDX document.

### Task 10: Final Product Verification

**Files:**

- No planned source changes.

- [ ] Run `node scripts/validate-journal-mdx-examples.mjs`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run format:check`.
- [ ] Run the focused Rust MDX corpus test and full `cargo test`.
- [ ] Run `git diff --check`.
- [ ] Open the all-components demo through the real `.md-content.mdx-content` rendering chain and verify no unknown-component fallback appears.
- [ ] Audit each design completion criterion against manifest counts, file counts, validator output, compiler output, and rendered output.
