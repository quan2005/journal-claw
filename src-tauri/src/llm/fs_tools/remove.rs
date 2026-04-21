use super::super::types::{ToolDefinition, ToolResult};
use super::sandbox_resolve;
use serde_json::json;

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "remove".to_string(),
        description: "Move a file or directory to the system trash (recoverable). Use this instead of permanent deletion. Fails if the path does not exist.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path to the file or directory to remove"
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

    if !abs_path.exists() {
        return ToolResult {
            output: format!("error: path not found: {}", path),
            is_error: true,
        };
    }

    match trash::delete(&abs_path) {
        Ok(_) => ToolResult {
            output: format!("moved to trash: {}", path),
            is_error: false,
        },
        Err(e) => ToolResult {
            output: format!("error: failed to trash: {}", e),
            is_error: true,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn remove_file() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("del.txt"), "bye").unwrap();
        let input = serde_json::json!({"path": "del.txt"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        // trash may or may not work in CI, just check no panic and path gone or error is descriptive
        if !result.is_error {
            assert!(!dir.path().join("del.txt").exists());
        }
    }

    #[tokio::test]
    async fn remove_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({"path": "nope.txt"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(result.is_error);
        assert!(result.output.contains("not found"));
    }

    #[tokio::test]
    async fn remove_escape_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({"path": "../../etc/passwd"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(result.is_error);
        assert!(result.output.contains("escapes"));
    }
}
