use serde_json::{json, Value};
use std::path::PathBuf;

use super::types::{ToolDefinition, ToolResult};

/// Truncate description to ~300 chars at a natural boundary.
fn truncate_description(desc: &str, max_chars: usize) -> String {
    if desc.chars().count() <= max_chars {
        return desc.to_string();
    }
    let truncated: String = desc.chars().take(max_chars).collect();
    // Try to cut at last sentence/comma boundary
    if let Some(pos) = truncated.rfind(['。', '，', '.', ',']) {
        if pos > max_chars / 2 {
            return format!("{}……", &truncated[..=pos]);
        }
    }
    format!("{}……", truncated.trim_end())
}

pub fn definition(skills: &[(String, String)]) -> ToolDefinition {
    let skill_desc = if skills.is_empty() {
        "Skill 名称，对应 skills 目录下的子目录名".to_string()
    } else {
        let items: Vec<String> = skills
            .iter()
            .map(|(name, desc)| {
                let short = truncate_description(desc, 300);
                if short.is_empty() {
                    format!("- {}", name)
                } else {
                    format!("- {}: {}", name, short)
                }
            })
            .collect();
        format!(
            "Skill 名称，对应 skills 目录下的子目录名。可选值：\n{}",
            items.join("\n")
        )
    };

    ToolDefinition {
        name: "load_skill".to_string(),
        description: "加载指定 skill 的规则定义（SKILL.md），作为当前会话后续操作的遵循依据。name 对应 skills 目录下的子目录名。".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": skill_desc
                }
            },
            "required": ["name"]
        }),
    }
}

pub async fn execute(input: &Value, workspace: &str) -> ToolResult {
    let name = match input.get("name").and_then(|v| v.as_str()) {
        Some(n) if !n.trim().is_empty() => n.trim(),
        _ => {
            return ToolResult {
                output: "error: missing or empty 'name' field".to_string(),
                is_error: true,
            };
        }
    };

    // Search project skills first, then global
    let search_dirs = vec![
        PathBuf::from(workspace).join(".claude").join("skills"),
        dirs::home_dir()
            .unwrap_or_default()
            .join(".claude")
            .join("skills"),
    ];

    for dir in &search_dirs {
        let skill_md = dir.join(name).join("SKILL.md");
        if let Ok(content) = tokio::fs::read_to_string(&skill_md).await {
            let path_str = skill_md.to_string_lossy().to_string();
            let result = json!({
                "path": path_str,
                "content": content,
            });
            return ToolResult {
                output: result.to_string(),
                is_error: false,
            };
        }
    }

    // Not found — list available skills
    let mut available: Vec<String> = Vec::new();
    for dir in &search_dirs {
        if let Ok(mut entries) = tokio::fs::read_dir(dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let path = entry.path();
                if path.is_dir() && path.join("SKILL.md").exists() {
                    if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                        if !available.contains(&dir_name.to_string()) {
                            available.push(dir_name.to_string());
                        }
                    }
                }
            }
        }
    }
    available.sort();

    let list = if available.is_empty() {
        "（无可用 skill）".to_string()
    } else {
        available.join(", ")
    };

    ToolResult {
        output: format!(
            "error: skill '{}' not found. Available skills: {}",
            name, list
        ),
        is_error: true,
    }
}

/// Extract a concise label for log display
pub fn log_label(input: &serde_json::Value) -> String {
    let name = input
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("(empty)");
    format!("load_skill: {}", name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn definition_has_required_fields() {
        let def = definition(&[]);
        assert_eq!(def.name, "load_skill");
        assert!(def.input_schema.get("properties").is_some());
    }

    #[tokio::test]
    async fn execute_missing_name() {
        let input = json!({});
        let result = execute(&input, "/tmp").await;
        assert!(result.is_error);
        assert!(result.output.contains("missing"));
    }

    #[tokio::test]
    async fn execute_nonexistent_skill() {
        let input = json!({"name": "nonexistent-skill-xyz"});
        let result = execute(&input, "/tmp").await;
        assert!(result.is_error);
        assert!(result.output.contains("not found"));
    }
}
