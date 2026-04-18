use async_trait::async_trait;
use reqwest::Client;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use super::types::*;
use super::LlmEngine;

const MAX_RETRIES: u32 = 5;
const BASE_DELAY_MS: u64 = 2000;
pub struct AnthropicEngine {
    client: Client,
    api_key: String,
    base_url: String,
    model: String,
}

impl AnthropicEngine {
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

/// Check if an error is retryable (network errors, server errors, rate limits).
fn is_retryable(err: &LlmError) -> bool {
    match err {
        LlmError::Network(_) => true,
        LlmError::Api { status, .. } => {
            // status 0 = error from SSE stream (proxy/network issue)
            // 429 = rate limit, 500/502/503/529 = server errors
            matches!(status, 0 | 429 | 500 | 502 | 503 | 529)
        }
        _ => false,
    }
}

#[async_trait]
impl LlmEngine for AnthropicEngine {
    async fn chat_stream(
        &self,
        messages: &[Message],
        tools: &[ToolDefinition],
        system: &str,
        on_event: Box<dyn Fn(StreamEvent) + Send>,
    ) -> Result<AssistantResponse, LlmError> {
        let body = build_request_body(&self.model, system, messages, tools);
        let url = format!("{}/v1/messages", self.base_url.trim_end_matches('/'));
        let on_event = Arc::new(std::sync::Mutex::new(on_event));

        let mut last_err: Option<LlmError> = None;

        for attempt in 0..=MAX_RETRIES {
            if attempt > 0 {
                let delay = BASE_DELAY_MS * 2u64.pow(attempt - 1);
                eprintln!(
                    "[anthropic] retry {}/{} after {}ms",
                    attempt, MAX_RETRIES, delay
                );
                tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
            }

            let events_emitted = Arc::new(AtomicBool::new(false));
            let events_emitted_clone = events_emitted.clone();
            let on_event_clone = on_event.clone();
            let tracking_callback: Box<dyn Fn(StreamEvent) + Send> = Box::new(move |evt| {
                events_emitted_clone.store(true, Ordering::SeqCst);
                if let Ok(cb) = on_event_clone.lock() {
                    (cb)(evt);
                }
            });

            let result = self.single_request(&url, &body, tracking_callback).await;

            match result {
                Ok(response) => return Ok(response),
                Err(err) => {
                    let streamed = events_emitted.load(Ordering::SeqCst);
                    if streamed || !is_retryable(&err) || attempt == MAX_RETRIES {
                        return Err(err);
                    }
                    eprintln!("[anthropic] retryable error: {}", err);
                    last_err = Some(err);
                }
            }
        }

        Err(last_err.unwrap_or(LlmError::Network("max retries exceeded".to_string())))
    }
}

impl AnthropicEngine {
    async fn single_request(
        &self,
        url: &str,
        body: &serde_json::Value,
        on_event: Box<dyn Fn(StreamEvent) + Send>,
    ) -> Result<AssistantResponse, LlmError> {
        let response = self
            .client
            .post(url)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
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

        parse_sse_stream(response, on_event).await
    }
}

// ── Request body builder ────────────────────────

fn build_request_body(
    model: &str,
    system: &str,
    messages: &[Message],
    tools: &[ToolDefinition],
) -> serde_json::Value {
    let msgs: Vec<serde_json::Value> = messages.iter().map(message_to_json).collect();

    // Client-side tools (bash, etc.)
    let mut tool_defs: Vec<serde_json::Value> = tools
        .iter()
        .map(|t| {
            serde_json::json!({
                "name": t.name,
                "description": t.description,
                "input_schema": t.input_schema,
            })
        })
        .collect();

    tool_defs.push(serde_json::json!({
        "type": "web_search_20250305",
        "name": "web_search",
        "max_uses": 5,
    }));

    let mut body = serde_json::json!({
        "model": model,
        "system": system,
        "messages": msgs,
        "stream": true,
        "max_tokens": 32768,
        "thinking": {
            "type": "enabled",
            "budget_tokens": 10000,
        },
    });

    body["tools"] = serde_json::Value::Array(tool_defs);

    body
}

fn message_to_json(msg: &Message) -> serde_json::Value {
    let role = match msg.role {
        Role::User => "user",
        Role::Assistant => "assistant",
    };

    let content: Vec<serde_json::Value> = msg
        .content
        .iter()
        .map(|block| match block {
            ContentBlock::Text { text } => serde_json::json!({
                "type": "text",
                "text": text,
            }),
            ContentBlock::Thinking {
                thinking,
                signature,
            } => serde_json::json!({
                "type": "thinking",
                "thinking": thinking,
                "signature": signature,
            }),
            ContentBlock::ToolUse { id, name, input } => serde_json::json!({
                "type": "tool_use",
                "id": id,
                "name": name,
                "input": input,
            }),
            ContentBlock::ToolResult {
                tool_use_id,
                content,
                is_error,
            } => {
                let mut val = serde_json::json!({
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": content,
                });
                if *is_error {
                    val["is_error"] = serde_json::Value::Bool(true);
                }
                val
            }
            // Server-side blocks — pass through as-is for multi-turn
            ContentBlock::ServerToolUse { id, name, input } => serde_json::json!({
                "type": "server_tool_use",
                "id": id,
                "name": name,
                "input": input,
            }),
            ContentBlock::ServerToolResult(raw) => raw.clone(),
        })
        .collect();

    serde_json::json!({
        "role": role,
        "content": content,
    })
}

// ── SSE stream parser ───────────────────────────

async fn parse_sse_stream(
    response: reqwest::Response,
    on_event: Box<dyn Fn(StreamEvent) + Send>,
) -> Result<AssistantResponse, LlmError> {
    use futures::StreamExt;

    let mut content_blocks: Vec<ContentBlock> = Vec::new();
    let mut stop_reason = StopReason::EndTurn;
    let mut usage = Usage::default();

    // Track current tool_use being built
    let mut current_tool_id: Option<String> = None;
    let mut current_tool_name: Option<String> = None;
    let mut current_tool_input_json = String::new();

    // Track current thinking block
    let mut current_thinking_text = String::new();
    let mut current_thinking_signature = String::new();

    // Track current server_tool_use block
    let mut current_server_tool: Option<(String, String, serde_json::Value)> = None;

    // Track current block index → type for content_block_stop
    let mut current_block_type: Option<String> = None;

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| LlmError::Network(e.to_string()))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process complete SSE events (separated by \n\n)
        while let Some(pos) = buffer.find("\n\n") {
            let event_text = buffer[..pos].to_string();
            buffer = buffer[pos + 2..].to_string();

            let (event_type, data) = parse_sse_event(&event_text);
            if data.is_empty() {
                continue;
            }

            let val: serde_json::Value = match serde_json::from_str(&data) {
                Ok(v) => v,
                Err(_) => continue,
            };

            match event_type.as_str() {
                "message_start" => {
                    if let Some(u) = val.pointer("/message/usage") {
                        usage.input_tokens =
                            u.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                    }
                }
                "content_block_start" => {
                    let block_type = val
                        .pointer("/content_block/type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    current_block_type = Some(block_type.clone());

                    match block_type.as_str() {
                        "tool_use" => {
                            let id = val
                                .pointer("/content_block/id")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            let name = val
                                .pointer("/content_block/name")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            on_event(StreamEvent::ToolUseStart {
                                id: id.clone(),
                                name: name.clone(),
                            });
                            current_tool_id = Some(id);
                            current_tool_name = Some(name);
                            current_tool_input_json.clear();
                        }
                        "server_tool_use" => {
                            let id = val
                                .pointer("/content_block/id")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            let name = val
                                .pointer("/content_block/name")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            let input = val
                                .pointer("/content_block/input")
                                .cloned()
                                .unwrap_or(serde_json::Value::Object(Default::default()));
                            on_event(StreamEvent::ToolUseStart {
                                id: id.clone(),
                                name: name.clone(),
                            });
                            current_server_tool = Some((id, name, input));
                        }
                        "web_search_tool_result" => {
                            // Capture the entire block as-is for pass-through
                            if let Some(block) = val.get("content_block") {
                                on_event(StreamEvent::WebSearchResult(block.clone()));
                                content_blocks.push(ContentBlock::ServerToolResult(block.clone()));
                            }
                        }
                        "thinking" => {
                            current_thinking_text.clear();
                            current_thinking_signature.clear();
                        }
                        _ => {}
                    }
                }
                "content_block_delta" => {
                    let delta_type = val
                        .pointer("/delta/type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    match delta_type {
                        "text_delta" => {
                            if let Some(text) = val.pointer("/delta/text").and_then(|v| v.as_str())
                            {
                                on_event(StreamEvent::TextDelta(text.to_string()));
                            }
                        }
                        "thinking_delta" => {
                            if let Some(text) =
                                val.pointer("/delta/thinking").and_then(|v| v.as_str())
                            {
                                current_thinking_text.push_str(text);
                                on_event(StreamEvent::ThinkingDelta(text.to_string()));
                            }
                        }
                        "signature_delta" => {
                            if let Some(sig) =
                                val.pointer("/delta/signature").and_then(|v| v.as_str())
                            {
                                current_thinking_signature.push_str(sig);
                            }
                        }
                        "input_json_delta" => {
                            if let Some(json_delta) =
                                val.pointer("/delta/partial_json").and_then(|v| v.as_str())
                            {
                                current_tool_input_json.push_str(json_delta);
                                if let Some(ref id) = current_tool_id {
                                    on_event(StreamEvent::ToolUseDelta {
                                        id: id.clone(),
                                        input_json_delta: json_delta.to_string(),
                                    });
                                }
                            }
                        }
                        _ => {}
                    }
                }
                "content_block_stop" => {
                    let bt = current_block_type.take().unwrap_or_default();
                    match bt.as_str() {
                        "tool_use" => {
                            if let (Some(id), Some(name)) =
                                (current_tool_id.take(), current_tool_name.take())
                            {
                                let input: serde_json::Value =
                                    serde_json::from_str(&current_tool_input_json)
                                        .unwrap_or(serde_json::Value::Object(Default::default()));
                                current_tool_input_json.clear();
                                on_event(StreamEvent::ToolUseEnd { id: id.clone() });
                                content_blocks.push(ContentBlock::ToolUse { id, name, input });
                            }
                        }
                        "server_tool_use" => {
                            if let Some((id, name, input)) = current_server_tool.take() {
                                on_event(StreamEvent::ToolUseEnd { id: id.clone() });
                                content_blocks.push(ContentBlock::ServerToolUse {
                                    id,
                                    name,
                                    input,
                                });
                            }
                        }
                        "thinking" => {
                            if !current_thinking_text.is_empty() {
                                content_blocks.push(ContentBlock::Thinking {
                                    thinking: std::mem::take(&mut current_thinking_text),
                                    signature: std::mem::take(&mut current_thinking_signature),
                                });
                            }
                            current_thinking_text.clear();
                            current_thinking_signature.clear();
                        }
                        _ => {}
                    }
                }
                "message_delta" => {
                    if let Some(sr) = val.pointer("/delta/stop_reason").and_then(|v| v.as_str()) {
                        stop_reason = match sr {
                            "tool_use" => StopReason::ToolUse,
                            "max_tokens" => StopReason::MaxTokens,
                            "pause_turn" => StopReason::PauseTurn,
                            _ => StopReason::EndTurn,
                        };
                    }
                    if let Some(u) = val.get("usage") {
                        usage.output_tokens =
                            u.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                    }
                }
                "message_stop" => {
                    on_event(StreamEvent::MessageEnd {
                        usage: Some(usage.clone()),
                    });
                }
                "error" => {
                    let msg = val
                        .pointer("/error/message")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown error");
                    on_event(StreamEvent::Error(msg.to_string()));
                    return Err(LlmError::Api {
                        status: 0,
                        message: msg.to_string(),
                    });
                }
                _ => {}
            }
        }
    }

    // NOTE: Text content is accumulated by the caller (tool_loop) from StreamEvent::TextDelta.
    // The content_blocks here contain ToolUse + ServerToolUse + ServerToolResult entries.

    Ok(AssistantResponse {
        content: content_blocks,
        stop_reason,
        usage: Some(usage),
    })
}

fn parse_sse_event(text: &str) -> (String, String) {
    let mut event_type = String::new();
    let mut data_lines = Vec::new();

    for line in text.lines() {
        if let Some(val) = line.strip_prefix("event: ") {
            event_type = val.trim().to_string();
        } else if let Some(val) = line.strip_prefix("data: ") {
            data_lines.push(val);
        } else if let Some(val) = line.strip_prefix("data:") {
            data_lines.push(val);
        }
    }

    (event_type, data_lines.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_sse_event_basic() {
        let text = "event: message_start\ndata: {\"type\":\"message_start\"}";
        let (event_type, data) = parse_sse_event(text);
        assert_eq!(event_type, "message_start");
        assert!(data.contains("message_start"));
    }

    #[test]
    fn message_to_json_text() {
        let msg = Message {
            role: Role::User,
            content: vec![ContentBlock::Text {
                text: "hello".to_string(),
            }],
        };
        let json = message_to_json(&msg);
        assert_eq!(json["role"], "user");
        assert_eq!(json["content"][0]["type"], "text");
        assert_eq!(json["content"][0]["text"], "hello");
    }

    #[test]
    fn message_to_json_tool_result() {
        let msg = Message {
            role: Role::User,
            content: vec![ContentBlock::ToolResult {
                tool_use_id: "t1".to_string(),
                content: "output".to_string(),
                is_error: true,
            }],
        };
        let json = message_to_json(&msg);
        assert_eq!(json["content"][0]["is_error"], true);
    }

    #[test]
    fn build_request_body_includes_web_search() {
        let tools = vec![ToolDefinition {
            name: "bash".to_string(),
            description: "run bash".to_string(),
            input_schema: serde_json::json!({"type": "object"}),
        }];
        let body = build_request_body("claude-sonnet-4-20250514", "sys", &[], &tools);
        let tools_arr = body["tools"].as_array().unwrap();
        // bash + web_search
        assert_eq!(tools_arr.len(), 2);
        assert_eq!(tools_arr[0]["name"], "bash");
        assert_eq!(tools_arr[1]["type"], "web_search_20250305");
        assert_eq!(tools_arr[1]["name"], "web_search");
    }

    #[test]
    fn build_request_body_web_search_for_any_vendor() {
        let body = build_request_body("qwen-max", "sys", &[], &[]);
        let tools_arr = body["tools"].as_array().unwrap();
        assert_eq!(tools_arr.len(), 1);
        assert_eq!(tools_arr[0]["type"], "web_search_20250305");
    }

    #[test]
    fn message_to_json_server_tool_use() {
        let msg = Message {
            role: Role::Assistant,
            content: vec![ContentBlock::ServerToolUse {
                id: "stu_1".to_string(),
                name: "web_search".to_string(),
                input: serde_json::json!({"query": "test"}),
            }],
        };
        let json = message_to_json(&msg);
        assert_eq!(json["content"][0]["type"], "server_tool_use");
        assert_eq!(json["content"][0]["name"], "web_search");
    }
}
