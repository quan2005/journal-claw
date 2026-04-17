use crate::config;
use crate::llm;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tokio_util::sync::CancellationToken;

use llm::types::{ContentBlock, Message, Role};

// ── Types ────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionMode {
    Chat,
    Agent,
    Observe,
}

pub(crate) struct ConversationSession {
    messages: Vec<Message>,
    /// `None` until the first send — built lazily to keep create() instant.
    system_prompt: Option<String>,
    mode: SessionMode,
    cancel: Option<CancellationToken>,
    workspace: String,
    pending_user_messages: Vec<String>,
    title: Option<String>,
    title_locked: bool,
    created_at: u64,
    first_turn_done: bool,
    /// Stored from create() for deferred prompt building
    context: Option<String>,
    /// Stored from create() for deferred prompt building
    context_files: Option<Vec<String>>,
}

pub struct ConversationStore(pub Mutex<HashMap<String, ConversationSession>>);

impl Default for ConversationStore {
    fn default() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationStreamPayload {
    pub session_id: String,
    pub event: String,
    pub data: String,
}

// ── Persistence types ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub id: String,
    pub title: Option<String>,
    pub mode: SessionMode,
    pub created_at: u64,
    pub updated_at: u64,
    pub is_streaming: bool,
    pub message_count: usize,
}

/// V2 persistence — messages stored in Anthropic Messages API format.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedSessionV2 {
    id: String,
    title: Option<String>,
    title_locked: bool,
    mode: SessionMode,
    created_at: u64,
    updated_at: u64,
    #[serde(default)]
    version: u32,
    messages: Vec<Message>,
    #[serde(default)]
    system_prompt: Option<String>,
}

/// V1 persistence (legacy) — kept only for deserializing old session files.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedSessionV1 {
    id: String,
    title: Option<String>,
    title_locked: bool,
    mode: SessionMode,
    created_at: u64,
    updated_at: u64,
    messages: Vec<PersistedMessageV1>,
    #[serde(default)]
    system_prompt: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedMessageV1 {
    role: String,
    content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    thinking: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<DisplayTool>>,
}

/// Display-oriented tool info returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct DisplayTool {
    name: String,
    label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    output: Option<String>,
    #[serde(default)]
    is_error: bool,
}

/// Display-oriented message returned to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct LoadedMessage {
    pub role: String,
    pub content: String,
    pub thinking: Option<String>,
    pub tools: Option<Vec<DisplayTool>>,
}

fn conversations_dir(workspace: &str) -> PathBuf {
    PathBuf::from(workspace).join(".conversations")
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn save_session_to_disk(workspace: &str, session_id: &str, session: &ConversationSession) {
    let dir = conversations_dir(workspace);
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join(format!("{}.json", session_id));

    let persisted = PersistedSessionV2 {
        id: session_id.to_string(),
        title: session.title.clone(),
        title_locked: session.title_locked,
        mode: session.mode,
        created_at: session.created_at,
        updated_at: now_secs(),
        version: 2,
        messages: session.messages.clone(),
        system_prompt: session.system_prompt.clone(),
    };

    if let Ok(json) = serde_json::to_string_pretty(&persisted) {
        let _ = std::fs::write(&path, json);
    }
}

fn load_session_summaries(workspace: &str) -> Vec<SessionSummary> {
    let dir = conversations_dir(workspace);
    let mut summaries = Vec::new();
    let entries = match std::fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return summaries,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        if let Ok(content) = std::fs::read_to_string(&path) {
            // Try V2 first, then V1
            if let Ok(v2) = serde_json::from_str::<PersistedSessionV2>(&content) {
                if v2.messages.is_empty() {
                    let _ = std::fs::remove_file(&path);
                    continue;
                }
                summaries.push(SessionSummary {
                    id: v2.id,
                    title: v2.title,
                    mode: v2.mode,
                    created_at: v2.created_at,
                    updated_at: v2.updated_at,
                    is_streaming: false,
                    message_count: v2.messages.len(),
                });
            } else if let Ok(v1) = serde_json::from_str::<PersistedSessionV1>(&content) {
                if v1.messages.is_empty() {
                    let _ = std::fs::remove_file(&path);
                    continue;
                }
                summaries.push(SessionSummary {
                    id: v1.id,
                    title: v1.title,
                    mode: v1.mode,
                    created_at: v1.created_at,
                    updated_at: v1.updated_at,
                    is_streaming: false,
                    message_count: v1.messages.len(),
                });
            }
        }
    }
    summaries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    summaries
}

// ── Helpers ──────────────────────────────────────────────

fn build_context_section(files: &[String]) -> String {
    let mut section = String::from("\n\n## 当前上下文\n");
    let mut total_chars: usize = 0;
    const PER_FILE_LIMIT: usize = 8000;
    const TOTAL_LIMIT: usize = 20000;
    for file_path in files {
        if total_chars >= TOTAL_LIMIT {
            break;
        }
        match std::fs::read_to_string(file_path) {
            Ok(content) => {
                let remaining = TOTAL_LIMIT.saturating_sub(total_chars);
                let limit = remaining.min(PER_FILE_LIMIT);
                let truncated: String = content.chars().take(limit).collect();
                let fname = std::path::Path::new(file_path)
                    .file_name()
                    .map(|f| f.to_string_lossy().to_string())
                    .unwrap_or_else(|| file_path.clone());
                section.push_str(&format!("\n### {}\n\n{}\n", fname, truncated));
                total_chars += truncated.len();
            }
            Err(e) => {
                eprintln!(
                    "[conversation] failed to read context file {}: {}",
                    file_path, e
                );
            }
        }
    }
    if total_chars > 0 {
        section
    } else {
        String::new()
    }
}

fn generate_session_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static LAST_TS: AtomicU64 = AtomicU64::new(0);
    static SEQ: AtomicU64 = AtomicU64::new(0);

    let now = chrono::Local::now();
    use chrono::Timelike;
    let date_prefix = now.format("%Y%m%d").to_string();

    // Milliseconds since midnight — fits in 27 bits (max 86_399_999)
    let ms_of_day = (now.hour() as u64 * 3_600_000)
        + (now.minute() as u64 * 60_000)
        + (now.second() as u64 * 1_000)
        + (now.timestamp_subsec_millis() as u64);

    // Bump sequence on same-millisecond collision, reset otherwise
    let prev = LAST_TS.swap(ms_of_day, Ordering::SeqCst);
    let seq = if prev == ms_of_day {
        SEQ.fetch_add(1, Ordering::SeqCst) + 1
    } else {
        SEQ.store(0, Ordering::SeqCst);
        0
    };

    // Pack into 30 bits: ms_of_day (27 bits) | seq (3 bits, wraps at 8)
    let packed: u64 = ((ms_of_day & 0x7FF_FFFF) << 3) | (seq & 0x7);

    // Encode as base32 (Crockford alphabet, 6 chars)
    const ALPHABET: &[u8; 32] = b"0123456789abcdefghjkmnpqrstvwxyz";
    let mut buf = [0u8; 6];
    let mut val = packed;
    for i in (0..6).rev() {
        buf[i] = ALPHABET[(val & 0x1F) as usize];
        val >>= 5;
    }
    let snowflake = std::str::from_utf8(&buf).unwrap();

    format!("{}_{}", date_prefix, snowflake)
}

fn create_engine(cfg: &config::Config) -> Box<dyn llm::LlmEngine> {
    let (api_key, base_url, model) = cfg.active_vendor_config();
    Box::new(llm::create_anthropic_engine(api_key, base_url, model))
}

/// Convert API-format messages to display-oriented LoadedMessages for the frontend.
/// Filters out tool-result-only user messages and extracts thinking/tools from ContentBlocks.
fn messages_to_display(messages: &[Message]) -> Vec<LoadedMessage> {
    messages
        .iter()
        .enumerate()
        .filter(|(_, m)| {
            // Skip user messages that only contain ToolResult (not user-typed input)
            if m.role == Role::User {
                m.content
                    .iter()
                    .any(|b| matches!(b, ContentBlock::Text { .. }))
            } else {
                true
            }
        })
        .map(|(idx, m)| {
            let role = match m.role {
                Role::User => "user",
                Role::Assistant => "assistant",
            };
            let text = m
                .content
                .iter()
                .filter_map(|b| {
                    if let ContentBlock::Text { text: t } = b {
                        Some(t.as_str())
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
                .join("");
            let thinking = m
                .content
                .iter()
                .filter_map(|b| {
                    if let ContentBlock::Thinking { thinking: t, .. } = b {
                        Some(t.as_str())
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
                .join("");

            // Extract tools from ToolUse blocks + their results from the next message
            let mut tools: Vec<DisplayTool> = Vec::new();
            let tool_uses: Vec<(&str, &str, &serde_json::Value)> = m
                .content
                .iter()
                .filter_map(|b| {
                    if let ContentBlock::ToolUse { id, name, input } = b {
                        Some((id.as_str(), name.as_str(), input))
                    } else {
                        None
                    }
                })
                .collect();
            if !tool_uses.is_empty() {
                let next_msg = messages.get(idx + 1);
                for (tool_id, tool_name, tool_input) in &tool_uses {
                    let (output, is_error) = next_msg
                        .and_then(|nm| {
                            nm.content.iter().find_map(|b| {
                                if let ContentBlock::ToolResult {
                                    tool_use_id,
                                    content,
                                    is_error,
                                } = b
                                {
                                    if tool_use_id == tool_id {
                                        Some((content.clone(), *is_error))
                                    } else {
                                        None
                                    }
                                } else {
                                    None
                                }
                            })
                        })
                        .unwrap_or_default();
                    let label = match *tool_name {
                        "bash" => llm::bash_tool::log_label(tool_input),
                        "load_skill" => llm::enable_skill::log_label(tool_input),
                        _ => format!("{}: {}", tool_name, tool_id),
                    };
                    tools.push(DisplayTool {
                        name: tool_name.to_string(),
                        label,
                        output: if output.is_empty() {
                            None
                        } else {
                            Some(output)
                        },
                        is_error,
                    });
                }
            }
            // Extract web_search from ServerToolResult
            for b in &m.content {
                if let ContentBlock::ServerToolResult(val) = b {
                    let query = val
                        .get("search_queries")
                        .and_then(|sq| sq.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|q| q.get("query"))
                        .and_then(|q| q.as_str())
                        .unwrap_or("")
                        .to_string();
                    let label = if query.is_empty() {
                        "web_search".to_string()
                    } else {
                        format!("搜索: {}", query)
                    };
                    tools.push(DisplayTool {
                        name: "web_search".to_string(),
                        label,
                        output: Some(val.to_string()),
                        is_error: false,
                    });
                }
            }

            LoadedMessage {
                role: role.to_string(),
                content: text,
                thinking: if thinking.is_empty() {
                    None
                } else {
                    Some(thinking)
                },
                tools: if tools.is_empty() { None } else { Some(tools) },
            }
        })
        .collect()
}

/// Migrate a V1 persisted session to V2 (best-effort, signatures lost).
fn migrate_v1_to_v2(v1: PersistedSessionV1) -> PersistedSessionV2 {
    let mut messages: Vec<Message> = Vec::new();
    for pm in &v1.messages {
        let role = if pm.role == "assistant" {
            Role::Assistant
        } else {
            Role::User
        };
        let mut content: Vec<ContentBlock> = Vec::new();

        // Thinking (no signature — lost in V1)
        if let Some(ref thinking) = pm.thinking {
            if !thinking.is_empty() {
                content.push(ContentBlock::Thinking {
                    thinking: thinking.clone(),
                    signature: String::new(),
                });
            }
        }

        // Text
        if !pm.content.is_empty() {
            content.push(ContentBlock::Text {
                text: pm.content.clone(),
            });
        }

        if content.is_empty() {
            continue;
        }
        messages.push(Message { role, content });
    }

    PersistedSessionV2 {
        id: v1.id,
        title: v1.title,
        title_locked: v1.title_locked,
        mode: v1.mode,
        created_at: v1.created_at,
        updated_at: v1.updated_at,
        version: 2,
        messages,
        system_prompt: v1.system_prompt,
    }
}

/// Load a persisted session from disk, handling both V1 and V2 formats.
fn load_persisted_session(workspace: &str, session_id: &str) -> Result<PersistedSessionV2, String> {
    let path = conversations_dir(workspace).join(format!("{}.json", session_id));
    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("failed to read session: {}", e))?;

    // Try V2 first (has version field >= 2 and messages as Vec<Message>)
    if let Ok(v2) = serde_json::from_str::<PersistedSessionV2>(&content) {
        if v2.version >= 2 {
            return Ok(v2);
        }
    }

    // Fallback: parse as V1 and migrate
    let v1: PersistedSessionV1 =
        serde_json::from_str(&content).map_err(|e| format!("failed to parse session: {}", e))?;
    Ok(migrate_v1_to_v2(v1))
}

// ── Commands ─────────────────────────────────────────────

#[tauri::command]
pub async fn conversation_create(
    app: AppHandle,
    store: tauri::State<'_, ConversationStore>,
    mode: SessionMode,
    context: Option<String>,
    context_files: Option<Vec<String>>,
) -> Result<String, String> {
    let cfg = config::load_config(&app)?;
    let workspace = cfg.workspace_path.clone();

    // build_system_prompt is deferred to the first send so that create returns instantly.
    // ensure_workspace_dot_claude runs at app startup and workspace switch, not here.

    let session_id = generate_session_id();

    let session = ConversationSession {
        messages: Vec::new(),
        system_prompt: None, // built lazily on first send
        mode,
        cancel: None,
        workspace,
        pending_user_messages: Vec::new(),
        title: None,
        title_locked: false,
        created_at: now_secs(),
        first_turn_done: false,
        context,
        context_files,
    };

    let mut sessions = store.0.lock().map_err(|e| e.to_string())?;
    sessions.insert(session_id.clone(), session);

    eprintln!(
        "[conversation] created session {} mode={:?}",
        session_id, mode
    );
    Ok(session_id)
}

#[tauri::command]
pub async fn conversation_send(
    app: AppHandle,
    store: tauri::State<'_, ConversationStore>,
    session_id: String,
    message: String,
) -> Result<(), String> {
    let cfg = config::load_config(&app)?;

    // ── Lazy system-prompt init ──────────────────────────
    // Check if this session still needs its system prompt built.
    let needs_prompt = {
        let sessions = store.0.lock().map_err(|e| e.to_string())?;
        let session = sessions
            .get(&session_id)
            .ok_or_else(|| format!("session not found: {}", session_id))?;
        session.system_prompt.is_none()
    };

    if needs_prompt {
        // Heavy work happens here, outside the lock
        let (workspace, mode, ctx, ctx_files) = {
            let sessions = store.0.lock().map_err(|e| e.to_string())?;
            let s = sessions.get(&session_id).unwrap();
            (
                s.workspace.clone(),
                s.mode,
                s.context.clone(),
                s.context_files.clone(),
            )
        };

        let base_system =
            llm::prompt::build_system_prompt(&workspace, crate::ai_processor::WORKSPACE_CLAUDE_MD)
                .await;

        let context_section = ctx_files
            .as_ref()
            .filter(|f| !f.is_empty())
            .map(|files| build_context_section(files))
            .unwrap_or_default();

        let system_prompt = match mode {
            SessionMode::Chat => {
                let topic = ctx.as_deref().unwrap_or("自由对话");
                format!(
                    "{}{}\n\n## 当前模式\n\n你正在与用户进行主题探讨。围绕以下主题展开对话：\n\n{}\n\n请直接回应，不要执行任何文件操作。",
                    base_system, context_section, topic
                )
            }
            SessionMode::Agent => {
                format!(
                    "{}{}\n\n## 当前模式\n\n你正在与用户进行通用问答。可以使用 bash 工具执行命令来辅助回答。\n\n### 工具使用原则\n\n- **bash**: 需要执行命令、读写文件、运行脚本时使用\n- **web_search**: 查询实时信息 — 新闻事件、最新文档版本、技术发布动态、需要验证的事实性问题。返回搜索结果摘要供你引用。",
                    base_system, context_section
                )
            }
            SessionMode::Observe => base_system,
        };

        // Store the built prompt and clear deferred fields
        let mut sessions = store.0.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.get_mut(&session_id) {
            session.system_prompt = Some(system_prompt);
            session.context = None;
            session.context_files = None;
        }
    }

    // ── Extract session data under lock, then release ────
    let (messages, system_prompt, mode, workspace, cancel_token, provisional_title) = {
        let mut sessions = store.0.lock().map_err(|e| e.to_string())?;
        let session = sessions
            .get_mut(&session_id)
            .ok_or_else(|| format!("session not found: {}", session_id))?;

        // Cancel any in-flight request
        if let Some(old_cancel) = session.cancel.take() {
            old_cancel.cancel();
        }

        // Append user message
        session.messages.push(Message {
            role: Role::User,
            content: vec![ContentBlock::Text {
                text: message.clone(),
            }],
        });

        // Instant provisional title from user text (replaced by LLM title after first turn)
        let provisional_title = if session.title.is_none() && !session.title_locked {
            let t: String = message.chars().take(15).collect();
            let t = t.trim().to_string();
            if !t.is_empty() {
                session.title = Some(t.clone());
                Some(t)
            } else {
                None
            }
        } else {
            None
        };

        let cancel = CancellationToken::new();
        session.cancel = Some(cancel.clone());

        (
            session.messages.clone(),
            session.system_prompt.clone().unwrap_or_default(),
            session.mode,
            session.workspace.clone(),
            cancel,
            provisional_title,
        )
    };

    // Emit provisional title outside the lock
    if let Some(t) = provisional_title {
        let _ = app.emit(
            "conversation-stream",
            ConversationStreamPayload {
                session_id: session_id.clone(),
                event: "title".to_string(),
                data: t,
            },
        );
    }

    let engine = create_engine(&cfg);
    let sid = session_id.clone();
    let app_clone = app.clone();

    // Spawn the LLM call
    tauri::async_runtime::spawn(async move {
        let result = run_conversation_turn(
            engine.as_ref(),
            &workspace,
            &system_prompt,
            messages,
            mode,
            &sid,
            &app_clone,
            cancel_token.clone(),
        )
        .await;

        // Update session messages under lock via app state
        let store = app_clone.state::<ConversationStore>();
        match result {
            Ok(updated_messages) => {
                let (workspace, should_gen_title, first_user, first_assistant) = {
                    let mut guard = store.0.lock().unwrap_or_else(|e| e.into_inner());
                    if let Some(session) = guard.get_mut(&sid) {
                        session.messages = updated_messages;
                        session.cancel = None;
                        let should_gen = !session.first_turn_done && !session.title_locked;
                        session.first_turn_done = true;
                        // Extract first user + assistant text for title generation
                        let first_u = session
                            .messages
                            .iter()
                            .find(|m| m.role == Role::User)
                            .and_then(|m| {
                                m.content.iter().find_map(|b| {
                                    if let ContentBlock::Text { text: t } = b {
                                        Some(t.clone())
                                    } else {
                                        None
                                    }
                                })
                            })
                            .unwrap_or_default();
                        let first_a = session
                            .messages
                            .iter()
                            .find(|m| m.role == Role::Assistant)
                            .and_then(|m| {
                                m.content.iter().find_map(|b| {
                                    if let ContentBlock::Text { text: t } = b {
                                        Some(t.clone())
                                    } else {
                                        None
                                    }
                                })
                            })
                            .unwrap_or_default();
                        save_session_to_disk(&session.workspace, &sid, session);
                        (session.workspace.clone(), should_gen, first_u, first_a)
                    } else {
                        (String::new(), false, String::new(), String::new())
                    }
                };

                // Generate title asynchronously after first turn
                if should_gen_title && !first_user.is_empty() {
                    let cfg_for_title = config::load_config(&app_clone).ok();
                    if let Some(cfg) = cfg_for_title {
                        let engine = create_engine(&cfg);
                        let sid_for_title = sid.clone();
                        let app_for_title = app_clone.clone();
                        let workspace_for_title = workspace;
                        tauri::async_runtime::spawn(async move {
                            let title =
                                generate_title(engine.as_ref(), &first_user, &first_assistant)
                                    .await;
                            let store = app_for_title.state::<ConversationStore>();
                            if let Ok(mut sessions) = store.0.lock() {
                                if let Some(session) = sessions.get_mut(&sid_for_title) {
                                    if !session.title_locked {
                                        session.title = Some(title.clone());
                                        save_session_to_disk(
                                            &workspace_for_title,
                                            &sid_for_title,
                                            session,
                                        );
                                    }
                                }
                            }
                            let _ = app_for_title.emit(
                                "conversation-stream",
                                ConversationStreamPayload {
                                    session_id: sid_for_title,
                                    event: "title".to_string(),
                                    data: title,
                                },
                            );
                        });
                    }
                }
            }
            Err(e) => {
                let _ = app_clone.emit(
                    "conversation-stream",
                    ConversationStreamPayload {
                        session_id: sid.clone(),
                        event: "error".to_string(),
                        data: e.to_string(),
                    },
                );
                if let Ok(mut sessions) = store.0.lock() {
                    if let Some(session) = sessions.get_mut(&sid) {
                        session.cancel = None;
                    }
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn conversation_cancel(
    store: tauri::State<'_, ConversationStore>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = store.0.lock().map_err(|e| e.to_string())?;
    if let Some(session) = sessions.get_mut(&session_id) {
        if let Some(cancel) = session.cancel.take() {
            cancel.cancel();
            eprintln!("[conversation] cancelled session {}", session_id);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn conversation_close(
    store: tauri::State<'_, ConversationStore>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = store.0.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = sessions.remove(&session_id) {
        if let Some(cancel) = session.cancel.take() {
            cancel.cancel();
        }
        eprintln!("[conversation] closed session {}", session_id);
    }
    Ok(())
}

#[tauri::command]
pub async fn conversation_inject(
    app: AppHandle,
    store: tauri::State<'_, ConversationStore>,
    session_id: String,
    message: String,
) -> Result<(), String> {
    let mut sessions = store.0.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| format!("session not found: {}", session_id))?;
    session.pending_user_messages.push(message.clone());
    eprintln!(
        "[conversation] injected message into session {}",
        session_id
    );

    // Emit event so frontend can show the user bubble immediately
    let _ = app.emit(
        "conversation-stream",
        ConversationStreamPayload {
            session_id,
            event: "user_inject".to_string(),
            data: message,
        },
    );
    Ok(())
}

#[tauri::command]
pub async fn conversation_truncate(
    store: tauri::State<'_, ConversationStore>,
    session_id: String,
    keep_count: usize,
) -> Result<(), String> {
    let mut sessions = store.0.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| format!("session not found: {}", session_id))?;
    session.messages.truncate(keep_count);
    eprintln!(
        "[conversation] truncated session {} to {} messages",
        session_id, keep_count
    );
    Ok(())
}
#[tauri::command]
pub async fn conversation_list(
    app: AppHandle,
    store: tauri::State<'_, ConversationStore>,
) -> Result<Vec<SessionSummary>, String> {
    let cfg = config::load_config(&app)?;
    let workspace = cfg.workspace_path.clone();

    let mut summaries = load_session_summaries(&workspace);

    // Mark in-memory streaming sessions
    if let Ok(sessions) = store.0.lock() {
        for summary in &mut summaries {
            if let Some(session) = sessions.get(&summary.id) {
                summary.is_streaming = session.cancel.is_some();
                summary.message_count = session.messages.len();
            }
        }
        // Add in-memory sessions not yet persisted (return ALL, let frontend filter)
        for (id, session) in sessions.iter() {
            if !summaries.iter().any(|s| s.id == *id) {
                summaries.push(SessionSummary {
                    id: id.clone(),
                    title: session.title.clone(),
                    mode: session.mode,
                    created_at: session.created_at,
                    updated_at: now_secs(),
                    is_streaming: session.cancel.is_some(),
                    message_count: session.messages.len(),
                });
            }
        }
    }

    summaries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(summaries)
}

#[tauri::command]
pub async fn conversation_rename(
    app: AppHandle,
    store: tauri::State<'_, ConversationStore>,
    session_id: String,
    title: String,
) -> Result<(), String> {
    let workspace = {
        let mut sessions = store.0.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.get_mut(&session_id) {
            session.title = Some(title.clone());
            session.title_locked = true;
            session.workspace.clone()
        } else {
            // Try to update on disk directly
            let cfg = config::load_config(&app)?;
            cfg.workspace_path.clone()
        }
    };

    // Update on disk
    let path = conversations_dir(&workspace).join(format!("{}.json", session_id));
    if let Ok(content) = std::fs::read_to_string(&path) {
        if let Ok(mut persisted) = serde_json::from_str::<PersistedSessionV2>(&content) {
            persisted.title = Some(title);
            persisted.title_locked = true;
            if let Ok(json) = serde_json::to_string_pretty(&persisted) {
                let _ = std::fs::write(&path, json);
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn conversation_delete(
    app: AppHandle,
    store: tauri::State<'_, ConversationStore>,
    session_id: String,
) -> Result<(), String> {
    // Remove from memory
    {
        let mut sessions = store.0.lock().map_err(|e| e.to_string())?;
        if let Some(mut session) = sessions.remove(&session_id) {
            if let Some(cancel) = session.cancel.take() {
                cancel.cancel();
            }
        }
    }
    // Remove from disk
    let cfg = config::load_config(&app)?;
    let path = conversations_dir(&cfg.workspace_path).join(format!("{}.json", session_id));
    let _ = std::fs::remove_file(&path);
    eprintln!("[conversation] deleted session {}", session_id);
    Ok(())
}

/// Fast in-memory message retrieval — no disk I/O.
/// Falls back to conversation_load for disk-only sessions.
#[tauri::command]
pub async fn conversation_get_messages(
    app: AppHandle,
    store: tauri::State<'_, ConversationStore>,
    session_id: String,
) -> Result<Vec<LoadedMessage>, String> {
    // Try memory first (fast path)
    {
        let sessions = store.0.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.get(&session_id) {
            return Ok(messages_to_display(&session.messages));
        }
    }
    // Fallback: load from disk and restore to memory
    conversation_load(app, store, session_id).await
}

#[tauri::command]
pub async fn conversation_load(
    app: AppHandle,
    store: tauri::State<'_, ConversationStore>,
    session_id: String,
) -> Result<Vec<LoadedMessage>, String> {
    let cfg = config::load_config(&app)?;
    let workspace = cfg.workspace_path.clone();

    let persisted = load_persisted_session(&workspace, &session_id)?;

    // Use persisted system_prompt if available, otherwise rebuild (slow path)
    let system_prompt = if let Some(ref sp) = persisted.system_prompt {
        sp.clone()
    } else {
        let base_system =
            llm::prompt::build_system_prompt(&workspace, crate::ai_processor::WORKSPACE_CLAUDE_MD)
                .await;
        match persisted.mode {
            SessionMode::Chat => {
                format!(
                    "{}\n\n## 当前模式\n\n你正在与用户进行主题探讨。请直接回应，不要执行任何文件操作。",
                    base_system
                )
            }
            SessionMode::Agent => {
                format!(
                    "{}\n\n## 当前模式\n\n你正在与用户进行通用问答。可以使用 bash 工具执行命令来辅助回答。",
                    base_system
                )
            }
            SessionMode::Observe => base_system,
        }
    };

    let display = messages_to_display(&persisted.messages);

    let session = ConversationSession {
        messages: persisted.messages,
        system_prompt: Some(system_prompt),
        mode: persisted.mode,
        cancel: None,
        workspace,
        pending_user_messages: Vec::new(),
        title: persisted.title.clone(),
        title_locked: persisted.title_locked,
        created_at: persisted.created_at,
        first_turn_done: true,
        context: None,
        context_files: None,
    };

    {
        let mut sessions = store.0.lock().map_err(|e| e.to_string())?;
        sessions.insert(session_id.clone(), session);
    }

    eprintln!(
        "[conversation] loaded session {} ({} messages)",
        session_id,
        display.len()
    );
    Ok(display)
}

// ── Turn execution ───────────────────────────────────────

/// Run a single conversation turn. For Agent mode, includes a tool loop.
/// Returns the updated message history.
#[allow(clippy::too_many_arguments)]
async fn run_conversation_turn(
    engine: &dyn llm::LlmEngine,
    workspace: &str,
    system_prompt: &str,
    mut messages: Vec<Message>,
    mode: SessionMode,
    session_id: &str,
    app: &AppHandle,
    cancel: CancellationToken,
) -> Result<Vec<Message>, llm::types::LlmError> {
    let tools = match mode {
        SessionMode::Agent => {
            let skills = llm::prompt::scan_skills(workspace).await;
            vec![
                llm::bash_tool::definition(),
                llm::enable_skill::definition(&skills),
            ]
        }
        _ => vec![],
    };

    let max_turns: usize = match mode {
        SessionMode::Agent => 60,
        _ => 1,
    };

    let sid = session_id.to_string();

    for _turn in 0..max_turns {
        if cancel.is_cancelled() {
            return Err(llm::types::LlmError::Cancelled);
        }

        // Signal frontend to start a new assistant message for this turn
        let _ = app.emit(
            "conversation-stream",
            ConversationStreamPayload {
                session_id: sid.clone(),
                event: "turn_start".to_string(),
                data: String::new(),
            },
        );

        // Collect streamed text
        let turn_text = std::sync::Arc::new(std::sync::Mutex::new(String::new()));
        let turn_thinking = std::sync::Arc::new(std::sync::Mutex::new(String::new()));
        let turn_text_clone = turn_text.clone();
        let turn_thinking_clone = turn_thinking.clone();
        let app_for_stream = app.clone();
        let sid_for_stream = sid.clone();

        let stream_callback: Box<dyn Fn(llm::types::StreamEvent) + Send> = {
            let turn_text = turn_text_clone;
            let turn_thinking = turn_thinking_clone;
            Box::new(move |evt| {
                match &evt {
                    llm::types::StreamEvent::TextDelta(ref text) => {
                        if let Ok(mut t) = turn_text.lock() {
                            t.push_str(text);
                        }
                        let _ = app_for_stream.emit(
                            "conversation-stream",
                            ConversationStreamPayload {
                                session_id: sid_for_stream.clone(),
                                event: "text_delta".to_string(),
                                data: text.clone(),
                            },
                        );
                    }
                    llm::types::StreamEvent::ThinkingDelta(ref text) => {
                        if let Ok(mut t) = turn_thinking.lock() {
                            t.push_str(text);
                        }
                        let _ = app_for_stream.emit(
                            "conversation-stream",
                            ConversationStreamPayload {
                                session_id: sid_for_stream.clone(),
                                event: "thinking_delta".to_string(),
                                data: text.clone(),
                            },
                        );
                    }
                    llm::types::StreamEvent::ToolUseStart { .. } => {
                        // Client-side tools (bash) have their own emit path in the execution loop.
                        // Server-side tools (web_search) emit WebSearchResult handled below.
                        // No action needed here.
                    }
                    llm::types::StreamEvent::ToolUseEnd { .. } => {
                        // Same as above — no action needed.
                    }
                    llm::types::StreamEvent::WebSearchResult(ref val) => {
                        let _ = app_for_stream.emit(
                            "conversation-stream",
                            ConversationStreamPayload {
                                session_id: sid_for_stream.clone(),
                                event: "web_search_result".to_string(),
                                data: val.to_string(),
                            },
                        );
                    }
                    _ => {}
                }
            })
        };

        let response = engine
            .chat_stream(&messages, &tools, system_prompt, stream_callback)
            .await?;

        let turn_text_str = turn_text.lock().unwrap_or_else(|e| e.into_inner()).clone();

        // Build assistant message
        let mut assistant_content: Vec<ContentBlock> = Vec::new();

        // Thinking blocks must come first (API requirement for multi-turn)
        for block in &response.content {
            if let ContentBlock::Thinking { .. } = block {
                assistant_content.push(block.clone());
            }
        }

        if !turn_text_str.is_empty() {
            assistant_content.push(ContentBlock::Text {
                text: turn_text_str,
            });
        }

        let tool_calls: Vec<(String, String, serde_json::Value)> = response
            .content
            .iter()
            .filter_map(|b| {
                if let ContentBlock::ToolUse { id, name, input } = b {
                    Some((id.clone(), name.clone(), input.clone()))
                } else {
                    None
                }
            })
            .collect();

        for (id, name, input) in &tool_calls {
            assistant_content.push(ContentBlock::ToolUse {
                id: id.clone(),
                name: name.clone(),
                input: input.clone(),
            });
        }

        // Preserve server-side blocks (web_search) for multi-turn pass-through
        for block in &response.content {
            match block {
                ContentBlock::ServerToolUse { .. } | ContentBlock::ServerToolResult(_) => {
                    assistant_content.push(block.clone());
                }
                _ => {}
            }
        }

        messages.push(Message {
            role: Role::Assistant,
            content: assistant_content,
        });

        // Thinking is already stored in ContentBlock::Thinking inside assistant_content

        match response.stop_reason {
            llm::types::StopReason::EndTurn | llm::types::StopReason::MaxTokens => {
                // Check for pending user messages before finishing
                let pending = {
                    let store = app.state::<ConversationStore>();
                    let mut sessions = match store.0.lock() {
                        Ok(s) => s,
                        Err(e) => e.into_inner(),
                    };
                    if let Some(session) = sessions.get_mut(&sid) {
                        std::mem::take(&mut session.pending_user_messages)
                    } else {
                        Vec::new()
                    }
                };
                if !pending.is_empty() {
                    for text in pending {
                        messages.push(Message {
                            role: Role::User,
                            content: vec![ContentBlock::Text { text }],
                        });
                    }
                    eprintln!("[conversation] continuing turn with pending user messages");
                    let _ = app.emit(
                        "conversation-stream",
                        ConversationStreamPayload {
                            session_id: sid.clone(),
                            event: "turn_start".to_string(),
                            data: String::new(),
                        },
                    );
                    continue;
                }
                let _ = app.emit(
                    "conversation-stream",
                    ConversationStreamPayload {
                        session_id: sid.clone(),
                        event: "done".to_string(),
                        data: String::new(),
                    },
                );
                return Ok(messages);
            }
            llm::types::StopReason::PauseTurn => {
                // API paused a long-running turn; re-send to continue.
                continue;
            }
            llm::types::StopReason::ToolUse => {
                if tool_calls.is_empty() {
                    let _ = app.emit(
                        "conversation-stream",
                        ConversationStreamPayload {
                            session_id: sid.clone(),
                            event: "done".to_string(),
                            data: String::new(),
                        },
                    );
                    return Ok(messages);
                }

                // Execute tools
                let mut results: Vec<ContentBlock> = Vec::new();
                for (id, name, input) in &tool_calls {
                    if cancel.is_cancelled() {
                        return Err(llm::types::LlmError::Cancelled);
                    }

                    let label = match name.as_str() {
                        "load_skill" => llm::enable_skill::log_label(input),
                        _ => llm::bash_tool::log_label(input),
                    };
                    let _ = app.emit(
                        "conversation-stream",
                        ConversationStreamPayload {
                            session_id: sid.clone(),
                            event: "tool_start".to_string(),
                            data: serde_json::json!({ "name": name, "label": label }).to_string(),
                        },
                    );

                    let result = match name.as_str() {
                        "bash" => llm::bash_tool::execute(input, workspace).await,
                        "load_skill" => llm::enable_skill::execute(input, workspace).await,
                        _ => llm::types::ToolResult {
                            output: format!("unknown tool: {}", name),
                            is_error: true,
                        },
                    };

                    let _ = app.emit(
                        "conversation-stream",
                        ConversationStreamPayload {
                            session_id: sid.clone(),
                            event: "tool_end".to_string(),
                            data: serde_json::json!({
                                "name": name,
                                "is_error": result.is_error,
                                "output": result.output,
                            })
                            .to_string(),
                        },
                    );

                    results.push(ContentBlock::ToolResult {
                        tool_use_id: id.clone(),
                        content: result.output,
                        is_error: result.is_error,
                    });
                }

                messages.push(Message {
                    role: Role::User,
                    content: results,
                });

                // Drain pending user messages (M1: mid-stream intervention)
                {
                    let store = app.state::<ConversationStore>();
                    let pending = {
                        let mut sessions = match store.0.lock() {
                            Ok(s) => s,
                            Err(e) => e.into_inner(),
                        };
                        if let Some(session) = sessions.get_mut(&sid) {
                            std::mem::take(&mut session.pending_user_messages)
                        } else {
                            Vec::new()
                        }
                    };
                    if !pending.is_empty() {
                        let combined = pending.join("\n\n");
                        messages.push(Message {
                            role: Role::User,
                            content: vec![ContentBlock::Text {
                                text: format!("[用户补充指令]\n{}", combined),
                            }],
                        });
                        eprintln!(
                            "[conversation] injected {} pending messages into turn",
                            pending.len()
                        );
                    }
                }
            }
        }
    }

    Err(llm::types::LlmError::MaxTurnsExceeded)
}

/// Generate a short title from the first user+assistant exchange.
async fn generate_title(
    engine: &dyn llm::LlmEngine,
    user_text: &str,
    assistant_text: &str,
) -> String {
    let prompt = format!(
        "用户: {}\n\n助手: {}\n\n请用≤8个中文字总结这段对话的主题，只输出标题，不要任何解释。",
        user_text.chars().take(500).collect::<String>(),
        assistant_text.chars().take(500).collect::<String>(),
    );
    let messages = vec![Message {
        role: Role::User,
        content: vec![ContentBlock::Text { text: prompt }],
    }];
    let system = "你是一个标题生成器。只输出简短的中文标题，不超过8个字。";
    let accumulated = std::sync::Arc::new(std::sync::Mutex::new(String::new()));
    let acc_clone = accumulated.clone();
    let on_event: Box<dyn Fn(llm::types::StreamEvent) + Send> = Box::new(move |event| {
        if let llm::types::StreamEvent::TextDelta(text) = event {
            if let Ok(mut buf) = acc_clone.lock() {
                buf.push_str(&text);
            }
        }
    });
    match engine.chat_stream(&messages, &[], system, on_event).await {
        Ok(_resp) => {
            let text = accumulated.lock().map(|b| b.clone()).unwrap_or_default();
            let title = text.trim().trim_matches('"').trim().to_string();
            if title.is_empty() {
                // Fallback: first 15 chars of user message
                user_text.chars().take(15).collect()
            } else {
                title
            }
        }
        Err(_) => user_text.chars().take(15).collect(),
    }
}
