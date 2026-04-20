use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use super::types::*;
use super::LlmEngine;

type EventCallback = Arc<std::sync::Mutex<Box<dyn Fn(StreamEvent) + Send>>>;

const MAX_RETRIES: u32 = 5;
const BASE_DELAY_MS: u64 = 2000;

pub struct OpenAiCompatEngine {
    client: Client,
    api_key: String,
    base_url: String,
    model: String,
}

impl OpenAiCompatEngine {
    pub fn new(api_key: String, base_url: String, model: String) -> Self {
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(300))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            client,
            api_key,
            base_url,
            model,
        }
    }
}

fn is_retryable_status(status: u16) -> bool {
    matches!(status, 429 | 500 | 502 | 503 | 529)
}

#[async_trait]
impl LlmEngine for OpenAiCompatEngine {
    async fn chat_stream(
        &self,
        messages: &[Message],
        tools: &[ToolDefinition],
        system: &str,
        on_event: Box<dyn Fn(StreamEvent) + Send>,
    ) -> Result<AssistantResponse, LlmError> {
        let body = build_openai_request(&self.model, system, messages, tools);
        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));
        let on_event: EventCallback = Arc::new(std::sync::Mutex::new(on_event));

        let mut last_err: Option<LlmError> = None;

        for attempt in 0..=MAX_RETRIES {
            if attempt > 0 {
                let delay = BASE_DELAY_MS * 2u64.pow(attempt - 1);
                eprintln!(
                    "[openai_compat] retry {}/{} after {}ms",
                    attempt, MAX_RETRIES, delay
                );
                tokio::time::sleep(Duration::from_millis(delay)).await;
            }

            let events_emitted = Arc::new(AtomicBool::new(false));
            let events_emitted_clone = events_emitted.clone();
            let on_event_clone = on_event.clone();

            let result = self
                .single_request(&url, &body, &on_event_clone, &events_emitted_clone)
                .await;

            match result {
                Ok(response) => return Ok(response),
                Err(err) => {
                    let streamed = events_emitted.load(Ordering::SeqCst);
                    let retryable = match &err {
                        LlmError::Network(_) => true,
                        LlmError::Api { status, .. } => is_retryable_status(*status),
                        _ => false,
                    };
                    if streamed || !retryable || attempt == MAX_RETRIES {
                        return Err(err);
                    }
                    eprintln!("[openai_compat] retryable error: {}", err);
                    last_err = Some(err);
                }
            }
        }

        Err(last_err.unwrap_or(LlmError::Network("max retries exceeded".to_string())))
    }
}

impl OpenAiCompatEngine {
    async fn single_request(
        &self,
        url: &str,
        body: &Value,
        on_event: &EventCallback,
        events_emitted: &Arc<AtomicBool>,
    ) -> Result<AssistantResponse, LlmError> {
        let response = self
            .client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(body)
            .send()
            .await?;

        let status = response.status().as_u16();
        if status >= 400 {
            let text = response.text().await.unwrap_or_default();
            return Err(LlmError::Api {
                status,
                message: text,
            });
        }

        parse_openai_sse_stream(response, on_event, events_emitted).await
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

    // System prompt as first message
    if !system.is_empty() {
        oai_messages.push(json!({
            "role": "system",
            "content": system,
        }));
    }

    // Convert each message
    for msg in messages {
        match msg.role {
            Role::User => {
                let user_msgs = translate_user_message(&msg.content);
                oai_messages.extend(user_msgs);
            }
            Role::Assistant => {
                let assistant_msg = translate_assistant_message(&msg.content);
                oai_messages.push(assistant_msg);
            }
        }
    }

    // Convert tools
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
        "max_tokens": 32768,
    });

    if !oai_tools.is_empty() {
        body["tools"] = Value::Array(oai_tools);
        body["tool_choice"] = json!("auto");
    }

    body
}

fn translate_user_message(content: &[ContentBlock]) -> Vec<Value> {
    let mut messages: Vec<Value> = Vec::new();

    // Separate tool results from text content
    let mut text_parts: Vec<String> = Vec::new();
    let mut tool_results: Vec<Value> = Vec::new();

    for block in content {
        match block {
            ContentBlock::Text { text } => {
                text_parts.push(text.clone());
            }
            ContentBlock::ToolResult {
                tool_use_id,
                content: result_content,
                is_error,
            } => {
                let mut msg = json!({
                    "role": "tool",
                    "tool_call_id": tool_use_id,
                    "content": result_content,
                });
                if *is_error {
                    // Some providers support an error indicator; for most we just prefix
                    msg["content"] = json!(format!("[ERROR] {}", result_content));
                }
                tool_results.push(msg);
            }
            _ => {}
        }
    }

    // Emit text content as user message
    if !text_parts.is_empty() {
        messages.push(json!({
            "role": "user",
            "content": text_parts.join("\n"),
        }));
    }

    // Emit tool results as separate tool messages
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
            ContentBlock::Thinking { .. } => {
                // Skip thinking blocks — OpenAI format doesn't have them
            }
            _ => {}
        }
    }

    let mut msg = json!({
        "role": "assistant",
    });

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
    on_event: &EventCallback,
    events_emitted: &Arc<AtomicBool>,
) -> Result<AssistantResponse, LlmError> {
    use futures::StreamExt;

    let mut state = StreamState {
        text_content: String::new(),
        tool_calls: Vec::new(),
        stop_reason: StopReason::EndTurn,
        usage: Usage::default(),
        thinking_text: String::new(),
    };

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| LlmError::Network(e.to_string()))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].to_string();
            buffer = buffer[pos + 1..].to_string();

            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            if line == "data: [DONE]" {
                break;
            }

            let Some(data) = line.strip_prefix("data: ") else {
                continue;
            };

            let chunk: OaiStreamChunk = match serde_json::from_str(data) {
                Ok(c) => c,
                Err(_) => continue,
            };

            // Capture usage if present (some providers send it in the last chunk)
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

                // Text content
                if let Some(ref text) = delta.content {
                    if !text.is_empty() {
                        events_emitted.store(true, Ordering::SeqCst);
                        state.text_content.push_str(text);
                        if let Ok(cb) = on_event.lock() {
                            (cb)(StreamEvent::TextDelta(text.clone()));
                        }
                    }
                }

                // Reasoning/thinking content (DeepSeek, qwen3.6-plus, etc.)
                if let Some(ref reasoning) = delta.reasoning_content {
                    if !reasoning.is_empty() {
                        events_emitted.store(true, Ordering::SeqCst);
                        state.thinking_text.push_str(reasoning);
                        if let Ok(cb) = on_event.lock() {
                            (cb)(StreamEvent::ThinkingDelta(reasoning.clone()));
                        }
                    }
                }

                // Tool calls
                if let Some(ref tool_calls) = delta.tool_calls {
                    for tc_delta in tool_calls {
                        let idx = tc_delta.index;

                        // Ensure accumulator exists for this index
                        while state.tool_calls.len() <= idx {
                            state.tool_calls.push(ToolCallAccumulator {
                                id: String::new(),
                                name: String::new(),
                                arguments_json: String::new(),
                            });
                        }

                        let acc = &mut state.tool_calls[idx];

                        // ID arrives on the first delta for this tool call.
                        // Some providers (DashScope) send "id":"" on subsequent deltas — skip empty.
                        if let Some(ref id) = tc_delta.id {
                            if !id.is_empty() {
                                acc.id = id.clone();
                                events_emitted.store(true, Ordering::SeqCst);
                            }
                        }

                        if let Some(ref func) = tc_delta.function {
                            if let Some(ref name) = func.name {
                                acc.name = name.clone();
                                if let Ok(cb) = on_event.lock() {
                                    (cb)(StreamEvent::ToolUseStart {
                                        id: acc.id.clone(),
                                        name: name.clone(),
                                    });
                                }
                            }
                            if let Some(ref args) = func.arguments {
                                acc.arguments_json.push_str(args);
                                if let Ok(cb) = on_event.lock() {
                                    (cb)(StreamEvent::ToolUseDelta {
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
    }

    // Emit ToolUseEnd for all accumulated tool calls
    for tc in &state.tool_calls {
        if !tc.id.is_empty() {
            if let Ok(cb) = on_event.lock() {
                (cb)(StreamEvent::ToolUseEnd { id: tc.id.clone() });
            }
        }
    }

    // Build final AssistantResponse
    let mut content_blocks: Vec<ContentBlock> = Vec::new();

    // Thinking block (if any)
    if !state.thinking_text.is_empty() {
        content_blocks.push(ContentBlock::Thinking {
            thinking: state.thinking_text,
            signature: String::new(),
        });
    }

    // Text block
    if !state.text_content.is_empty() {
        content_blocks.push(ContentBlock::Text {
            text: state.text_content,
        });
    }

    // Tool use blocks
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

    // If we got tool calls, ensure stop_reason is ToolUse
    if content_blocks
        .iter()
        .any(|b| matches!(b, ContentBlock::ToolUse { .. }))
    {
        state.stop_reason = StopReason::ToolUse;
    }

    if let Ok(cb) = on_event.lock() {
        (cb)(StreamEvent::MessageEnd {
            usage: Some(state.usage.clone()),
        });
    }

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
        assert_eq!(
            msg["tool_calls"][0]["function"]["arguments"],
            r#"{"command":"ls"}"#
        );
    }

    #[test]
    fn translate_user_tool_result() {
        let content = vec![ContentBlock::ToolResult {
            tool_use_id: "call_123".to_string(),
            content: "file1.txt\nfile2.txt".to_string(),
            is_error: false,
        }];

        let msgs = translate_user_message(&content);
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0]["role"], "tool");
        assert_eq!(msgs[0]["tool_call_id"], "call_123");
        assert_eq!(msgs[0]["content"], "file1.txt\nfile2.txt");
    }

    #[test]
    fn translate_user_mixed_text_and_tool_result() {
        let content = vec![
            ContentBlock::ToolResult {
                tool_use_id: "call_1".to_string(),
                content: "result1".to_string(),
                is_error: false,
            },
            ContentBlock::ToolResult {
                tool_use_id: "call_2".to_string(),
                content: "error msg".to_string(),
                is_error: true,
            },
        ];

        let msgs = translate_user_message(&content);
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0]["tool_call_id"], "call_1");
        assert_eq!(msgs[1]["content"], "[ERROR] error msg");
    }
}
