pub mod copy;
pub mod edit;
pub mod glob;
pub mod grep;
pub mod mkdir;
pub mod move_file;
pub mod read;
pub mod remove;
pub mod stat;
pub mod write;

use super::types::{ToolDefinition, ToolResult};
use std::path::{Path, PathBuf};

pub const NOISE_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "__pycache__",
    ".next",
    ".nuxt",
    "dist",
    "build",
    ".cache",
    ".turbo",
    ".svelte-kit",
    "coverage",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "vendor",
];

const MAX_READ_CHARS: usize = 30_000;

/// Validate and resolve a relative path within the workspace sandbox.
/// Returns the absolute path if valid, or an error ToolResult.
pub fn sandbox_resolve(workspace: &str, relative: &str) -> Result<PathBuf, ToolResult> {
    let relative = relative.trim();
    if relative.is_empty() {
        return Err(ToolResult {
            output: "error: path is empty".to_string(),
            is_error: true,
        });
    }

    // Reject absolute paths
    if Path::new(relative).is_absolute() {
        return Err(ToolResult {
            output: "error: absolute paths are not allowed, use relative paths within workspace"
                .to_string(),
            is_error: true,
        });
    }

    let workspace_path = PathBuf::from(workspace);
    let resolved = workspace_path.join(relative);

    // Normalize: resolve .. and . components without requiring the path to exist
    let normalized = normalize_path(&resolved);

    // Check the normalized path starts with workspace
    if !normalized.starts_with(&workspace_path) {
        return Err(ToolResult {
            output: "error: path escapes workspace directory".to_string(),
            is_error: true,
        });
    }

    // If path exists, check symlink target
    if normalized.exists() {
        // Canonicalize both sides to handle OS-level symlinks (e.g. /var → /private/var on macOS)
        let canonical_workspace = workspace_path
            .canonicalize()
            .unwrap_or(workspace_path.clone());
        if let Ok(canonical) = normalized.canonicalize() {
            if !canonical.starts_with(&canonical_workspace) {
                return Err(ToolResult {
                    output: "error: symlink target is outside workspace".to_string(),
                    is_error: true,
                });
            }
        }
    }

    Ok(normalized)
}

/// Normalize path components (resolve `.` and `..`) without filesystem access.
fn normalize_path(path: &Path) -> PathBuf {
    let mut components = Vec::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => {
                components.pop();
            }
            std::path::Component::CurDir => {}
            other => components.push(other),
        }
    }
    components.iter().collect()
}

/// Return all tool definitions.
pub fn definitions() -> Vec<ToolDefinition> {
    vec![
        read::definition(),
        write::definition(),
        edit::definition(),
        glob::definition(),
        grep::definition(),
        mkdir::definition(),
        move_file::definition(),
        copy::definition(),
        remove::definition(),
        stat::definition(),
    ]
}

/// Execute a named fs tool. Returns None if name doesn't match.
pub async fn execute(name: &str, input: &serde_json::Value, workspace: &str) -> Option<ToolResult> {
    match name {
        "read" => Some(read::execute(input, workspace).await),
        "write" => Some(write::execute(input, workspace).await),
        "edit" => Some(edit::execute(input, workspace).await),
        "glob" => Some(glob::execute(input, workspace).await),
        "grep" => Some(grep::execute(input, workspace).await),
        "mkdir" => Some(mkdir::execute(input, workspace).await),
        "move" => Some(move_file::execute(input, workspace).await),
        "copy" => Some(copy::execute(input, workspace).await),
        "remove" => Some(remove::execute(input, workspace).await),
        "stat" => Some(stat::execute(input, workspace).await),
        _ => None,
    }
}

/// Extract a concise label for log display.
pub fn log_label(name: &str, input: &serde_json::Value) -> String {
    let path = input.get("path").and_then(|v| v.as_str()).unwrap_or("");
    match name {
        "read" => format!("read: {}", path),
        "write" => format!("write: {}", path),
        "edit" => format!("edit: {}", path),
        "glob" => {
            let pattern = input.get("pattern").and_then(|v| v.as_str()).unwrap_or("");
            format!("glob: {}", pattern)
        }
        "grep" => {
            let pattern = input.get("pattern").and_then(|v| v.as_str()).unwrap_or("");
            format!("grep: {}", pattern)
        }
        "mkdir" => format!("mkdir: {}", path),
        "move" => {
            let src = input.get("source").and_then(|v| v.as_str()).unwrap_or("");
            let dst = input
                .get("destination")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            format!("move: {} → {}", src, dst)
        }
        "copy" => {
            let src = input.get("source").and_then(|v| v.as_str()).unwrap_or("");
            let dst = input
                .get("destination")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            format!("copy: {} → {}", src, dst)
        }
        "remove" => format!("remove: {}", path),
        "stat" => format!("stat: {}", path),
        _ => format!("{}: {}", name, path),
    }
}
