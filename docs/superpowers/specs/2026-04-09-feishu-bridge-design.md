# Feishu Bridge Design

**Date:** 2026-04-09  
**Status:** Draft

## Overview

Add a Feishu (Lark) IM bridge to 谨迹 that lets users send messages from Feishu and receive AI-processed replies. The bridge runs as a background task inside the existing Tauri/Rust process — no extra processes, no lark-cli dependency.

---

## Architecture

```
Feishu WebSocket (wss://open.feishu.cn/event/v1/ws/)
  ↓ im.message.receive_v1 event
feishu_bridge.rs  ←→  config.rs (app_id, app_secret, session_id)
  ↓ accumulate messages (debounce or run-lock)
  ↓ import_text() + enqueue_material(reply_ctx)
ai_processor.rs (existing AiQueue)
  ↓ claude -p --resume <session_id> --output-format json
  ↓ capture stdout (final result)
feishu_bridge.rs
  ↓ POST /open-apis/im/v1/messages/{message_id}/reply
Feishu chat
```

---

## Part 1 — Config

### New fields in `Config` (config.rs)

```rust
#[serde(default)]
pub feishu_enabled: bool,
#[serde(default)]
pub feishu_app_id: String,
#[serde(default)]
pub feishu_app_secret: String,
#[serde(default)]
pub feishu_session_id: Option<String>,  // persisted claude session UUID
```

`feishu_session_id` is managed internally by the bridge — not exposed in the settings UI. It is cleared when the user changes `app_id` or `app_secret`.

### New Tauri commands

```rust
get_feishu_config() -> FeishuConfig   // { enabled, app_id, app_secret }
set_feishu_config(config: FeishuConfig) -> Result<(), String>
get_feishu_status() -> FeishuStatus   // { state: "idle"|"connecting"|"connected"|"error", error: Option<String> }
```

`set_feishu_config` restarts the bridge if `enabled` is true, or stops it if false. Changing credentials clears `feishu_session_id`.

---

## Part 2 — Settings UI

New section `SectionFeishu.tsx` inserted between `SectionPlugins` and `SectionAbout` in `SettingsLayout.tsx`. Nav entry: icon `MessageSquare`, label "飞书".

### UI elements

- **Enable toggle** — master switch; toggling off stops the WebSocket connection immediately
- **App ID** — text input, placeholder `cli_xxxxxxxxxx`
- **App Secret** — password input (masked), placeholder `xxxxxxxxxxxxxxxx`
- **Status indicator** — small colored dot + text:
  - gray "未启用" (disabled)
  - yellow "连接中…" (connecting)
  - green "已连接" (connected)
  - red "连接失败: {error}" (error)
- **Save button** — saves and restarts bridge; disabled while connecting

Status is polled via `get_feishu_status()` every 3s when the section is visible.

---

## Part 3 — feishu_bridge.rs

### Startup

Called from `main.rs` after Tauri setup, same pattern as `auto_dream.rs`:

```rust
tauri::async_runtime::spawn(feishu_bridge::run(app_handle.clone()));
```

`run()` reads config, exits early if `feishu_enabled` is false. Watches for a `feishu-config-changed` internal event to restart.

### Token management

1. POST `https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal` with `app_id` + `app_secret`
2. Cache `tenant_access_token` in memory; refresh 5 minutes before expiry (token TTL is 2 hours)

### WebSocket connection

Feishu's event subscription WebSocket: `wss://open.feishu.cn/event/v1/ws/`

- Authenticate with `tenant_access_token` in the handshake header
- Handle Feishu's ping/pong heartbeat (every 30s)
- On disconnect: exponential backoff reconnect (1s, 2s, 4s… max 60s)
- Emit `feishu-status-changed` Tauri event on state transitions so the UI status indicator updates

### Message handling

On receiving `im.message.receive_v1`:

1. Extract `message_id`, `chat_id`, `content.text` (strip `@bot` mention if present)
2. Pass to the **accumulator**

### Message accumulator (run-lock strategy)

Two modes, controlled by a shared `Arc<Mutex<BridgeState>>`:

```
BridgeState {
  running: bool,           // true while claude is processing
  pending: Vec<String>,    // messages waiting to be sent
  reply_ctx: Option<FeishuReplyCtx>,  // last message_id to reply to
}
```

**When `running == false` (idle mode):**
- New message → append to `pending`, start/reset a 3s debounce timer
- Timer fires → flush `pending` as one batch, set `running = true`, call `submit_batch()`

**When `running == true` (accumulate mode):**
- New message → append to `pending` (no timer)
- When Claude finishes → if `pending` is non-empty, immediately flush as next batch (no debounce wait)

Multiple messages in a batch are joined with `\n\n---\n\n`.

`reply_ctx` always holds the **most recent** `message_id` — the reply goes to the last message in the batch.

### submit_batch()

```rust
async fn submit_batch(app: &AppHandle, text: String, reply_ctx: FeishuReplyCtx)
```

1. Calls `materials::import_text(app, text)` → gets `material_path`, `year_month`
2. Calls `ai_processor::enqueue_material(app, material_path, year_month, None, None)` with `reply_ctx` attached to the `QueueTask`

### FeishuReplyCtx

```rust
pub struct FeishuReplyCtx {
    pub message_id: String,   // for reply threading
    pub chat_id: String,
}
```

Stored in `QueueTask.reply_ctx: Option<FeishuReplyCtx>`.

---

## Part 4 — ai_processor.rs changes

### QueueTask extension

```rust
pub struct QueueTask {
    material_path: String,
    year_month: String,
    note: Option<String>,
    prompt_text: Option<String>,
    pub reply_ctx: Option<FeishuReplyCtx>,  // NEW
}
```

### Session management

Before spawning Claude CLI, check `config.feishu_session_id`:

- `None` → run without `--resume`, parse JSON output for `session_id`, persist to config
- `Some(id)` → add `--resume {id}` flag
- If Claude exits with session-not-found error → clear `feishu_session_id`, retry without `--resume`

Claude CLI invocation for Feishu tasks:

```bash
claude -p --output-format json --cwd <workspace_yyMM_dir> "<prompt>"
# or with session:
claude -p --resume <uuid> --output-format json --cwd <workspace_yyMM_dir> "<prompt>"
```

Parse stdout as JSON: `{ "session_id": "...", "result": "..." }`. The `result` field is the reply content.

### Completion callback

After Claude finishes, if `reply_ctx` is present, emit a Tauri event (avoids circular module dependency):

```rust
app.emit("feishu-reply-ready", FeishuReplyPayload {
    reply_ctx,
    result: result_text,
});
```

`feishu_bridge.rs` listens for `feishu-reply-ready`, calls the Feishu reply API, then sets `running = false` and flushes pending messages if any.

---

## Part 5 — Feishu reply

`send_reply()` in `feishu_bridge.rs`:

```
POST https://open.feishu.cn/open-apis/im/v1/messages/{message_id}/reply
Authorization: Bearer {tenant_access_token}
{
  "msg_type": "text",
  "content": "{\"text\": \"<result>\"}"
}
```

If result is longer than 4000 chars (Feishu text limit), split into multiple sequential replies.

---

## New Rust dependencies

```toml
tokio-tungstenite = { version = "0.24", features = ["native-tls"] }
```

`reqwest` is already present. No other new dependencies needed.

---

## Error handling

| Scenario | Behavior |
|---|---|
| Token fetch fails | Status → error, retry after 30s |
| WebSocket disconnect | Reconnect with backoff, status → connecting |
| Claude session not found | Clear session_id, retry as new session |
| Claude CLI exits non-zero | Reply "处理失败，请重试" to Feishu |
| Feishu reply API fails | Log error, do not retry (avoid duplicate replies) |
| App quits mid-processing | Pending messages lost (acceptable — user can resend) |

---

## Out of scope

- Multi-user / multi-chat support (single bot, all chats share one Claude session)
- Voice message handling
- File/image attachments from Feishu
- Feishu card messages (rich format replies)
- Rate limiting per user
