use super::super::types::{ToolDefinition, ToolResult};
use serde_json::json;

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "move".to_string(),
        description: "TODO".to_string(),
        input_schema: json!({"type": "object", "properties": {}, "required": []}),
    }
}

pub async fn execute(_input: &serde_json::Value, _workspace: &str) -> ToolResult {
    ToolResult {
        output: "not implemented".to_string(),
        is_error: true,
    }
}
