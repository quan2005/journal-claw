# Tasks: 首次启动引导体验

**Input**: Design documents from `/specs/001-onboarding-experience/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/onboarding-ui.md, quickstart.md

**Tests**: Not explicitly requested in spec. Test tasks omitted — verification via quickstart.md checklist and manual testing.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `src/` (React components, hooks, styles, locales, lib)
- **Backend**: `src-tauri/src/` (Rust commands, config)

---

## Phase 1: Setup

**Purpose**: Verify prerequisites, no new project initialization needed (existing Tauri v2 + React project)

- [x] T001 Verify dev environment runs: `npm run tauri dev` succeeds with no onboarding state
- [x] T002 [P] Read and understand existing AI engine config UI in `src/settings/components/SectionAiEngine.tsx` — note reusable IPC calls, provider list structure, connection test logic

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rust backend changes that ALL user stories depend on. Must complete before any frontend work.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

- [x] T003 Add `onboarding_completed: bool` field (default `false`) to Config struct in `src-tauri/src/config.rs`
- [x] T004 Add `onboarding_last_step: Option<u8>` field to Config struct in `src-tauri/src/config.rs` (for step recovery on restart)
- [x] T005 Create `src-tauri/src/onboarding.rs` with `get_onboarding_status` command (returns `onboarding_completed` and `onboarding_last_step`) and `complete_onboarding` command (sets `onboarding_completed = true`, clears `onboarding_last_step`)
- [x] T006 Create `set_onboarding_step` command in `src-tauri/src/onboarding.rs` (persists current step index to `onboarding_last_step` for crash/window-close recovery)
- [x] T007 Register new Tauri commands (`get_onboarding_status`, `complete_onboarding`, `set_onboarding_step`) in `src-tauri/src/main.rs` `invoke_handler![]`
- [x] T008 Add IPC wrapper functions (`getOnboardingStatus()`, `completeOnboarding()`, `setOnboardingStep()`) in `src/lib/tauri.ts`
- [x] T009 [P] Add all onboarding i18n strings to `src/locales/zh.ts` (see contracts/onboarding-ui.md i18n keys table — ~30 keys)
- [x] T010 [P] Add all onboarding i18n strings to `src/locales/en.ts` (mirror zh.ts keys)

**Checkpoint**: Foundation ready — Rust backend can persist/query onboarding state. Frontend IPC wrappers and i18n strings available. User story implementation can now begin.

---

## Phase 3: User Story 1 - 工作区路径确认 (Priority: P1) 🎯 MVP

**Goal**: 用户首次启动时看到欢迎界面，确认或自定义工作区路径，确认后进入下一步

**Independent Test**: 清除 config.json 中 `onboarding_completed` 字段后启动应用，验证欢迎界面出现、默认路径展示、确认/自定义路径均可正常进入下一步

### Implementation for User Story 1

- [x] T011 [US1] Create `src/hooks/useOnboarding.ts` — state machine hook: `currentStep` (0|1|2), `workspacePath`, `isTransitioning`, `isDismissing`. Reads initial status from `getOnboardingStatus()`, handles step transitions, skip, and dismiss
- [x] T012 [US1] Create `src/styles/onboarding.css` — base layout styles: centered container (`max-width: min(980px, 100%)`, padding `40px 42px 42px`), welcome title (56px/700), subtitle (15px/text-muted), workspace path card, button styles (amber accent on primary, text-muted on secondary), step transition animations (opacity + translateX, 250ms ease-out expo)
- [x] T013 [US1] Create `src/components/OnboardingView.tsx` — component shell with props `{ onComplete: () => void }`. Implement step indicator (3 dots + labels), step switching logic, and skip button in footer
- [x] T014 [US1] Implement Step 0 (Welcome & Workspace) in `src/components/OnboardingView.tsx` — app logo/icon, welcome title + subtitle (from i18n), workspace path display (default from `getWorkspacePath()`), "确认并继续" button (calls `setWorkspacePath()` then advances to step 1), "自定义路径..." button (calls `pickFolder()` to select directory), error state for permission denied, skip link in footer
- [x] T015 [US1] Integrate OnboardingView into `src/App.tsx` — add `showOnboarding` state, on mount check `getOnboardingStatus()`, if `!onboardingCompleted` render `<OnboardingView>` as overlay (z-index above main content), on complete call `completeOnboarding()` and set `showOnboarding = false`

**Checkpoint**: Users can complete workspace path setup and see the welcome screen. Can skip or confirm to advance.

---

## Phase 4: User Story 2 - AI 引擎配置 (Priority: P1) 🎯 MVP

**Goal**: 工作区确认后，用户选择 AI 提供商并填入 API Key，可通过连接测试验证凭据，也可跳过

**Independent Test**: 在 Step 0 确认路径后，验证 Step 1 出现、提供商选择卡展示（≥4 个）、API Key 输入+显示/隐藏、连接测试（成功/失败分级展示）、跳过进入 Step 2

### Implementation for User Story 2

- [x] T016 [US2] Implement Step 1 (AI Engine Config) in `src/components/OnboardingView.tsx` — provider selection cards (2-column grid, at least 4: Anthropic, DeepSeek, Ollama, Custom), card selected state with accent border + fill, API Key password input with show/hide toggle, provider list sourced from existing `getEngineConfig()` providers
- [x] T017 [US2] Implement connection test flow in `src/components/OnboardingView.tsx` Step 1 — "测试连接" button with loading state, call existing engine test endpoint, display graded results: success (green, "连接成功 · 延迟 {latency}ms"), error_auth (red, "API Key 无效"), error_network (yellow, "无法连接"), error_quota (red, "账户余额不足"), error_not_found (red, "模型不可用")
- [x] T018 [US2] Implement save and advance in Step 1 — on "确认并继续" save via existing `setEngineConfig()` IPC, handle case where user provided key but didn't test (still save and advance), "跳过" skips to Step 2
- [x] T019 [US2] Add pre-configured state handling — if `getEngineConfig()` returns existing config (upgrade scenario), pre-fill provider selection and key, skip connection test auto-run but show previous status if available

**Checkpoint**: Users can configure AI engine with connection test feedback. Core value proposition (AI processing) is now enabled.

---

## Phase 5: User Story 3 - 可选能力展示 (Priority: P2)

**Goal**: AI 引擎配置完成后，展示两种输入方式（拖入文件、粘贴文本），用户可直接尝试或跳过进入主界面

**Independent Test**: Step 1 完成/跳过后，验证 Step 2 出现、两种输入方式均展示、拖入文件触发导入、粘贴文本触发导入、跳过进入主界面

### Implementation for User Story 3

- [x] T02 [US3] Implement Step 2 (Capabilities) in `src/components/OnboardingView.tsx` — two capability cards (2-column grid): Drop (icon + "拖入文件" + "导入文件自动分析" + drag zone), Paste (icon + "粘贴文本" + "快速记录整理" + click-to-paste area). All text from i18n
- [x] T02 [US3] Wire capability actions in Step 2 — drag zone accepts file drop calls `importFile()` then dismisses onboarding, paste area accepts text calls `importText()` then dismisses. Actions continue in background after dismiss (no data loss)
- [x] T02 [P] [US3] Add drag-over visual feedback for drop zone and paste placeholder animation in `src/styles/onboarding.css`

**Checkpoint**: Users can discover input methods and try them directly from onboarding.

---

## Phase 6: User Story 4 - 空白页体验 (Priority: P3)

**Goal**: 引导完成后，空工作区不显示"暂无日志"提示，保持清净。详情面板展示温和引导语，第一条日志出现后自动消失

**Independent Test**: 新工作区进入主界面，验证无"暂无日志"空状态文字、底部输入区域完整可用、详情面板显示引导语、第一条日志产生后引导语消失

### Implementation for User Story 4

- [x] T02 [US4] Remove empty state placeholder text (if any) from `src/components/JournalList.tsx` — when entries array is empty, render nothing in the list area (no "暂无日志" or empty icon)
- [x] T02 [US4] Add conditional empty-workspace hint in `src/components/DetailPanel.tsx` — when `selectedEntry` is null AND entries list is empty, show muted guide text "拖入一个文件或粘贴一段文字开始" (from i18n `onboarding.emptyState.hint`). Hide automatically when entries exist

**Checkpoint**: Clean empty state. App feels intentional and quiet with no visual noise.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Animations, accessibility, resilience, and final validation

- [x] T02 Implement dismiss animation — OnboardingView fade-out (opacity 0, 250ms ease-out), signal `onComplete()` after animation ends, App.tsx fade-in main content (opacity 0→1, 250ms ease-out)
- [x] T02 Implement step transition animations in `src/styles/onboarding.css` — step enter/exit using opacity + translateX, 250ms `cubic-bezier(0.16, 1, 0.3, 1)`
- [x] T02 [P] Add `prefers-reduced-motion` detection — use `window.matchMedia('(prefers-reduced-motion: reduce)')` to disable all step transitions and dismiss animation, switching to instant
- [x] T02 [P] Add step indicator click-to-navigate — completed steps are clickable to go back (restore previous step state), current and future steps are not clickable. Add `aria-current="step"` on active step
- [x] T02 [P] Add keyboard navigation — Tab order through all interactive elements, Enter/Space to activate buttons, Escape to skip/close
- [x] T03 Verify theme integration — test light/dark/system theme in onboarding, confirm theme toggle button visible and functional during onboarding, all CSS variables resolve correctly
- [x] T03 Run quickstart.md validation checklist — verify all 18 items pass on a clean config state

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T002) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational completion
- **US2 (Phase 4)**: Depends on US1 (OnboardingView shell + Step 0 + App.tsx integration exist) — builds on top of existing component
- **US3 (Phase 5)**: Depends on US1 (OnboardingView + App.tsx integration) — US2 completion not required if AI config was skipped
- **US4 (Phase 6)**: Depends on US1 (App.tsx integration so onboarding can complete) — independent of US2/US3
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundation phase → can start. No other story dependencies
- **US2 (P1)**: Depends on US1 (needs OnboardingView shell, Step 0, App.tsx integration). Implements Step 1 in same component
- **US3 (P2)**: Depends on US1 (needs OnboardingView, App.tsx). Can proceed even if US2 is skipped (AI config is skippable)
- **US4 (P3)**: Depends on US1 (needs onboarding completion flow). Independent of US2/US3

### Within Each User Story

- Hook before component
- Step implementation in order (0 → 1 → 2) within shared OnboardingView.tsx
- Styles can be added in parallel with component logic
- Integration (App.tsx) after component is ready

### Parallel Opportunities

- **Phase 2**: T009 (zh.ts) and T010 (en.ts) can run in parallel
- **Phase 3**: T011 (hook) and T012 (styles) can run in parallel; T013 and T014 both touch OnboardingView.tsx so must be sequential
- **Phase 5**: T022 (styles) can run in parallel with T020-T021
- **Phase 6**: T023 (JournalList) and T024 (DetailPanel) touch different files — can run in parallel
- **Phase 7**: T027 (reduced-motion), T028 (aria), T029 (keyboard) all touch different concerns of same files — T027 is styles-only so parallel with T028/T029

---

## Parallel Example: Phase 2 (Foundational)

```bash
# After T003-T008 complete (Rust + IPC), launch i18n together:
Task: "Add onboarding i18n strings to src/locales/zh.ts"
Task: "Add onboarding i18n strings to src/locales/en.ts"
```

## Parallel Example: Phase 3 (US1)

```bash
# Launch hook and styles together (different files):
Task: "Create useOnboarding hook in src/hooks/useOnboarding.ts"
Task: "Create onboarding styles in src/styles/onboarding.css"

# Then sequentially (same file):
Task: "Create OnboardingView shell + Step 0 in src/components/OnboardingView.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1: Setup (understand existing code)
2. Complete Phase 2: Foundational (Rust + IPC + i18n)
3. Complete Phase 3: US1 (Welcome + Workspace)
4. Complete Phase 4: US2 (AI Engine Config)
5. **STOP and VALIDATE**: Test full onboarding flow — workspace path → AI config → skip → main app
6. Deploy/demo if ready — this is the minimal viable onboarding

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Workspace confirmed, can enter app → Demo
3. Add US2 → AI engine configured, core value enabled → **MVP!**
4. Add US3 → Input methods discoverable → Demo
5. Add US4 → Clean empty state → Demo
6. Polish → Animations, a11y, final polish → Ship

### Recommended Focus

**US1 + US2 are both P1 and together form the MVP.** US1 sets up the onboarding framework; US2 delivers the critical AI configuration. These two should be completed before moving to US3/US4.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- OnboardingView.tsx is the shared component — all three steps live in it. Plan task order within phases accordingly
- AI engine config reuses existing IPC (`getEngineConfig`/`setEngineConfig`) — do NOT create new engine commands
- Connection test reuses existing test logic from SectionAiEngine
- Commit after each phase or logical group
- Stop at any checkpoint to validate story independently
