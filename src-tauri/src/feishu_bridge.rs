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

fn safe_utf8_chunks(text: &str, max_bytes: usize) -> Vec<String> {
    if text.len() <= max_bytes {
        return vec![text.to_string()];
    }
    let mut chunks = Vec::new();
    let mut start = 0;
    while start < text.len() {
        let end = (start + max_bytes).min(text.len());
        let end = (0..=end - start)
            .rev()
            .map(|i| start + i)
            .find(|&i| text.is_char_boundary(i))
            .unwrap_or(start + 1);
        if end <= start {
            break;
        }
        chunks.push(text[start..end].to_string());
        start = end;
    }
    chunks
}

pub async fn send_reply(token: &str, message_id: &str, text: &str) -> Result<(), String> {
    const MAX_LEN: usize = 4000;
    let client = reqwest::Client::new();
    let chunks = safe_utf8_chunks(text, MAX_LEN);
    for chunk in &chunks {
        let content = serde_json::json!({ "text": chunk }).to_string();
        let body = serde_json::json!({ "msg_type": "text", "content": content });
        let url = format!(
            "https://open.feishu.cn/open-apis/im/v1/messages/{}/reply",
            message_id
        );
        let resp = client
            .post(&url)
            .bearer_auth(token)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("reply failed: {}", e))?;
        if resp.status() == 401 {
            return Err("TOKEN_EXPIRED".to_string());
        }
        if !resp.status().is_success() {
            return Err(format!("reply HTTP {}", resp.status()));
        }
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
    msg_type: Option<String>,
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MessageContent {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ImageContent {
    image_key: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FileContent {
    file_key: Option<String>,
    file_name: Option<String>,
}

async fn download_resource(
    token: &str,
    message_id: &str,
    file_key: &str,
    resource_type: &str,
    filename: &str,
) -> Result<std::path::PathBuf, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://open.feishu.cn/open-apis/im/v1/messages/{}/resources/{}?type={}",
        message_id, file_key, resource_type
    );
    let resp = client
        .get(&url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("download failed: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("download HTTP {}", resp.status()));
    }
    let bytes = resp.bytes().await.map_err(|e| format!("read bytes failed: {}", e))?;
    let tmp_path = std::env::temp_dir().join(filename);
    std::fs::write(&tmp_path, &bytes).map_err(|e| format!("write temp failed: {}", e))?;
    Ok(tmp_path)
}

async fn export_feishu_doc(token: &str, doc_token: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "file_extension": "md",
        "token": doc_token,
        "type": "docx"
    });
    let resp = client
        .post("https://open.feishu.cn/open-apis/drive/v1/export_tasks")
        .bearer_auth(token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("export task failed: {}", e))?;
    let val: serde_json::Value = resp.json().await.map_err(|e| format!("export parse failed: {}", e))?;
    let ticket = val.pointer("/data/ticket")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("no ticket in response: {}", val))?
        .to_string();

    let mut file_token = String::new();
    for _ in 0..15 {
        tokio::time::sleep(Duration::from_secs(2)).await;
        let poll_url = format!(
            "https://open.feishu.cn/open-apis/drive/v1/export_tasks/{}?token={}",
            ticket, doc_token
        );
        let poll_resp = client
            .get(&poll_url)
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| format!("poll failed: {}", e))?;
        let poll_val: serde_json::Value = poll_resp.json().await.map_err(|e| format!("poll parse: {}", e))?;
        let status = poll_val.pointer("/data/result/job_status")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        if status == 0 {
            file_token = poll_val.pointer("/data/result/file_token")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            break;
        }
        if status == 3 {
            return Err("export failed".to_string());
        }
    }
    if file_token.is_empty() {
        return Err("export timed out".to_string());
    }

    let dl_url = format!(
        "https://open.feishu.cn/open-apis/drive/v1/export_tasks/{}/download",
        ticket
    );
    let dl_resp = client
        .get(&dl_url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("download failed: {}", e))?;
    let bytes = dl_resp.bytes().await.map_err(|e| format!("read bytes: {}", e))?;
    String::from_utf8(bytes.to_vec()).map_err(|e| format!("utf8: {}", e))
}

fn extract_feishu_doc_token(text: &str) -> Option<String> {
    let patterns = ["/docx/", "/docs/"];
    for pat in &patterns {
        if let Some(pos) = text.find(pat) {
            let after = &text[pos + pat.len()..];
            let token: String = after.chars()
                .take_while(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
                .collect();
            if token.len() > 8 {
                return Some(token);
            }
        }
    }
    None
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
    let auth_value = format!("Bearer {}", token)
        .parse()
        .map_err(|e| format!("invalid token for header: {}", e))?;
    request.headers_mut().insert("Authorization", auth_value);

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
                                        let msg_type = msg.msg_type.as_deref().unwrap_or("text");

                                        let text_opt: Option<String> = match msg_type {
                                            "text" => {
                                                let text = serde_json::from_str::<MessageContent>(&raw_content)
                                                    .ok()
                                                    .and_then(|c| c.text)
                                                    .unwrap_or(raw_content);
                                                // Strip @bot mention
                                                let text = if let Some(at_pos) = text.find('@') {
                                                    let before = text[..at_pos].trim();
                                                    let after = &text[at_pos + 1..];
                                                    let rest = after.splitn(2, ' ').nth(1).unwrap_or("").trim();
                                                    if rest.is_empty() { before.to_string() }
                                                    else if before.is_empty() { rest.to_string() }
                                                    else { format!("{} {}", before, rest) }
                                                } else { text };
                                                let text = text.trim().to_string();
                                                // Check for Feishu doc link
                                                if let Some(doc_token) = extract_feishu_doc_token(&text) {
                                                    let token_clone = token.clone();
                                                    let app_clone = app.clone();
                                                    let bridge_clone = bridge_state.clone();
                                                    let debounce_tx_clone = debounce_tx.clone();
                                                    let mid = message_id.clone();
                                                    let cid = chat_id.clone();
                                                    tokio::spawn(async move {
                                                        eprintln!("[feishu_bridge] exporting doc token: {}", doc_token);
                                                        match export_feishu_doc(&token_clone, &doc_token).await {
                                                            Ok(md_text) => {
                                                                push_message(&bridge_clone, md_text, mid, cid);
                                                                if !is_running(&bridge_clone) {
                                                                    let _ = debounce_tx_clone.try_send(());
                                                                }
                                                            }
                                                            Err(e) => eprintln!("[feishu_bridge] doc export failed: {}", e),
                                                        }
                                                    });
                                                    None
                                                } else if text.is_empty() {
                                                    None
                                                } else {
                                                    Some(text)
                                                }
                                            }
                                            "image" => {
                                                let image_key = serde_json::from_str::<ImageContent>(&raw_content)
                                                    .ok()
                                                    .and_then(|c| c.image_key)
                                                    .unwrap_or_default();
                                                if image_key.is_empty() { None } else {
                                                    let token_clone = token.clone();
                                                    let app_clone = app.clone();
                                                    let mid = message_id.clone();
                                                    let cid = chat_id.clone();
                                                    tokio::spawn(async move {
                                                        let filename = format!("{}.jpg", &image_key[..image_key.len().min(16)]);
                                                        match download_resource(&token_clone, &mid, &image_key, "image", &filename).await {
                                                            Ok(path) => {
                                                                let path_str = path.to_string_lossy().to_string();
                                                                let result = crate::materials::import_file(app_clone.clone(), path_str);
                                                                if let Ok(import_result) = result {
                                                                    let reply_ctx = FeishuReplyCtx { message_id: mid, chat_id: cid };
                                                                    let _ = crate::ai_processor::enqueue_material(
                                                                        &app_clone, import_result.path, import_result.year_month,
                                                                        None, None, Some(reply_ctx),
                                                                    ).await;
                                                                }
                                                            }
                                                            Err(e) => eprintln!("[feishu_bridge] image download failed: {}", e),
                                                        }
                                                    });
                                                    None
                                                }
                                            }
                                            "file" | "audio" | "video" => {
                                                let file_content = serde_json::from_str::<FileContent>(&raw_content).ok();
                                                let file_key = file_content.as_ref().and_then(|c| c.file_key.clone()).unwrap_or_default();
                                                let file_name = file_content.as_ref().and_then(|c| c.file_name.clone())
                                                    .unwrap_or_else(|| format!("{}.bin", &file_key[..file_key.len().min(8)]));
                                                if file_key.is_empty() { None } else {
                                                    let token_clone = token.clone();
                                                    let app_clone = app.clone();
                                                    let mid = message_id.clone();
                                                    let cid = chat_id.clone();
                                                    tokio::spawn(async move {
                                                        match download_resource(&token_clone, &mid, &file_key, "file", &file_name).await {
                                                            Ok(path) => {
                                                                let path_str = path.to_string_lossy().to_string();
                                                                let result = crate::materials::import_file(app_clone.clone(), path_str);
                                                                if let Ok(import_result) = result {
                                                                    let reply_ctx = FeishuReplyCtx { message_id: mid, chat_id: cid };
                                                                    let _ = crate::ai_processor::enqueue_material(
                                                                        &app_clone, import_result.path, import_result.year_month,
                                                                        None, None, Some(reply_ctx),
                                                                    ).await;
                                                                }
                                                            }
                                                            Err(e) => eprintln!("[feishu_bridge] file download failed: {}", e),
                                                        }
                                                    });
                                                    None
                                                }
                                            }
                                            _ => None,
                                        };

                                        if let Some(text) = text_opt {
                                            eprintln!(
                                                "[feishu_bridge] received text: {}",
                                                &text[..text.len().min(80)]
                                            );
                                            push_message(&bridge_state, text, message_id, chat_id);
                                            if !is_running(&bridge_state) {
                                                let _ = debounce_tx.try_send(());
                                            }
                                        }
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

    // Register reply listener once — must outlive individual WS connections
    let reply_state = bridge_state.clone();
    let reply_app = app.clone();
    let token_holder: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
    let reply_token_holder = token_holder.clone();
    let _reply_listener = app.listen("feishu-reply-ready", move |event| {
        let payload_str = event.payload().to_string();
        let reply_state = reply_state.clone();
        let reply_app = reply_app.clone();
        let token = reply_token_holder.lock().unwrap_or_else(|e| e.into_inner()).clone();
        tauri::async_runtime::spawn(async move {
            if let Ok(payload) = serde_json::from_str::<FeishuReplyPayload>(&payload_str) {
                if token.is_empty() {
                    eprintln!("[feishu_bridge] no token available for reply");
                } else {
                    match send_reply(&token, &payload.reply_ctx.message_id, &payload.result).await {
                        Ok(()) => {}
                        Err(ref e) if e == "TOKEN_EXPIRED" => {
                            eprintln!("[feishu_bridge] token expired, will refresh on next reconnect");
                        }
                        Err(e) => eprintln!("[feishu_bridge] send_reply error: {}", e),
                    }
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
                *token_holder.lock().unwrap_or_else(|e| e.into_inner()) = t.clone();
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
