//! Model-specific quirk detection.
//! Determines behavioral adjustments needed for different LLM providers/models.

/// Strip routing prefixes (e.g. "openai/gpt-4" → "gpt-4", "dashscope/qwen-max" → "qwen-max")
pub fn strip_routing_prefix(model: &str) -> &str {
    const PREFIXES: &[&str] = &[
        "openai/",
        "dashscope/",
        "xai/",
        "grok/",
        "qwen/",
        "kimi/",
        "deepseek/",
    ];
    for prefix in PREFIXES {
        if let Some(rest) = model.strip_prefix(prefix) {
            return rest;
        }
    }
    model
}

/// Kimi models reject the `is_error` field in tool result messages.
pub fn rejects_is_error_field(model: &str) -> bool {
    let m = strip_routing_prefix(model).to_lowercase();
    m.starts_with("kimi") || m.starts_with("moonshot")
}

/// Reasoning models reject temperature, top_p, frequency_penalty, presence_penalty.
pub fn is_reasoning_model(model: &str) -> bool {
    let m = strip_routing_prefix(model).to_lowercase();
    m.starts_with("o1")
        || m.starts_with("o3")
        || m.starts_with("o4")
        || m.starts_with("qwq")
        || m.starts_with("qwen-qwq")
        || m.contains("-thinking")
        || m.starts_with("deepseek-reasoner")
        || m.starts_with("grok-3-mini")
}

/// GPT-5 series uses `max_completion_tokens` instead of `max_tokens`.
pub fn uses_max_completion_tokens(model: &str) -> bool {
    let m = strip_routing_prefix(model).to_lowercase();
    m.starts_with("gpt-5") || m.starts_with("o1") || m.starts_with("o3") || m.starts_with("o4")
}

/// Whether the model supports thinking/extended reasoning in the request.
#[allow(dead_code)]
pub fn supports_thinking_request(model: &str) -> bool {
    let m = strip_routing_prefix(model).to_lowercase();
    m.starts_with("claude")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_routing_prefix() {
        assert_eq!(strip_routing_prefix("openai/gpt-4"), "gpt-4");
        assert_eq!(strip_routing_prefix("dashscope/qwen-max"), "qwen-max");
        assert_eq!(strip_routing_prefix("kimi-k2.5"), "kimi-k2.5");
        assert_eq!(
            strip_routing_prefix("claude-sonnet-4-20250514"),
            "claude-sonnet-4-20250514"
        );
    }

    #[test]
    fn test_rejects_is_error() {
        assert!(rejects_is_error_field("kimi-k2.5"));
        assert!(rejects_is_error_field("dashscope/kimi-k1.5"));
        assert!(rejects_is_error_field("moonshot-v1-8k"));
        assert!(!rejects_is_error_field("qwen-max"));
        assert!(!rejects_is_error_field("gpt-4"));
    }

    #[test]
    fn test_is_reasoning_model() {
        assert!(is_reasoning_model("o1-preview"));
        assert!(is_reasoning_model("o3-mini"));
        assert!(is_reasoning_model("o4-mini"));
        assert!(is_reasoning_model("qwq-32b"));
        assert!(is_reasoning_model("qwen-qwq-32b"));
        assert!(is_reasoning_model("deepseek-reasoner"));
        assert!(is_reasoning_model("grok-3-mini"));
        assert!(is_reasoning_model("qwen3-235b-thinking"));
        assert!(!is_reasoning_model("qwen-max"));
        assert!(!is_reasoning_model("gpt-4"));
        assert!(!is_reasoning_model("grok-3"));
    }

    #[test]
    fn test_uses_max_completion_tokens() {
        assert!(uses_max_completion_tokens("gpt-5"));
        assert!(uses_max_completion_tokens("gpt-5-turbo"));
        assert!(uses_max_completion_tokens("o1-preview"));
        assert!(uses_max_completion_tokens("o3-mini"));
        assert!(!uses_max_completion_tokens("gpt-4"));
        assert!(!uses_max_completion_tokens("qwen-max"));
    }

    #[test]
    fn test_supports_thinking_request() {
        assert!(supports_thinking_request("claude-sonnet-4-20250514"));
        assert!(supports_thinking_request("claude-opus-4-6"));
        assert!(!supports_thinking_request("qwen-max"));
        assert!(!supports_thinking_request("gpt-4"));
    }
}
