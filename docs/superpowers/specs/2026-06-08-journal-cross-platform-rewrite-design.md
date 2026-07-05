# JournalClaw Cross-Platform Rewrite Design

Date: 2026-06-08
Status: Approved design draft

## Goal

Rewrite JournalClaw for architecture clarity and development speed while preserving the product's local-first identity.

The rewrite optimizes for:

- Clear module boundaries.
- Testable application logic without Tauri, React, or live LLM dependencies.
- Windows as a first-class platform.
- Faster feature work through stable IPC and event contracts.
- Preservation of the existing workspace mental model: monthly folders, `raw/`, Markdown/MDX journal entries, identities, and todos.

## Non-Goals

- No Swift sidecar.
- No Apple STT, WhisperKit, or local ASR model management.
- No local Whisper or bundled local transcription runtime in v1.
- No SQLite, embedded DB, IndexedDB, or database-like source of truth.
- No migration to a cloud-first architecture.
- No token-by-token rendering of arbitrary unfinished MDX/JSX into React.

ASR may return later only through a cloud provider adapter.

## Current Architecture Assessment

The current repo is functionally rich but has blurred boundaries:

- `src-tauri/src/main.rs` registers roughly 100 IPC commands directly against backend modules.
- `src/lib/tauri.ts` mirrors many of those commands one by one.
- `src/hooks/useConversation.ts` owns session tabs, global caches, stream parsing, artifact parsing, and state reconciliation.
- `src/hooks/useJournal.ts` mixes journal loading, queue state, polling, and multiple event listeners.
- `src/components/ChatPanel.tsx`, `src/components/DetailView.tsx`, and `src-tauri/src/conversation.rs` are large enough that local changes have broad blast radius.
- Backend business modules emit Tauri events directly, which couples domain behavior to the desktop shell.

The rewrite should not primarily change the stack. The main change is to move from "Tauri commands around many modules" to "use-case driven application core with adapters."

## Recommended Approach

Use a cross-platform Tauri + React + Rust architecture with a clean Rust core.

```text
apps/
  desktop/                 # Tauri startup, windows, menu, IPC registration

crates/
  domain/                  # Pure models and business rules
  application/             # Use cases, transactions, domain events
  workspace/               # Markdown workspace storage and scanning
  ai-runtime/              # Conversations, agent runner, tools, context
  providers/               # LLM, cloud ASR, document extraction adapters
  platform/                # Cross-platform file opening, paths, notifications
  protocol/                # IPC DTOs, event schemas, versioning
```

## Backend Boundaries

### `domain`

Pure Rust models and rules. No IO, no async runtime, no Tauri, no provider code.

Core entities:

- `JournalEntry`
- `RawMaterial`
- `Identity`
- `Todo`
- `ConversationSession`
- `AutomationRoutine`
- `Job`
- `WorkspacePath`
- `DomainEvent`

This crate validates invariants such as entry metadata, job state transitions, stable IDs, and workspace-relative paths.

### `application`

Use-case layer. One public operation maps to one user intent:

- `import_raw_file`
- `import_raw_text`
- `compile_raw_to_journal`
- `list_journal_entries`
- `open_journal_entry`
- `send_conversation_message`
- `run_automation`
- `retry_job`
- `cancel_job`

The application layer depends on traits, not concrete adapters:

```rust
trait JournalRepository;
trait RawRepository;
trait ConversationRepository;
trait JobRepository;
trait LlmProvider;
trait CloudAsrProvider;
trait DocumentExtractor;
trait EventSink;
```

### `workspace`

Owns the local file layout, scanning, parsing, and atomic writes.

No SQLite or embedded database is introduced. The source of truth remains regular files.

```text
workspace/
  2606/
    raw/
      08-proposal.pdf
      08-paste-103012.txt
      08-proposal.extracted.md

    08-产品会议纪要.mdx

  identities/
    person-zhang-san.md
    project-journalclaw.md

  todos.md

  .journal/
    sessions/
      ses_01JABC.json
    jobs/
      job_01JABC.json
```

Rules:

- Monthly folders and `raw/` are preserved.
- Journal entries and raw sources remain co-located by month.
- Stable IDs live in frontmatter or sidecar JSON, not in a database.
- `.journal/sessions/` stores AI conversation data.
- `.journal/jobs/` stores background job state.
- No `.journal/cache/` in v1. Add only after measured performance need.
- Any future cache must be deletable and rebuildable.
- All internal references use stable IDs or workspace-relative paths.
- Windows path behavior is tested explicitly.

### `ai-runtime`

Owns the shared agent machinery without forcing every background task through a conversation session.

```text
CompileRawToJournalUseCase -> AgentRunner -> journal entry
SendConversationMessageUseCase -> AgentRunner -> conversation turn
RunAutomationUseCase -> AgentRunner -> workspace changes
```

Components:

- `AgentRunner`: executes one agent turn or job.
- `ToolRegistry`: exposes tools by capability profile.
- `ContextBuilder`: builds workspace, entry, raw, skill, and identity context.
- `PromptCatalog`: typed prompts for journal compile, chat, and automation.
- `StreamPublisher`: emits structured domain events.
- `JobScheduler`: handles queued work, retry, cancellation, and persistence.

The current indirect path where a work queue creates a conversation and sends a message should be removed.

### Tool Capabilities

Tools are granted by profile, not by UI label.

```text
compile_raw:
  read raw
  write journal
  write todos
  write identities

chat:
  read workspace
  write only when explicitly in agent mode

automation:
  read workspace
  write only allowed scopes
```

## IPC and Event Protocol

The frontend should not call many small backend functions. IPC is grouped by domain and represents user intent.

```text
workspace.get_state
workspace.set_root

raw.import_files
raw.import_text
raw.extract

journal.list
journal.get
journal.save
journal.delete

conversation.create
conversation.send
conversation.cancel
conversation.list
conversation.get

jobs.list
jobs.cancel
jobs.retry

automation.list
automation.save
automation.run_now

settings.get
settings.update
```

All IPC responses use a structured result:

```ts
type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }

type AppError = {
  code: string
  message: string
  retryable: boolean
  details?: unknown
}
```

Tauri emits a single typed event channel:

```text
app-event
```

Payload:

```ts
type AppEvent =
  | { v: 1; type: 'workspace.changed'; data: WorkspaceChanged }
  | { v: 1; type: 'journal.updated'; data: JournalUpdated }
  | { v: 1; type: 'job.updated'; data: JobUpdated }
  | { v: 1; type: 'conversation.event'; data: ConversationEvent }
  | { v: 1; type: 'settings.changed'; data: SettingsChanged }
```

Only the Tauri adapter may call `emit`. Domain and application code returns `DomainEvent`.

### Conversation Events

Conversation events must include stable IDs so the frontend reducer does not infer state by scanning "last unfinished block."

```ts
type ConversationEvent =
  | { sessionId: string; kind: 'turn_started'; turnId: string }
  | { sessionId: string; kind: 'text_delta'; turnId: string; delta: string }
  | { sessionId: string; kind: 'thinking_delta'; turnId: string; delta: string }
  | { sessionId: string; kind: 'tool_started'; toolCall: ToolCall }
  | { sessionId: string; kind: 'tool_finished'; toolCallId: string; output: ToolOutput }
  | { sessionId: string; kind: 'artifact_delta'; artifactId: string; delta: string }
  | { sessionId: string; kind: 'artifact_finished'; artifactId: string }
  | { sessionId: string; kind: 'usage'; usage: TokenUsage }
  | { sessionId: string; kind: 'failed'; error: AppError }
  | { sessionId: string; kind: 'turn_finished'; stats: TurnStats }
```

## Frontend Boundaries

Use feature-sliced organization instead of broad `components/hooks/lib` buckets.

```text
src/
  app/
    AppShell.tsx
    providers/
    layout/

  shared/
    ui/
    hooks/
    ipc/
    events/
    markdown/
    mdx/
    types/

  entities/
    journal/
    raw/
    conversation/
    todo/
    identity/
    automation/

  features/
    import-raw/
    journal-browser/
    journal-reader/
    conversation-panel/
    automation-workbench/
    settings/
    command-input/
```

### Frontend Rules

- `app/AppShell` owns layout, panel widths, selection, and global providers.
- Feature code imports `shared/ipc`, not Tauri directly.
- Only `shared/events` listens to Tauri.
- Conversation streaming is handled by a pure reducer.
- Journal rendering is separate from entry selection and navigation.
- Large components such as chat panel and detail view are split into feature containers and pure presentational components.

### State Model

Use a light external store such as Zustand or a small `useSyncExternalStore` implementation.

State split:

- UI layout state: app store.
- Domain/entity state: entity stores.
- Streaming state: reducer.
- Derived state: selectors.
- Persistence: backend, except narrow UI preferences such as panel width.

## Rendering Design

Keep MDX as controlled output, not arbitrary runtime execution.

```text
JournalRenderer
  MarkdownRenderer
  MdxRenderer
  ArtifactRenderer
```

Rules:

- `.md` and `.mdx` go through one `JournalRenderer` entry point.
- MDX component whitelist lives in the frontend.
- Backend may compile or validate MDX, but does not know UI component implementations.
- `artifactType="mdx"` renders only at safe boundaries: artifact completion, debounced preview, or last-good preview.
- Streaming text renders as Markdown/text.
- MDX compile failure must degrade locally and not blank the whole document.
- Local file navigation continues through a shared file-open contract.

## Cloud ASR

ASR is not part of the v1 critical path.

Allowed future design:

```text
audio file -> YYMM/raw/ -> cloud_asr job -> transcript sidecar -> compile raw
```

Only cloud ASR providers are allowed. No local ASR runtime, no Swift sidecar, no Apple-only API path.

## Error Handling

Errors must be structured at the protocol boundary.

Categories:

- `workspace_path_invalid`
- `file_not_found`
- `permission_denied`
- `provider_auth_failed`
- `provider_rate_limited`
- `provider_unavailable`
- `job_cancelled`
- `job_failed`
- `mdx_compile_failed`
- `unsupported_file_type`

Every error declares whether retry is useful.

Jobs persist their final error in `.journal/jobs/job_*.json` so failures survive app restarts and can be retried.

## Testing Strategy

### Rust

```text
domain tests
  pure model and state transition tests

application tests
  fake repositories, fake LLM, fake event sink

workspace adapter tests
  temp directories, real files, Windows path cases

ai-runtime tests
  fake provider streams, tool permissions, cancellation, retries

protocol tests
  DTO schema snapshots and version compatibility
```

### Frontend

```text
stream reducer tests
  conversation event -> message blocks

entity store tests
  journal/job/session updates

feature tests
  journal browser, reader, conversation panel

renderer tests
  markdown, mdx, artifact safe boundaries

ipc mock tests
  features call domain APIs, not Tauri directly
```

Required high-value tests:

- `conversationStreamReducer` is pure and covers every `ConversationEvent`.
- `JournalRenderer` handles MDX compile failure, unknown components, and local file links.
- `WorkspaceStore` handles Windows path separators, long paths, and file replacement.
- `CompileRawToJournalUseCase` runs with fake LLM and fake repositories.
- IPC schema changes require explicit version handling.

## Migration Path

Migration should be incremental even if the target is a rewrite.

1. Create `protocol` types and typed event schemas.
2. Extract pure conversation stream reducer in the current frontend.
3. Introduce `workspace` adapter around the current file layout without changing user data.
4. Move raw import and journal listing into application use cases.
5. Replace old IPC commands with domain-grouped commands behind compatibility wrappers.
6. Extract `AgentRunner` and make raw compile, chat, and automation use it directly.
7. Split frontend into feature boundaries.
8. Remove legacy audio/local ASR paths from the v1 rewrite scope.
9. Keep compatibility with existing `YYMM/raw/` and journal files.

## Design Decisions

- Keep Tauri + React + Rust.
- Make Windows a first-class target.
- Preserve existing workspace layout and `raw/`.
- Do not add SQLite.
- Store sessions and jobs under `.journal/`.
- Do not add `.journal/cache/` in v1.
- Treat ASR as cloud-only future capability.
- Use domain events internally and one typed Tauri event channel externally.
- Separate conversation, raw compile, and automation use cases while sharing `AgentRunner`.

## Approval Notes

The user approved:

- Architecture clarity and developer speed as the main quality attributes.
- Windows support and removal of Swift/platform-bound sidecars.
- Cloud-only ASR if ASR returns later.
- Keeping monthly `raw/` naming and location.
- Avoiding SQLite or database-like source of truth.
- Using `.journal/sessions/` and `.journal/jobs/`.
