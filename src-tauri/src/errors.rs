use serde::{Deserialize, Serialize};

/// Machine-readable error codes for AI processing failures.
/// Each variant maps to a specific failure category with known retry behavior.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum AiErrorCode {
    RateLimited,
    AuthFailed,
    NetworkTimeout,
    ModelUnavailable,
    QuotaExhausted,
    TranscriptionFailed,
    InvalidMaterial,
    LlmError,
    InternalError,
}

impl AiErrorCode {
    /// Whether this error category is worth retrying automatically.
    pub fn retryable(&self) -> bool {
        matches!(
            self,
            AiErrorCode::RateLimited
                | AiErrorCode::NetworkTimeout
                | AiErrorCode::ModelUnavailable
        )
    }

    /// Human-readable hint for what the user should do.
    pub fn user_action(&self) -> Option<&'static str> {
        match self {
            AiErrorCode::RateLimited => Some("请求过于频繁，稍后自动重试"),
            AiErrorCode::AuthFailed => Some("API Key 无效，请检查设置"),
            AiErrorCode::NetworkTimeout => Some("网络超时，稍后自动重试"),
            AiErrorCode::ModelUnavailable => Some("模型暂时不可用，稍后重试"),
            AiErrorCode::QuotaExhausted => Some("API 额度已用尽，请充值或更换 Key"),
            AiErrorCode::TranscriptionFailed => Some("语音转写失败，请检查音频文件"),
            AiErrorCode::InvalidMaterial => Some("素材无法解析"),
            AiErrorCode::LlmError => None,
            AiErrorCode::InternalError => None,
        }
    }

    /// Classify from an LLM error message string.
    /// Parses common patterns from Anthropic / OpenAI-compat error responses.
    pub fn from_llm_error(message: &str) -> Self {
        let lower = message.to_ascii_lowercase();
        if lower.contains("429") || lower.contains("rate") || lower.contains("too many") {
            AiErrorCode::RateLimited
        } else if lower.contains("401")
            || lower.contains("403")
            || lower.contains("auth")
            || lower.contains("invalid api key")
            || lower.contains("invalid x-api-key")
        {
            AiErrorCode::AuthFailed
        } else if lower.contains("timeout")
            || lower.contains("timed out")
            || lower.contains("connection refused")
        {
            AiErrorCode::NetworkTimeout
        } else if lower.contains("model")
            && (lower.contains("not found") || lower.contains("unavailable"))
        {
            AiErrorCode::ModelUnavailable
        } else if lower.contains("quota")
            || lower.contains("billing")
            || lower.contains("credit")
        {
            AiErrorCode::QuotaExhausted
        } else {
            AiErrorCode::LlmError
        }
    }
}

/// Structured error payload emitted alongside `ai-processing` events.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProcessingError {
    pub code: AiErrorCode,
    pub message: String,
    pub retryable: bool,
    pub user_action: Option<String>,
    pub attempt: u32,
}

impl AiProcessingError {
    pub fn new(code: AiErrorCode, message: String, attempt: u32) -> Self {
        Self {
            retryable: code.retryable(),
            user_action: code.user_action().map(|s| s.to_string()),
            message,
            code,
            attempt,
        }
    }

    /// Classify from a raw LLM error string.
    pub fn from_llm_error_string(message: &str, attempt: u32) -> Self {
        let code = AiErrorCode::from_llm_error(message);
        Self::new(code, message.to_string(), attempt)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rate_limited_is_retryable() {
        assert!(AiErrorCode::RateLimited.retryable());
    }

    #[test]
    fn auth_failed_is_not_retryable() {
        assert!(!AiErrorCode::AuthFailed.retryable());
    }

    #[test]
    fn network_timeout_is_retryable() {
        assert!(AiErrorCode::NetworkTimeout.retryable());
    }

    #[test]
    fn auth_failed_has_user_action() {
        assert!(AiErrorCode::AuthFailed.user_action().is_some());
    }

    #[test]
    fn llm_error_has_no_user_action() {
        assert!(AiErrorCode::LlmError.user_action().is_none());
    }

    #[test]
    fn classify_429() {
        assert_eq!(
            AiErrorCode::from_llm_error("Error 429: rate limit exceeded"),
            AiErrorCode::RateLimited
        );
    }

    #[test]
    fn classify_401() {
        assert_eq!(
            AiErrorCode::from_llm_error("401 Unauthorized: invalid api key"),
            AiErrorCode::AuthFailed
        );
    }

    #[test]
    fn classify_timeout() {
        assert_eq!(
            AiErrorCode::from_llm_error("request timed out after 30s"),
            AiErrorCode::NetworkTimeout
        );
    }

    #[test]
    fn classify_model_not_found() {
        assert_eq!(
            AiErrorCode::from_llm_error("model not found: gpt-5"),
            AiErrorCode::ModelUnavailable
        );
    }

    #[test]
    fn classify_quota() {
        assert_eq!(
            AiErrorCode::from_llm_error("You have exceeded your billing quota"),
            AiErrorCode::QuotaExhausted
        );
    }

    #[test]
    fn classify_unknown() {
        assert_eq!(
            AiErrorCode::from_llm_error("something unexpected happened"),
            AiErrorCode::LlmError
        );
    }

    #[test]
    fn error_struct_carries_attempt() {
        let err = AiProcessingError::from_llm_error_string("timeout", 3);
        assert_eq!(err.attempt, 3);
        assert!(err.retryable);
    }

    #[test]
    fn error_serialization_roundtrip() {
        let err = AiProcessingError::new(AiErrorCode::AuthFailed, "bad key".to_string(), 1);
        let json = serde_json::to_string(&err).unwrap();
        let parsed: AiProcessingError = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.code, AiErrorCode::AuthFailed);
        assert_eq!(parsed.message, "bad key");
        assert!(!parsed.retryable);
    }
}
