use super::super::types::{ToolDefinition, ToolResult};
use super::{sandbox_resolve, NOISE_DIRS};
use serde_json::json;

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "glob".to_string(),
        description: "Find files matching a glob pattern within the workspace. Automatically skips noise directories (node_modules, .git, target, etc.). Returns a newline-separated list of relative paths.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Glob pattern to match (e.g. '**/*.rs', 'src/**/*.ts')"
                },
                "path": {
                    "type": "string",
                    "description": "Subdirectory to search within (optional, defaults to workspace root)"
                }
            },
            "required": ["pattern"]
        }),
    }
}

pub async fn execute(input: &serde_json::Value, workspace: &str) -> ToolResult {
    let pattern = match input.get("pattern").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => {
            return ToolResult {
                output: "error: missing 'pattern' field".to_string(),
                is_error: true,
            }
        }
    };

    let search_root = if let Some(sub) = input.get("path").and_then(|v| v.as_str()) {
        match sandbox_resolve(workspace, sub) {
            Ok(p) => p,
            Err(e) => return e,
        }
    } else {
        std::path::PathBuf::from(workspace)
    };

    if !search_root.exists() {
        return ToolResult {
            output: format!("error: path not found: {}", search_root.display()),
            is_error: true,
        };
    }

    let walker = match globwalk::GlobWalkerBuilder::from_patterns(&search_root, &[pattern])
        .follow_links(false)
        .build()
    {
        Ok(w) => w,
        Err(e) => {
            return ToolResult {
                output: format!("error: invalid glob pattern: {}", e),
                is_error: true,
            }
        }
    };

    let workspace_path = std::path::Path::new(workspace);
    let mut matches: Vec<String> = Vec::new();

    for entry in walker.flatten() {
        let path = entry.path();

        // Skip noise dirs
        let skip = path.components().any(|c| {
            if let std::path::Component::Normal(name) = c {
                NOISE_DIRS.contains(&name.to_str().unwrap_or(""))
            } else {
                false
            }
        });
        if skip {
            continue;
        }

        if let Ok(rel) = path.strip_prefix(workspace_path) {
            matches.push(rel.to_string_lossy().to_string());
        }
    }

    matches.sort();

    if matches.is_empty() {
        ToolResult {
            output: "(no matches)".to_string(),
            is_error: false,
        }
    } else {
        ToolResult {
            output: matches.join("\n"),
            is_error: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn glob_finds_files() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "").unwrap();
        std::fs::write(dir.path().join("b.rs"), "").unwrap();
        std::fs::write(dir.path().join("c.txt"), "").unwrap();
        let input = serde_json::json!({"pattern": "*.rs"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(result.output.contains("a.rs"));
        assert!(result.output.contains("b.rs"));
        assert!(!result.output.contains("c.txt"));
    }

    #[tokio::test]
    async fn glob_skips_noise_dirs() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("node_modules")).unwrap();
        std::fs::write(dir.path().join("node_modules/pkg.js"), "").unwrap();
        std::fs::write(dir.path().join("real.js"), "").unwrap();
        let input = serde_json::json!({"pattern": "**/*.js"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(!result.output.contains("node_modules"));
        assert!(result.output.contains("real.js"));
    }

    #[tokio::test]
    async fn glob_no_matches() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({"pattern": "*.xyz"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(result.output.contains("no matches"));
    }
}
