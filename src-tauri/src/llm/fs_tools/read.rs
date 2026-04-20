use super::super::types::{ToolDefinition, ToolResult};
use super::{sandbox_resolve, MAX_READ_CHARS};
use serde_json::json;

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "read".to_string(),
        description: "Read the contents of a file within the workspace. Returns file content as text. Supports optional line offset and limit.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path to the file within the workspace"
                },
                "offset": {
                    "type": "integer",
                    "description": "Line number to start reading from (1-indexed, optional)"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of lines to read (optional)"
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
            output: format!("error: file not found: {}", path),
            is_error: true,
        };
    }

    if abs_path.is_dir() {
        return ToolResult {
            output: format!("error: path is a directory: {}", path),
            is_error: true,
        };
    }

    let content = match tokio::fs::read_to_string(&abs_path).await {
        Ok(c) => c,
        Err(e) => {
            return ToolResult {
                output: format!("error: failed to read file: {}", e),
                is_error: true,
            }
        }
    };

    let offset = input
        .get("offset")
        .and_then(|v| v.as_u64())
        .unwrap_or(1)
        .max(1) as usize;
    let limit = input
        .get("limit")
        .and_then(|v| v.as_u64())
        .map(|v| v as usize);

    let lines: Vec<&str> = content.lines().collect();
    let start = (offset - 1).min(lines.len());
    let end = match limit {
        Some(n) => (start + n).min(lines.len()),
        None => lines.len(),
    };

    let slice = lines[start..end].join("\n");

    let truncated = slice.chars().count() > MAX_READ_CHARS;
    let output: String = if truncated {
        slice.chars().take(MAX_READ_CHARS).collect::<String>()
            + &format!("\n\n[truncated at {} chars]", MAX_READ_CHARS)
    } else {
        slice
    };

    ToolResult {
        output,
        is_error: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn read_simple_file() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("hello.txt"), "line1\nline2\nline3").unwrap();
        let input = serde_json::json!({"path": "hello.txt"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(result.output.contains("line1") && result.output.contains("line3"));
    }

    #[tokio::test]
    async fn read_with_offset_and_limit() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "a\nb\nc\nd\ne").unwrap();
        let input = serde_json::json!({"path": "f.txt", "offset": 2, "limit": 2});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert_eq!(result.output, "b\nc");
    }

    #[tokio::test]
    async fn read_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({"path": "nope.txt"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(result.is_error);
        assert!(result.output.contains("not found"));
    }

    #[tokio::test]
    async fn read_path_escape_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({"path": "../../etc/passwd"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(result.is_error);
        assert!(result.output.contains("escapes"));
    }
}
