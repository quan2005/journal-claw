# Maintenance Governance Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the incorrect 1.0 release path and remove the highest-risk drift between version configuration, release automation, current architecture documentation, and executable gates.

**Architecture:** Phase 0 introduces a zero-dependency version policy CLI, closes the release chain inside one GitHub Actions run, and repairs current documentation references. It deliberately does not implement the later dependency graph, Electron E2E, coverage, or contract migration work; those remain separate Phase 1–4 stories.

**Tech Stack:** Node.js built-in modules and test runner, Bun workspaces, release-please v4, GitHub Actions, GitHub CLI, Markdown.

## Global Constraints

- JournalClaw remains in `0.x`; do not merge or recreate a `1.0.0` release.
- `fix` and backward-compatible `feat` increment patch; breaking changes increment minor.
- The public tag format remains exactly `vX.Y.Z`.
- Root and all four workspace package versions remain lockstep.
- release-please owns version files, CHANGELOG, tag, and GitHub Release text; the asset job only builds and uploads DMG files.
- CI is the reproducible hard gate; independent Codex verification checks story intent but does not replace CI.
- Do not push, tag, merge/close PR #31, publish a Release, or delete remote assets without explicit user confirmation.
- Do not commit task-by-task. Project verification-gate rules override the generic planning skill: produce one independent verify-report first, then commit only with user approval.
- Use `bun` commands consistently; do not introduce `npm` or `npx` examples.

---

## File Map

| File                                                                           | Responsibility                                                                     |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `scripts/version-policy.mjs`                                                   | Pure version/config validation functions and CLI entry point                       |
| `scripts/tests/version-policy.test.mjs`                                        | Mutation-based tests for lockstep versions, pre-major policy, and tag format       |
| `package.json`                                                                 | Exposes `policy:version` and `policy:test` commands                                |
| `release-please-config.json`                                                   | Encodes pre-1.0 bump semantics and `vX.Y.Z` tag format                             |
| `.release-please-manifest.json`                                                | Records the actual last released baseline `0.16.0`                                 |
| `.github/workflows/release-please.yml`                                         | Creates Release PR/Release and calls the asset workflow when a release is created  |
| `.github/workflows/release.yml`                                                | Reusable/manual macOS validation, build, and DMG upload workflow                   |
| `scripts/check-docs-consistency.mjs`                                           | Checks all current authority docs and hidden repository paths                      |
| `scripts/tests/docs-consistency.test.mjs`                                      | Proves hidden-path and retired-path drift is detected                              |
| `scripts/check-format-baseline.mjs`                                            | Fingerprints existing Prettier debt and blocks new/changed debt or baseline growth |
| `scripts/format-baseline.json`                                                 | Records existing master debt fingerprints; entries may only be removed             |
| `AGENTS.md`                                                                    | Navigation and current command summary only                                        |
| `docs/ARCH.md`                                                                 | Current single-engine architecture only                                            |
| `docs/CONVENTIONS.md`                                                          | Executable story/verification process and accurate CI/release behavior             |
| `docs/final-state.md`                                                          | Product north star; implementation-history sections are explicitly historical      |
| `docs/dev/building.md`                                                         | User-facing build/release guide aligned to the authority docs                      |
| `stories/_archive/superpowers/plans/2026-07-08-workspace-tree-enhancements.md` | Archived destination for the stray legacy plan                                     |

---

### Task 1: Add an executable version policy

**Files:**

- Create: `scripts/version-policy.mjs`
- Create: `scripts/tests/version-policy.test.mjs`
- Modify: `package.json`

**Interfaces:**

- Produces: `validateVersionPolicy(repoRoot, { tagName?: string }): string[]`
- Produces CLI: `node scripts/version-policy.mjs [--tag vX.Y.Z]`
- Exit `0`: no policy violations; exit `1`: one or more stable, line-oriented violations.
- Later tasks call `bun run policy:version` locally/CI and `bun run policy:version -- --tag "$TAG_NAME"` before asset upload.

- [ ] **Step 1: Create fixture helpers and the passing baseline test**

Create `scripts/tests/version-policy.test.mjs` using only Node.js built-in modules. The fixture must write these five manifests at `0.16.0`, a manifest `{ ".": "0.16.0" }`, and this release configuration:

```js
const releaseConfig = {
  packages: {
    '.': {
      'release-type': 'node',
      'include-component-in-tag': false,
      'bump-minor-pre-major': true,
      'bump-patch-for-minor-pre-major': true,
      'extra-files': [
        { type: 'json', path: 'apps/web/package.json', jsonpath: '$.version' },
        { type: 'json', path: 'apps/daemon/package.json', jsonpath: '$.version' },
        { type: 'json', path: 'apps/desktop/package.json', jsonpath: '$.version' },
        { type: 'json', path: 'packages/contracts/package.json', jsonpath: '$.version' },
      ],
    },
  },
}
```

The first test must assert:

```js
assert.deepEqual(validateVersionPolicy(repoRoot), [])
assert.deepEqual(validateVersionPolicy(repoRoot, { tagName: 'v0.16.0' }), [])
```

- [ ] **Step 2: Add failing mutation cases**

Add independent tests that mutate only one property and assert an exact diagnostic substring:

```js
;[
  ['apps/web/package.json', '0.16.1', 'workspace version mismatch'],
  ['.release-please-manifest.json', '0.11.3', 'release baseline mismatch'],
  ['include-component-in-tag', true, 'tag must omit component name'],
  ['bump-minor-pre-major', false, 'breaking changes must bump minor before 1.0'],
  ['bump-patch-for-minor-pre-major', false, 'compatible features must bump patch before 1.0'],
]
```

Also assert `journal-v0.16.0`, `v1.0.0`, and `v0.16` are rejected while the repository version is `0.16.0`. `v1.0.0` must report that 1.0 is not permitted, rather than only reporting a string mismatch.

- [ ] **Step 3: Run tests to verify the module is absent**

Run:

```bash
node --test scripts/tests/version-policy.test.mjs
```

Expected: FAIL with an assertion showing that `validateVersionPolicy` is not yet a function. Capture the initial missing-module import only to keep the red run inside the test runner; do not treat a module-loader crash as the behavioral red signal.

- [ ] **Step 4: Implement the pure validator and CLI**

Create `scripts/version-policy.mjs` with:

```js
export const VERSION_FILES = [
  'package.json',
  'apps/web/package.json',
  'apps/daemon/package.json',
  'apps/desktop/package.json',
  'packages/contracts/package.json',
]

export function validateVersionPolicy(repoRoot, { tagName } = {}) {
  const issues = []
  // Read and parse every VERSION_FILES entry.
  // Require exact lockstep with root package version.
  // Require 0.x.y with no prerelease for the current stable channel.
  // Require .release-please-manifest.json['.'] to equal the root version.
  // Require the three exact release-please properties used by the fixture.
  // Require extra-files to cover the four workspace manifests exactly once.
  // If tagName is present, require tagName === `v${rootVersion}`.
  return issues
}
```

The CLI must resolve the repository root relative to `import.meta.url`, parse only an optional `--tag` value, reject unknown arguments, print each violation with prefix `[version-policy]`, and set `process.exitCode = 1` when issues are present.

- [ ] **Step 5: Run the mutation tests**

Run:

```bash
node --test scripts/tests/version-policy.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 6: Expose repository commands**

Add to root `package.json#scripts`:

```json
"policy:version": "node scripts/version-policy.mjs",
"policy:test": "node --test scripts/tests/*.test.mjs"
```

- [ ] **Step 7: Prove the current repository fails for the known reason**

Run:

```bash
bun run policy:version
```

Expected before Task 2: FAIL only because the release manifest is `0.11.3` and the three pre-major/tag properties are absent. Any additional failure is an unplanned repository inconsistency and must be investigated before continuing.

---

### Task 2: Repair release baseline and close the automation chain

**Files:**

- Modify: `.release-please-manifest.json`
- Modify: `release-please-config.json`
- Modify: `.github/workflows/release-please.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: `bun run policy:version` from Task 1.
- Produces reusable workflow input: `tag_name` matching `^v0\.[0-9]+\.[0-9]+$`.
- Produces release-please job outputs: `release_created` and `tag_name`.

- [ ] **Step 1: Align release-please configuration**

Set `.release-please-manifest.json` to:

```json
{
  ".": "0.16.0"
}
```

Add to the `packages["."]` object in `release-please-config.json`:

```json
"include-component-in-tag": false,
"bump-minor-pre-major": true,
"bump-patch-for-minor-pre-major": true
```

Keep the existing four `extra-files` entries unchanged.

- [ ] **Step 2: Make the release asset workflow reusable and manually recoverable**

Change `.github/workflows/release.yml` to accept both `workflow_call` and `workflow_dispatch`, each with required `tag_name`. The job must:

1. validate `tag_name` against `^v0\.[0-9]+\.[0-9]+$` before checkout;
2. checkout exactly `inputs.tag_name`;
3. install Bun using `package.json` and frozen lockfile;
4. run `bun run policy:version -- --tag "${{ inputs.tag_name }}"`;
5. run docs consistency, format, all workspace typechecks/tests, and all builds required for the DMG;
6. assert at least one `apps/desktop/release/*.dmg` exists;
7. upload assets to the existing Release using:

```bash
gh release upload "${{ inputs.tag_name }}" apps/desktop/release/*.dmg --clobber
```

Do not provide a release name or body; release-please remains the sole owner of Release text.

- [ ] **Step 3: Connect release-please outputs to the reusable workflow**

In `.github/workflows/release-please.yml`:

- give the action step `id: release`;
- expose job outputs `release_created` and `tag_name` from that step;
- add a `release-assets` job with `needs: release-please`;
- guard it with `needs.release-please.outputs.release_created == 'true'`;
- call `./.github/workflows/release.yml` and pass `tag_name`;
- inherit only the permissions/secrets needed by the reusable workflow.

This same-run reusable workflow is required because pushes/tags created with `GITHUB_TOKEN` do not reliably start a second workflow.

- [ ] **Step 4: Add policy checks to normal CI**

In the Ubuntu CI job, run these before workspace builds:

```yaml
- run: bun run policy:test
- run: bun run policy:version
- run: node scripts/check-docs-consistency.mjs
```

Keep CI PR-only in Phase 0 and document that fact in Task 3. Release validation runs in the same release-please workflow after a release is created.

- [ ] **Step 5: Validate configuration without source-text tests**

Workflow YAML is configuration owned by GitHub Actions. Do not add tests that grep its source text: such tests detect intentional text changes rather than release behavior. Phase 0 validation is:

1. `bun run policy:test` proves the version semantics against mutated repositories;
2. `bun run policy:version` proves the real repository configuration;
3. opening the implementation PR lets GitHub parse both workflows and resolve the local reusable workflow;
4. the independent verifier inspects the data flow from release-please outputs to the reusable job;
5. no tag or Release is created as a test.

Add a Phase 2 debt item to adopt a mature GitHub Actions validator pinned to a reviewed version; do not invent a YAML validator in this repository.

- [ ] **Step 6: Run the local policy suite**

Run:

```bash
bun run policy:test
bun run policy:version
```

Expected: PASS. The root and workspace versions remain `0.16.0`; no tag or Release is created.

---

### Task 3: Remove current documentation and gate drift

**Files:**

- Modify: `scripts/check-docs-consistency.mjs`
- Create: `scripts/tests/docs-consistency.test.mjs`
- Create: `scripts/check-format-baseline.mjs`
- Create: `scripts/format-baseline.json`
- Create: `scripts/tests/format-baseline.test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `AGENTS.md`
- Modify: `docs/ARCH.md`
- Modify: `docs/CONVENTIONS.md`
- Modify: `docs/final-state.md`
- Modify: `docs/dev/architecture.md`
- Modify: `docs/dev/backend.md`
- Modify: `docs/dev/building.md`
- Modify: `docs/dev/index.md`
- Modify: `docs/dev/setup.md`
- Modify: `docs/guide/index.md`
- Move: `docs/superpowers/plans/2026-07-08-workspace-tree-enhancements.md` → `stories/_archive/superpowers/plans/2026-07-08-workspace-tree-enhancements.md`

**Interfaces:**

- Produces: `checkDocsConsistency({ repoRoot, docs }): Array<{ doc: string; ref: string; reason: string }>`.
- Produces: `classifyFormatDebt(actualFiles, baselineFiles)` and `findBaselineRegressions(currentFiles, referenceFiles)` for fingerprint and target-branch comparisons.
- CLI behavior stays compatible: `node scripts/check-docs-consistency.mjs` exits nonzero and prints every issue.
- `bun run format:check` fingerprints each current Prettier difference and, when `FORMAT_BASELINE_REF` is set, permits only removal from the referenced baseline.
- Consumes: `bun run policy:test` from Task 1 so both policy suites run in CI.

- [ ] **Step 1: Write failing tests for hidden paths and retired current-state claims**

Create `scripts/tests/docs-consistency.test.mjs` with temporary fixtures. Test these exact cases:

1. a core doc containing `` `.agents/skills/missing` `` produces a missing-path issue;
2. a core doc containing `` `.github/workflows/missing.yml` `` produces a missing-path issue;
3. a current architecture doc containing `apps/daemon/src/runtimes/` produces an issue when the path is absent;
4. glob paths such as `` `docs/adr/*` `` remain ignored;
5. an existing hidden path passes;
6. duplicate issues from two documents preserve both document locations rather than being globally de-duplicated; repeated occurrences inside one document are reported once;
7. a prefixed path that resolves outside `repoRoot` is rejected even when the external target exists.
8. a non-ADR current doc outside the four authority hubs is scanned by the default CLI.

- [ ] **Step 2: Run the docs policy test and confirm the missing export**

Run:

```bash
node --test scripts/tests/docs-consistency.test.mjs
```

Expected: FAIL because `check-docs-consistency.mjs` does not export a pure function and ignores hidden path prefixes.

- [ ] **Step 3: Refactor the checker without adding dependencies**

Update `scripts/check-docs-consistency.mjs` to:

- export `checkDocsConsistency({ repoRoot, docs })`;
- scan `AGENTS.md` plus every current Markdown document under `docs/`, excluding append-only historical ADRs;
- recognize `apps/`, `packages/`, `docs/`, `scripts/`, `stories/`, `.github/`, and `.agents/`;
- report `{ doc, ref, reason }` once per authority document and referenced path;
- reject a resolved target unless it is `repoRoot` itself or a descendant of `repoRoot`;
- keep glob exclusion and punctuation stripping;
- run the CLI only when `import.meta.url` is the executed entry point.

- [ ] **Step 4: Fingerprint formatting debt and enforce target-branch monotonicity**

Create `scripts/tests/format-baseline.test.mjs` first and prove these cases:

1. a fully formatted legacy file may disappear from the actual differences without editing the baseline;
2. a new violating file fails;
3. any content change to a still-unformatted known file changes its normalized SHA-256 fingerprint and fails;
4. comparing the current baseline with a Git reference permits removals but rejects added or rewritten entries;
5. a temporary Git repository CLI test proves `FORMAT_BASELINE_REF` is actually enforced.

Then create `scripts/check-format-baseline.mjs` and `scripts/format-baseline.json`. Normalize CRLF to LF before hashing. In PR CI, fetch the base commit and set `FORMAT_BASELINE_REF` to `github.event.pull_request.base.sha`; release validation may compare with `HEAD` because the tag has already passed the PR gate. Make `format:check` the no-regression gate and retain `format:strict` as the diagnostic full-debt command.

- [ ] **Step 5: Replace invalid process references with an executable direct process**

In `docs/CONVENTIONS.md`:

- replace `.agents/skills/requirements-gate` with the direct requirement to create `stories/<YYYYMMDD>-<slug>/story.md`, set `approved` only after user approval, and link the current story schema by example;
- replace `.agents/skills/verification-gate` with the direct requirement for an independent Codex run and `verify-report.md`;
- replace `.agents/skills/docs-maintenance` with an explicit affected-document checklist;
- replace all `npm`/`npx` commands with `bun run`/`bunx`;
- state that normal CI is PR-only and that release validation is called from the release-please workflow;
- state that AI verification cannot waive failing CI.

Do not create a new permanent `skip-gate` escape hatch. Existing `[skip-gate]` wording must be replaced with a time-bounded exception record containing reason, risk, owner, and expiry.

- [ ] **Step 6: Remove retired engine claims from current architecture**

In `docs/ARCH.md`:

- keep pi as the only engine;
- remove the `EngineSwitcher` external CLI flow, `GET /agents`, and `apps/daemon/src/runtimes/` current-state claims;
- change “frontend does not see pi/CLI raw events” to “frontend does not see engine-internal raw events”;
- retain a short historical link to the removal story/ADR, not implementation detail.

In `docs/final-state.md`, label completed migration and D1–D7 sections as historical records and replace current-state summaries that still claim CLI adapters exist. Also align the linked current `docs/dev/` and `docs/guide/` pages with the pi-only engine and Bun command rules. Product north-star content remains unchanged.

- [ ] **Step 7: Align navigation and build documentation**

In `AGENTS.md` and `docs/dev/building.md`:

- use Bun commands only;
- describe `vX.Y.Z`, the `0.x` policy, and release-please as the Release text owner;
- document that merging/replacing the current Release PR is an operator action requiring user approval;
- keep `AGENTS.md` as a summary and link details to CONVENTIONS.

- [ ] **Step 8: Move the stray archived plan**

Use a filesystem move that preserves Git history:

```bash
mkdir -p stories/_archive/superpowers/plans
mv docs/superpowers/plans/2026-07-08-workspace-tree-enhancements.md \
  stories/_archive/superpowers/plans/2026-07-08-workspace-tree-enhancements.md
```

If `docs/superpowers/` becomes empty, remove only the empty directories. Do not touch other archive contents.

- [ ] **Step 9: Run documentation tests and the real checker**

Run:

```bash
bun run policy:test
node scripts/check-docs-consistency.mjs
bun run format:check
```

Expected: PASS with no invalid `.agents/skills/*`, retired runtime, current `docs/superpowers/` references, new/changed formatting debt, or baseline growth relative to the target branch. Record the baseline count as debt; do not format unrelated files in this story.

---

### Task 4: Run the Phase 0 gate and produce independent evidence

**Files:**

- Modify: `stories/20260801-maintenance-governance/story.md`
- Create: `stories/20260801-maintenance-governance/verify-report-phase-0.md`

**Interfaces:**

- Consumes all policy commands and workflows from Tasks 1–3.
- Produces an AC-by-AC report; it does not create a tag, Release, commit, or remote PR mutation.

- [ ] **Step 1: Run static and policy gates from a clean command context**

Run and record exact exit codes:

```bash
bun run policy:test
bun run policy:version
node scripts/check-docs-consistency.mjs
bun run format:check
git diff --check
```

Expected: all exit `0`.

- [ ] **Step 2: Run workspace quality and test gates**

Run:

```bash
bun run --filter @journal/contracts build
bun run --filter @journal/web typecheck
bun run --filter @journal/web lint
bun run --filter @journal/web test
bun run --filter @journal/contracts typecheck
bun run --filter @journal/contracts test
bun run --filter @journal/daemon typecheck
bun run --filter @journal/daemon test
bun run --filter @journal/desktop typecheck
bun run --filter @journal/desktop test
```

Expected: all exit `0`; record test file/test counts and any warnings. A new warning fails Phase 0; a pre-existing warning must be identified by baseline evidence and recorded as debt.

- [ ] **Step 3: Build all release inputs without publishing**

Run:

```bash
bun run --filter @journal/web build
bun run --filter @journal/daemon build
bun run --filter @journal/desktop build
```

Expected: all exit `0`, at least one DMG exists, and no GitHub upload command is run locally.

- [ ] **Step 4: Independently map Phase 0 work to the parent story**

Dispatch a fresh Codex verifier that did not implement Tasks 1–3. It must check:

- AC-1 and AC-6 completely;
- the Phase 0 portion of AC-2;
- no accidental implementation of Phase 1–4 scope;
- exact version/tag/release workflow semantics;
- current Release PR #31 remains unmerged and no remote release action occurred.

- [ ] **Step 5: Write the verification report**

Create `verify-report-phase-0.md` containing:

- frontmatter: `story`, `date`, `scope`, `result`;
- each applicable AC with implementation and command evidence;
- explicit deferred AC portions assigned to Phase 1–4;
- known warnings/debt;
- remote actions deliberately not performed;
- final pass/fail conclusion.

If any required check fails, set the story to `in_progress`, record the gap, fix it through the same red/green cycle, and repeat independent verification. Do not mark the parent story `verified` until all phases finish.

- [ ] **Step 6: Stop before external or git publication actions**

Report the verified Phase 0 result to the user. Request confirmation before any of these actions:

- committing the Phase 0 changes;
- closing/replacing Release PR #31;
- pushing a branch;
- merging a Release PR;
- creating a tag or GitHub Release.

---

## Deferred Plans

The following are intentionally separate plans because each can be accepted or rejected independently:

1. **Phase 1 — Authoritative rules:** add `docs/COMPATIBILITY.md`, define four compatibility surfaces, write channels, Electron trust boundary, and final-state cleanup.
2. **Phase 2 — Policy and CI:** architecture dependency rules, contracts single-source checks, story state policy, shared lint/tsconfig, branch required checks.
3. **Phase 3 — Risk-based testing:** renderer Playwright CI, real daemon integration, Electron launch/package smoke, coverage/warning baselines, artifacts.
4. **Phase 4 — Legacy cleanup:** remove contract mirrors and retired APIs, split oversized composition roots, add versioned migration fixtures.

Each deferred phase receives its own approved child story, detailed implementation plan, independent verification, and commit decision.
