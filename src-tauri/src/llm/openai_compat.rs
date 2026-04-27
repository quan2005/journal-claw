use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;

use super::model_quirks;
use super::retry::{self, RetryPolicy};
use super::sse_parser::{self, SseParser};
use super::types::*;
use super::LlmEngine;

const REQUEST_ID_HEADER: &str = "request-id";
const ALT_REQUEST_ID_HEADER: &str = "x-request-id";

const DASHSCOPE_MAX_BODY_BYTES: usize = 6_291_456; // 6MB
const XAI_MAX_BODY_BYTES: usize = 52_428_800; // 50MB
const DEFAULT_MAX_BODY_BYTES: usize = 104_857_600; // 100MB

pub struct OpenAiCompatEngine {
    client: Client,
    api_key: String,
    base_url: String,
    model: String,
    retry_policy: RetryPolicy,
}

impl OpenAiCompatEngine {
    pub fn new(api_key: String, base_url: String, model: String) -> Self {
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(15))
            .read_timeout(Duration::from_secs(120))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            client,
            api_key,
            base_url,
            model,
            retry_policy: RetryPolicy::default(),
        }
    }
}

fn detect_provider_name(base_url: &str) -> &'static str {
    let lower = base_url.to_ascii_lowercase();
    if lower.contains("dashscope") {
        "DashScope"
    } else if lower.contains("x.ai") || lower.contains("xai") {
        "xAI"
    } else if lower.contains("openai") {
        "OpenAI"
    } else {
        "OpenAI-compat"
    }
}

fn max_body_bytes_for_provider(base_url: &str) -> usize {
    let lower = base_url.to_ascii_lowercase();
    if lower.contains("dashscope") {
        DASHSCOPE_MAX_BODY_BYTES
    } else if lower.contains("x.ai") || lower.contains("xai") {
        XAI_MAX_BODY_BYTES
    } else {
        DEFAULT_MAX_BODY_BYTES
    }
}

fn check_request_body_size(body: &Value, base_url: &str) -> Result<(), LlmError> {
    let estimated = serde_json::to_vec(body).map(|v| v.len()).unwrap_or(0);
    let max = max_body_bytes_for_provider(base_url);
    if estimated > max {
        return Err(LlmError::RequestBodySizeExceeded {
            estimated_bytes: estimated,
            max_bytes: max,
            provider: detect_provider_name(base_url).to_string(),
        });
    }
    Ok(())
}

#[async_trait]
impl LlmEngine for OpenAiCompatEngine {
    async fn chat_stream(
        &self,
        messages: &[Message],
        tools: &[ToolDefinition],
        system: &str,
        event_tx: mpsc::UnboundedSender<StreamEvent>,
    ) -> Result<AssistantResponse, LlmError> {
        let mut sanitized = messages.to_vec();
        sanitize_tool_message_pairing(&mut sanitized);

        let body = build_openai_request(&self.model, system, &sanitized, tools);
        check_request_body_size(&body, &self.base_url)?;

        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));

        retry::run_with_retry(
            &self.retry_policy,
            |events_emitted| {
                let url = url.clone();
                let body = body.clone();
                let tx = event_tx.clone();
                let client = self.client.clone();
                let api_key = self.api_key.clone();
                async move {
                    single_request(&client, &api_key, &url, &body, &tx, &events_emitted).await
                }
            },
            |attempt, max, delay, err| {
                let _ = event_tx.send(StreamEvent::Error(format!(
                    "重试 {}/{}（{}s 后）: {}",
                    attempt,
                    max,
                    delay.as_secs(),
                    err
                )));
            },
        )
        .await
    }
}

async fn single_request(
    client: &Client,
    api_key: &str,
    url: &str,
    body: &Value,
    event_tx: &mpsc::UnboundedSender<StreamEvent>,
    events_emitted: &Arc<AtomicBool>,
) -> Result<AssistantResponse, LlmError> {
    let response = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(body)
        .send()
        .await?;

    let status = response.status().as_u16();
    if status >= 400 {
        let request_id = extract_request_id(&response);
        let text = response.text().await.unwrap_or_default();
        let (error_type, message) = parse_openai_error(&text);
        let retryable = matches!(status, 408 | 409 | 429 | 500 | 502 | 503 | 504 | 529);
        return Err(LlmError::Api {
            status,
            message: message.unwrap_or(text),
            error_type,
            request_id,
            retryable,
        });
    }

    parse_openai_sse_stream(response, event_tx, events_emitted).await
}

fn extract_request_id(response: &reqwest::Response) -> Option<String> {
    response
        .headers()
        .get(REQUEST_ID_HEADER)
        .or_else(|| response.headers().get(ALT_REQUEST_ID_HEADER))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

fn parse_openai_error(body: &str) -> (Option<String>, Option<String>) {
    let val: serde_json::Value = match serde_json::from_str(body) {
        Ok(v) => v,
        Err(_) => return (None, None),
    };
    let error_type = val
        .pointer("/error/type")
        .or_else(|| val.pointer("/error/code"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let message = val
        .pointer("/error/message")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    (error_type, message)
}

// ── Sanitize tool message pairing (Stage 6) ─────

/// Remove orphaned tool_result messages that have no matching tool_use in a preceding assistant message.
/// Also remove trailing assistant tool_use blocks that have no corresponding tool_result.
fn sanitize_tool_message_pairing(messages: &mut Vec<Message>) {
    use std::collections::HashSet;

    // Collect all tool_use IDs from assistant messages
    let mut tool_use_ids: HashSet<String> = HashSet::new();
    for msg in messages.iter() {
        if msg.role == Role::Assistant {
            for block in &msg.content {
                if let ContentBlock::ToolUse { id, .. } = block {
                    tool_use_ids.insert(id.clone());
                }
            }
        }
    }

    // Collect all tool_result IDs from user messages
    let mut tool_result_ids: HashSet<String> = HashSet::new();
    for msg in messages.iter() {
        if msg.role == Role::User {
            for block in &msg.content {
                if let ContentBlock::ToolResult { tool_use_id, .. } = block {
                    tool_result_ids.insert(tool_use_id.clone());
                }
            }
        }
    }

    let mut modified = false;

    // Remove orphaned tool_result blocks (no matching tool_use)
    for msg in messages.iter_mut() {
        if msg.role == Role::User {
            let before = msg.content.len();
            msg.content.retain(|block| {
                if let ContentBlock::ToolResult { tool_use_id, .. } = block {
                    tool_use_ids.contains(tool_use_id)
                } else {
                    true
                }
            });
            if msg.content.len() != before {
                modified = true;
            }
        }
    }

    // Remove trailing assistant tool_use blocks without matching tool_result
    if let Some(last) = messages.last_mut() {
        if last.role == Role::Assistant {
            let before = last.content.len();
            last.content.retain(|block| {
                if let ContentBlock::ToolUse { id, .. } = block {
                    tool_result_ids.contains(id)
                } else {
                    true
                }
            });
            if last.content.len() != before {
                modified = true;
            }
        }
    }

    // Remove empty messages
    messages.retain(|msg| !msg.content.is_empty());

    if modified {
        eprintln!("[openai_compat] sanitized orphaned tool messages");
    }
}

// ── Request translation (Anthropic → OpenAI) ────────────

fn build_openai_request(
    model: &str,
    system: &str,
    messages: &[Message],
    tools: &[ToolDefinition],
) -> Value {
    let mut oai_messages: Vec<Value> = Vec::new();

    if !system.is_empty() {
        oai_messages.push(json!({
            "role": "system",
            "content": system,
        }));
    }

    let reject_is_error = model_quirks::rejects_is_error_field(model);

    for msg in messages {
        match msg.role {
            Role::User => {
                let user_msgs = translate_user_message(&msg.content, reject_is_error);
                oai_messages.extend(user_msgs);
            }
            Role::Assistant => {
                let assistant_msg = translate_assistant_message(&msg.content);
                oai_messages.push(assistant_msg);
            }
        }
    }

    let oai_tools: Vec<Value> = tools
        .iter()
        .map(|t| {
            json!({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.input_schema,
                }
            })
        })
        .collect();

    let mut body = json!({
        "model": model,
        "messages": oai_messages,
        "stream": true,
    });

    // Stage 4: model-specific token field
    if model_quirks::uses_max_completion_tokens(model) {
        body["max_completion_tokens"] = json!(32768);
    } else {
        body["max_tokens"] = json!(32768);
    }

    // Stage 4: reasoning models reject tuning params
    if !model_quirks::is_reasoning_model(model) {
        // Only set temperature for non-reasoning models (default is fine)
    }

    if !oai_tools.is_empty() {
        body["tools"] = Value::Array(oai_tools);
        body["tool_choice"] = json!("auto");
    }

    body
}

fn translate_user_message(content: &[ContentBlock], reject_is_error: bool) -> Vec<Value> {
    let mut messages: Vec<Value> = Vec::new();
    let mut content_parts: Vec<Value> = Vec::new();
    let mut tool_results: Vec<Value> = Vec::new();
    let mut has_images = false;

    for block in content {
        match block {
            ContentBlock::Text { text } => {
                content_parts.push(json!({ "type": "text", "text": text }));
            }
            ContentBlock::Image { media_type, data } => {
                has_images = true;
                let data_url = format!("data:{};base64,{}", media_type, data);
                content_parts.push(json!({
                    "type": "image_url",
                    "image_url": { "url": data_url },
                }));
            }
            ContentBlock::ToolResult {
                tool_use_id,
                content: result_content,
                is_error,
                ..
            } => {
                // Stage 4: Kimi rejects is_error field — encode error in content prefix
                let content_str = if *is_error {
                    format!("[ERROR] {}", result_content)
                } else {
                    result_content.clone()
                };

                let mut msg = json!({
                    "role": "tool",
                    "tool_call_id": tool_use_id,
                    "content": content_str,
                });

                // Only include is_error for providers that support it
                if *is_error && !reject_is_error {
                    msg["is_error"] = json!(true);
                }

                tool_results.push(msg);
            }
            _ => {}
        }
    }

    if !content_parts.is_empty() {
        if has_images {
            messages.push(json!({ "role": "user", "content": content_parts }));
        } else {
            let text: String = content_parts
                .iter()
                .filter_map(|p| p.get("text").and_then(|t| t.as_str()))
                .collect::<Vec<_>>()
                .join("\n");
            messages.push(json!({ "role": "user", "content": text }));
        }
    }

    messages.extend(tool_results);
    messages
}

fn translate_assistant_message(content: &[ContentBlock]) -> Value {
    let mut text_parts: Vec<String> = Vec::new();
    let mut tool_calls: Vec<Value> = Vec::new();

    for block in content {
        match block {
            ContentBlock::Text { text } => {
                text_parts.push(text.clone());
            }
            ContentBlock::ToolUse { id, name, input } => {
                tool_calls.push(json!({
                    "id": id,
                    "type": "function",
                    "function": {
                        "name": name,
                        "arguments": input.to_string(),
                    }
                }));
            }
            // Stage 5: Skip thinking blocks — OpenAI format doesn't support them.
            // Thinking blocks with non-empty signatures (from Anthropic) are dropped.
            // Thinking blocks with empty signatures (from OpenAI reasoning_content)
            // are also not re-sent — the model generates fresh reasoning each turn.
            ContentBlock::Thinking { .. } => {}
            // Drop server-side blocks — OpenAI doesn't understand them
            ContentBlock::ServerToolUse { .. } | ContentBlock::ServerToolResult(_) => {}
            _ => {}
        }
    }

    let mut msg = json!({ "role": "assistant" });

    let combined_text = text_parts.join("\n");
    if !combined_text.is_empty() {
        msg["content"] = json!(combined_text);
    } else {
        msg["content"] = Value::Null;
    }

    if !tool_calls.is_empty() {
        msg["tool_calls"] = Value::Array(tool_calls);
    }

    msg
}

// ── Response/Stream translation (OpenAI → Anthropic) ────

#[derive(Debug, Deserialize)]
struct OaiStreamDelta {
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    reasoning_content: Option<String>,
    #[serde(default)]
    tool_calls: Option<Vec<OaiStreamToolCallDelta>>,
}

#[derive(Debug, Deserialize)]
struct OaiStreamToolCallDelta {
    #[serde(default)]
    index: usize,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    function: Option<OaiStreamFunctionDelta>,
}

#[derive(Debug, Deserialize)]
struct OaiStreamFunctionDelta {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    arguments: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OaiStreamChoice {
    #[serde(default)]
    delta: Option<OaiStreamDelta>,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OaiStreamChunk {
    #[serde(default)]
    choices: Vec<OaiStreamChoice>,
    #[serde(default)]
    usage: Option<OaiUsage>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct OaiUsage {
    #[serde(default)]
    prompt_tokens: u32,
    #[serde(default)]
    completion_tokens: u32,
}

struct StreamState {
    text_content: String,
    tool_calls: Vec<ToolCallAccumulator>,
    stop_reason: StopReason,
    usage: Usage,
    thinking_text: String,
}

struct ToolCallAccumulator {
    id: String,
    name: String,
    arguments_json: String,
}

async fn parse_openai_sse_stream(
    response: reqwest::Response,
    event_tx: &mpsc::UnboundedSender<StreamEvent>,
    events_emitted: &Arc<AtomicBool>,
) -> Result<AssistantResponse, LlmError> {
    use futures::StreamExt;
    use tokio::time::{timeout, Duration};

    const CHUNK_TIMEOUT: Duration = Duration::from_secs(90);

    let mut state = StreamState {
        text_content: String::new(),
        tool_calls: Vec::new(),
        stop_reason: StopReason::EndTurn,
        usage: Usage::default(),
        thinking_text: String::new(),
    };

    let mut parser = SseParser::new();
    let mut stream = response.bytes_stream();

    let emit = |evt: StreamEvent| {
        events_emitted.store(true, Ordering::SeqCst);
        let _ = event_tx.send(evt);
    };

    loop {
        let chunk = match timeout(CHUNK_TIMEOUT, stream.next()).await {
            Ok(Some(Ok(bytes))) => bytes,
            Ok(Some(Err(e))) => return Err(LlmError::Network(e.to_string())),
            Ok(None) => break,
            Err(_) => {
                return Err(LlmError::Api {
                    status: 0,
                    message: "SSE 流超时：90 秒未收到数据".to_string(),
                    error_type: Some("stream_timeout".to_string()),
                    request_id: None,
                    retryable: true,
                });
            }
        };
        let events = parser.feed(&chunk);

        for sse_event in events {
            let data = &sse_event.data;

            // Stage 2: Detect error objects in SSE data
            if let Some((error_msg, retryable)) = sse_parser::detect_error_in_data(data) {
                emit(StreamEvent::Error(error_msg.clone()));
                return Err(LlmError::Api {
                    status: 0,
                    message: error_msg,
                    error_type: Some("stream_error".to_string()),
                    request_id: None,
                    retryable,
                });
            }

            let chunk: OaiStreamChunk = match serde_json::from_str(data) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!(
                        "[openai_compat] SSE parse warning: {} — data: {}",
                        e,
                        &data[..data.len().min(100)]
                    );
                    continue;
                }
            };

            if let Some(usage) = &chunk.usage {
                state.usage.input_tokens = usage.prompt_tokens;
                state.usage.output_tokens = usage.completion_tokens;
            }

            for choice in &chunk.choices {
                if let Some(ref finish) = choice.finish_reason {
                    state.stop_reason = match finish.as_str() {
                        "tool_calls" | "function_call" => StopReason::ToolUse,
                        "length" => StopReason::MaxTokens,
                        _ => StopReason::EndTurn,
                    };
                }

                let Some(ref delta) = choice.delta else {
                    continue;
                };

                if let Some(ref text) = delta.content {
                    if !text.is_empty() {
                        state.text_content.push_str(text);
                        emit(StreamEvent::TextDelta(text.clone()));
                    }
                }

                if let Some(ref reasoning) = delta.reasoning_content {
                    if !reasoning.is_empty() {
                        state.thinking_text.push_str(reasoning);
                        emit(StreamEvent::ThinkingDelta(reasoning.clone()));
                    }
                }

                if let Some(ref tool_calls) = delta.tool_calls {
                    for tc_delta in tool_calls {
                        let idx = tc_delta.index;

                        while state.tool_calls.len() <= idx {
                            state.tool_calls.push(ToolCallAccumulator {
                                id: String::new(),
                                name: String::new(),
                                arguments_json: String::new(),
                            });
                        }

                        let acc = &mut state.tool_calls[idx];

                        if let Some(ref id) = tc_delta.id {
                            if !id.is_empty() {
                                acc.id = id.clone();
                                events_emitted.store(true, Ordering::SeqCst);
                            }
                        }

                        if let Some(ref func) = tc_delta.function {
                            if let Some(ref name) = func.name {
                                acc.name = name.clone();
                                emit(StreamEvent::ToolUseStart {
                                    id: acc.id.clone(),
                                    name: name.clone(),
                                });
                            }
                            if let Some(ref args) = func.arguments {
                                acc.arguments_json.push_str(args);
                                emit(StreamEvent::ToolUseDelta {
                                    id: acc.id.clone(),
                                    input_json_delta: args.clone(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // Emit ToolUseEnd for all accumulated tool calls
    for tc in &state.tool_calls {
        if !tc.id.is_empty() {
            emit(StreamEvent::ToolUseEnd { id: tc.id.clone() });
        }
    }

    // Build final AssistantResponse
    // Stage 1: Do NOT include Text block — text is delivered via StreamEvent::TextDelta only.
    // This matches Anthropic engine behavior where content_blocks only has ToolUse/Thinking.
    let mut content_blocks: Vec<ContentBlock> = Vec::new();

    if !state.thinking_text.is_empty() {
        content_blocks.push(ContentBlock::Thinking {
            thinking: state.thinking_text,
            signature: String::new(),
        });
    }

    // Tool use blocks only — no Text block
    for tc in state.tool_calls {
        if tc.id.is_empty() {
            continue;
        }
        let input: Value =
            serde_json::from_str(&tc.arguments_json).unwrap_or(Value::Object(Default::default()));
        content_blocks.push(ContentBlock::ToolUse {
            id: tc.id,
            name: tc.name,
            input,
        });
    }

    if content_blocks
        .iter()
        .any(|b| matches!(b, ContentBlock::ToolUse { .. }))
    {
        state.stop_reason = StopReason::ToolUse;
    }

    emit(StreamEvent::MessageEnd {
        usage: Some(state.usage.clone()),
    });

    Ok(AssistantResponse {
        content: content_blocks,
        stop_reason: state.stop_reason,
        usage: Some(state.usage),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_request_basic() {
        let messages = vec![Message {
            role: Role::User,
            content: vec![ContentBlock::Text {
                text: "hello".to_string(),
            }],
        }];
        let tools = vec![ToolDefinition {
            name: "bash".to_string(),
            description: "run bash".to_string(),
            input_schema: json!({"type": "object", "properties": {"command": {"type": "string"}}}),
        }];

        let body = build_openai_request("qwen-plus", "You are helpful.", &messages, &tools);

        assert_eq!(body["model"], "qwen-plus");
        assert_eq!(body["stream"], true);
        assert_eq!(body["messages"][0]["role"], "system");
        assert_eq!(body["messages"][0]["content"], "You are helpful.");
        assert_eq!(body["messages"][1]["role"], "user");
        assert_eq!(body["messages"][1]["content"], "hello");
        assert_eq!(body["tools"][0]["type"], "function");
        assert_eq!(body["tools"][0]["function"]["name"], "bash");
    }

    #[test]
    fn build_request_reasoning_model_uses_max_completion_tokens() {
        let messages = vec![Message {
            role: Role::User,
            content: vec![ContentBlock::Text {
                text: "hi".to_string(),
            }],
        }];
        let body = build_openai_request("o3-mini", "sys", &messages, &[]);
        assert!(body.get("max_completion_tokens").is_some());
        assert!(body.get("max_tokens").is_none());
    }

    #[test]
    fn translate_assistant_with_tool_calls() {
        let content = vec![
            ContentBlock::Text {
                text: "Let me run that.".to_string(),
            },
            ContentBlock::ToolUse {
                id: "call_123".to_string(),
                name: "bash".to_string(),
                input: json!({"command": "ls"}),
            },
        ];

        let msg = translate_assistant_message(&content);
        assert_eq!(msg["role"], "assistant");
        assert_eq!(msg["content"], "Let me run that.");
        assert_eq!(msg["tool_calls"][0]["id"], "call_123");
        assert_eq!(msg["tool_calls"][0]["function"]["name"], "bash");
    }

    #[test]
    fn translate_user_tool_result_no_is_error_for_kimi() {
        let content = vec![ContentBlock::ToolResult {
            tool_use_id: "call_123".to_string(),
            content: "some error".to_string(),
            is_error: true,
            image: None,
        }];

        // Kimi mode: reject_is_error = true
        let msgs = translate_user_message(&content, true);
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0]["content"], "[ERROR] some error");
        assert!(msgs[0].get("is_error").is_none());

        // Normal mode: reject_is_error = false
        let msgs = translate_user_message(&content, false);
        assert_eq!(msgs[0]["content"], "[ERROR] some error");
        assert_eq!(msgs[0]["is_error"], true);
    }

    #[test]
    fn translate_assistant_drops_thinking_and_server_blocks() {
        let content = vec![
            ContentBlock::Thinking {
                thinking: "let me think".to_string(),
                signature: "sig123".to_string(),
            },
            ContentBlock::Text {
                text: "answer".to_string(),
            },
            ContentBlock::ServerToolUse {
                id: "stu_1".to_string(),
                name: "web_search".to_string(),
                input: json!({"query": "test"}),
            },
        ];

        let msg = translate_assistant_message(&content);
        assert_eq!(msg["content"], "answer");
        assert!(msg.get("tool_calls").is_none());
    }

    #[test]
    fn sanitize_removes_orphaned_tool_results() {
        let mut messages = vec![
            Message {
                role: Role::User,
                content: vec![ContentBlock::ToolResult {
                    tool_use_id: "orphan_id".to_string(),
                    content: "result".to_string(),
                    is_error: false,
                    image: None,
                }],
            },
            Message {
                role: Role::User,
                content: vec![ContentBlock::Text {
                    text: "hello".to_string(),
                }],
            },
        ];

        sanitize_tool_message_pairing(&mut messages);
        // Orphaned tool_result message should be removed (empty after retain)
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].role, Role::User);
    }

    #[test]
    fn sanitize_keeps_valid_tool_pairing() {
        let mut messages = vec![
            Message {
                role: Role::Assistant,
                content: vec![ContentBlock::ToolUse {
                    id: "call_1".to_string(),
                    name: "bash".to_string(),
                    input: json!({}),
                }],
            },
            Message {
                role: Role::User,
                content: vec![ContentBlock::ToolResult {
                    tool_use_id: "call_1".to_string(),
                    content: "output".to_string(),
                    is_error: false,
                    image: None,
                }],
            },
        ];

        sanitize_tool_message_pairing(&mut messages);
        assert_eq!(messages.len(), 2);
    }
}
