use crate::config::{self, FeishuStatus};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Listener, Manager};
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
    if let Some(s) = app.try_state::<BridgeStatusState>() {
        let mut guard = s.0.lock().unwrap_or_else(|e: std::sync::PoisonError<_>| e.into_inner());
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
) {
    let mut s = bridge_state.lock().unwrap_or_else(|e| e.into_inner());
    s.pending.push(text);
    s.reply_ctx = Some(FeishuReplyCtx { message_id, chat_id });
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
    use futures::{SinkExt, StreamExt};
    use tokio_tungstenite::connect_async;
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;

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

    // Debounce channel: idle mode sends a signal here when a message arrives
    let (debounce_tx, mut debounce_rx) = tokio::sync::mpsc::channel::<()>(8);

    // Debounce task: waits 3s after last signal, then flushes if not running
    let debounce_state = bridge_state.clone();
    let debounce_app = app.clone();
    tokio::spawn(async move {
        loop {
            if debounce_rx.recv().await.is_none() {
                break;
            }
            // Drain rapid follow-ups within 3s window
            loop {
                match tokio::time::timeout(Duration::from_secs(3), debounce_rx.recv()).await {
                    Ok(Some(())) => continue,
                    _ => break,
                }
            }
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
    let _reply_listener = app.listen("feishu-reply-ready", move |event: tauri::Event| {
        let payload_str = event.payload().to_string();
        let reply_state = reply_state.clone();
        let reply_app = reply_app.clone();
        let reply_token = reply_token.clone();
        tauri::async_runtime::spawn(async move {
            if let Ok(payload) = serde_json::from_str::<FeishuReplyPayload>(&payload_str) {
                if let Err(e) =
                    send_reply(&reply_token, &payload.reply_ctx.message_id, &payload.result).await
                {
                    eprintln!("[feishu_bridge] send_reply error: {}", e);
                }
            }
            set_not_running(&reply_state);
            if has_pending(&reply_state) {
                if let Some((batch, ctx)) = flush_pending(&reply_state) {
                    submit_batch(&reply_app, batch, ctx).await;
                }
            }
        });
    });

    // Heartbeat (30s ping)
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
                                        let text = if let Some(at_pos) = text.find('@') {
                                            let before = text[..at_pos].trim();
                                            let after = &text[at_pos + 1..];
                                            let rest = after.splitn(2, ' ').nth(1).unwrap_or("").trim();
                                            if rest.is_empty() {
                                                before.to_string()
                                            } else if before.is_empty() {
                                                rest.to_string()
                                            } else {
                                                format!("{} {}", before, rest)
                                            }
                                        } else {
                                            text
                                        };
                                        let text = text.trim().to_string();

                                        if text.is_empty() {
                                            continue;
                                        }

                                        eprintln!(
                                            "[feishu_bridge] received: {}",
                                            &text[..text.len().min(80)]
                                        );
                                        push_message(&bridge_state, text, message_id, chat_id);

                                        if !is_running(&bridge_state) {
                                            let _ = debounce_tx.try_send(());
                                        }
                                        // If running, message is accumulated — flush happens after Claude finishes
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
            // Wait for config change before re-checking
            let (tx, rx) = tokio::sync::oneshot::channel::<()>();
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

        // Listen for config changes to trigger restart
        let (restart_tx, restart_rx) = tokio::sync::oneshot::channel::<()>();
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
            _ = restart_rx => {
                eprintln!("[feishu_bridge] config changed, restarting");
                Ok(())
            }
        };

        match ws_result {
            Ok(()) => {
                backoff_secs = 1;
            }
            Err(e) => {
                eprintln!("[feishu_bridge] error: {}, reconnecting in {}s", e, backoff_secs);
                set_status(&app, "connecting", None);
                sleep(Duration::from_secs(backoff_secs)).await;
                backoff_secs = (backoff_secs * 2).min(60);
            }
        }
    }
}
