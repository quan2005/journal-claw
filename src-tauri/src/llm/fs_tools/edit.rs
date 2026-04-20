use super::super::types::{ToolDefinition, ToolResult};
use super::sandbox_resolve;
use serde_json::json;

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "edit".to_string(),
        description: "Replace an exact string in a file. Fails if old_string is not found or appears more than once (use replace_all to override). The match is exact and case-sensitive.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path to the file within the workspace"
                },
                "old_string": {
                    "type": "string",
                    "description": "Exact string to find and replace"
                },
                "new_string": {
                    "type": "string",
                    "description": "Replacement string"
                },
                "replace_all": {
                    "type": "boolean",
                    "description": "If true, replace all occurrences instead of requiring exactly one (default: false)"
                }
            },
            "required": ["path", "old_string", "new_string"]
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

    let old_string = match input.get("old_string").and_then(|v| v.as_str()) {
        Some(s) => s,
        None => {
            return ToolResult {
                output: "error: missing 'old_string' field".to_string(),
                is_error: true,
            }
        }
    };

    let new_string = match input.get("new_string").and_then(|v| v.as_str()) {
        Some(s) => s,
        None => {
            return ToolResult {
                output: "error: missing 'new_string' field".to_string(),
                is_error: true,
            }
        }
    };

    let replace_all = input
        .get("replace_all")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

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

    let content = match tokio::fs::read_to_string(&abs_path).await {
        Ok(c) => c,
        Err(e) => {
            return ToolResult {
                output: format!("error: failed to read file: {}", e),
                is_error: true,
            }
        }
    };

    let count = content.matches(old_string).count();

    if count == 0 {
        return ToolResult {
            output: format!("error: old_string not found in {}", path),
            is_error: true,
        };
    }

    if count > 1 && !replace_all {
        return ToolResult {
            output: format!(
                "error: old_string appears {} times in {}; set replace_all=true to replace all occurrences",
                count, path
            ),
            is_error: true,
        };
    }

    let new_content = content.replacen(old_string, new_string, if replace_all { count } else { 1 });

    match tokio::fs::write(&abs_path, &new_content).await {
        Ok(_) => ToolResult {
            output: format!(
                "replaced {} occurrence(s) in {}",
                if replace_all { count } else { 1 },
                path
            ),
            is_error: false,
        },
        Err(e) => ToolResult {
            output: format!("error: failed to write file: {}", e),
            is_error: true,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn edit_replaces_once() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "hello world").unwrap();
        let input =
            serde_json::json!({"path": "f.txt", "old_string": "world", "new_string": "rust"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert_eq!(
            std::fs::read_to_string(dir.path().join("f.txt")).unwrap(),
            "hello rust"
        );
    }

    #[tokio::test]
    async fn edit_fails_on_ambiguous() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "a a a").unwrap();
        let input = serde_json::json!({"path": "f.txt", "old_string": "a", "new_string": "b"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(result.is_error);
        assert!(result.output.contains("3 times"));
    }

    #[tokio::test]
    async fn edit_replace_all() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "a a a").unwrap();
        let input = serde_json::json!({"path": "f.txt", "old_string": "a", "new_string": "b", "replace_all": true});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert_eq!(
            std::fs::read_to_string(dir.path().join("f.txt")).unwrap(),
            "b b b"
        );
    }

    #[tokio::test]
    async fn edit_not_found() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "hello").unwrap();
        let input = serde_json::json!({"path": "f.txt", "old_string": "xyz", "new_string": "abc"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(result.is_error);
        assert!(result.output.contains("not found"));
    }
}
