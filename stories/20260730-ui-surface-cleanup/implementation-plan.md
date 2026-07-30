# Workspace UI Surface Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the two panel-divider toggle buttons and the journal paste/drop card, preserve the underlying panel/file-drop workflows, and rename the empty-chat greeting to “您的谨迹”.

**Architecture:** Keep the existing App shell, layout state, divider resize handlers, responsive behavior, host file-drop pipeline, and conversation data flow. Change only the rendered controls and the now-dead `onOpenDock` wrapper API, then lock the user-visible contract with focused React Testing Library tests.

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library, Bun workspace scripts.

**Contracts:** `stories/20260730-ui-surface-cleanup/story.md` and `stories/20260730-ui-surface-cleanup/design.md`.

## Global Constraints

- Preserve `runtimeClient` and `hostBridge` boundaries from `docs/ARCH.md`; do not touch daemon URLs or raw Electron IPC.
- Preserve the left/right divider elements and resize handlers.
- Preserve panel state, keyboard shortcuts, responsive auto-collapse, pinning, and all business-triggered open paths.
- Preserve the Electron preload → `hostBridge.onFileDrop` → App import/enqueue pipeline.
- Preserve “创建示例条目” for an empty journal workspace.
- Render the empty-chat greeting exactly as `您的谨迹`.
- Add no dependency and perform no unrelated refactor.
- Follow red-green-refactor. Project verification gate forbids implementation commits before independent acceptance, so the tasks below do not create intermediate commits; commit only after the story is verified.

---

### Task 1: Remove panel-divider toggle buttons

**Files:**

- Modify: `apps/web/src/tests/App.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**

- Consumes: existing `[data-sidebar-divider="left"]`, `[data-sidebar-divider="right"]`, `[data-sidebar-panel="left"]`, and `[data-sidebar-panel="right"]` DOM contracts.
- Produces: both divider elements remain resize targets, but neither renders an expand/collapse button.

- [ ] **Step 1: Replace the existing positive toggle-button test with a failing absence test**

Replace `it('places sidebar collapse controls on the panel dividers', ...)` with:

```tsx
it('keeps panel dividers without rendering collapse controls', async () => {
  await act(async () => {
    renderApp()
  })
  await act(async () => {})

  const leftDivider = document.querySelector('[data-sidebar-divider="left"]')
  const rightDivider = document.querySelector('[data-sidebar-divider="right"]')
  const leftPanel = document.querySelector('[data-sidebar-panel="left"]') as HTMLElement
  const rightPanel = document.querySelector('[data-sidebar-panel="right"]') as HTMLElement

  expect(leftDivider).toBeTruthy()
  expect(rightDivider).toBeTruthy()
  expect(leftPanel).toBeTruthy()
  expect(rightPanel).toBeTruthy()
  expect(screen.queryByRole('button', { name: /折叠左侧栏|展开左侧栏/ })).toBeNull()
expect(screen.queryByRole('button', { name: /折叠右侧栏|展开右侧栏/ })).toBeNull()
})
```

- Also replace the existing vacuous `it('toggles todo sidebar with Cmd+T', ...)` test with a real retained-behavior assertion:

```tsx
it('toggles the right conversation panel with Cmd+T', async () => {
  await act(async () => {
    renderApp()
  })
  await act(async () => {})

  const rightPanel = document.querySelector('[data-sidebar-panel="right"]') as HTMLElement
  expect(rightPanel.style.width).not.toBe('0px')

  await act(async () => {
    fireEvent.keyDown(window, { key: 't', metaKey: true })
  })
  expect(rightPanel.style.width).toBe('0px')

  await act(async () => {
    fireEvent.keyDown(window, { key: 't', metaKey: true })
  })
  expect(rightPanel.style.width).not.toBe('0px')
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd apps/web
bunx vitest run src/tests/App.test.tsx -t "keeps panel dividers without rendering collapse controls"
```

Expected: FAIL because the current App still renders buttons named “折叠左侧栏” and “折叠右侧栏 (⌘T)”.

- [ ] **Step 3: Remove only the divider buttons and their dead helpers**

In `apps/web/src/App.tsx`:

- remove `type CSSProperties` from the React import;
- remove the `ChevronLeft` / `ChevronRight` import;
- remove `PANEL_TOGGLE_TOP` and `sidebarToggleStyle`;
- leave both divider `<div>` elements and their `onMouseDown`, width, cursor, and drag styles intact;
- delete each divider’s child `<button>`;
- remove the dead `handleOpenChat` callback and the `onOpenDock={handleOpenChat}` prop passed to `DetailView`;
- do not change `openChatPanel`, keyboard listeners, responsive effects, pinning, or `handleDropFiles`.

The resulting divider shape is:

```tsx
<div
  data-sidebar-divider="left"
  onMouseDown={leftSidebarOpen ? onDividerMouseDown : undefined}
  style={{
    width: DIVIDER_WIDTH,
    flexShrink: 0,
    position: 'relative',
    background: 'transparent',
    userSelect: 'none' as const,
    cursor: leftSidebarOpen ? 'col-resize' : 'default',
  }}
/>
```

Apply the same childless pattern to the right divider while retaining its active background and transition.

- [ ] **Step 4: Run focused and adjacent App tests and verify GREEN**

Run:

```bash
cd apps/web
bunx vitest run src/tests/App.test.tsx
```

Expected: PASS, including existing Cmd+T, responsive panel, navigation, and shell tests.

### Task 2: Simplify the journal unselected state

**Files:**

- Modify: `apps/web/src/tests/DetailView.test.tsx`
- Modify: `apps/web/src/components/DetailView.tsx`

**Interfaces:**

- Consumes: `DetailViewProps.entries` and `DetailViewProps.onSelectSample`.
- Produces: non-empty journal + no selection renders only the existing watermark; empty journal + no selection retains the sample action; `DetailViewProps.onOpenDock` is removed.

- [ ] **Step 1: Add regression fixtures and failing journal empty-state tests**

Add near the top of `DetailView.test.tsx`:

```tsx
import type { ComponentType } from 'react'

import { DetailView, type DetailViewProps } from '../components/DetailView'

const JOURNAL_ENTRY = {
  filename: '30-test.md',
  path: '/ws/2607/30-test.md',
  title: '测试日志',
  summary: '测试摘要',
  tags: [],
  sources: [],
  year_month: '2607',
  day: 30,
  created_time: '10:00',
  created_at_secs: 0,
  mtime_secs: 0,
  materials: [],
}
```

Add:

```tsx
describe('DetailView journal unselected state', () => {
  it('renders no capture card or orphan heading when the journal has entries', () => {
    const LegacyDetailView = DetailView as unknown as ComponentType<
      DetailViewProps & { onOpenDock: () => void }
    >

    renderWithProviders(
      <LegacyDetailView
        type="journal"
        entries={[JOURNAL_ENTRY]}
        onOpenDock={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /粘贴 \/ 拖文件/ })).toBeNull()
    expect(screen.queryByText('通过以下方式开始记录')).toBeNull()
  })

  it('keeps the sample-entry action for an empty journal without the paste card', () => {
    const onSelectSample = vi.fn()
    const LegacyDetailView = DetailView as unknown as ComponentType<
      DetailViewProps & { onOpenDock: () => void }
    >

    renderWithProviders(
      <LegacyDetailView
        type="journal"
        entries={[]}
        onSelectSample={onSelectSample}
        onOpenDock={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /粘贴 \/ 拖文件/ })).toBeNull()
    expect(screen.getByText('通过以下方式开始记录')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /创建示例条目/ }))
    expect(onSelectSample).toHaveBeenCalledTimes(1)
  })
})
```

The `legacyProps` spread deliberately reproduces the old runtime prop even after the public TypeScript interface is removed, preventing the old card from being reintroduced behind that prop.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
cd apps/web
bunx vitest run src/tests/DetailView.test.tsx -t "DetailView journal unselected state"
```

Expected: both tests FAIL because the current component renders the paste/drop card when the legacy callback is supplied; the non-empty case also renders the guidance heading.

- [ ] **Step 3: Remove the paste/drop UI and retain only the valid empty-workspace action**

In `apps/web/src/components/DetailView.tsx`:

- remove `onOpenDock?: () => void` from `DetailViewProps`;
- remove `onOpenDock` from the component destructuring;
- replace `showJournalCards` with an explicit sample-state condition:

```tsx
const showJournalSample =
  isJournalMode && (category === 'journal' || !category) && isEmpty && Boolean(onSelectSample)
```

- replace the journal card block so it renders only when `showJournalSample` is true;
- retain the existing heading and “创建示例条目” button/callback;
- delete the entire “粘贴 / 拖文件” button, icon, copy, hover handlers, and its now-redundant sibling wrapper assumptions;
- keep the watermark and identity/topics hints unchanged.

- [ ] **Step 4: Run the DetailView test file and verify GREEN**

Run:

```bash
cd apps/web
bunx vitest run src/tests/DetailView.test.tsx
```

Expected: PASS with the two new journal-state tests and all existing detail rendering tests.

### Task 3: Rename the empty-chat greeting

**Files:**

- Modify: `apps/web/src/tests/WorkspaceView.test.tsx`
- Modify: `apps/web/src/components/WorkspaceView.tsx`

**Interfaces:**

- Consumes: existing `showEmpty` condition in `WorkspaceChatShell`.
- Produces: the empty greeting is exactly `您的谨迹`; message and composer behavior are unchanged.

- [ ] **Step 1: Change the greeting test first**

Replace the greeting assertion with:

```tsx
it('renders the JournalClaw greeting and input', async () => {
  renderWithProviders(<WorkspaceChatShell {...chatShellProps} />)
  await waitFor(() => {
    expect(screen.getByText('您的谨迹')).toBeTruthy()
  })
  expect(screen.queryByText("闫戍's momo")).toBeNull()
  expect(screen.getByPlaceholderText(/Ask me anything/i)).toBeTruthy()
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd apps/web
bunx vitest run src/tests/WorkspaceView.test.tsx -t "renders the JournalClaw greeting and input"
```

Expected: FAIL because the current greeting is “闫戍's momo”.

- [ ] **Step 3: Apply the exact copy change**

In `WorkspaceChatShell`, replace:

```tsx
<div className="workspace-chat__greeting">闫戍&apos;s momo</div>
```

with:

```tsx
<div className="workspace-chat__greeting">您的谨迹</div>
```

- [ ] **Step 4: Run the WorkspaceView test file and verify GREEN**

Run:

```bash
cd apps/web
bunx vitest run src/tests/WorkspaceView.test.tsx
```

Expected: PASS with the updated greeting and all existing chat-shell behavior.

### Task 4: Integrate and verify the approved contract

**Files:**

- Modify: `stories/20260730-ui-surface-cleanup/story.md` (`approved` → `in_progress` before Task 1; `in_progress` → `verified` only after independent acceptance)
- Create: `stories/20260730-ui-surface-cleanup/verify-report.md`
- Modify only if required by docs-maintenance: the authoritative documentation selected from `docs/DESIGN.md`, `docs/ARCH.md`, `README.md`, or `AGENTS.md`

**Interfaces:**

- Consumes: AC-1 through AC-5 and all three story boundary clauses.
- Produces: fresh technical verification evidence, an independent acceptance report, and a single verified implementation commit.

- [ ] **Step 1: Run focused web tests together**

Run:

```bash
cd apps/web
bunx vitest run src/tests/App.test.tsx src/tests/DetailView.test.tsx src/tests/WorkspaceView.test.tsx src/tests/hostBridge.test.ts
```

Expected: PASS with zero failed tests.

- [ ] **Step 2: Run repository-wide quality gates**

Run from the repository root:

```bash
bun run test
bun run build
bun run lint
bun run format:check
```

Expected: all four commands exit 0.

- [ ] **Step 3: Verify the rendered desktop/web behavior**

Run the app using the existing development command and inspect the real shared renderer:

```bash
bun run desktop:dev
```

Verify:

- both dividers remain visible and draggable;
- no divider expand/collapse button is present;
- a non-empty unselected journal shows neither the paste/drop card nor the orphan heading;
- an empty journal still shows “创建示例条目”;
- an empty chat shows exactly “您的谨迹”;
- Cmd/Ctrl+T and a supported file drop still use the existing paths.

- [ ] **Step 4: Run the independent verification gate**

Dispatch a clean-context Codex verifier using `.agents/skills/verification-gate` with only:

- story: `stories/20260730-ui-surface-cleanup/story.md`;
- design: `stories/20260730-ui-surface-cleanup/design.md`;
- full implementation diff/file list;
- report: `stories/20260730-ui-surface-cleanup/verify-report.md`;
- round: `1`.

Expected: `result: pass`, every AC has file/line or reproducible runtime evidence, and the over-scope list is empty. On failure, leave status `in_progress`, fix only reported gaps, and produce `verify-report-r2.md` for the next round.

- [ ] **Step 5: Apply docs-maintenance and commit**

After an independent pass:

1. change story status to `verified`;
2. run `.agents/skills/docs-maintenance` and update only authoritative docs actually made stale by the verified behavior;
3. re-run `git diff --check` and the affected checks after any documentation edits;
4. stage only the story directory, touched web source/tests, verifier report, and required authoritative docs;
5. create one Conventional Commit:

```bash
git commit -m "fix(web): simplify workspace empty states"
```
