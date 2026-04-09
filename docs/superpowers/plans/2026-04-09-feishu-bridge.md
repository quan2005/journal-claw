# Feishu Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Feishu IM bridge that receives messages via WebSocket, processes them through the existing AI queue, and replies with Claude's output.

**Architecture:** A new `feishu_bridge.rs` Rust module runs as a tokio background task. It connects to Feishu's WebSocket event API, accumulates messages using a run-lock strategy (debounce when idle, accumulate when Claude is running), and feeds batches into the existing `AiQueue`. Claude is invoked with `--resume <session_id>` for conversation continuity. Replies are sent back via Feishu's REST reply API, triggered by a `feishu-reply-ready` Tauri event emitted from `ai_processor.rs`.

**Tech Stack:** Rust/Tauri, `tokio-tungstenite` (new dep), `reqwest` (existing), React/TypeScript settings UI.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src-tauri/src/feishu_bridge.rs` | Create | WebSocket client, token mgmt, accumulator, reply sender |
| `src-tauri/src/config.rs` | Modify | Add feishu config fields + Tauri commands |
| `src-tauri/src/ai_processor.rs` | Modify | Add `reply_ctx` to QueueTask, emit `feishu-reply-ready` on completion, session management |
| `src-tauri/src/main.rs` | Modify | Register new commands, manage bridge state, spawn bridge task |
| `src/settings/navigation.ts` | Modify | Add `'feishu'` NavId |
| `src/settings/SettingsLayout.tsx` | Modify | Add SectionFeishu to nav + content |
| `src/settings/components/SectionFeishu.tsx` | Create | Feishu settings UI |
| `src/lib/tauri.ts` | Modify | Add `getFeishuConfig`, `setFeishuConfig`, `getFeishuStatus` |
| `src/locales/en.ts` | Modify | Add feishu i18n keys |
| `src/locales/zh.ts` | Modify | Add feishu i18n keys |
| `src-tauri/Cargo.toml` | Modify | Add `tokio-tungstenite` dependency |

---

## Task 1: Add dependency and config fields

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/config.rs`

- [ ] **Step 1: Add tokio-tungstenite to Cargo.toml**

In `src-tauri/Cargo.toml`, after the `futures = "0.3"` line add:

```toml
tokio-tungstenite = { version = "0.24", features = ["native-tls"] }
```

- [ ] **Step 2: Add feishu fields to Config struct**

In `src-tauri/src/config.rs`, find the `pub sample_entry_created: bool,` field and add after it:

```rust
    // Feishu bridge
    #[serde(default)]
    pub feishu_enabled: bool,
    #[serde(default)]
    pub feishu_app_id: String,
    #[serde(default)]
    pub feishu_app_secret: String,
    #[serde(default)]
    pub feishu_session_id: Option<String>,
```

- [ ] **Step 3: Add FeishuConfig type and Tauri commands to config.rs**

At the end of `src-tauri/src/config.rs`, append:

```rust
// ── Feishu bridge config ─────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeishuConfig {
    pub enabled: bool,
    pub app_id: String,
    pub app_secret: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeishuStatus {
    pub state: String, // "idle" | "connecting" | "connected" | "error"
    pub error: Option<String>,
}

#[tauri::command]
pub fn get_feishu_config(app: AppHandle) -> Result<FeishuConfig, String> {
    let cfg = load_config(&app)?;
    Ok(FeishuConfig {
        enabled: cfg.feishu_enabled,
        app_id: cfg.feishu_app_id,
        app_secret: cfg.feishu_app_secret,
    })
}

#[tauri::command]
pub fn set_feishu_config(app: AppHandle, config: FeishuConfig) -> Result<(), String> {
    let mut cfg = load_config(&app)?;
    let creds_changed = cfg.feishu_app_id != config.app_id
        || cfg.feishu_app_secret != config.app_secret;
    cfg.feishu_enabled = config.enabled;
    cfg.feishu_app_id = config.app_id;
    cfg.feishu_app_secret = config.app_secret;
    if creds_changed {
        cfg.feishu_session_id = None;
    }
    save_config(&app, &cfg)?;
    let _ = app.emit("feishu-config-changed", ());
    Ok(())
}

#[tauri::command]
pub fn get_feishu_status(app: AppHandle) -> FeishuStatus {
    use crate::feishu_bridge::BridgeStatusState;
    let state = app.state::<BridgeStatusState>();
    let guard = state.0.lock().unwrap_or_else(|e| e.into_inner());
    guard.clone()
}
```

- [ ] **Step 4: Verify it compiles**

```bash
cd src-tauri && cargo check 2>&1 | grep -E "^error" | head -20
```

Expected: errors only about missing `feishu_bridge` module (not yet created) and unregistered commands — that's fine for now.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/config.rs
git commit -m "feat(feishu): add config fields and Tauri commands"
```

---

## Task 2: Create feishu_bridge.rs

**Files:**
- Create: `src-tauri/src/feishu_bridge.rs`

- [ ] **Step 1: Create the file with types and state**

```bash
cat > src-tauri/src/feishu_bridge.rs << 'EOF'
use crate::config::{self, FeishuStatus};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tokio::time::{sleep, Duration};

// ── Public state (managed by Tauri) ──────────────────────

pub struct BridgeStatusState(pub Mutex<FeishuStatus>);

// ── Internal types ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeishuReplyCtx {
    pub message_id: String,
    pub chat_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeishuReplyPayload {
    pub reply_ctx: FeishuReplyCtx,
    pub result: String,
}

struct BridgeState {
    running: bool,
    pending: Vec<String>,
    reply_ctx: Option<FeishuReplyCtx>,
}

impl BridgeState {
    fn new() -> Self {
        Self { running: false, pending: vec![], reply_ctx: None }
    }
}

// ── Token management ──────────────────────────────────────

#[derive(Debug, Deserialize)]
struct TokenResponse {
    tenant_access_token: String,
    expire: u64,
}

async fn fetch_token(app_id: &str, app_secret: &str) -> Result<(String, u64), String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({ "app_id": app_id, "app_secret": app_secret });
    let resp = client
        .post("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("token request failed: {}", e))?;
    let tr: TokenResponse = resp.json().await.map_err(|e| format!("token parse failed: {}", e))?;
    Ok((tr.tenant_access_token, tr.expire))
}

// ── Reply sender ──────────────────────────────────────────

pub async fn send_reply(token: &str, message_id: &str, text: &str) -> Result<(), String> {
    const MAX_LEN: usize = 4000;
    let client = reqwest::Client::new();
    let chunks: Vec<&str> = if text.len() <= MAX_LEN {
        vec![text]
    } else {
        text.as_bytes()
            .chunks(MAX_LEN)
            .map(|c| std::str::from_utf8(c).unwrap_or(""))
            .collect()
    };
    for chunk in chunks {
        let content = serde_json::json!({ "text": chunk }).to_string();
        let body = serde_json::json!({ "msg_type": "text", "content": content });
        let url = format!(
            "https://open.feishu.cn/open-apis/im/v1/messages/{}/reply",
            message_id
        );
        client
            .post(&url)
            .bearer_auth(token)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("reply failed: {}", e))?;
    }
    Ok(())
}

// ── Status helpers ────────────────────────────────────────

fn set_status(app: &AppHandle, state: &str, error: Option<String>) {
    let status = FeishuStatus { state: state.to_string(), error };
    if let Ok(s) = app.try_state::<BridgeStatusState>() {
        let mut guard = s.0.lock().unwrap_or_else(|e| e.into_inner());
        *guard = status.clone();
    }
    let _ = app.emit("feishu-status-changed", status);
}

// ── Message accumulator ───────────────────────────────────

fn push_message(
    bridge_state: &Arc<Mutex<BridgeState>>,
    text: String,
    message_id: String,
    chat_id: String,
) -> Option<(String, FeishuReplyCtx)> {
    let mut s = bridge_state.lock().unwrap_or_else(|e| e.into_inner());
    s.pending.push(text);
    s.reply_ctx = Some(FeishuReplyCtx { message_id, chat_id });
    if s.running {
        // accumulate mode — caller will flush after Claude finishes
        None
    } else {
        // idle mode — signal to start debounce
        None // debounce handled in caller
    }
}

fn flush_pending(bridge_state: &Arc<Mutex<BridgeState>>) -> Option<(String, FeishuReplyCtx)> {
    let mut s = bridge_state.lock().unwrap_or_else(|e| e.into_inner());
    if s.pending.is_empty() {
        return None;
    }
    let batch = s.pending.join("\n\n---\n\n");
    let ctx = s.reply_ctx.clone()?;
    s.pending.clear();
    s.reply_ctx = None;
    s.running = true;
    Some((batch, ctx))
}

fn set_not_running(bridge_state: &Arc<Mutex<BridgeState>>) {
    let mut s = bridge_state.lock().unwrap_or_else(|e| e.into_inner());
    s.running = false;
}

fn is_running(bridge_state: &Arc<Mutex<BridgeState>>) -> bool {
    bridge_state.lock().unwrap_or_else(|e| e.into_inner()).running
}

fn has_pending(bridge_state: &Arc<Mutex<BridgeState>>) -> bool {
    !bridge_state.lock().unwrap_or_else(|e| e.into_inner()).pending.is_empty()
}

// ── submit_batch ──────────────────────────────────────────

async fn submit_batch(app: &AppHandle, text: String, reply_ctx: FeishuReplyCtx) {
    let result = crate::materials::import_text(app.clone(), text);
    match result {
        Ok(import_result) => {
            let _ = crate::ai_processor::enqueue_material(
                app,
                import_result.path,
                import_result.year_month,
                None,
                None,
                Some(reply_ctx),
            )
            .await;
        }
        Err(e) => {
            eprintln!("[feishu_bridge] import_text failed: {}", e);
        }
    }
}

// ── WebSocket event loop ──────────────────────────────────

#[derive(Debug, Deserialize)]
struct WsEvent {
    #[serde(rename = "type")]
    event_type: Option<String>,
    header: Option<WsHeader>,
    event: Option<WsMessageEvent>,
}

#[derive(Debug, Deserialize)]
struct WsHeader {
    event_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WsMessageEvent {
    message: Option<WsMessage>,
}

#[derive(Debug, Deserialize)]
struct WsMessage {
    message_id: Option<String>,
    chat_id: Option<String>,
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MessageContent {
    text: Option<String>,
}

async fn run_websocket(
    app: AppHandle,
    token: String,
    bridge_state: Arc<Mutex<BridgeState>>,
) -> Result<(), String> {
    use tokio_tungstenite::connect_async;
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;
    use futures::{SinkExt, StreamExt};

    let url = "wss://open.feishu.cn/event/v1/ws/";
    let mut request = url.into_client_request().map_err(|e| e.to_string())?;
    request
        .headers_mut()
        .insert("Authorization", format!("Bearer {}", token).parse().unwrap());

    let (ws_stream, _) = connect_async(request)
        .await
        .map_err(|e| format!("ws connect failed: {}", e))?;

    set_status(&app, "connected", None);
    eprintln!("[feishu_bridge] WebSocket connected");

    let (mut write, mut read) = ws_stream.split();

    // Debounce timer handle
    let debounce_state = bridge_state.clone();
    let debounce_app = app.clone();
    let (debounce_tx, mut debounce_rx) =
        tokio::sync::mpsc::channel::<()>(8);

    // Debounce task: waits 3s after last signal, then flushes if not running
    tokio::spawn(async move {
        loop {
            // Wait for first signal
            if debounce_rx.recv().await.is_none() {
                break;
            }
            // Drain any rapid follow-ups within 3s window
            loop {
                match tokio::time::timeout(Duration::from_secs(3), debounce_rx.recv()).await {
                    Ok(Some(())) => continue, // reset window
                    _ => break,
                }
            }
            // Only flush if not already running
            if !is_running(&debounce_state) {
                if let Some((batch, ctx)) = flush_pending(&debounce_state) {
                    submit_batch(&debounce_app, batch, ctx).await;
                }
            }
        }
    });

    // Listen for feishu-reply-ready to send replies and flush pending
    let reply_state = bridge_state.clone();
    let reply_app = app.clone();
    let reply_token = token.clone();
    let _reply_listener = app.listen("feishu-reply-ready", move |event| {
        let payload_str = event.payload().to_string();
        let reply_state = reply_state.clone();
        let reply_app = reply_app.clone();
        let reply_token = reply_token.clone();
        tauri::async_runtime::spawn(async move {
            if let Ok(payload) = serde_json::from_str::<FeishuReplyPayload>(&payload_str) {
                if let Err(e) = send_reply(&reply_token, &payload.reply_ctx.message_id, &payload.result).await {
                    eprintln!("[feishu_bridge] send_reply error: {}", e);
                }
            }
            set_not_running(&reply_state);
            // Flush any accumulated messages
            if has_pending(&reply_state) {
                if let Some((batch, ctx)) = flush_pending(&reply_state) {
                    submit_batch(&reply_app, batch, ctx).await;
                }
            }
        });
    });

    // Heartbeat task (30s ping)
    let mut heartbeat = tokio::time::interval(Duration::from_secs(30));
    heartbeat.tick().await; // skip immediate first tick

    loop {
        tokio::select! {
            _ = heartbeat.tick() => {
                use tokio_tungstenite::tungstenite::Message;
                let _ = write.send(Message::Ping(vec![])).await;
            }
            msg = read.next() => {
                match msg {
                    Some(Ok(tokio_tungstenite::tungstenite::Message::Text(text))) => {
                        if let Ok(event) = serde_json::from_str::<WsEvent>(&text) {
                            let is_message = event
                                .header
                                .as_ref()
                                .and_then(|h| h.event_type.as_deref())
                                == Some("im.message.receive_v1");
                            if is_message {
                                if let Some(msg_event) = event.event {
                                    if let Some(msg) = msg_event.message {
                                        let message_id = msg.message_id.unwrap_or_default();
                                        let chat_id = msg.chat_id.unwrap_or_default();
                                        let raw_content = msg.content.unwrap_or_default();
                                        let text = serde_json::from_str::<MessageContent>(&raw_content)
                                            .ok()
                                            .and_then(|c| c.text)
                                            .unwrap_or(raw_content);
                                        // Strip @bot mention
                                        let text = text
                                            .split_once('@')
                                            .map(|(before, after)| {
                                                // Remove the @mention token (word after @)
                                                let rest = after.splitn(2, ' ').nth(1).unwrap_or("").trim();
                                                format!("{}{}", before.trim(), if rest.is_empty() { String::new() } else { format!(" {}", rest) })
                                            })
                                            .unwrap_or(text)
                                            .trim()
                                            .to_string();

                                        if text.is_empty() {
                                            continue;
                                        }

                                        eprintln!("[feishu_bridge] received message: {}", &text[..text.len().min(80)]);
                                        push_message(&bridge_state, text, message_id, chat_id);

                                        if !is_running(&bridge_state) {
                                            let _ = debounce_tx.try_send(());
                                        }
                                        // If running, message is accumulated — no debounce needed
                                    }
                                }
                            }
                        }
                    }
                    Some(Ok(tokio_tungstenite::tungstenite::Message::Close(_))) | None => {
                        eprintln!("[feishu_bridge] WebSocket closed");
                        return Err("connection closed".to_string());
                    }
                    Some(Err(e)) => {
                        return Err(format!("ws error: {}", e));
                    }
                    _ => {}
                }
            }
        }
    }
}

// ── Main run loop ─────────────────────────────────────────

pub async fn run(app: AppHandle) {
    let bridge_state = Arc::new(Mutex::new(BridgeState::new()));
    let mut backoff_secs = 1u64;

    loop {
        let cfg = match config::load_config(&app) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[feishu_bridge] config load error: {}", e);
                sleep(Duration::from_secs(5)).await;
                continue;
            }
        };

        if !cfg.feishu_enabled {
            set_status(&app, "idle", None);
            // Wait for config change
            let (tx, mut rx) = tokio::sync::oneshot::channel::<()>();
            let tx = std::sync::Mutex::new(Some(tx));
            let _listener = app.listen("feishu-config-changed", move |_| {
                if let Ok(mut guard) = tx.lock() {
                    if let Some(sender) = guard.take() {
                        let _ = sender.send(());
                    }
                }
            });
            let _ = rx.await;
            continue;
        }

        set_status(&app, "connecting", None);
        eprintln!("[feishu_bridge] fetching token...");

        let token = match fetch_token(&cfg.feishu_app_id, &cfg.feishu_app_secret).await {
            Ok((t, _expire)) => {
                backoff_secs = 1;
                t
            }
            Err(e) => {
                let msg = format!("获取 token 失败: {}", e);
                eprintln!("[feishu_bridge] {}", msg);
                set_status(&app, "error", Some(msg));
                sleep(Duration::from_secs(30)).await;
                continue;
            }
        };

        // Listen for config changes to restart
        let (restart_tx, mut restart_rx) = tokio::sync::oneshot::channel::<()>();
        let restart_tx = std::sync::Mutex::new(Some(restart_tx));
        let _config_listener = app.listen("feishu-config-changed", move |_| {
            if let Ok(mut guard) = restart_tx.lock() {
                if let Some(sender) = guard.take() {
                    let _ = sender.send(());
                }
            }
        });

        let ws_result = tokio::select! {
            r = run_websocket(app.clone(), token, bridge_state.clone()) => r,
            _ = &mut restart_rx => {
                eprintln!("[feishu_bridge] config changed, restarting");
                Ok(())
            }
        };

        match ws_result {
            Ok(()) => {
                // Config changed restart — reset backoff
                backoff_secs = 1;
            }
            Err(e) => {
                eprintln!("[feishu_bridge] ws error: {}, reconnecting in {}s", e, backoff_secs);
                set_status(&app, "connecting", None);
                sleep(Duration::from_secs(backoff_secs)).await;
                backoff_secs = (backoff_secs * 2).min(60);
            }
        }
    }
}
EOF
- [ ] **Step 2: Verify file was created**

```bash
wc -l src-tauri/src/feishu_bridge.rs
```

Expected: ~280 lines

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/feishu_bridge.rs
git commit -m "feat(feishu): add feishu_bridge.rs with WebSocket client and accumulator"
```

---

## Task 3: Modify ai_processor.rs

**Files:**
- Modify: `src-tauri/src/ai_processor.rs`

- [ ] **Step 1: Add FeishuReplyCtx import and reply_ctx to QueueTask**

At the top of `src-tauri/src/ai_processor.rs`, the existing imports include `use crate::config;`. Add after it:

```rust
use crate::feishu_bridge::{FeishuReplyCtx, FeishuReplyPayload};
```

Find the `QueueTask` struct (around line 17):

```rust
pub struct QueueTask {
    material_path: String,
    year_month: String,
    note: Option<String>,
    prompt_text: Option<String>,
}
```

Replace with:

```rust
pub struct QueueTask {
    pub material_path: String,
    pub year_month: String,
    pub note: Option<String>,
    pub prompt_text: Option<String>,
    pub reply_ctx: Option<FeishuReplyCtx>,
}
```

- [ ] **Step 2: Update enqueue_material signature to accept reply_ctx**

Find `pub async fn enqueue_material(` and update its signature and body:

```rust
pub async fn enqueue_material(
    app: &AppHandle,
    material_path: String,
    year_month: String,
    note: Option<String>,
    prompt_text: Option<String>,
    reply_ctx: Option<FeishuReplyCtx>,
) -> Result<(), String> {
    let _ = app.emit(
        "ai-processing",
        ProcessingUpdate {
            material_path: material_path.clone(),
            status: "queued".to_string(),
            error: None,
        },
    );

    let tx = app.state::<AiQueue>().0.clone();
    tx.send(QueueTask {
        material_path,
        year_month,
        note,
        prompt_text,
        reply_ctx,
    })
    .await
    .map_err(|e| format!("队列发送失败: {}", e))?;

    Ok(())
}
```

- [ ] **Step 3: Fix all existing callers of enqueue_material**

Search for all call sites:

```bash
grep -n "enqueue_material" src-tauri/src/*.rs
```

For each call site that doesn't pass `reply_ctx`, add `None` as the last argument. Typical existing calls look like:

```rust
enqueue_material(app, material_path, year_month, note, prompt_text).await
```

Change to:

```rust
enqueue_material(app, material_path, year_month, note, prompt_text, None).await
```

- [ ] **Step 4: Add session management to process_material**

In `process_material`, find the section that builds `args` (after `build_claude_args_with_creds` call). The current code generates a random `session_id` and writes it to a temp file. Replace that entire block (from `let t = std::time::SystemTime::now()` through `args.push(session_id);`) with:

```rust
    // Feishu session resume: if a feishu session_id is stored, use --resume
    // Only apply when this task has a reply_ctx (i.e. it came from Feishu)
    let feishu_session_id = cfg.feishu_session_id.clone();
    let has_reply_ctx = task_reply_ctx.is_some();
    if has_reply_ctx {
        if let Some(ref sid) = feishu_session_id {
            args.push("--resume".to_string());
            args.push(sid.clone());
        }
    }
```

Note: `task_reply_ctx` needs to be passed into `process_material`. Update the function signature:

```rust
pub async fn process_material(
    app: &AppHandle,
    material_path: &str,
    year_month: &str,
    note: Option<&str>,
    prompt_text: Option<&str>,
    current_task: &tauri::State<'_, CurrentTask>,
    reply_ctx: Option<FeishuReplyCtx>,
) -> Result<(), String> {
```

And update the call site in `start_queue_consumer`:

```rust
let result = AssertUnwindSafe(process_material(
    &app,
    &task.material_path,
    &task.year_month,
    task.note.as_deref(),
    task.prompt_text.as_deref(),
    &current_task,
    task.reply_ctx.clone(),
))
.catch_unwind()
.await;
```

- [ ] **Step 5: Capture result text and emit feishu-reply-ready on completion**

In `process_material`, find the stdout reading loop. The loop currently sets `final_result` but doesn't capture the actual text output. Add a `last_result_text` accumulator.

Find the line `let mut final_result: Result<(), String> = Ok(());` and add after it:

```rust
    let mut last_result_text: Option<String> = None;
```

Inside the loop, find the `"result" =>` match arm in `extract_log_line` — but actually we need to capture the raw `result` field from the JSON directly in the loop. Find the block:

```rust
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&line) {
            if val.get("type").and_then(|v| v.as_str()) == Some("result") {
```

Add inside that block, before the `break`:

```rust
                // Capture Claude's final output text for Feishu reply
                if !is_error {
                    last_result_text = val
                        .get("result")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    // Also persist session_id for Feishu resume
                    if reply_ctx.is_some() {
                        if let Some(sid) = val.get("session_id").and_then(|v| v.as_str()) {
                            if let Ok(mut c) = config::load_config(app) {
                                c.feishu_session_id = Some(sid.to_string());
                                let _ = config::save_config(app, &c);
                            }
                        }
                    }
                }
```

- [ ] **Step 6: Emit feishu-reply-ready on successful completion**

In the `match final_result {` block, find `Ok(()) => {` and add after the existing emits:

```rust
            // Feishu reply
            if let Some(ctx) = reply_ctx {
                let result_text = last_result_text.unwrap_or_else(|| "完成".to_string());
                let _ = app_clone.emit(
                    "feishu-reply-ready",
                    FeishuReplyPayload { reply_ctx: ctx, result: result_text },
                );
            }
```

For the `Err(err) =>` branch, add:

```rust
            // Feishu reply on failure
            if let Some(ctx) = reply_ctx {
                let _ = app_clone.emit(
                    "feishu-reply-ready",
                    FeishuReplyPayload {
                        reply_ctx: ctx,
                        result: "处理失败，请重试".to_string(),
                    },
                );
            }
```

- [ ] **Step 7: Check compilation**

```bash
cd src-tauri && cargo check 2>&1 | grep "^error" | head -20
```

Expected: errors only about unregistered commands in main.rs — not type errors.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/ai_processor.rs
git commit -m "feat(feishu): add reply_ctx to QueueTask, session resume, emit feishu-reply-ready"
```

---

## Task 4: Wire into main.rs

**Files:**
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Add mod declaration**

Find `mod auto_dream;` and add after it:

```rust
mod feishu_bridge;
```

- [ ] **Step 2: Add managed state**

Find `.manage(auto_dream::DreamRunning(std::sync::Mutex::new(false)))` and add after it:

```rust
        .manage(feishu_bridge::BridgeStatusState(std::sync::Mutex::new(
            crate::config::FeishuStatus { state: "idle".to_string(), error: None },
        )))
```

- [ ] **Step 3: Spawn bridge task**

Find `auto_dream::start_scheduler(app.handle().clone());` and add after it:

```rust
                // ── Feishu bridge ──
                tauri::async_runtime::spawn(feishu_bridge::run(app.handle().clone()));
```

- [ ] **Step 4: Register Tauri commands**

Find the `invoke_handler` block. Add these three commands alongside the other config commands:

```rust
            config::get_feishu_config,
            config::set_feishu_config,
            config::get_feishu_status,
```

- [ ] **Step 5: Full compile check**

```bash
cd src-tauri && cargo check 2>&1 | grep "^error" | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/main.rs
git commit -m "feat(feishu): register bridge in main.rs"
```

---

## Task 5: Frontend types, tauri.ts, i18n, navigation

**Files:**
- Modify: `src/lib/tauri.ts`
- Modify: `src/locales/en.ts`
- Modify: `src/locales/zh.ts`
- Modify: `src/settings/navigation.ts`

- [ ] **Step 1: Add Feishu IPC wrappers to tauri.ts**

At the end of `src/lib/tauri.ts`, append:

```typescript
// Feishu bridge
export interface FeishuConfig {
  enabled: boolean
  app_id: string
  app_secret: string
}

export interface FeishuStatus {
  state: 'idle' | 'connecting' | 'connected' | 'error'
  error: string | null
}

export const getFeishuConfig = (): Promise<FeishuConfig> =>
  invoke<FeishuConfig>('get_feishu_config')

export const setFeishuConfig = (config: FeishuConfig): Promise<void> =>
  invoke<void>('set_feishu_config', { config })

export const getFeishuStatus = (): Promise<FeishuStatus> =>
  invoke<FeishuStatus>('get_feishu_status')
```

- [ ] **Step 2: Add i18n keys to en.ts**

Find `// Settings: Automation` in `src/locales/en.ts` and add before it:

```typescript
  // Settings: Feishu bridge
  feishu: 'Feishu',
  feishuSection: 'Feishu Bridge',
  feishuEnable: 'Enable Feishu bridge',
  feishuAppId: 'App ID',
  feishuAppSecret: 'App Secret',
  feishuAppIdPlaceholder: 'cli_xxxxxxxxxx',
  feishuAppSecretPlaceholder: 'xxxxxxxxxxxxxxxx',
  feishuSave: 'Save & Connect',
  feishuStatusIdle: 'Disabled',
  feishuStatusConnecting: 'Connecting…',
  feishuStatusConnected: 'Connected',
  feishuStatusError: 'Connection failed',
  feishuHint: 'Create a self-built app in Feishu Open Platform and enable the im.message.receive_v1 event.',

```

- [ ] **Step 3: Add i18n keys to zh.ts**

Find `// Settings: Automation` in `src/locales/zh.ts` and add before it:

```typescript
  // Settings: Feishu bridge
  feishu: '飞书',
  feishuSection: '飞书远程',
  feishuEnable: '启用飞书远程',
  feishuAppId: 'App ID',
  feishuAppSecret: 'App Secret',
  feishuAppIdPlaceholder: 'cli_xxxxxxxxxx',
  feishuAppSecretPlaceholder: 'xxxxxxxxxxxxxxxx',
  feishuSave: '保存并连接',
  feishuStatusIdle: '未启用',
  feishuStatusConnecting: '连接中…',
  feishuStatusConnected: '已连接',
  feishuStatusError: '连接失败',
  feishuHint: '在飞书开放平台创建自建应用，开启 im.message.receive_v1 事件订阅。',

```

- [ ] **Step 4: Add 'feishu' to navigation.ts**

In `src/settings/navigation.ts`, update `NavId`:

```typescript
export type NavId = 'general' | 'ai' | 'voice' | 'permissions' | 'automation' | 'plugins' | 'feishu' | 'about'
```

Update `ALL_NAV_IDS`:

```typescript
export const ALL_NAV_IDS: NavId[] = [
  'general',
  'ai',
  'voice',
  'permissions',
  'automation',
  'plugins',
  'feishu',
  'about',
]
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/tauri.ts src/locales/en.ts src/locales/zh.ts src/settings/navigation.ts
git commit -m "feat(feishu): add frontend types, i18n keys, navigation entry"
```

---

## Task 6: Create SectionFeishu.tsx

**Files:**
- Create: `src/settings/components/SectionFeishu.tsx`

- [ ] **Step 1: Create the component**

```bash
cat > src/settings/components/SectionFeishu.tsx << 'EOF'
import { useState, useEffect, useRef } from 'react'
import { getFeishuConfig, setFeishuConfig, getFeishuStatus, type FeishuConfig, type FeishuStatus } from '../../lib/tauri'
import { useTranslation } from '../../contexts/I18nContext'

const sectionStyle: React.CSSProperties = { padding: '28px 28px 180px', borderBottom: '1px solid var(--divider)' }
const labelStyle: React.CSSProperties = { fontSize: 13, color: 'var(--item-meta)', marginBottom: 5, display: 'block' }
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--detail-case-bg)', border: '1px solid var(--divider)',
  borderRadius: 6, padding: '7px 10px', fontSize: 14, color: 'var(--item-text)',
  fontFamily: 'ui-monospace, monospace', outline: 'none', boxSizing: 'border-box',
}
const hintStyle: React.CSSProperties = { fontSize: 12, color: 'var(--duration-text)', marginTop: 4, lineHeight: 1.5 }

function StatusDot({ state }: { state: FeishuStatus['state'] }) {
  const colors: Record<FeishuStatus['state'], string> = {
    idle: 'var(--item-meta)',
    connecting: '#f5a623',
    connected: '#4caf50',
    error: 'var(--record-btn)',
  }
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: colors[state], marginRight: 6, flexShrink: 0,
    }} />
  )
}

export default function SectionFeishu() {
  const { t } = useTranslation()
  const [cfg, setCfg] = useState<FeishuConfig>({ enabled: false, app_id: '', app_secret: '' })
  const [status, setStatus] = useState<FeishuStatus>({ state: 'idle', error: null })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    Promise.all([getFeishuConfig(), getFeishuStatus()]).then(([c, s]) => {
      setCfg(c)
      setStatus(s)
      setLoading(false)
    })
  }, [])

  // Poll status every 3s
  useEffect(() => {
    pollRef.current = setInterval(() => {
      getFeishuStatus().then(setStatus)
    }, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await setFeishuConfig(cfg)
    } finally {
      setSaving(false)
    }
  }

  const statusLabel = () => {
    if (status.state === 'error' && status.error) return `${t('feishuStatusError')}: ${status.error}`
    const map: Record<FeishuStatus['state'], string> = {
      idle: t('feishuStatusIdle'),
      connecting: t('feishuStatusConnecting'),
      connected: t('feishuStatusConnected'),
      error: t('feishuStatusError'),
    }
    return map[status.state]
  }

  if (loading) return <div style={sectionStyle} />

  return (
    <div style={sectionStyle}>
      <div style={{ fontSize: 13, color: 'var(--month-label)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20, fontWeight: 500 }}>
        {t('feishuSection')}
      </div>

      {/* Enable toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <span style={{ fontSize: 14, color: 'var(--item-text)' }}>{t('feishuEnable')}</span>
        <button
          onClick={() => setCfg(prev => ({ ...prev, enabled: !prev.enabled }))}
          style={{
            width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
            background: cfg.enabled ? 'var(--record-btn)' : 'var(--divider)',
            position: 'relative', transition: 'background 0.2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: cfg.enabled ? 21 : 3,
            width: 16, height: 16, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {/* App ID */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>{t('feishuAppId')}</label>
        <input
          style={inputStyle}
          type="text"
          value={cfg.app_id}
          placeholder={t('feishuAppIdPlaceholder')}
          onChange={e => setCfg(prev => ({ ...prev, app_id: e.target.value }))}
        />
      </div>

      {/* App Secret */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>{t('feishuAppSecret')}</label>
        <input
          style={inputStyle}
          type="password"
          value={cfg.app_secret}
          placeholder={t('feishuAppSecretPlaceholder')}
          onChange={e => setCfg(prev => ({ ...prev, app_secret: e.target.value }))}
        />
      </div>

      {/* Save button + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleSave}
          disabled={saving || status.state === 'connecting'}
          style={{
            padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: 'var(--record-btn)', color: '#fff', fontSize: 13,
            opacity: (saving || status.state === 'connecting') ? 0.5 : 1,
          }}
        >
          {saving ? '…' : t('feishuSave')}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--item-meta)' }}>
          <StatusDot state={status.state} />
          {statusLabel()}
        </div>
      </div>

      <p style={hintStyle}>{t('feishuHint')}</p>
    </div>
  )
}
EOF
- [ ] **Step 2: Commit**

```bash
git add src/settings/components/SectionFeishu.tsx
git commit -m "feat(feishu): add SectionFeishu settings UI component"
```

---

## Task 7: Wire SectionFeishu into SettingsLayout

**Files:**
- Modify: `src/settings/SettingsLayout.tsx`

- [ ] **Step 1: Add import**

At the top of `src/settings/SettingsLayout.tsx`, find the existing section imports and add:

```typescript
import SectionFeishu from './components/SectionFeishu'
```

- [ ] **Step 2: Add nav item**

Find the `NAV_ITEMS` array definition. It currently ends with `{ id: 'plugins', ... }` and `{ id: 'about', ... }`. Add between them:

```typescript
    { id: 'feishu', label: t('feishu'), icon: MessageSquare },
```

Also add `MessageSquare` to the lucide-react import at the top:

```typescript
import {
  Settings2,
  Cpu,
  Mic,
  ShieldCheck,
  Timer,
  Puzzle,
  MessageSquare,
  Info,
  type LucideIcon,
} from 'lucide-react'
```

- [ ] **Step 3: Add section to SettingsContent**

In the `SettingsContent` component, find:

```tsx
<section id="about" ref={(el) => registerSectionRef('about', el)} style={{ paddingBottom: 40 }}><SectionAbout /></section>
```

Add before it:

```tsx
<section id="feishu" ref={(el) => registerSectionRef('feishu', el)}><SectionFeishu /></section>
```

- [ ] **Step 4: Commit**

```bash
git add src/settings/SettingsLayout.tsx
git commit -m "feat(feishu): add Feishu section to settings layout"
```

---

## Task 8: Build verification

- [ ] **Step 1: TypeScript check**

```bash
npm run build 2>&1 | grep -E "error TS|Error" | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 2: Rust compile check**

```bash
cd src-tauri && cargo check 2>&1 | grep "^error" | head -20
```

Expected: no errors.

- [ ] **Step 3: Full build**

```bash
npm run build 2>&1 | tail -5
```

Expected: build completes successfully.

- [ ] **Step 4: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix(feishu): address build errors"
```

---

## Task 9: Manual smoke test

- [ ] **Step 1: Start dev server**

Run in a separate terminal (do not run via Claude):
```
npm run tauri dev
```

- [ ] **Step 2: Verify settings section appears**

Open Settings (Cmd+,) → scroll to "飞书" section. Confirm:
- Toggle, App ID, App Secret fields visible
- Status shows "未启用" with gray dot

- [ ] **Step 3: Test enable/save flow**

Enter a test App ID and App Secret, toggle on, click "保存并连接". Confirm:
- Status changes to "连接中…" (yellow dot)
- After a few seconds: either "已连接" (green) or "连接失败: ..." (red with error message)

- [ ] **Step 4: Test disable**

Toggle off, click save. Confirm status returns to "未启用".

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(feishu): complete Feishu bridge implementation"
```

