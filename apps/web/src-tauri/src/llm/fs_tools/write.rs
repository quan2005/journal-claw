use super::super::types::{ToolDefinition, ToolResult};
use super::{sandbox_resolve, validate_mdx_after_write};
use serde_json::json;

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "write".to_string(),
        description: "Write content to a file within the workspace. Creates the file and any missing parent directories. Overwrites existing content. After writing .mdx files, runs an MDX syntax check and returns the error so you can fix the file.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path to the file within the workspace"
                },
                "content": {
                    "type": "string",
                    "description": "Content to write to the file"
                }
            },
            "required": ["path", "content"]
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

    let content = match input.get("content").and_then(|v| v.as_str()) {
        Some(c) => c,
        None => {
            return ToolResult {
                output: "error: missing 'content' field".to_string(),
                is_error: true,
            }
        }
    };

    let abs_path = match sandbox_resolve(workspace, path) {
        Ok(p) => p,
        Err(e) => return e,
    };

    if let Some(parent) = abs_path.parent() {
        if let Err(e) = tokio::fs::create_dir_all(parent).await {
            return ToolResult {
                output: format!("error: failed to create parent directories: {}", e),
                is_error: true,
            };
        }
    }

    match tokio::fs::write(&abs_path, content).await {
        Ok(_) => {
            let success_output = format!("wrote {} bytes to {}", content.len(), path);
            validate_mdx_after_write(path, content, success_output.clone()).unwrap_or(ToolResult {
                output: success_output,
                is_error: false,
            })
        }
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
    async fn write_creates_file() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({"path": "out.txt", "content": "hello"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert_eq!(
            std::fs::read_to_string(dir.path().join("out.txt")).unwrap(),
            "hello"
        );
    }

    #[tokio::test]
    async fn write_creates_parent_dirs() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({"path": "a/b/c.txt", "content": "x"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(dir.path().join("a/b/c.txt").exists());
    }

    #[tokio::test]
    async fn write_validates_mdx_after_file_is_written() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({
            "path": "bad.mdx",
            "content": "---\nsummary: bad\ntags: [journal]\n---\n\n# Broken\n\n<Callout title=\"Missing close>"
        });

        let result = execute(&input, dir.path().to_str().unwrap()).await;

        assert!(dir.path().join("bad.mdx").exists());
        assert!(result.is_error);
        assert!(result.output.contains("MDX syntax check failed"));
        assert!(result.output.contains("Please fix"));
        assert!(result.output.contains("bad.mdx"));
        assert!(result.output.contains("8:"));
    }

    #[tokio::test]
    async fn write_accepts_valid_mdx_with_frontmatter() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({
            "path": "good.mdx",
            "content": "---\nsummary: ok\ntags: [journal]\n---\n\n# Good\n\n<Callout title=\"Note\">Body</Callout>"
        });

        let result = execute(&input, dir.path().to_str().unwrap()).await;

        assert!(!result.is_error);
        assert!(result.output.contains("wrote"));
        assert!(dir.path().join("good.mdx").exists());
    }

    #[tokio::test]
    async fn write_reports_multiple_mdx_syntax_issues() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({
            "path": "many-bad.mdx",
            "content": "---\nsummary: bad\ntags: [journal]\n---\n\n# Broken\n\n<Callout title=\"Missing close>\n\n</Card>\n\n<Section>"
        });

        let result = execute(&input, dir.path().to_str().unwrap()).await;

        assert!(result.is_error);
        assert!(result.output.contains("MDX preflight found 3 issue(s):"));
        assert!(result.output.contains("Line 8:"));
        assert!(result.output.contains("Line 10:"));
        assert!(result.output.contains("Line 12:"));
        assert!(result.output.contains("Compiler error:"));
    }

    #[tokio::test]
    async fn write_escape_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({"path": "../../evil.txt", "content": "x"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(result.is_error);
    }
}
