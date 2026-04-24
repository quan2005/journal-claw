use super::super::types::{ToolDefinition, ToolResult};
use super::sandbox_resolve;
use serde_json::json;

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "edit".to_string(),
        description: "Replace text in a file using regex (default) or literal matching. Replaces all matches by default; set first_only=true for single replacement. Supports capture groups ($1, $2) in new_string.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative path to the file within the workspace"
                },
                "old_string": {
                    "type": "string",
                    "description": "Pattern to find (regex by default, or literal if literal=true)"
                },
                "new_string": {
                    "type": "string",
                    "description": "Replacement string. Supports $1, $2 capture group references in regex mode"
                },
                "literal": {
                    "type": "boolean",
                    "description": "Treat old_string as literal text instead of regex. Default: false"
                },
                "first_only": {
                    "type": "boolean",
                    "description": "Only replace the first match. Default: false (replace all)"
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

    if old_string.is_empty() {
        return ToolResult {
            output: "error: old_string cannot be empty — empty pattern matches every position and would corrupt the file".to_string(),
            is_error: true,
        };
    }

    let new_string = match input.get("new_string").and_then(|v| v.as_str()) {
        Some(s) => s,
        None => {
            return ToolResult {
                output: "error: missing 'new_string' field".to_string(),
                is_error: true,
            }
        }
    };

    let literal = input
        .get("literal")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let first_only = input
        .get("first_only")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let abs_path = match sandbox_resolve(workspace, path) {
        Ok(p) => p,
        Err(e) => return e,
    };

    let content = match tokio::fs::read_to_string(&abs_path).await {
        Ok(c) => c,
        Err(e) => {
            return ToolResult {
                output: format!("error: cannot read '{}': {}", path, e),
                is_error: true,
            }
        }
    };

    let (new_content, count) = if literal {
        let matches = content.matches(old_string).count();
        if matches == 0 {
            return ToolResult {
                output: format!("error: '{}' not found in {}", old_string, path),
                is_error: true,
            };
        }
        if first_only {
            (content.replacen(old_string, new_string, 1), 1)
        } else {
            (content.replace(old_string, new_string), matches)
        }
    } else {
        let re = match regex::Regex::new(old_string) {
            Ok(r) => r,
            Err(e) => {
                return ToolResult {
                    output: format!("error: invalid regex '{}': {}", old_string, e),
                    is_error: true,
                }
            }
        };

        let matches: Vec<_> = re.find_iter(&content).collect();
        if matches.is_empty() {
            return ToolResult {
                output: format!("error: pattern '{}' not found in {}", old_string, path),
                is_error: true,
            };
        }

        if first_only {
            (re.replacen(&content, 1, new_string).to_string(), 1)
        } else {
            let count = matches.len();
            (re.replace_all(&content, new_string).to_string(), count)
        }
    };

    match tokio::fs::write(&abs_path, &new_content).await {
        Ok(_) => ToolResult {
            output: format!("replaced {} occurrence(s) in {}", count, path),
            is_error: false,
        },
        Err(e) => ToolResult {
            output: format!("error: write failed: {}", e),
            is_error: true,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn edit_regex_replace_all() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "foo bar foo baz foo").unwrap();
        let input = serde_json::json!({"path": "f.txt", "old_string": "foo", "new_string": "qux"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(result.output.contains("3 occurrence"));
        assert_eq!(
            std::fs::read_to_string(dir.path().join("f.txt")).unwrap(),
            "qux bar qux baz qux"
        );
    }

    #[tokio::test]
    async fn edit_first_only() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "aaa bbb aaa").unwrap();
        let input = serde_json::json!({"path": "f.txt", "old_string": "aaa", "new_string": "ccc", "first_only": true});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(result.output.contains("1 occurrence"));
        assert_eq!(
            std::fs::read_to_string(dir.path().join("f.txt")).unwrap(),
            "ccc bbb aaa"
        );
    }

    #[tokio::test]
    async fn edit_literal_mode() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "price is $10.00 today").unwrap();
        let input = serde_json::json!({"path": "f.txt", "old_string": "$10.00", "new_string": "$20.00", "literal": true});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert_eq!(
            std::fs::read_to_string(dir.path().join("f.txt")).unwrap(),
            "price is $20.00 today"
        );
    }

    #[tokio::test]
    async fn edit_regex_capture_groups() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "hello world").unwrap();
        let input = serde_json::json!({"path": "f.txt", "old_string": "(hello) (world)", "new_string": "$2 $1"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert_eq!(
            std::fs::read_to_string(dir.path().join("f.txt")).unwrap(),
            "world hello"
        );
    }

    #[tokio::test]
    async fn edit_no_match_returns_error() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "hello world").unwrap();
        let input = serde_json::json!({"path": "f.txt", "old_string": "xyz", "new_string": "abc"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(result.is_error);
        assert!(result.output.contains("not found"));
    }

    #[tokio::test]
    async fn edit_invalid_regex() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "hello").unwrap();
        let input =
            serde_json::json!({"path": "f.txt", "old_string": "[invalid", "new_string": "x"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(result.is_error);
        assert!(result.output.contains("invalid regex"));
    }

    #[tokio::test]
    async fn edit_empty_pattern_rejected() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "ABC").unwrap();
        let input = serde_json::json!({"path": "f.txt", "old_string": "", "new_string": "X"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(result.is_error);
        assert!(result.output.contains("old_string cannot be empty"));
        // File must be untouched
        assert_eq!(
            std::fs::read_to_string(dir.path().join("f.txt")).unwrap(),
            "ABC"
        );
    }
}
