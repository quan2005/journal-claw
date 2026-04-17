use crate::config;
use serde_json::{json, Value};

use super::output_compress;
use super::types::{ToolDefinition, ToolResult};

const DEFAULT_TIMEOUT_MS: u64 = 120_000; // 2 minutes
const MAX_TIMEOUT_MS: u64 = 600_000; // 10 minutes
const MAX_OUTPUT_BYTES: usize = 100 * 1024; // 100 KB

pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "bash".to_string(),
        description: "Execute a bash command in the workspace directory. Use this for all file operations (cat, tee, ls, mkdir, etc.), running scripts, and any shell tasks.".to_string(),
        input_schema: json!({
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The bash command to execute"
                },
                "timeout_ms": {
                    "type": "integer",
                    "description": "Optional timeout in milliseconds. Default: 120000 (2 min). Max: 600000 (10 min)."
                }
            },
            "required": ["command"]
        }),
    }
}

pub async fn execute(input: &Value, workspace_path: &str) -> ToolResult {
    let command = match input.get("command").and_then(|v| v.as_str()) {
        Some(cmd) if !cmd.trim().is_empty() => cmd,
        _ => {
            return ToolResult {
                output: "error: missing or empty 'command' field".to_string(),
                is_error: true,
            };
        }
    };

    let timeout_ms = input
        .get("timeout_ms")
        .and_then(|v| v.as_u64())
        .map(|t| t.clamp(1000, MAX_TIMEOUT_MS))
        .unwrap_or(DEFAULT_TIMEOUT_MS);

    let timeout = std::time::Duration::from_millis(timeout_ms);

    let mut cmd = tokio::process::Command::new("bash");
    cmd.arg("-c")
        .arg(command)
        .current_dir(workspace_path)
        .env("PATH", config::augmented_path())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);

    #[cfg(unix)]
    {
        cmd.process_group(0);
    }

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            return ToolResult {
                output: format!("error: failed to spawn bash: {}", e),
                is_error: true,
            };
        }
    };

    // Take stdout/stderr before waiting so we retain access to child for kill on timeout
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Drain stdout/stderr concurrently with wait to avoid deadlock when output > pipe buffer
    let result = tokio::time::timeout(timeout, async {
        use tokio::io::AsyncReadExt;

        let stdout_fut = async {
            let mut buf = Vec::new();
            if let Some(mut out) = stdout {
                let _ = out.read_to_end(&mut buf).await;
            }
            buf
        };
        let stderr_fut = async {
            let mut buf = Vec::new();
            if let Some(mut err) = stderr {
                let _ = err.read_to_end(&mut buf).await;
            }
            buf
        };

        let (stdout_bytes, stderr_bytes, status) =
            tokio::join!(stdout_fut, stderr_fut, child.wait());
        let status = status?;
        Ok::<_, std::io::Error>((status, stdout_bytes, stderr_bytes))
    })
    .await;

    match result {
        Ok(Ok((status, stdout_bytes, stderr_bytes))) => {
            let mut combined = stdout_bytes;
            if !stderr_bytes.is_empty() {
                if !combined.is_empty() {
                    combined.push(b'\n');
                }
                combined.extend_from_slice(&stderr_bytes);
            }

            // Truncate to prevent context explosion
            let truncated = combined.len() > MAX_OUTPUT_BYTES;
            if truncated {
                combined.truncate(MAX_OUTPUT_BYTES);
            }

            let text = String::from_utf8_lossy(&combined).to_string();

            // Compress output to reduce token consumption
            let mut text = output_compress::compress(command, &text);
            if truncated {
                text.push_str("\n\n[output truncated at 100KB]");
            }

            let exit_code = status.code().unwrap_or(-1);
            if exit_code != 0 {
                text.push_str(&format!("\n\n[exit code: {}]", exit_code));
            }

            ToolResult {
                output: text,
                is_error: !status.success(),
            }
        }
        Ok(Err(e)) => ToolResult {
            output: format!("error: {}", e),
            is_error: true,
        },
        Err(_) => {
            // Timeout — kill the process group
            #[cfg(unix)]
            {
                if let Some(pid) = child.id() {
                    unsafe {
                        libc::killpg(pid as i32, libc::SIGKILL);
                    }
                }
            }
            let _ = child.start_kill();

            ToolResult {
                output: format!(
                    "error: command timed out after {}ms\ncommand: {}",
                    timeout_ms, command
                ),
                is_error: true,
            }
        }
    }
}

/// Extract a concise label for log display (e.g. "bash: ls -la")
pub fn log_label(input: &Value) -> String {
    let cmd = input
        .get("command")
        .and_then(|v| v.as_str())
        .unwrap_or("(empty)");
    let truncated: String = cmd.split_whitespace().collect::<Vec<_>>().join(" ");
    if truncated.chars().count() > 120 {
        format!("bash: {}…", truncated.chars().take(120).collect::<String>())
    } else {
        format!("bash: {}", truncated)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn definition_has_required_fields() {
        let def = definition();
        assert_eq!(def.name, "bash");
        assert!(def.input_schema.get("properties").is_some());
    }

    #[tokio::test]
    async fn execute_simple_echo() {
        let input = json!({"command": "echo hello"});
        let result = execute(&input, "/tmp").await;
        assert!(!result.is_error);
        assert!(result.output.contains("hello"));
    }

    #[tokio::test]
    async fn execute_missing_command() {
        let input = json!({});
        let result = execute(&input, "/tmp").await;
        assert!(result.is_error);
        assert!(result.output.contains("missing"));
    }

    #[tokio::test]
    async fn execute_nonzero_exit() {
        let input = json!({"command": "exit 42"});
        let result = execute(&input, "/tmp").await;
        assert!(result.is_error);
        assert!(result.output.contains("exit code: 42"));
    }

    #[tokio::test]
    async fn execute_timeout() {
        let input = json!({"command": "sleep 60", "timeout_ms": 1000});
        let result = execute(&input, "/tmp").await;
        assert!(result.is_error);
        assert!(result.output.contains("timed out"));
    }

    #[test]
    fn log_label_truncates() {
        let long_cmd = "a".repeat(200);
        let input = json!({"command": long_cmd});
        let label = log_label(&input);
        assert!(label.len() < 200);
        assert!(label.ends_with('…'));
    }
}
