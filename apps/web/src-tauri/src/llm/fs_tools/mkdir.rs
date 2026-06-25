use super::super::types::{ToolDefinition, ToolResult};
use super::sandbox_resolve;
use serde_json::json;

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "mkdir".to_string(),
        description:
            "Create a directory (and any missing parent directories) within the workspace."
                .to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path of the directory to create"
                }
            },
            "required": ["path"]
        }),
    }
}

pub async fn execute(input: &serde_json::Value, workspace: &str) -> ToolResult {
    let path = match input.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => {
            return ToolResult {
                output: "error: missing 'path' field".to_string(),
                is_error: true,
            }
        }
    };

    let abs_path = match sandbox_resolve(workspace, path) {
        Ok(p) => p,
        Err(e) => return e,
    };

    match tokio::fs::create_dir_all(&abs_path).await {
        Ok(_) => ToolResult {
            output: format!("created directory: {}", path),
            is_error: false,
        },
        Err(e) => ToolResult {
            output: format!("error: failed to create directory: {}", e),
            is_error: true,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn mkdir_creates_nested() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({"path": "a/b/c"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(dir.path().join("a/b/c").is_dir());
    }

    #[tokio::test]
    async fn mkdir_idempotent() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("existing")).unwrap();
        let input = serde_json::json!({"path": "existing"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
    }

    #[tokio::test]
    async fn mkdir_escape_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({"path": "../../evil"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(result.is_error);
    }
}
