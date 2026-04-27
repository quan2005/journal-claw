pub mod anthropic;
pub mod bash_tool;
pub mod enable_skill;
pub mod fs_tools;
pub mod loop_detector;
pub mod model_quirks;
pub mod openai_compat;
pub mod output_compress;
pub mod prompt;
pub mod retry;
pub mod sse_parser;
pub mod tool_loop;
pub mod types;

use async_trait::async_trait;
use tokio::sync::mpsc;
use types::{AssistantResponse, LlmError, Message, StreamEvent, ToolDefinition};

// ── Engine trait ────────────────────────────────

#[async_trait]
pub trait LlmEngine: Send + Sync {
    async fn chat_stream(
        &self,
        messages: &[Message],
        tools: &[ToolDefinition],
        system: &str,
        event_tx: mpsc::UnboundedSender<StreamEvent>,
    ) -> Result<AssistantResponse, LlmError>;
}

// ── Engine constructor ──────────────────────────

pub fn create_anthropic_engine(
    api_key: &str,
    base_url: &str,
    model: &str,
) -> anthropic::AnthropicEngine {
    let base = if base_url.is_empty() {
        "https://api.anthropic.com"
    } else {
        base_url
    };
    let model = if model.is_empty() {
        "claude-sonnet-4-20250514"
    } else {
        model
    };
    anthropic::AnthropicEngine::new(api_key.to_string(), base.to_string(), model.to_string())
}

pub fn create_openai_compat_engine(
    api_key: &str,
    base_url: &str,
    model: &str,
) -> openai_compat::OpenAiCompatEngine {
    let base = if base_url.is_empty() {
        "https://dashscope.aliyuncs.com/compatible-mode/v1"
    } else {
        base_url
    };
    let model = if model.is_empty() { "qwen-max" } else { model };
    openai_compat::OpenAiCompatEngine::new(api_key.to_string(), base.to_string(), model.to_string())
}

pub fn create_engine_for_provider(
    api_key: &str,
    base_url: &str,
    model: &str,
    protocol: &str,
) -> Box<dyn LlmEngine> {
    match protocol {
        "openai" => Box::new(create_openai_compat_engine(api_key, base_url, model)),
        _ => Box::new(create_anthropic_engine(api_key, base_url, model)),
    }
}
