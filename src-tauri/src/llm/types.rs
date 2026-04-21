use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt;

// ── Message types ───────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: Role,
    pub content: Vec<ContentBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    #[serde(rename = "image")]
    Image {
        #[serde(rename = "media_type")]
        media_type: String,
        data: String,
    },
    #[serde(rename = "text")]
    Text { text: String },
    /// Extended thinking block — must be preserved in multi-turn conversations.
    #[serde(rename = "thinking")]
    Thinking { thinking: String, signature: String },
    #[serde(rename = "tool_use")]
    ToolUse {
        id: String,
        name: String,
        input: Value,
    },
    #[serde(rename = "tool_result")]
    ToolResult {
        tool_use_id: String,
        content: String,
        #[serde(default, skip_serializing_if = "is_false")]
        is_error: bool,
        #[serde(skip)]
        image: Option<ImageData>,
    },
    /// Server-side tool invocation (e.g. web_search). Opaque — pass through as-is.
    #[serde(rename = "server_tool_use")]
    ServerToolUse {
        id: String,
        name: String,
        input: Value,
    },
    /// Server-side tool result (e.g. web_search_tool_result). Opaque — pass through as-is.
    /// Uses untagged fallback so any unknown `type` is captured as raw JSON.
    #[serde(untagged)]
    ServerToolResult(Value),
}

fn is_false(v: &bool) -> bool {
    !v
}

// ── Tool definition ─────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

// ── Streaming events ────────────────────────────

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum StreamEvent {
    TextDelta(String),
    ThinkingDelta(String),
    ToolUseStart {
        id: String,
        name: String,
    },
    ToolUseDelta {
        id: String,
        input_json_delta: String,
    },
    ToolUseEnd {
        id: String,
    },
    /// Server-side web_search result — carries the raw JSON for frontend rendering
    WebSearchResult(serde_json::Value),
    MessageEnd {
        usage: Option<Usage>,
    },
    Error(String),
}

// ── Response types ──────────────────────────────

#[derive(Debug, Clone)]
pub struct AssistantResponse {
    pub content: Vec<ContentBlock>,
    pub stop_reason: StopReason,
    pub usage: Option<Usage>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum StopReason {
    EndTurn,
    ToolUse,
    MaxTokens,
    /// API paused a long-running turn (e.g. multiple web searches). Resume by re-sending.
    PauseTurn,
}

#[derive(Debug, Clone, Default)]
pub struct Usage {
    pub input_tokens: u32,
    pub output_tokens: u32,
}

// ── Image data for vision ────────────────────────

#[derive(Debug, Clone)]
pub struct ImageData {
    pub media_type: String,
    pub data: String,
}

// ── Tool execution result ───────────────────────

#[derive(Debug, Clone)]
pub struct ToolResult {
    pub output: String,
    pub is_error: bool,
}

// ── Errors ──────────────────────────────────────

#[derive(Debug)]
pub enum LlmError {
    /// HTTP or network error
    Network(String),
    /// API returned an error response
    Api { status: u16, message: String },
    /// Failed to parse SSE stream
    #[allow(dead_code)]
    Parse(String),
    /// Agent cancelled by user
    Cancelled,
    /// Exceeded max tool-loop turns
    MaxTurnsExceeded,
}

impl LlmError {
    /// Structured error info for the frontend.
    pub fn error_info(&self) -> serde_json::Value {
        let (code, message, retryable) = match self {
            LlmError::Network(e) => {
                if e.contains("timed out") || e.contains("timeout") {
                    ("timeout", format!("连接超时: {}", e), true)
                } else {
                    ("network_error", format!("网络错误: {}", e), true)
                }
            }
            LlmError::Api { status, message } => match status {
                401 | 403 => (
                    "auth_error",
                    format!("认证失败 ({}): {}", status, message),
                    false,
                ),
                429 => (
                    "rate_limited",
                    "API 请求频率超限，请稍后重试".to_string(),
                    true,
                ),
                400 => ("invalid_request", format!("请求无效: {}", message), false),
                0 => ("server_error", format!("流式传输中断: {}", message), true),
                _ if *status >= 500 => (
                    "server_error",
                    format!("服务端错误 ({}): {}", status, message),
                    true,
                ),
                _ => (
                    "api_error",
                    format!("API 错误 ({}): {}", status, message),
                    false,
                ),
            },
            LlmError::Parse(e) => ("parse_error", format!("解析错误: {}", e), false),
            LlmError::Cancelled => ("cancelled", "已取消".to_string(), false),
            LlmError::MaxTurnsExceeded => ("max_turns", "超过最大轮次限制".to_string(), false),
        };
        serde_json::json!({
            "code": code,
            "message": message,
            "retryable": retryable,
        })
    }
}

impl fmt::Display for LlmError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LlmError::Network(e) => write!(f, "网络错误: {}", e),
            LlmError::Api { status, message } => write!(f, "API 错误 ({}): {}", status, message),
            LlmError::Parse(e) => write!(f, "解析错误: {}", e),
            LlmError::Cancelled => write!(f, "已取消"),
            LlmError::MaxTurnsExceeded => write!(f, "超过最大轮次限制"),
        }
    }
}

impl From<reqwest::Error> for LlmError {
    fn from(e: reqwest::Error) -> Self {
        LlmError::Network(e.to_string())
    }
}
