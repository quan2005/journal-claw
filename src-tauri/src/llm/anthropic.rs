use async_trait::async_trait;
use reqwest::Client;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

use super::retry::{self, RetryPolicy};
use super::sse_parser::SseParser;
use super::types::*;
use super::LlmEngine;

const REQUEST_ID_HEADER: &str = "request-id";
const ALT_REQUEST_ID_HEADER: &str = "x-request-id";

pub struct AnthropicEngine {
    client: Client,
    api_key: String,
    base_url: String,
    model: String,
    retry_policy: RetryPolicy,
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
            retry_policy: RetryPolicy::default(),
        }
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

        retry::run_with_retry(&self.retry_policy, |events_emitted| {
            let url = url.clone();
            let body = body.clone();
            let on_event = on_event.clone();
            let client = self.client.clone();
            let api_key = self.api_key.clone();
            async move {
                let tracking_callback: Box<dyn Fn(StreamEvent) + Send> = {
                    let events_emitted = events_emitted.clone();
                    let on_event = on_event.clone();
                    Box::new(move |evt| {
                        events_emitted.store(true, Ordering::SeqCst);
                        if let Ok(cb) = on_event.lock() {
                            (cb)(evt);
                        }
                    })
                };
                single_request(&client, &api_key, &url, &body, tracking_callback).await
            }
        })
        .await
    }
}

async fn single_request(
    client: &Client,
    api_key: &str,
    url: &str,
    body: &serde_json::Value,
    on_event: Box<dyn Fn(StreamEvent) + Send>,
) -> Result<AssistantResponse, LlmError> {
    let response = client
        .post(url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(body)
        .send()
        .await?;

    let status = response.status().as_u16();
    if status >= 400 {
        let request_id = extract_request_id(&response);
        let text = response.text().await.unwrap_or_default();
        let (error_type, message) = parse_anthropic_error(&text);
        let retryable = matches!(status, 408 | 409 | 429 | 500 | 502 | 503 | 504 | 529);
        return Err(LlmError::Api {
            status,
            message: message.unwrap_or(text),
            error_type,
            request_id,
            retryable,
        });
    }

    parse_sse_stream(response, on_event).await
}

fn extract_request_id(response: &reqwest::Response) -> Option<String> {
    response
        .headers()
        .get(REQUEST_ID_HEADER)
        .or_else(|| response.headers().get(ALT_REQUEST_ID_HEADER))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

fn parse_anthropic_error(body: &str) -> (Option<String>, Option<String>) {
    let val: serde_json::Value = match serde_json::from_str(body) {
        Ok(v) => v,
        Err(_) => return (None, None),
    };
    let error_type = val
        .pointer("/error/type")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let message = val
        .pointer("/error/message")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    (error_type, message)
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
        "input_schema": { "type": "object", "properties": {} },
    }));

    let mut body = serde_json::json!({
        "model": model,
        "system": system,
        "messages": msgs,
        "stream": true,
        "max_tokens": 65536,
        "thinking": {
            "type": "enabled",
            "budget_tokens": 32768,
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
            ContentBlock::Image { media_type, data } => serde_json::json!({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": data,
                },
            }),
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
                image,
            } => {
                let content_val = if let Some(img) = image {
                    let mut blocks = vec![serde_json::json!({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": img.media_type,
                            "data": img.data,
                        }
                    })];
                    if !content.is_empty() {
                        blocks.push(serde_json::json!({
                            "type": "text",
                            "text": content,
                        }));
                    }
                    serde_json::Value::Array(blocks)
                } else {
                    serde_json::Value::String(content.clone())
                };
                let mut val = serde_json::json!({
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": content_val,
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

    let mut current_tool_id: Option<String> = None;
    let mut current_tool_name: Option<String> = None;
    let mut current_tool_input_json = String::new();

    let mut current_thinking_text = String::new();
    let mut current_thinking_signature = String::new();

    let mut current_server_tool: Option<(String, String, serde_json::Value)> = None;

    let mut current_block_type: Option<String> = None;

    // Stage 7: Use unified SSE parser
    let mut parser = SseParser::new();
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| LlmError::Network(e.to_string()))?;
        let sse_events = parser.feed(&chunk);

        for sse_event in sse_events {
            let event_type = sse_event.event_type.as_deref().unwrap_or("");
            let data = &sse_event.data;

            if data.is_empty() {
                continue;
            }

            let val: serde_json::Value = match serde_json::from_str(data) {
                Ok(v) => v,
                Err(_) => continue,
            };

            match event_type {
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
                    let error_type = val
                        .pointer("/error/type")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let retryable = matches!(
                        error_type.as_deref(),
                        Some("server_error" | "rate_limit_error" | "overloaded_error")
                    );
                    on_event(StreamEvent::Error(msg.to_string()));
                    return Err(LlmError::Api {
                        status: 0,
                        message: msg.to_string(),
                        error_type,
                        request_id: None,
                        retryable,
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

#[cfg(test)]
mod tests {
    use super::*;

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
                image: None,
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
