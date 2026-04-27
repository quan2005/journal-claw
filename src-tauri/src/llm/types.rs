use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt;
use std::sync::atomic::{AtomicU64, Ordering};

// ── Span ID for structured tracing ─────────────

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpanId(pub String);

#[allow(dead_code)]
impl SpanId {
    pub fn new() -> Self {
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        Self(format!("{:08x}", n))
    }
}

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

// ── Context window error markers (ported from claw-code) ──

const CONTEXT_WINDOW_ERROR_MARKERS: &[&str] = &[
    "maximum context length",
    "context window",
    "context length",
    "too many tokens",
    "prompt is too long",
    "input is too long",
    "request is too large",
];

// ── Errors ──────────────────────────────────────

#[derive(Debug)]
pub enum LlmError {
    /// HTTP or network error
    Network(String),
    /// API returned an error response
    Api {
        status: u16,
        message: String,
        #[allow(dead_code)]
        error_type: Option<String>,
        request_id: Option<String>,
        retryable: bool,
    },
    /// Failed to parse SSE stream
    #[allow(dead_code)]
    Parse(String),
    /// Agent cancelled by user
    Cancelled,
    /// Exceeded max tool-loop turns
    MaxTurnsExceeded,
    /// Loop detector triggered a hard stop
    LoopDetected(String),
    /// All retry attempts exhausted
    RetriesExhausted {
        attempts: u32,
        last_error: Box<LlmError>,
    },
    /// Context window exceeded (pre-flight or API response)
    #[allow(dead_code)]
    ContextWindowExceeded { model: String, message: String },
    /// Request body too large for provider
    RequestBodySizeExceeded {
        estimated_bytes: usize,
        max_bytes: usize,
        provider: String,
    },
    /// Post-tool stall: model did not respond within timeout
    Stall,
}

impl LlmError {
    /// Whether this error is transient and the request should be retried.
    pub fn is_retryable(&self) -> bool {
        match self {
            LlmError::Network(_) => true,
            LlmError::Api {
                status, retryable, ..
            } => {
                if *retryable {
                    return true;
                }
                matches!(status, 0 | 408 | 409 | 429 | 500 | 502 | 503 | 504 | 529)
            }
            LlmError::RetriesExhausted { last_error, .. } => last_error.is_retryable(),
            _ => false,
        }
    }

    /// Whether this error indicates the context window was exceeded.
    pub fn is_context_window_failure(&self) -> bool {
        match self {
            LlmError::ContextWindowExceeded { .. } => true,
            LlmError::Api {
                status, message, ..
            } => matches!(status, 400 | 413 | 422) && looks_like_context_window_error(message),
            LlmError::RetriesExhausted { last_error, .. } => last_error.is_context_window_failure(),
            _ => false,
        }
    }

    /// Extract request ID, delegating through RetriesExhausted.
    pub fn request_id(&self) -> Option<&str> {
        match self {
            LlmError::Api { request_id, .. } => request_id.as_deref(),
            LlmError::RetriesExhausted { last_error, .. } => last_error.request_id(),
            _ => None,
        }
    }

    /// Stable error classification string for logging/telemetry.
    pub fn safe_failure_class(&self) -> &'static str {
        match self {
            LlmError::RetriesExhausted { .. } if self.is_context_window_failure() => {
                "context_window"
            }
            LlmError::RetriesExhausted { last_error, .. } => last_error.safe_failure_class(),
            LlmError::Network(e) => {
                if e.contains("timed out") || e.contains("timeout") {
                    "provider_timeout"
                } else {
                    "provider_transport"
                }
            }
            LlmError::Api { status, .. } if matches!(status, 401 | 403) => "provider_auth",
            LlmError::ContextWindowExceeded { .. } => "context_window",
            LlmError::Api { .. } if self.is_context_window_failure() => "context_window",
            LlmError::Api { status, .. } if *status == 429 => "provider_rate_limit",
            LlmError::Api { status, .. } if *status >= 500 => "provider_internal",
            LlmError::Api { .. } => "provider_error",
            LlmError::Parse(_) => "parse_error",
            LlmError::Cancelled => "cancelled",
            LlmError::MaxTurnsExceeded => "max_turns",
            LlmError::LoopDetected(_) => "loop_detected",
            LlmError::RequestBodySizeExceeded { .. } => "request_size",
            LlmError::Stall => "post_tool_stall",
        }
    }

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
            LlmError::Api {
                status, message, ..
            } => match status {
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
            LlmError::LoopDetected(ref msg) => ("loop_detected", msg.clone(), false),
            LlmError::RetriesExhausted {
                attempts,
                last_error,
            } => (
                "retries_exhausted",
                format!("重试 {} 次后仍然失败: {}", attempts, last_error),
                false,
            ),
            LlmError::ContextWindowExceeded { model, message } => (
                "context_window",
                format!("上下文窗口超限 ({}): {}", model, message),
                false,
            ),
            LlmError::RequestBodySizeExceeded {
                estimated_bytes,
                max_bytes,
                provider,
            } => (
                "request_size",
                format!(
                    "请求体过大: {} 字节，{} 限制 {} 字节",
                    estimated_bytes, provider, max_bytes
                ),
                false,
            ),
            LlmError::Stall => (
                "stall",
                "工具执行后 API 响应超时，正在重试…".to_string(),
                true,
            ),
        };
        let mut info = serde_json::json!({
            "code": code,
            "message": message,
            "retryable": retryable,
            "failure_class": self.safe_failure_class(),
        });
        if let Some(rid) = self.request_id() {
            info["request_id"] = serde_json::Value::String(rid.to_string());
        }
        info
    }
}

fn looks_like_context_window_error(text: &str) -> bool {
    let lowered = text.to_ascii_lowercase();
    CONTEXT_WINDOW_ERROR_MARKERS
        .iter()
        .any(|marker| lowered.contains(marker))
}

impl fmt::Display for LlmError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LlmError::Network(e) => write!(f, "网络错误: {}", e),
            LlmError::Api {
                status,
                message,
                request_id,
                ..
            } => {
                write!(f, "API 错误 ({})", status)?;
                if let Some(rid) = request_id {
                    write!(f, " [trace {}]", rid)?;
                }
                write!(f, ": {}", message)
            }
            LlmError::Parse(e) => write!(f, "解析错误: {}", e),
            LlmError::Cancelled => write!(f, "已取消"),
            LlmError::MaxTurnsExceeded => write!(f, "超过最大轮次限制"),
            LlmError::LoopDetected(ref msg) => write!(f, "循环检测终止: {}", msg),
            LlmError::RetriesExhausted {
                attempts,
                last_error,
            } => write!(f, "重试 {} 次后失败: {}", attempts, last_error),
            LlmError::ContextWindowExceeded { model, message } => {
                write!(f, "上下文窗口超限 ({}): {}", model, message)
            }
            LlmError::RequestBodySizeExceeded {
                estimated_bytes,
                max_bytes,
                provider,
            } => write!(
                f,
                "请求体过大: {} 字节，{} 限制 {} 字节",
                estimated_bytes, provider, max_bytes
            ),
            LlmError::Stall => write!(f, "工具执行后 API 响应超时"),
        }
    }
}

impl From<reqwest::Error> for LlmError {
    fn from(e: reqwest::Error) -> Self {
        LlmError::Network(e.to_string())
    }
}

#[cfg(test)]
mod error_tests {
    use super::*;

    #[test]
    fn retryable_network_errors() {
        let err = LlmError::Network("connection reset".into());
        assert!(err.is_retryable());
    }

    #[test]
    fn retryable_api_statuses() {
        for status in [0, 408, 409, 429, 500, 502, 503, 504, 529] {
            let err = LlmError::Api {
                status,
                message: "test".into(),
                error_type: None,
                request_id: None,
                retryable: false,
            };
            assert!(err.is_retryable(), "status {} should be retryable", status);
        }
    }

    #[test]
    fn non_retryable_api_statuses() {
        for status in [400, 401, 403, 404, 422] {
            let err = LlmError::Api {
                status,
                message: "test".into(),
                error_type: None,
                request_id: None,
                retryable: false,
            };
            assert!(
                !err.is_retryable(),
                "status {} should not be retryable",
                status
            );
        }
    }

    #[test]
    fn context_window_detection() {
        let err = LlmError::Api {
            status: 400,
            message: "This model's maximum context length is 200000 tokens".into(),
            error_type: None,
            request_id: None,
            retryable: false,
        };
        assert!(err.is_context_window_failure());
        assert_eq!(err.safe_failure_class(), "context_window");
    }

    #[test]
    fn request_id_propagation_through_retries() {
        let inner = LlmError::Api {
            status: 502,
            message: "bad gateway".into(),
            error_type: None,
            request_id: Some("req_abc123".into()),
            retryable: true,
        };
        let outer = LlmError::RetriesExhausted {
            attempts: 8,
            last_error: Box::new(inner),
        };
        assert_eq!(outer.request_id(), Some("req_abc123"));
        assert_eq!(outer.safe_failure_class(), "provider_internal");
    }

    #[test]
    fn error_info_backward_compatible() {
        let err = LlmError::Api {
            status: 429,
            message: "rate limited".into(),
            error_type: Some("rate_limit_error".into()),
            request_id: Some("req_xyz".into()),
            retryable: true,
        };
        let info = err.error_info();
        assert!(info.get("code").is_some());
        assert!(info.get("message").is_some());
        assert!(info.get("retryable").is_some());
        assert_eq!(info["request_id"], "req_xyz");
        assert_eq!(info["failure_class"], "provider_rate_limit");
    }

    #[test]
    fn display_includes_request_id() {
        let err = LlmError::Api {
            status: 500,
            message: "internal".into(),
            error_type: None,
            request_id: Some("req_trace".into()),
            retryable: true,
        };
        let s = err.to_string();
        assert!(s.contains("[trace req_trace]"));
    }
}
