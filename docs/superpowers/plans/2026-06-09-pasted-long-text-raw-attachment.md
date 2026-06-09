# Pasted Long Text Raw Attachment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save pasted long text in the current month's `raw/` directory before attaching it to a chat message.

**Architecture:** Reuse the existing `importText` frontend IPC wrapper and Rust `materials::import_text` command. Limit the behavior change to the long-text branch of `ChatPanel.handlePaste`; all file-path attachment flows remain unchanged.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Tauri v2, Rust

---

### Task 1: Lock the long-text paste behavior

**Files:**
- Modify: `src/tests/ChatPanel.test.tsx`

- [ ] **Step 1: Replace the `importTextTemp` mock with `importText`**

Mock `importText` from `../lib/tauri`, return a path under
`/workspace/2606/raw/`, and assert the pasted text is passed unchanged.

- [ ] **Step 2: Assert the raw attachment path is sent**

Expect the attachment label and `onSend` payload to use the returned workspace
path.

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
npx vitest run src/tests/ChatPanel.test.tsx
```

Expected: FAIL because `ChatPanel` still imports and calls `importTextTemp`.

### Task 2: Route long pasted text through `importText`

**Files:**
- Modify: `src/components/ChatPanel.tsx`

- [ ] **Step 1: Replace the IPC import**

Import `importText` instead of `importTextTemp` from `../lib/tauri`.

- [ ] **Step 2: Replace the long-text paste call**

Call `importText(rawText)` and continue passing `result.path` to the existing
`addFiles` helper.

- [ ] **Step 3: Run the focused test and verify GREEN**

Run:

```bash
npx vitest run src/tests/ChatPanel.test.tsx
```

Expected: PASS.

### Task 3: Verify the change

**Files:**
- Verify: `src/components/ChatPanel.tsx`
- Verify: `src/tests/ChatPanel.test.tsx`

- [ ] **Step 1: Run related IPC contract tests**

```bash
npx vitest run src/tests/ChatPanel.test.tsx src/tests/ipc-contract.test.ts
```

- [ ] **Step 2: Run the frontend build**

```bash
npm run build
```

- [ ] **Step 3: Check patch integrity**

```bash
git diff --check
```

