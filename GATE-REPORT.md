# P2 Unified Chat + Engine Switch Gate Report - Round 2

Date: 2026-06-28
Role: independent gatekeeper (codex)
Scope: `stories/20260628-unified-chat-engine-switch/spec.md`, previous `GATE-REPORT.md`, `DEV-NOTES.md` round-2a/2b, P2 implementation files and tests.

## Verdict: NEEDS-FIX

Round-2 fixed the structural AC-6 blocker, the model chip, token usage, and test hygiene. One blocker remains:

1. **FIX-3 FAIL**: `AgentRunPanel` / `RunStreamEntries` still expose user-visible English backend tokens in the zh UI: `cs.operation`, `cs.status`, `source.kind`, `artifact.type`. The test suite still asserts `blocked` / `failed` English strings. This violates the requested "AgentRunPanel zero English hardcode / zh+en aligned" cleanup.

Important caveat, not counted as the blocker above: AC-6 is now real render-layer fusion, not the old shell-level child swap. However, run entries are gated by `isCli`, so switching back to builtin hides prior run output. That is weaker than open-design's "past execution remains in one conversation history", but it does not invalidate the specific round-2a fix because ChatPanel is now permanently mounted and CLI run output coexists with chat bubbles while the CLI engine is active.

## FIX Results

### FIX-1 / AC-6: PASS

Evidence:

- `useAgentRun` is lifted into `UnifiedChatShell`, not owned only by `AgentRunPanel`: `apps/web/src/components/UnifiedChatShell.tsx:61-67`.
- `ChatPanel` is mounted unconditionally; there is no `return <AgentRunPanel>` branch in the shell: `apps/web/src/components/UnifiedChatShell.tsx:183-223`.
- CLI run artifacts are materialized as `streamExtras` with `RunStreamEntries`: `apps/web/src/components/UnifiedChatShell.tsx:142-159`.
- `streamExtras` is rendered inside ChatPanel's own scroll container, after chat bubbles and stats: `apps/web/src/components/ChatPanel.tsx:420-430`, `apps/web/src/components/ChatPanel.tsx:571-573`.
- The two data arrays are not merged: conversation `messages` are passed separately at `apps/web/src/components/UnifiedChatShell.tsx:205-220`; run state is passed separately into `RunStreamEntries` at `apps/web/src/components/UnifiedChatShell.tsx:148-158`.
- `RunStreamEntries` is presentational and owns no hook: `apps/web/src/components/AgentRunPanel.tsx:522-557`.
- `UnifiedChatShell.test.tsx` no longer mocks `ChatPanel`: `apps/web/src/tests/UnifiedChatShell.test.tsx:32-52`.
- Continuity tests assert the same chat bubble DOM survives a builtin -> cli switch and that chat bubble + changeset coexist: `apps/web/src/tests/UnifiedChatShell.test.tsx:146-163`, `apps/web/src/tests/UnifiedChatShell.test.tsx:165-214`.

Judgment against open-design ChatPane: this is now render-layer fusion, not "same shell, swapped child component". It still is not a fully merged chronological message model, which is allowed by the story's Won't item.

Residual risk:

- Existing run output is hidden when `engine !== 'cli'` because `streamExtras` is gated by `isCli`: `apps/web/src/components/UnifiedChatShell.tsx:145-159`. If product intent is that prior executions remain visible while the current engine is builtin, this should be promoted into a new AC or fixed in a follow-up.

### FIX-2 / AC-2: PASS

Evidence:

- The chip renders mode + engine/agent + model in one line: `apps/web/src/components/EngineSwitcher.tsx:122-149`.
- Unknown model is not blank; it falls back to localized `engineSwitcherModelDefault`: `apps/web/src/components/EngineSwitcher.tsx:97-99`.
- Builtin pi model is loaded from daemon engine config via `getEngineConfig()`: `apps/web/src/components/UnifiedChatShell.tsx:93-111`.
- Builtin model is passed into the chip; CLI passes `null`, triggering fallback: `apps/web/src/components/UnifiedChatShell.tsx:186-191`.
- Engine selection persistence goes through `useAgentEngine -> tauri -> runtimeClient -> /settings`: `apps/web/src/hooks/useAgentEngine.ts:34-66`, `apps/web/src/lib/tauri.ts:45-55`, `apps/web/src/lib/httpRuntimeClient.ts:119-137`.
- No P2 engine selection localStorage path exists; `rg` only found localStorage in unrelated existing features or daemon URL helpers.
- Tests cover builtin model and CLI fallback: `apps/web/src/tests/EngineSwitcher.test.tsx:55-69`, `apps/web/src/tests/UnifiedChatShell.test.tsx:224-231`.

Race / offline judgment:

- Daemon/config failure is swallowed and the chip falls back to "默认 / Default": `apps/web/src/components/UnifiedChatShell.tsx:97-107`.
- The model is loaded once on mount. That is acceptable for this AC; live model refresh is not required by the Won't section.

### FIX-3 / i18n: FAIL

Passing evidence:

- Run status labels are localized through `statusLabel(status, t)`: `apps/web/src/components/AgentRunPanel.tsx:35-51`.
- Run section titles use locale keys: `apps/web/src/components/AgentRunPanel.tsx:577-630`.
- Run event labels moved into `useAgentRun` i18n keys: `apps/web/src/hooks/useAgentRun.ts:102-111`, `apps/web/src/hooks/useAgentRun.ts:144-153`, `apps/web/src/hooks/useAgentRun.ts:175-184`.
- Memory-kind labels moved through `memoryKindLabel(kind, t)`: `apps/web/src/components/AgentRunPanel.tsx:465-491`.
- Relevant `agentRun*` and `engineSwitcher*` locale key counts match: local node check returned `zh: 40`, `en: 40`, `onlyZh: []`, `onlyEn: []`.
- Tests now assert many localized zh strings: `apps/web/src/tests/AgentRunPanel.test.tsx:103-110`, `apps/web/src/tests/AgentRunPanel.test.tsx:182`, `apps/web/src/tests/AgentRunPanel.test.tsx:248-250`, `apps/web/src/tests/UnifiedChatShell.test.tsx:211`.

Failing evidence:

- Change operation is rendered raw from the backend enum: `apps/web/src/components/AgentRunPanel.tsx:223`.
- Changeset status is rendered raw from the backend enum: `apps/web/src/components/AgentRunPanel.tsx:232`.
- Source kind is rendered raw from the backend enum: `apps/web/src/components/AgentRunPanel.tsx:431`.
- Artifact type is rendered raw from the backend enum: `apps/web/src/components/AgentRunPanel.tsx:441`.
- Tests still lock raw English status tokens: `apps/web/src/tests/AgentRunPanel.test.tsx:186-189`.

Required fix:

- Add localized label resolvers for changeset operation, changeset status, source kind, and artifact type. Unknown future enum values may fall back to raw strings, but known current contract values must not render as English in zh.
- Update `AgentRunPanel.test.tsx` to assert localized labels instead of `blocked` / `failed`.

### FIX-4 / token: PASS

Evidence:

- `AgentRunPanel` uses `--record-btn` for running status and primary/action accents: `apps/web/src/components/AgentRunPanel.tsx:23-30`, `apps/web/src/components/AgentRunPanel.tsx:292-298`, `apps/web/src/components/AgentRunPanel.tsx:352-354`, `apps/web/src/components/AgentRunPanel.tsx:422-428`, `apps/web/src/components/AgentRunPanel.tsx:437-441`, `apps/web/src/components/AgentRunPanel.tsx:484-490`.
- `EngineSwitcher` uses `--record-btn`, structured radius/shadow/menu/focus tokens: `apps/web/src/styles/engine-switcher.css:13-46`, `apps/web/src/styles/engine-switcher.css:92-106`.
- Grep result for `var(--accent)` / `--accent` in P2 surfaces only found comments saying not to use it, not runtime styles.

### FIX-5 / test hygiene: PASS

Evidence:

- The debug-only `App.test.tsx` case is gone; P2 App tests now start at `apps/web/src/tests/App.test.tsx:670`.
- `useAgentEngine.test.tsx` uses `vi.resetAllMocks()` and reinstalls default mock implementations every `beforeEach`: `apps/web/src/tests/useAgentEngine.test.tsx:14-22`.
- `httpRuntimeClient.test.ts` covers `get_agent_engine` and partial `set_agent_engine`: `apps/web/src/tests/httpRuntimeClient.test.ts:166-221`.
- `tauri.test.ts` covers `getAgentEngine` / `setAgentEngine` command boundary: `apps/web/src/tests/tauri.test.ts:104-117`.
- Grep for `DEBUG right panel`, `expect(true).toBe(true)`, and `console.log` in tests found no P2 debug test. The only `console.log` match is fixture content in `DetailView.test.tsx`, unrelated.

## AC Results

### AC-1: PASS

- `App.tsx` lazy-loads `UnifiedChatShell`: `apps/web/src/App.tsx:60-63`.
- The right panel renders one `UnifiedChatShell`, not Chat / Agent Run tabs: `apps/web/src/App.tsx:1230-1261`.
- `rightPanelMode` / `setRightPanelMode` are gone from `UIContext`: no matches in `App.tsx`, `UIContext.tsx`, components, or tests.

### AC-2: PASS

- Engine chip is always in the shell top bar: `apps/web/src/components/UnifiedChatShell.tsx:183-197`.
- Chip shows engine + model: `apps/web/src/components/EngineSwitcher.tsx:135-149`.
- Builtin model source is daemon engine config: `apps/web/src/components/UnifiedChatShell.tsx:97-104`.
- CLI fallback model label exists: `apps/web/src/components/EngineSwitcher.tsx:97-99`.
- Persistence uses runtimeClient/settings, not localStorage: `apps/web/src/hooks/useAgentEngine.ts:34-66`, `apps/web/src/lib/httpRuntimeClient.ts:119-137`.

### AC-3: PASS

- Builtin sends route through the original conversation `onSend`: `apps/web/src/components/UnifiedChatShell.tsx:127-130`.
- CLI sends route through `agentRun.start({ engine:'cli', agentId, authorizationMode })`: `apps/web/src/components/UnifiedChatShell.tsx:132-139`.
- `createRun` includes `engine`, `agentId`, `prompt`, `authorizationMode` in `POST /runs`: `apps/web/src/lib/agentRuns.ts:35-49`.
- Continuity surface is covered by `UnifiedChatShell.test.tsx`: `apps/web/src/tests/UnifiedChatShell.test.tsx:165-214`.

### AC-4: PASS

- Authorization selector is injected only when `engine === 'cli'`: `apps/web/src/components/UnifiedChatShell.tsx:161-178`.
- Builtin path has no authorization selector because `composerExtras` is undefined: `apps/web/src/components/UnifiedChatShell.tsx:162-178`.
- Test coverage asserts builtin absence and CLI presence: `apps/web/src/tests/UnifiedChatShell.test.tsx:122-143`.

### AC-5: PASS WITH BASELINE FAILURES

Commands I ran:

- `npm run build`: passed.
- `cd apps/web && npx vitest run src/tests/EngineSwitcher.test.tsx src/tests/UnifiedChatShell.test.tsx src/tests/AgentRunPanel.test.tsx src/tests/useAgentEngine.test.tsx src/tests/httpRuntimeClient.test.ts src/tests/tauri.test.ts`: passed, 6 files / 49 tests.
- `npm test`: failed only the two known web baseline tests; contracts and desktop passed before web failed.
- `cd apps/web && npx vitest run`: failed only the two known baseline tests; summary `2 failed | 50 passed`, `2 failed | 365 passed`.
- `cd apps/web && npx vitest run src/tests/App.test.tsx src/tests/useAgentEngine.test.tsx src/tests/UnifiedChatShell.test.tsx --no-isolate`: passed, 3 files / 26 tests.
- `cd apps/daemon && npx vitest run`: passed, 88 files / 546 tests.

Allowed baseline failures still exactly two:

- `apps/web/src/tests/HistoryFloatingButton.test.tsx:23`: expected left `24px`, got `8px`.
- `apps/web/src/tests/SandboxPreview.test.ts:58`: missing `/assets/tabler-icons.css` in `srcdoc`.

The previous "P2 isolated green but full-run loading failures" did not reproduce. The hardened `useAgentEngine` mock reset is now adequate.

### AC-6: PASS WITH CAVEAT

- This is no longer a shell-level swap. `ChatPanel` is the single mounted conversation surface, and run output is inserted into its scroll container via `streamExtras`.
- The test now proves chat bubble survival and chat + run changeset coexistence without mocking `ChatPanel`: `apps/web/src/tests/UnifiedChatShell.test.tsx:32-52`, `apps/web/src/tests/UnifiedChatShell.test.tsx:146-214`.
- Caveat: prior run output is hidden when switching back to builtin due `isCli && hasRunOutput`: `apps/web/src/components/UnifiedChatShell.tsx:145-159`. If the product definition of "one ChatPane" requires all prior run entries to remain visible regardless of current engine, AC-6 should be tightened and this should become a blocker.

## Adversarial Checks

- State leakage: `UnifiedChatShell` and standalone `AgentRunPanel` use separate `useAgentRun()` instances (`apps/web/src/components/UnifiedChatShell.tsx:67`, `apps/web/src/components/AgentRunPanel.tsx:83-94`); there is no module-level run singleton.
- Run state retention: starting a new run clears prior run artifacts in `useAgentRun.start`: `apps/web/src/hooks/useAgentRun.ts:71-79`.
- Empty-state flicker: `streamExtras` is undefined until there is actual run output, and ChatPanel empty state is suppressed only when `streamExtras` exists: `apps/web/src/components/UnifiedChatShell.tsx:145-159`, `apps/web/src/components/ChatPanel.tsx:432-476`.
- Key collision: chat bubbles use numeric / `run-${startIdx}` keys; run timeline entries are inside a separate subtree and use event ids: `apps/web/src/components/ChatPanel.tsx:478-520`, `apps/web/src/components/AgentRunPanel.tsx:577-584`.
- Authorization residual: `composerExtras` exists only for CLI, so builtin does not retain the selector: `apps/web/src/components/UnifiedChatShell.tsx:161-178`.
- Daemon unavailable: engine selection falls back to builtin and model/agent loading failures are swallowed: `apps/web/src/hooks/useAgentEngine.ts:42-48`, `apps/web/src/components/UnifiedChatShell.tsx:79-87`, `apps/web/src/components/UnifiedChatShell.tsx:97-107`.
- Agent fallback risk: if `agentId` is null and a CLI run is submitted, the payload falls back to `claude`: `apps/web/src/components/UnifiedChatShell.tsx:137`. This is not a current AC blocker because the switcher auto-picks the first available agent when possible (`apps/web/src/components/EngineSwitcher.tsx:101-112`), but it is worth hardening later.

## Required Fix

Blocker:

- Localize current contract enum labels in `RunStreamEntries`: changeset operation, changeset status, source kind, and artifact type. Update tests away from English `blocked` / `failed`.

Suggested implementation:

- Add helpers like `changeOperationLabel(op, t)`, `changeStatusLabel(status, t)`, `sourceKindLabel(kind, t)`, `artifactTypeLabel(type, t)`.
- Add zh/en keys for current known values (`create`, `edit`/`modify`, `remove`; `applied`, `blocked`, `failed`, `reverted`, `recorded`; `read`, `cite`; known artifact types such as `summary`).
- Keep raw fallback for unknown future enum values only.

