use super::super::types::{ToolDefinition, ToolResult};
use super::sandbox_resolve;
use serde_json::json;

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "copy".to_string(),
        description: "Copy a file or directory within the workspace. Destination parent directories are created automatically.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "description": "Source path relative to workspace root"
                },
                "destination": {
                    "type": "string",
                    "description": "Destination path relative to workspace root"
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

    let abs_src = match sandbox_resolve(workspace, source) {
        Ok(p) => p,
        Err(e) => return e,
    };

    let abs_dst = match sandbox_resolve(workspace, destination) {
        Ok(p) => p,
        Err(e) => return e,
    };

    if !abs_src.exists() {
        return ToolResult {
            output: format!("error: source not found: {}", source),
            is_error: true,
        };
    }

    // Auto-create destination parent
    if let Some(parent) = abs_dst.parent() {
        if let Err(e) = tokio::fs::create_dir_all(parent).await {
            return ToolResult {
                output: format!("error: cannot create destination directory: {}", e),
                is_error: true,
            };
        }
    }

    if abs_src.is_dir() {
        match copy_dir_recursive(&abs_src, &abs_dst).await {
            Ok(count) => ToolResult {
                output: format!(
                    "copied directory {} → {} ({} files)",
                    source, destination, count
                ),
                is_error: false,
            },
            Err(e) => ToolResult {
                output: format!("error: copy failed: {}", e),
                is_error: true,
            },
        }
    } else {
        match tokio::fs::copy(&abs_src, &abs_dst).await {
            Ok(bytes) => ToolResult {
                output: format!("copied {} → {} ({} bytes)", source, destination, bytes),
                is_error: false,
            },
            Err(e) => ToolResult {
                output: format!("error: copy failed: {}", e),
                is_error: true,
            },
        }
    }
}

async fn copy_dir_recursive(
    src: &std::path::Path,
    dst: &std::path::Path,
) -> Result<usize, std::io::Error> {
    tokio::fs::create_dir_all(dst).await?;
    let mut count = 0usize;
    let mut entries = tokio::fs::read_dir(src).await?;
    while let Some(entry) = entries.next_entry().await? {
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            count += Box::pin(copy_dir_recursive(&src_path, &dst_path)).await?;
        } else {
            tokio::fs::copy(&src_path, &dst_path).await?;
            count += 1;
        }
    }
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn copy_file() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.txt"), "hello").unwrap();
        let input = serde_json::json!({"source": "a.txt", "destination": "b.txt"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert_eq!(
            std::fs::read_to_string(dir.path().join("b.txt")).unwrap(),
            "hello"
        );
        // Source still exists
        assert!(dir.path().join("a.txt").exists());
    }

    #[tokio::test]
    async fn copy_directory() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("sub")).unwrap();
        std::fs::write(dir.path().join("sub/f.txt"), "content").unwrap();
        let input = serde_json::json!({"source": "sub", "destination": "sub2"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(result.output.contains("1 files"));
        assert_eq!(
            std::fs::read_to_string(dir.path().join("sub2/f.txt")).unwrap(),
            "content"
        );
    }

    #[tokio::test]
    async fn copy_missing_source() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({"source": "nope.txt", "destination": "b.txt"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(result.is_error);
        assert!(result.output.contains("not found"));
    }

    #[tokio::test]
    async fn copy_auto_creates_parent() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.txt"), "data").unwrap();
        let input = serde_json::json!({"source": "a.txt", "destination": "deep/nested/b.txt"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(dir.path().join("deep/nested/b.txt").exists());
    }
}
