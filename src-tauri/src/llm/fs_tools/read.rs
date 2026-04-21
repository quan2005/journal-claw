use super::super::types::{ToolDefinition, ToolResult};
use super::{sandbox_resolve, MAX_READ_CHARS};
use serde_json::json;

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "read".to_string(),
        description: "Read file contents within the workspace. Auto-paginates at ~10K tokens (~30000 chars). Use offset to read subsequent pages.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path to the file within the workspace"
                },
                "offset": {
                    "type": "integer",
                    "description": "Character offset to start reading from (for pagination). Default: 0"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum characters to return. Default: 30000 (~10K tokens)"
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

    let total_chars = content.len();
    let offset = input.get("offset").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
    let limit = input
        .get("limit")
        .and_then(|v| v.as_u64())
        .map(|v| v as usize)
        .unwrap_or(MAX_READ_CHARS);

    if offset >= total_chars {
        return ToolResult {
            output: format!("(end of file — {} total characters)", total_chars),
            is_error: false,
        };
    }

    let slice = &content[offset..];
    let end = slice.len().min(limit);

    // Snap to line boundary to avoid cutting mid-line
    let end = if end < slice.len() {
        slice[..end].rfind('\n').map(|p| p + 1).unwrap_or(end)
    } else {
        end
    };

    let page = &slice[..end];
    let has_more = offset + end < total_chars;

    // Add line numbers
    let before_offset = &content[..offset];
    let start_line = before_offset.chars().filter(|&c| c == '\n').count() + 1;

    let mut output = String::new();
    for (i, line) in page.lines().enumerate() {
        output.push_str(&format!("{:>4}\t{}\n", start_line + i, line));
    }

    if has_more {
        let next_offset = offset + end;
        output.push_str(&format!(
            "\n[truncated — showing {}/{} chars. Use offset={} to continue]",
            end, total_chars, next_offset
        ));
    }

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
    async fn read_with_char_pagination() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "aaaa\nbbbb\ncccc\ndddd\n").unwrap();
        let input = serde_json::json!({"path": "f.txt", "offset": 5, "limit": 10});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        // offset=5 skips "aaaa\n", starts at "bbbb\n..."
        assert!(result.output.contains("bbbb"));
    }

    #[tokio::test]
    async fn read_truncation_shows_next_offset() {
        let dir = tempfile::tempdir().unwrap();
        let content = "line\n".repeat(10000); // large file
        std::fs::write(dir.path().join("big.txt"), &content).unwrap();
        let input = serde_json::json!({"path": "big.txt", "limit": 100});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(result.output.contains("truncated"));
        assert!(result.output.contains("offset="));
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
