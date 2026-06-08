# Journal Cross-Platform Rewrite Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first testable foundation for the cross-platform rewrite: typed protocol contracts, a unified app-event seam, a pure conversation stream reducer, and an explicit workspace layout module that preserves `YYMM/raw/` without introducing a database.

**Architecture:** This is Plan 1 of the rewrite, not the full rewrite. It adds stable seams inside the current app so later plans can move backend use cases and frontend features behind those seams incrementally. Runtime behavior should remain compatible with the existing Tauri event and workspace layout during this plan.

**Tech Stack:** Tauri v2, Rust, React 19, TypeScript, Vitest, Cargo tests.

---

## Scope Check

The approved rewrite spec covers several independent subsystems: workspace storage, protocol/events, frontend state, AI runtime, automation, rendering, and ASR policy. That is too large for one implementation plan.

This plan covers only the foundation slice:

- Protocol types and app-event schema.
- A frontend event bus abstraction.
- A pure conversation stream reducer.
- Compatibility mapping from the current `conversation-stream` payload into the new reducer event shape.
- A Rust workspace layout module that preserves existing `YYMM/raw/` and `.journal/sessions|jobs`.

Later plans should cover application use cases, `AgentRunner`, frontend feature slicing, renderer migration, and automation/jobs integration.

## File Structure

Create:

- `src/shared/protocol/appEvent.ts`
  Frontend protocol types for `AppEvent`, `ConversationEvent`, `JobEvent`, `WorkspaceEvent`, `AppError`, plus a narrow runtime type guard.

- `src/shared/protocol/appEvent.test.ts`
  Vitest coverage for protocol guard behavior and the key event shapes.

- `src/shared/events/appEventBus.ts`
  Single frontend Tauri event subscription boundary for the future `app-event` channel.

- `src/shared/events/appEventBus.test.ts`
  Verifies that the bus listens to one channel, filters invalid payloads, and unsubscribes.

- `src/entities/conversation/streamReducer.ts`
  Pure reducer that turns typed `ConversationEvent` values into conversation state.

- `src/entities/conversation/streamReducer.test.ts`
  Reducer tests for text deltas, tool lifecycle, artifact lifecycle, usage, errors, and turn completion.

- `src/entities/conversation/currentStreamMapper.ts`
  Compatibility mapper from current `ConversationStreamPayload` to one or more typed `ConversationEvent` values.

- `src/entities/conversation/currentStreamMapper.test.ts`
  Tests for mapping the current `conversation-stream` subevents.

- `src-tauri/src/protocol.rs`
  Rust protocol DTOs for app events, conversation events, job events, workspace events, and app errors.

- `src-tauri/src/workspace_layout.rs`
  Workspace layout helpers for existing month folders, `raw/`, `.journal/sessions/`, and `.journal/jobs/`.

Modify:

- `src-tauri/src/main.rs`
  Add `mod protocol;` and `mod workspace_layout;`.

- `src/types.ts`
  No required change in this plan. Existing types stay for compatibility.

Do not modify:

- `src/hooks/useConversation.ts` runtime behavior.
- `src/hooks/useJournal.ts` runtime behavior.
- Existing `YYMM/raw/` workspace layout.
- Any ASR/audio code.

## Task 1: Frontend Protocol Types

**Files:**
- Create: `src/shared/protocol/appEvent.ts`
- Test: `src/shared/protocol/appEvent.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/shared/protocol/appEvent.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isAppEvent, type AppEvent } from './appEvent'

describe('app event protocol', () => {
  it('accepts a versioned conversation event', () => {
    const event: AppEvent = {
      v: 1,
      type: 'conversation.event',
      data: {
        sessionId: 'ses_1',
        kind: 'text_delta',
        turnId: 'turn_1',
        delta: 'hello',
      },
    }

    expect(isAppEvent(event)).toBe(true)
  })

  it('rejects unversioned event payloads', () => {
    expect(isAppEvent({ type: 'conversation.event', data: {} })).toBe(false)
  })

  it('rejects unknown event types', () => {
    expect(isAppEvent({ v: 1, type: 'unknown.event', data: {} })).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run src/shared/protocol/appEvent.test.ts
```

Expected: FAIL because `src/shared/protocol/appEvent.ts` does not exist.

- [ ] **Step 3: Implement protocol types**

Create `src/shared/protocol/appEvent.ts`:

```ts
export interface AppError {
  code: string
  message: string
  retryable: boolean
  details?: unknown
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export interface TurnStats {
  elapsedSecs: number
  totalInputTokens: number
  totalOutputTokens: number
}

export interface ToolCall {
  id: string
  name: string
  label: string
  input?: Record<string, unknown>
}

export interface ToolOutput {
  content: string
  isError: boolean
}

export type ConversationEvent =
  | { sessionId: string; kind: 'turn_started'; turnId: string }
  | { sessionId: string; kind: 'text_delta'; turnId: string; delta: string }
  | { sessionId: string; kind: 'thinking_delta'; turnId: string; delta: string }
  | { sessionId: string; kind: 'tool_started'; turnId: string; toolCall: ToolCall }
  | {
      sessionId: string
      kind: 'tool_finished'
      turnId: string
      toolCallId: string
      output: ToolOutput
    }
  | { sessionId: string; kind: 'artifact_delta'; turnId: string; artifactId: string; delta: string }
  | { sessionId: string; kind: 'artifact_finished'; turnId: string; artifactId: string }
  | { sessionId: string; kind: 'usage'; usage: TokenUsage }
  | { sessionId: string; kind: 'failed'; error: AppError }
  | { sessionId: string; kind: 'turn_finished'; stats: TurnStats }

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface JobEvent {
  jobId: string
  status: JobStatus
  error?: AppError
}

export interface WorkspaceEvent {
  reason: 'root_changed' | 'files_changed' | 'settings_changed'
  paths?: string[]
}

export interface JournalUpdatedEvent {
  entryIds?: string[]
  paths?: string[]
}

export interface SettingsChangedEvent {
  keys: string[]
}

export type AppEvent =
  | { v: 1; type: 'workspace.changed'; data: WorkspaceEvent }
  | { v: 1; type: 'journal.updated'; data: JournalUpdatedEvent }
  | { v: 1; type: 'job.updated'; data: JobEvent }
  | { v: 1; type: 'conversation.event'; data: ConversationEvent }
  | { v: 1; type: 'settings.changed'; data: SettingsChangedEvent }

const APP_EVENT_TYPES = new Set<AppEvent['type']>([
  'workspace.changed',
  'journal.updated',
  'job.updated',
  'conversation.event',
  'settings.changed',
])

export function isAppEvent(value: unknown): value is AppEvent {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { v?: unknown; type?: unknown; data?: unknown }
  return candidate.v === 1 && typeof candidate.type === 'string' && APP_EVENT_TYPES.has(candidate.type as AppEvent['type'])
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npx vitest run src/shared/protocol/appEvent.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/protocol/appEvent.ts src/shared/protocol/appEvent.test.ts
git commit -m "feat: add app event protocol types"
```

## Task 2: Frontend App Event Bus

**Files:**
- Create: `src/shared/events/appEventBus.ts`
- Test: `src/shared/events/appEventBus.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/shared/events/appEventBus.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listenMock = vi.fn()

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}))

import { subscribeAppEvents } from './appEventBus'

describe('subscribeAppEvents', () => {
  beforeEach(() => {
    listenMock.mockReset()
  })

  it('subscribes to exactly one app-event channel', async () => {
    const unlisten = vi.fn()
    listenMock.mockResolvedValue(unlisten)

    const subscription = subscribeAppEvents(vi.fn())
    await subscription.ready
    await subscription.unsubscribe()

    expect(listenMock).toHaveBeenCalledWith('app-event', expect.any(Function))
    expect(unlisten).toHaveBeenCalledOnce()
  })

  it('forwards only valid app events', async () => {
    const unlisten = vi.fn()
    let handler: ((event: { payload: unknown }) => void) | null = null
    listenMock.mockImplementation((_channel, cb) => {
      handler = cb as typeof handler
      return Promise.resolve(unlisten)
    })
    const onEvent = vi.fn()

    const subscription = subscribeAppEvents(onEvent)
    await subscription.ready

    handler?.({ payload: { type: 'bad' } })
    handler?.({
      payload: {
        v: 1,
        type: 'workspace.changed',
        data: { reason: 'files_changed', paths: ['2606/08-note.md'] },
      },
    })

    expect(onEvent).toHaveBeenCalledOnce()
    expect(onEvent).toHaveBeenCalledWith({
      v: 1,
      type: 'workspace.changed',
      data: { reason: 'files_changed', paths: ['2606/08-note.md'] },
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run src/shared/events/appEventBus.test.ts
```

Expected: FAIL because `src/shared/events/appEventBus.ts` does not exist.

- [ ] **Step 3: Implement event bus**

Create `src/shared/events/appEventBus.ts`:

```ts
import { listen } from '@tauri-apps/api/event'
import { isAppEvent, type AppEvent } from '../protocol/appEvent'

export interface AppEventSubscription {
  ready: Promise<void>
  unsubscribe: () => Promise<void>
}

export function subscribeAppEvents(onEvent: (event: AppEvent) => void): AppEventSubscription {
  let unlisten: (() => void) | null = null

  const ready = listen<unknown>('app-event', (event) => {
    if (isAppEvent(event.payload)) {
      onEvent(event.payload)
    }
  }).then((fn) => {
    unlisten = fn
  })

  return {
    ready,
    async unsubscribe() {
      await ready
      unlisten?.()
      unlisten = null
    },
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npx vitest run src/shared/events/appEventBus.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/events/appEventBus.ts src/shared/events/appEventBus.test.ts
git commit -m "feat: add typed app event bus"
```

## Task 3: Pure Conversation Stream Reducer

**Files:**
- Create: `src/entities/conversation/streamReducer.ts`
- Test: `src/entities/conversation/streamReducer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/entities/conversation/streamReducer.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createConversationStreamState, conversationStreamReducer } from './streamReducer'

describe('conversationStreamReducer', () => {
  it('appends text deltas to the active assistant turn', () => {
    let state = createConversationStreamState('ses_1')
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'turn_started',
      turnId: 'turn_1',
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'text_delta',
      turnId: 'turn_1',
      delta: 'hello',
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'text_delta',
      turnId: 'turn_1',
      delta: ' world',
    })

    expect(state.turns[0].blocks).toEqual([{ type: 'text', content: 'hello world' }])
  })

  it('tracks tool lifecycle by toolCallId', () => {
    let state = createConversationStreamState('ses_1')
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'turn_started',
      turnId: 'turn_1',
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'tool_started',
      turnId: 'turn_1',
      toolCall: { id: 'tool_1', name: 'read', label: 'Read file' },
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'tool_finished',
      turnId: 'turn_1',
      toolCallId: 'tool_1',
      output: { content: 'done', isError: false },
    })

    expect(state.turns[0].blocks).toEqual([
      {
        type: 'tool',
        toolCallId: 'tool_1',
        name: 'read',
        label: 'Read file',
        output: 'done',
        isError: false,
      },
    ])
  })

  it('keeps artifact blocks addressable by artifactId', () => {
    let state = createConversationStreamState('ses_1')
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'turn_started',
      turnId: 'turn_1',
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'artifact_delta',
      turnId: 'turn_1',
      artifactId: 'art_1',
      delta: '<Section',
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'artifact_delta',
      turnId: 'turn_1',
      artifactId: 'art_1',
      delta: ' />',
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'artifact_finished',
      turnId: 'turn_1',
      artifactId: 'art_1',
    })

    expect(state.turns[0].blocks).toEqual([
      { type: 'artifact', artifactId: 'art_1', content: '<Section />', isStreaming: false },
    ])
  })

  it('ignores events for other sessions', () => {
    const state = createConversationStreamState('ses_1')
    const next = conversationStreamReducer(state, {
      sessionId: 'ses_2',
      kind: 'turn_started',
      turnId: 'turn_1',
    })

    expect(next).toBe(state)
  })

  it('tracks usage and turn completion stats', () => {
    let state = createConversationStreamState('ses_1')
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'turn_started',
      turnId: 'turn_1',
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'usage',
      usage: { inputTokens: 12, outputTokens: 3 },
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'turn_finished',
      stats: { elapsedSecs: 1.5, totalInputTokens: 12, totalOutputTokens: 3 },
    })

    expect(state.usage).toEqual({ inputTokens: 12, outputTokens: 3 })
    expect(state.turns[0].status).toBe('finished')
    expect(state.turns[0].stats?.elapsedSecs).toBe(1.5)
  })

  it('records structured errors on the active turn', () => {
    let state = createConversationStreamState('ses_1')
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'turn_started',
      turnId: 'turn_1',
    })
    state = conversationStreamReducer(state, {
      sessionId: 'ses_1',
      kind: 'failed',
      error: { code: 'provider_unavailable', message: 'down', retryable: true },
    })

    expect(state.turns[0].status).toBe('failed')
    expect(state.turns[0].blocks).toEqual([
      {
        type: 'error',
        error: { code: 'provider_unavailable', message: 'down', retryable: true },
      },
    ])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run src/entities/conversation/streamReducer.test.ts
```

Expected: FAIL because `src/entities/conversation/streamReducer.ts` does not exist.

- [ ] **Step 3: Implement the reducer**

Create `src/entities/conversation/streamReducer.ts`:

```ts
import type {
  AppError,
  ConversationEvent,
  TokenUsage,
  TurnStats,
} from '../../shared/protocol/appEvent'

export type ConversationBlock =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | {
      type: 'tool'
      toolCallId: string
      name: string
      label: string
      input?: Record<string, unknown>
      output?: string
      isError?: boolean
    }
  | { type: 'artifact'; artifactId: string; content: string; isStreaming: boolean }
  | { type: 'error'; error: AppError }

export interface ConversationTurnState {
  turnId: string
  status: 'streaming' | 'finished' | 'failed'
  blocks: ConversationBlock[]
  stats?: TurnStats
}

export interface ConversationStreamState {
  sessionId: string
  turns: ConversationTurnState[]
  usage: TokenUsage
}

export function createConversationStreamState(sessionId: string): ConversationStreamState {
  return {
    sessionId,
    turns: [],
    usage: { inputTokens: 0, outputTokens: 0 },
  }
}

function ensureTurn(state: ConversationStreamState, turnId: string): ConversationStreamState {
  if (state.turns.some((turn) => turn.turnId === turnId)) return state
  return {
    ...state,
    turns: [...state.turns, { turnId, status: 'streaming', blocks: [] }],
  }
}

function updateTurn(
  state: ConversationStreamState,
  turnId: string,
  updater: (turn: ConversationTurnState) => ConversationTurnState,
): ConversationStreamState {
  const withTurn = ensureTurn(state, turnId)
  return {
    ...withTurn,
    turns: withTurn.turns.map((turn) => (turn.turnId === turnId ? updater(turn) : turn)),
  }
}

function appendTextBlock(blocks: ConversationBlock[], content: string): ConversationBlock[] {
  const last = blocks[blocks.length - 1]
  if (last?.type === 'text') {
    return [...blocks.slice(0, -1), { ...last, content: last.content + content }]
  }
  return [...blocks, { type: 'text', content }]
}

function appendThinkingBlock(blocks: ConversationBlock[], content: string): ConversationBlock[] {
  const last = blocks[blocks.length - 1]
  if (last?.type === 'thinking') {
    return [...blocks.slice(0, -1), { ...last, content: last.content + content }]
  }
  return [...blocks, { type: 'thinking', content }]
}

function appendArtifactDelta(
  blocks: ConversationBlock[],
  artifactId: string,
  delta: string,
): ConversationBlock[] {
  const existingIndex = blocks.findIndex(
    (block) => block.type === 'artifact' && block.artifactId === artifactId,
  )
  if (existingIndex >= 0) {
    return blocks.map((block, index) =>
      index === existingIndex && block.type === 'artifact'
        ? { ...block, content: block.content + delta }
        : block,
    )
  }
  return [...blocks, { type: 'artifact', artifactId, content: delta, isStreaming: true }]
}

export function conversationStreamReducer(
  state: ConversationStreamState,
  event: ConversationEvent,
): ConversationStreamState {
  if (event.sessionId !== state.sessionId) return state

  switch (event.kind) {
    case 'turn_started':
      return ensureTurn(state, event.turnId)
    case 'text_delta':
      return updateTurn(state, event.turnId, (turn) => ({
        ...turn,
        blocks: appendTextBlock(turn.blocks, event.delta),
      }))
    case 'thinking_delta':
      return updateTurn(state, event.turnId, (turn) => ({
        ...turn,
        blocks: appendThinkingBlock(turn.blocks, event.delta),
      }))
    case 'tool_started':
      return updateTurn(state, event.turnId, (turn) => ({
        ...turn,
        blocks: [
          ...turn.blocks,
          {
            type: 'tool',
            toolCallId: event.toolCall.id,
            name: event.toolCall.name,
            label: event.toolCall.label,
            input: event.toolCall.input,
          },
        ],
      }))
    case 'tool_finished':
      return updateTurn(state, event.turnId, (turn) => ({
        ...turn,
        blocks: turn.blocks.map((block) =>
          block.type === 'tool' && block.toolCallId === event.toolCallId
            ? { ...block, output: event.output.content, isError: event.output.isError }
            : block,
        ),
      }))
    case 'artifact_delta':
      return updateTurn(state, event.turnId, (turn) => ({
        ...turn,
        blocks: appendArtifactDelta(turn.blocks, event.artifactId, event.delta),
      }))
    case 'artifact_finished':
      return updateTurn(state, event.turnId, (turn) => ({
        ...turn,
        blocks: turn.blocks.map((block) =>
          block.type === 'artifact' && block.artifactId === event.artifactId
            ? { ...block, isStreaming: false }
            : block,
        ),
      }))
    case 'failed': {
      const turnId = state.turns[state.turns.length - 1]?.turnId ?? 'unknown'
      return updateTurn(state, turnId, (turn) => ({
        ...turn,
        status: 'failed',
        blocks: [...turn.blocks, { type: 'error', error: event.error }],
      }))
    }
    case 'turn_finished':
      return updateTurn(state, state.turns[state.turns.length - 1]?.turnId ?? 'unknown', (turn) => ({
        ...turn,
        status: 'finished',
        stats: event.stats,
      }))
    case 'usage':
      return { ...state, usage: event.usage }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npx vitest run src/entities/conversation/streamReducer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/entities/conversation/streamReducer.ts src/entities/conversation/streamReducer.test.ts
git commit -m "feat: add pure conversation stream reducer"
```

## Task 4: Current Conversation Stream Compatibility Mapper

**Files:**
- Create: `src/entities/conversation/currentStreamMapper.ts`
- Test: `src/entities/conversation/currentStreamMapper.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/entities/conversation/currentStreamMapper.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mapCurrentConversationStreamPayload } from './currentStreamMapper'
import type { ConversationStreamPayload } from '../../types'

describe('mapCurrentConversationStreamPayload', () => {
  it('maps text_delta to a typed conversation event', () => {
    const payload: ConversationStreamPayload = {
      session_id: 'ses_1',
      event: 'text_delta',
      data: 'hello',
    }

    expect(mapCurrentConversationStreamPayload(payload)).toEqual([
      { sessionId: 'ses_1', kind: 'text_delta', turnId: 'current', delta: 'hello' },
    ])
  })

  it('maps tool_start with stable fallback id', () => {
    const payload: ConversationStreamPayload = {
      session_id: 'ses_1',
      event: 'tool_start',
      data: JSON.stringify({ name: 'read', label: 'Read file', input: { path: '2606/a.md' } }),
      span_id: 'tool_span_1',
    }

    expect(mapCurrentConversationStreamPayload(payload)).toEqual([
      {
        sessionId: 'ses_1',
        kind: 'tool_started',
        turnId: 'current',
        toolCall: {
          id: 'tool_span_1',
          name: 'read',
          label: 'Read file',
          input: { path: '2606/a.md' },
        },
      },
    ])
  })

  it('maps structured error JSON', () => {
    const payload: ConversationStreamPayload = {
      session_id: 'ses_1',
      event: 'error',
      data: JSON.stringify({ code: 'provider_unavailable', message: 'down', retryable: true }),
    }

    expect(mapCurrentConversationStreamPayload(payload)).toEqual([
      {
        sessionId: 'ses_1',
        kind: 'failed',
        error: { code: 'provider_unavailable', message: 'down', retryable: true },
      },
    ])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx vitest run src/entities/conversation/currentStreamMapper.test.ts
```

Expected: FAIL because `currentStreamMapper.ts` does not exist.

- [ ] **Step 3: Implement mapper**

Create `src/entities/conversation/currentStreamMapper.ts`:

```ts
import type { ConversationStreamPayload } from '../../types'
import type { AppError, ConversationEvent } from '../../shared/protocol/appEvent'

const CURRENT_TURN_ID = 'current'

function parseJsonObject(data: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(data)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function parseError(data: string): AppError {
  const parsed = parseJsonObject(data)
  return {
    code: typeof parsed.code === 'string' ? parsed.code : 'unknown',
    message: typeof parsed.message === 'string' ? parsed.message : data,
    retryable: typeof parsed.retryable === 'boolean' ? parsed.retryable : false,
  }
}

export function mapCurrentConversationStreamPayload(
  payload: ConversationStreamPayload,
): ConversationEvent[] {
  const sessionId = payload.session_id

  switch (payload.event) {
    case 'turn_start':
      return [{ sessionId, kind: 'turn_started', turnId: CURRENT_TURN_ID }]
    case 'text_delta':
      return [{ sessionId, kind: 'text_delta', turnId: CURRENT_TURN_ID, delta: payload.data }]
    case 'thinking_delta':
      return [{ sessionId, kind: 'thinking_delta', turnId: CURRENT_TURN_ID, delta: payload.data }]
    case 'tool_start': {
      const info = parseJsonObject(payload.data)
      return [
        {
          sessionId,
          kind: 'tool_started',
          turnId: CURRENT_TURN_ID,
          toolCall: {
            id: payload.span_id ?? `legacy:${String(info.name ?? 'tool')}`,
            name: typeof info.name === 'string' ? info.name : 'tool',
            label: typeof info.label === 'string' ? info.label : 'Tool',
            input:
              typeof info.input === 'object' && info.input !== null
                ? (info.input as Record<string, unknown>)
                : undefined,
          },
        },
      ]
    }
    case 'tool_end': {
      const info = parseJsonObject(payload.data)
      return [
        {
          sessionId,
          kind: 'tool_finished',
          turnId: CURRENT_TURN_ID,
          toolCallId: payload.span_id ?? `legacy:${String(info.name ?? 'tool')}`,
          output: {
            content: typeof info.output === 'string' ? info.output : '',
            isError: Boolean(info.is_error),
          },
        },
      ]
    }
    case 'error':
      return [{ sessionId, kind: 'failed', error: parseError(payload.data) }]
    case 'done':
      return [
        {
          sessionId,
          kind: 'turn_finished',
          stats: { elapsedSecs: 0, totalInputTokens: 0, totalOutputTokens: 0 },
        },
      ]
    default:
      return []
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npx vitest run src/entities/conversation/currentStreamMapper.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/entities/conversation/currentStreamMapper.ts src/entities/conversation/currentStreamMapper.test.ts
git commit -m "feat: map current conversation stream events"
```

## Task 5: Rust Protocol DTOs

**Files:**
- Create: `src-tauri/src/protocol.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Write the failing Rust tests**

Create `src-tauri/src/protocol.rs` with only this failing test scaffold first:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_versioned_conversation_text_delta() {
        let event = AppEvent::conversation(ConversationEvent::TextDelta {
            session_id: "ses_1".to_string(),
            turn_id: "turn_1".to_string(),
            delta: "hello".to_string(),
        });

        let json = serde_json::to_value(event).unwrap();

        assert_eq!(json["v"], 1);
        assert_eq!(json["type"], "conversation.event");
        assert_eq!(json["data"]["kind"], "text_delta");
        assert_eq!(json["data"]["sessionId"], "ses_1");
    }
}
```

- [ ] **Step 2: Register module and verify the test fails**

Modify the top of `src-tauri/src/main.rs`:

```rust
mod protocol;
```

Run:

```bash
cd src-tauri && cargo test protocol::tests::serializes_versioned_conversation_text_delta
```

Expected: FAIL because protocol types are not defined.

- [ ] **Step 3: Implement Rust protocol DTOs**

Replace `src-tauri/src/protocol.rs` with:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TurnStats {
    pub elapsed_secs: f64,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ToolOutput {
    pub content: String,
    pub is_error: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ConversationEvent {
    #[serde(rename_all = "camelCase")]
    TurnStarted { session_id: String, turn_id: String },
    #[serde(rename_all = "camelCase")]
    TextDelta {
        session_id: String,
        turn_id: String,
        delta: String,
    },
    #[serde(rename_all = "camelCase")]
    ThinkingDelta {
        session_id: String,
        turn_id: String,
        delta: String,
    },
    #[serde(rename_all = "camelCase")]
    ToolStarted {
        session_id: String,
        turn_id: String,
        tool_call: ToolCall,
    },
    #[serde(rename_all = "camelCase")]
    ToolFinished {
        session_id: String,
        turn_id: String,
        tool_call_id: String,
        output: ToolOutput,
    },
    #[serde(rename_all = "camelCase")]
    ArtifactDelta {
        session_id: String,
        turn_id: String,
        artifact_id: String,
        delta: String,
    },
    #[serde(rename_all = "camelCase")]
    ArtifactFinished {
        session_id: String,
        turn_id: String,
        artifact_id: String,
    },
    #[serde(rename_all = "camelCase")]
    Usage {
        session_id: String,
        usage: TokenUsage,
    },
    #[serde(rename_all = "camelCase")]
    Failed {
        session_id: String,
        error: AppError,
    },
    #[serde(rename_all = "camelCase")]
    TurnFinished {
        session_id: String,
        stats: TurnStats,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEvent {
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JobEvent {
    pub job_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<AppError>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JournalUpdatedEvent {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SettingsChangedEvent {
    pub keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "data")]
pub enum AppEventKind {
    #[serde(rename = "workspace.changed")]
    WorkspaceChanged(WorkspaceEvent),
    #[serde(rename = "journal.updated")]
    JournalUpdated(JournalUpdatedEvent),
    #[serde(rename = "job.updated")]
    JobUpdated(JobEvent),
    #[serde(rename = "conversation.event")]
    Conversation(ConversationEvent),
    #[serde(rename = "settings.changed")]
    SettingsChanged(SettingsChangedEvent),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AppEvent {
    pub v: u8,
    #[serde(flatten)]
    pub kind: AppEventKind,
}

impl AppEvent {
    pub fn conversation(event: ConversationEvent) -> Self {
        Self {
            v: 1,
            kind: AppEventKind::Conversation(event),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_versioned_conversation_text_delta() {
        let event = AppEvent::conversation(ConversationEvent::TextDelta {
            session_id: "ses_1".to_string(),
            turn_id: "turn_1".to_string(),
            delta: "hello".to_string(),
        });

        let json = serde_json::to_value(event).unwrap();

        assert_eq!(json["v"], 1);
        assert_eq!(json["type"], "conversation.event");
        assert_eq!(json["data"]["kind"], "text_delta");
        assert_eq!(json["data"]["sessionId"], "ses_1");
    }
}
```

- [ ] **Step 4: Run the Rust test**

Run:

```bash
cd src-tauri && cargo test protocol::tests::serializes_versioned_conversation_text_delta
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/protocol.rs src-tauri/src/main.rs
git commit -m "feat: add rust app event protocol"
```

## Task 6: Workspace Layout Module

**Files:**
- Create: `src-tauri/src/workspace_layout.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Write failing tests**

Create `src-tauri/src/workspace_layout.rs` with only this test scaffold first:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn preserves_existing_month_raw_layout() {
        let layout = WorkspaceLayout::new(PathBuf::from("workspace"));

        assert_eq!(layout.month_dir("2606"), PathBuf::from("workspace/2606"));
        assert_eq!(layout.raw_dir("2606"), PathBuf::from("workspace/2606/raw"));
    }

    #[test]
    fn stores_internal_sessions_and_jobs_under_dot_journal() {
        let layout = WorkspaceLayout::new(PathBuf::from("workspace"));

        assert_eq!(
            layout.sessions_dir(),
            PathBuf::from("workspace/.journal/sessions")
        );
        assert_eq!(layout.jobs_dir(), PathBuf::from("workspace/.journal/jobs"));
    }
}
```

- [ ] **Step 2: Register module and verify the tests fail**

Modify the top of `src-tauri/src/main.rs`:

```rust
mod workspace_layout;
```

Run:

```bash
cd src-tauri && cargo test workspace_layout::tests
```

Expected: FAIL because `WorkspaceLayout` methods are undefined.

- [ ] **Step 3: Implement workspace layout**

Replace `src-tauri/src/workspace_layout.rs` with:

```rust
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceLayout {
    root: PathBuf,
}

impl WorkspaceLayout {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn month_dir(&self, year_month: &str) -> PathBuf {
        self.root.join(year_month)
    }

    pub fn raw_dir(&self, year_month: &str) -> PathBuf {
        self.month_dir(year_month).join("raw")
    }

    pub fn dot_journal_dir(&self) -> PathBuf {
        self.root.join(".journal")
    }

    pub fn sessions_dir(&self) -> PathBuf {
        self.dot_journal_dir().join("sessions")
    }

    pub fn jobs_dir(&self) -> PathBuf {
        self.dot_journal_dir().join("jobs")
    }

    pub fn ensure_internal_dirs(&self) -> Result<(), String> {
        std::fs::create_dir_all(self.sessions_dir()).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(self.jobs_dir()).map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn preserves_existing_month_raw_layout() {
        let layout = WorkspaceLayout::new(PathBuf::from("workspace"));

        assert_eq!(layout.month_dir("2606"), PathBuf::from("workspace/2606"));
        assert_eq!(layout.raw_dir("2606"), PathBuf::from("workspace/2606/raw"));
    }

    #[test]
    fn stores_internal_sessions_and_jobs_under_dot_journal() {
        let layout = WorkspaceLayout::new(PathBuf::from("workspace"));

        assert_eq!(
            layout.sessions_dir(),
            PathBuf::from("workspace/.journal/sessions")
        );
        assert_eq!(layout.jobs_dir(), PathBuf::from("workspace/.journal/jobs"));
    }

    #[test]
    fn ensure_internal_dirs_creates_only_sessions_and_jobs() {
        let root = std::env::temp_dir().join(format!(
            "journal-workspace-layout-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&root);
        let layout = WorkspaceLayout::new(root.clone());

        layout.ensure_internal_dirs().unwrap();

        assert!(layout.sessions_dir().is_dir());
        assert!(layout.jobs_dir().is_dir());
        assert!(!layout.dot_journal_dir().join("cache").exists());
        assert!(!layout.dot_journal_dir().join("index.sqlite").exists());

        std::fs::remove_dir_all(root).unwrap();
    }
}
```

- [ ] **Step 4: Run the Rust tests**

Run:

```bash
cd src-tauri && cargo test workspace_layout::tests
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/workspace_layout.rs src-tauri/src/main.rs
git commit -m "feat: define workspace layout contract"
```

## Task 7: Foundation Verification

**Files:**
- Verify only; no new files.

- [ ] **Step 1: Run focused frontend tests**

Run:

```bash
npx vitest run \
  src/shared/protocol/appEvent.test.ts \
  src/shared/events/appEventBus.test.ts \
  src/entities/conversation/streamReducer.test.ts \
  src/entities/conversation/currentStreamMapper.test.ts
```

Expected: all tests PASS.

- [ ] **Step 2: Run focused Rust tests**

Run:

```bash
cd src-tauri && cargo test protocol::tests && cargo test workspace_layout::tests
```

Expected: all tests PASS.

- [ ] **Step 3: Run typecheck/build gate**

Run:

```bash
npm run build
```

Expected: TypeScript build and Vite build PASS.

- [ ] **Step 4: Run Rust formatting gate**

Run:

```bash
cd src-tauri && cargo fmt --check
```

Expected: PASS. If it fails, run `cd src-tauri && cargo fmt`, then rerun `cargo fmt --check`.

- [ ] **Step 5: Commit verification-only fixes if needed**

If formatting changed files:

```bash
git add src-tauri/src/protocol.rs src-tauri/src/workspace_layout.rs src-tauri/src/main.rs
git commit -m "chore: format rewrite foundation"
```

If no formatting changed files, do not create an empty commit.

## Acceptance Criteria

- The repo has frontend protocol types for versioned app events.
- The frontend has a single `subscribeAppEvents()` seam for future `app-event` usage.
- The conversation stream reducer is pure and covered by unit tests.
- The current `conversation-stream` payload can be mapped into the new event shape for incremental migration.
- Rust has protocol DTOs with a tested JSON shape.
- Rust has an explicit workspace layout module that preserves existing `YYMM/raw/`.
- No SQLite, cache directory, local ASR runtime, or platform-specific sidecar is introduced.
- Existing runtime behavior remains compatible because hooks and IPC are not switched over yet.
