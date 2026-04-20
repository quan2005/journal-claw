use super::super::types::{ToolDefinition, ToolResult};
use super::{sandbox_resolve, NOISE_DIRS};
use regex::Regex;
use serde_json::json;
use std::path::Path;

const MAX_GREP_RESULTS: usize = 500;

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "grep".to_string(),
        description: "Search file contents using a regex pattern. Returns matching lines in 'file:line:content' format. Skips noise directories and binary files.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Regular expression pattern to search for"
                },
                "path": {
                    "type": "string",
                    "description": "File or directory to search within (optional, defaults to workspace root)"
                },
                "include": {
                    "type": "string",
                    "description": "Glob pattern to filter files (e.g. '*.rs', '*.{ts,tsx}')"
                },
                "case_insensitive": {
                    "type": "boolean",
                    "description": "Case-insensitive matching (default: false)"
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

    let case_insensitive = input
        .get("case_insensitive")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let regex_pattern = if case_insensitive {
        format!("(?i){}", pattern)
    } else {
        pattern.to_string()
    };

    let re = match Regex::new(&regex_pattern) {
        Ok(r) => r,
        Err(e) => {
            return ToolResult {
                output: format!("error: invalid regex pattern: {}", e),
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

    let include_pattern = input
        .get("include")
        .and_then(|v| v.as_str())
        .unwrap_or("**/*");

    let walker = match globwalk::GlobWalkerBuilder::from_patterns(&search_root, &[include_pattern])
        .follow_links(false)
        .build()
    {
        Ok(w) => w,
        Err(e) => {
            return ToolResult {
                output: format!("error: invalid include pattern: {}", e),
                is_error: true,
            }
        }
    };

    let workspace_path = Path::new(workspace);
    let mut results: Vec<String> = Vec::new();
    let mut truncated = false;

    'outer: for entry in walker.flatten() {
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

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

        let content = match std::fs::read(path) {
            Ok(bytes) => bytes,
            Err(_) => continue,
        };

        // Skip binary files
        if content.contains(&0u8) {
            continue;
        }

        let text = String::from_utf8_lossy(&content);
        let rel = path
            .strip_prefix(workspace_path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| path.to_string_lossy().to_string());

        for (line_num, line) in text.lines().enumerate() {
            if re.is_match(line) {
                results.push(format!("{}:{}:{}", rel, line_num + 1, line));
                if results.len() >= MAX_GREP_RESULTS {
                    truncated = true;
                    break 'outer;
                }
            }
        }
    }

    if results.is_empty() {
        return ToolResult {
            output: "(no matches)".to_string(),
            is_error: false,
        };
    }

    let mut output = results.join("\n");
    if truncated {
        output.push_str(&format!("\n\n[truncated at {} matches]", MAX_GREP_RESULTS));
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
    async fn grep_finds_matches() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("a.txt"),
            "hello world\nfoo bar\nhello again",
        )
        .unwrap();
        let input = serde_json::json!({"pattern": "hello"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(result.output.contains("a.txt:1:hello world"));
        assert!(result.output.contains("a.txt:3:hello again"));
        assert!(!result.output.contains("foo bar"));
    }

    #[tokio::test]
    async fn grep_case_insensitive() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "Hello\nhello\nHELLO").unwrap();
        let input = serde_json::json!({"pattern": "hello", "case_insensitive": true});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert_eq!(result.output.lines().count(), 3);
    }

    #[tokio::test]
    async fn grep_no_matches() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "nothing here").unwrap();
        let input = serde_json::json!({"pattern": "xyz123"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(result.output.contains("no matches"));
    }

    #[tokio::test]
    async fn grep_invalid_regex() {
        let dir = tempfile::tempdir().unwrap();
        let input = serde_json::json!({"pattern": "["});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(result.is_error);
        assert!(result.output.contains("invalid regex"));
    }
}
