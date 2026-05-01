use serde_json::{json, Value};
use tokio_util::sync::CancellationToken;

use super::tool_loop;
use super::types::{ToolDefinition, ToolResult};
use super::LlmEngine;

const MAX_SUMMARY_CHARS: usize = 50_000;

const SUBAGENT_SYSTEM: &str = r#"你是一个子任务执行器。你被分配了一个具体任务，请高效完成并给出简洁的结果摘要。

规则：
- 专注于分配给你的任务，不要偏离
- 完成后给出清晰、简洁的摘要
- 如果任务无法完成，说明原因
- 你拥有 bash、文件读写等工具，但不能再派生子任务"#;

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "task".to_string(),
        description: "派生一个独立子任务（subagent），在全新上下文中执行。子任务拥有 bash、文件读写等工具，完成后只返回摘要文本。适用于：需要大量文件读取/搜索的调研任务、独立的代码修改、不需要保留中间过程的操作。".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "子任务的详细指令。应包含足够的上下文，因为子任务无法看到当前对话历史。"
                }
            },
            "required": ["prompt"]
        }),
    }
}

pub async fn execute(
    input: &Value,
    workspace_path: &str,
    engine: &dyn LlmEngine,
    cancel: CancellationToken,
    on_event: impl Fn(tool_loop::AgentEvent) + Send + Sync + 'static,
    global_skills_enabled: bool,
) -> ToolResult {
    let prompt = match input.get("prompt").and_then(|v| v.as_str()) {
        Some(p) if !p.trim().is_empty() => p,
        _ => {
            return ToolResult {
                output: "error: missing or empty 'prompt' field".to_string(),
                is_error: true,
            };
        }
    };

    match tool_loop::run_agent(
        engine,
        workspace_path,
        SUBAGENT_SYSTEM,
        prompt,
        on_event,
        cancel,
        global_skills_enabled,
    )
    .await
    {
        Ok(summary) => {
            let mut text = summary;
            if text.chars().count() > MAX_SUMMARY_CHARS {
                text = text.chars().take(MAX_SUMMARY_CHARS).collect();
                text.push_str("\n\n[摘要已截断]");
            }
            ToolResult {
                output: text,
                is_error: false,
            }
        }
        Err(e) => ToolResult {
            output: format!("subtask failed: {}", e),
            is_error: true,
        },
    }
}

pub fn log_label(input: &Value) -> String {
    let prompt = input
        .get("prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("(empty)");
    let clean: String = prompt.split_whitespace().collect::<Vec<_>>().join(" ");
    if clean.chars().count() > 80 {
        format!("task: {}…", clean.chars().take(80).collect::<String>())
    } else {
        format!("task: {}", clean)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn definition_has_required_fields() {
        let def = definition();
        assert_eq!(def.name, "task");
        let props = def.input_schema.get("properties").unwrap();
        assert!(props.get("prompt").is_some());
        let required = def
            .input_schema
            .get("required")
            .unwrap()
            .as_array()
            .unwrap();
        assert!(required.iter().any(|v| v.as_str() == Some("prompt")));
    }

    #[test]
    fn log_label_truncates_long_prompt() {
        let long = "a".repeat(200);
        let input = serde_json::json!({"prompt": long});
        let label = log_label(&input);
        assert!(label.len() < 200);
        assert!(label.ends_with('…'));
    }

    #[test]
    fn log_label_short_prompt() {
        let input = serde_json::json!({"prompt": "find test framework"});
        let label = log_label(&input);
        assert_eq!(label, "task: find test framework");
    }
}
