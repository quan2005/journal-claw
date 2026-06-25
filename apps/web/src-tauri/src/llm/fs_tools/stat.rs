use super::super::types::{ToolDefinition, ToolResult};
use super::sandbox_resolve;
use serde_json::json;

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "stat".to_string(),
        description: "Get file or directory metadata: size, type (file/dir/symlink), modification time, permissions.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path to the file or directory within the workspace"
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

    let metadata = match tokio::fs::symlink_metadata(&abs_path).await {
        Ok(m) => m,
        Err(e) => {
            return ToolResult {
                output: format!("error: cannot stat '{}': {}", path, e),
                is_error: true,
            }
        }
    };

    let file_type = if metadata.is_symlink() {
        "symlink"
    } else if metadata.is_dir() {
        "directory"
    } else {
        "file"
    };

    let size = metadata.len();

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    #[cfg(unix)]
    let permissions = {
        use std::os::unix::fs::PermissionsExt;
        format!("{:o}", metadata.permissions().mode() & 0o777)
    };
    #[cfg(not(unix))]
    let permissions = if metadata.permissions().readonly() {
        "readonly".to_string()
    } else {
        "read-write".to_string()
    };

    let mut output = String::new();
    output.push_str(&format!("path: {}\n", path));
    output.push_str(&format!("type: {}\n", file_type));
    output.push_str(&format!("size: {} bytes\n", size));
    output.push_str(&format!("modified: {}\n", modified));
    output.push_str(&format!("permissions: {}\n", permissions));

    // For directories, show entry count
    if metadata.is_dir() {
        let count = match tokio::fs::read_dir(&abs_path).await {
            Ok(mut entries) => {
                let mut n = 0usize;
                while entries.next_entry().await.ok().flatten().is_some() {
                    n += 1;
                }
                n
            }
            Err(_) => 0,
        };
        output.push_str(&format!("entries: {}\n", count));
    }

    // For symlinks, show target
    if metadata.is_symlink() {
        if let Ok(target) = tokio::fs::read_link(&abs_path).await {
            output.push_str(&format!("target: {}\n", target.display()));
        }
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
    async fn stat_file() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "hello").unwrap();
        let input = serde_json::json!({"path": "f.txt"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(result.output.contains("type: file"));
        assert!(result.output.contains("size: 5 bytes"));
    }

    #[tokio::test]
    async fn stat_directory() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("sub")).unwrap();
        std::fs::write(dir.path().join("sub/a.txt"), "").unwrap();
        std::fs::write(dir.path().join("sub/b.txt"), "").unwrap();
        let input = serde_json::json!({"path": "sub"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(result.output.contains("type: directory"));
        assert!(result.output.contains("entries: 2"));
    }

    #[tokio::test]
    async fn stat_missing() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({"path": "nope"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(result.is_error);
        assert!(result.output.contains("cannot stat"));
    }
}
