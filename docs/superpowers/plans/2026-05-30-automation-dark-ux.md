# Automation Dark Mode And UX Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the automation workbench readable in dark mode and simplify the workflow around managing scheduled routines.

**Architecture:** Fix the theme contract at the global CSS layer, then move automation UI away from scattered inline low-contrast tokens toward a small set of semantic CSS classes. The workbench becomes routine-list-first; templates move behind the create flow, while detail content is progressively disclosed.

**Tech Stack:** React 19, TypeScript, Vitest, Vite, CSS custom properties, Playwright smoke checks.

---

### Task 1: Theme Contract Tests

**Files:**
- Modify: `src/tests/light-theme-unit.test.ts`
- Test: `src/tests/light-theme-unit.test.ts`

- [ ] Add tests that assert global body text inherits `--item-text`, dark `--duration-text` is not used as normal support copy, and automation CSS classes exist.
- [ ] Run `npm test -- src/tests/light-theme-unit.test.ts` and verify the new tests fail before implementation.

### Task 2: Automation UX Tests

**Files:**
- Create: `src/tests/AutomationWorkbench.test.tsx`
- Modify: `src/components/AutomationWorkbench.tsx`

- [ ] Add a focused component test showing routines are the primary surface, templates are hidden until `新建自动化`, and advanced detail is collapsed by default.
- [ ] Run `npm test -- src/tests/AutomationWorkbench.test.tsx` and verify the test fails before implementation.

### Task 3: Theme And Component Implementation

**Files:**
- Modify: `src/styles/globals.css`
- Modify: `src/components/AutomationWorkbench.tsx`
- Modify: `src/components/AutomationTemplateGrid.tsx`
- Modify: `src/components/AutomationRoutineList.tsx`
- Modify: `src/components/AutomationRoutineDetail.tsx`
- Modify: `src/components/AutomationEditorDialog.tsx`

- [ ] Add global default text color and automation-specific semantic tokens/classes for surfaces, muted copy, labels, rows, chips, and buttons.
- [ ] Rework automation workbench into a routine-list-first layout with a single create action and no always-visible metrics/template grid.
- [ ] Keep template-based creation, but show templates only inside the create dialog.
- [ ] Collapse Prompt/manifest/full run detail into an advanced section by default.

### Task 4: Verification

**Files:**
- No production file changes expected.

- [ ] Run `npm test -- src/tests/light-theme-unit.test.ts src/tests/AutomationWorkbench.test.tsx`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run a Playwright dark-mode smoke against the automation workbench and verify no browser errors and visible primary text.
