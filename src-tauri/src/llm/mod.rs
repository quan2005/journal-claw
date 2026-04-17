pub mod anthropic;
pub mod bash_tool;
pub mod enable_skill;
pub mod output_compress;
pub mod prompt;
pub mod tool_loop;
pub mod types;

use async_trait::async_trait;
use types::{AssistantResponse, LlmError, Message, StreamEvent, ToolDefinition};

// ── Engine trait ────────────────────────────────

#[async_trait]
pub trait LlmEngine: Send + Sync {
    async fn chat_stream(
        &self,
        messages: &[Message],
        tools: &[ToolDefinition],
        system: &str,
        on_event: Box<dyn Fn(StreamEvent) + Send>,
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
