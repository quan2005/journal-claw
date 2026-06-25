use super::super::types::{ToolDefinition, ToolResult};
use super::NOISE_DIRS;
use serde_json::json;
use std::path::Path;

const MAX_TOTAL_MATCHES: usize = 200;
const MAX_PER_FILE: usize = 10;

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "grep".to_string(),
        description: "Search file contents in the workspace. Returns matching file paths with content preview (matched line + context lines). Default: regex matching with 1 line of context before and after.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Search pattern (regex by default, or literal if literal=true)"
                },
                "glob": {
                    "type": "string",
                    "description": "Limit search to files matching this glob (e.g. \"**/*.md\")"
                },
                "literal": {
                    "type": "boolean",
                    "description": "Treat pattern as literal text. Default: false (regex)"
                },
                "context": {
                    "type": "integer",
                    "description": "Lines of context before and after each match. Default: 1"
                }
            },
            "required": ["pattern"]
        }),
    }
}

pub async fn execute(input: &serde_json::Value, workspace: &str) -> ToolResult {
    let pattern = match input.get("pattern").and_then(|v| v.as_str()) {
        Some(p) if !p.is_empty() => p,
        _ => {
            return ToolResult {
                output: "error: missing or empty 'pattern' field".to_string(),
                is_error: true,
            }
        }
    };

    let literal = input
        .get("literal")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let context_lines = input.get("context").and_then(|v| v.as_u64()).unwrap_or(1) as usize;
    let glob_filter = input.get("glob").and_then(|v| v.as_str()).unwrap_or("**/*");

    let regex_pattern = if literal {
        regex::escape(pattern)
    } else {
        pattern.to_string()
    };

    let re = match regex::Regex::new(&regex_pattern) {
        Ok(r) => r,
        Err(e) => {
            return ToolResult {
                output: format!("error: invalid pattern '{}': {}", pattern, e),
                is_error: true,
            }
        }
    };

    let walker = match globwalk::GlobWalkerBuilder::from_patterns(workspace, &[glob_filter])
        .max_depth(20)
        .follow_links(false)
        .build()
    {
        Ok(w) => w,
        Err(e) => {
            return ToolResult {
                output: format!("error: invalid glob '{}': {}", glob_filter, e),
                is_error: true,
            }
        }
    };

    let workspace_path = Path::new(workspace);
    let mut file_results: Vec<FileMatches> = Vec::new();
    let mut total_matches = 0usize;

    for entry in walker.flatten() {
        if total_matches >= MAX_TOTAL_MATCHES {
            break;
        }

        let path = entry.path();
        if !path.is_file() || !path.starts_with(workspace_path) {
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

        // Skip binary files
        let content = match std::fs::read(path) {
            Ok(bytes) => {
                if bytes.contains(&0u8) {
                    continue;
                }
                String::from_utf8_lossy(&bytes).to_string()
            }
            Err(_) => continue,
        };

        let lines: Vec<&str> = content.lines().collect();
        let mut matches: Vec<MatchWithContext> = Vec::new();

        for (line_idx, line) in lines.iter().enumerate() {
            if matches.len() >= MAX_PER_FILE || total_matches >= MAX_TOTAL_MATCHES {
                break;
            }
            if re.is_match(line) {
                let start = line_idx.saturating_sub(context_lines);
                let end = (line_idx + context_lines + 1).min(lines.len());
                let context: Vec<(usize, String)> = (start..end)
                    .map(|i| (i + 1, lines[i].to_string()))
                    .collect();
                matches.push(MatchWithContext {
                    line_number: line_idx + 1,
                    context,
                });
                total_matches += 1;
            }
        }

        if !matches.is_empty() {
            let relative = path
                .strip_prefix(workspace_path)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string();
            file_results.push(FileMatches {
                path: relative,
                matches,
            });
        }
    }

    if file_results.is_empty() {
        return ToolResult {
            output: format!("no matches for '{}'", pattern),
            is_error: false,
        };
    }

    // Format output
    let mut output = String::new();
    for file in &file_results {
        output.push_str(&format!(
            "[{}] ({} matches):\n",
            file.path,
            file.matches.len()
        ));
        for m in &file.matches {
            for (num, line) in &m.context {
                let marker = if *num == m.line_number { ">" } else { " " };
                let display = truncate_line(line, 200);
                output.push_str(&format!("  {}{:>4}: {}\n", marker, num, display));
            }
            output.push('\n');
        }
    }

    if total_matches >= MAX_TOTAL_MATCHES {
        output.push_str(&format!(
            "[results capped at {} matches across {} files]\n",
            MAX_TOTAL_MATCHES,
            file_results.len()
        ));
    } else {
        output.push_str(&format!(
            "[{} matches in {} files]\n",
            total_matches,
            file_results.len()
        ));
    }

    ToolResult {
        output,
        is_error: false,
    }
}

struct FileMatches {
    path: String,
    matches: Vec<MatchWithContext>,
}

struct MatchWithContext {
    line_number: usize,
    context: Vec<(usize, String)>,
}

fn truncate_line(line: &str, max: usize) -> String {
    if line.chars().count() <= max {
        line.to_string()
    } else {
        let truncated: String = line.chars().take(max).collect();
        format!("{}…", truncated)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn grep_finds_with_context() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("a.txt"),
            "line1\nline2\nhello world\nline4\nline5",
        )
        .unwrap();
        let input = serde_json::json!({"pattern": "hello"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        // Should show context: line2, >hello world, line4
        assert!(result.output.contains("line2"));
        assert!(result.output.contains("hello world"));
        assert!(result.output.contains("line4"));
    }

    #[tokio::test]
    async fn grep_literal_mode() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "price is $10.00\nother line").unwrap();
        // $10.00 would be invalid regex without literal mode
        let input = serde_json::json!({"pattern": "$10.00", "literal": true});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(result.output.contains("$10.00"));
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
        assert!(result.output.contains("invalid pattern"));
    }

    #[tokio::test]
    async fn grep_with_glob_filter() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.md"), "hello markdown").unwrap();
        std::fs::write(dir.path().join("b.txt"), "hello text").unwrap();
        let input = serde_json::json!({"pattern": "hello", "glob": "**/*.md"});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        assert!(result.output.contains("a.md"));
        assert!(!result.output.contains("b.txt"));
    }

    #[tokio::test]
    async fn grep_custom_context() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("f.txt"), "a\nb\nc\ntarget\ne\nf\ng").unwrap();
        let input = serde_json::json!({"pattern": "target", "context": 2});
        let result = execute(&input, dir.path().to_str().unwrap()).await;
        assert!(!result.is_error);
        // context=2 means 2 lines before and after: b, c, >target, e, f
        assert!(result.output.contains("b"));
        assert!(result.output.contains("c"));
        assert!(result.output.contains("target"));
        assert!(result.output.contains("e"));
        assert!(result.output.contains("f"));
    }
}
