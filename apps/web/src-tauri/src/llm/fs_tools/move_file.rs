use super::super::types::{ToolDefinition, ToolResult};
use super::sandbox_resolve;
use serde_json::json;

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "move".to_string(),
        description: "Move or rename a file or directory within the workspace.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "description": "Relative path of the source file or directory"
                },
                "destination": {
                    "type": "string",
                    "description": "Relative path of the destination"
                }
            },
            "required": ["source", "destination"]
        }),
    }
}

pub async fn execute(input: &serde_json::Value, workspace: &str) -> ToolResult {
    let source = match input.get("source").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => {
            return ToolResult {
                output: "error: missing 'source' field".to_string(),
                is_error: true,
            }
        }
    };

    let destination = match input.get("destination").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => {
            return ToolResult {
                output: "error: missing 'destination' field".to_string(),
                is_error: true,
            }
        }
    };

    let src_path = match sandbox_resolve(workspace, source) {
        Ok(p) => p,
        Err(e) => return e,
    };

    let dst_path = match sandbox_resolve(workspace, destination) {
        Ok(p) => p,
        Err(e) => return e,
    };

    if !src_path.exists() {
        return ToolResult {
            output: format!("error: source not found: {}", source),
            is_error: true,
        };
    }

    // Create parent dirs for destination
    if let Some(parent) = dst_path.parent() {
        if let Err(e) = tokio::fs::create_dir_all(parent).await {
            return ToolResult {
                output: format!(
                    "error: failed to create destination parent directories: {}",
                    e
                ),
                is_error: true,
            };
        }
    }

    match tokio::fs::rename(&src_path, &dst_path).await {
        Ok(_) => ToolResult {
            output: format!("moved {} → {}", source, destination),
            is_error: false,
        },
        Err(e) => ToolResult {
            output: format!("error: failed to move: {}", e),
            is_error: true,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn move_renames_file() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("old.txt"), "content").unwrap();
        let input = serde_json::json!({"source": "old.txt", "destination": "new.txt"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(!dir.path().join("old.txt").exists());
        assert!(dir.path().join("new.txt").exists());
    }

    #[tokio::test]
    async fn move_creates_parent_dirs() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "x").unwrap();
        let input = serde_json::json!({"source": "f.txt", "destination": "sub/dir/f.txt"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(dir.path().join("sub/dir/f.txt").exists());
    }

    #[tokio::test]
    async fn move_source_missing() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({"source": "nope.txt", "destination": "out.txt"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(result.is_error);
        assert!(result.output.contains("not found"));
    }

    #[tokio::test]
    async fn move_escape_rejected() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "x").unwrap();
        let input = serde_json::json!({"source": "f.txt", "destination": "../../evil.txt"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(result.is_error);
    }
}
