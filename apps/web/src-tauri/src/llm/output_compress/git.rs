//! Compressors for git subcommands: diff/show, status, log, action (add/commit/push/pull/fetch).
//!
//! Ported from RTK (https://github.com/rtk-ai/rtk) src/cmds/git/git.rs

use super::{cmd_matches, normalize_blanks, Compressor};

// ── git diff / show ─────────────────────────────

pub struct GitDiffCompressor;

impl Compressor for GitDiffCompressor {
    fn matches(&self, cmd: &str) -> bool {
        cmd_matches(cmd, &["git diff", "git show"])
    }

    fn compress(&self, _cmd: &str, output: &str) -> String {
        compact_diff(output)
    }
}

fn compact_diff(raw: &str) -> String {
    let mut result = Vec::new();
    let mut current_file = String::new();
    let mut added: usize = 0;
    let mut removed: usize = 0;
    let mut in_hunk = false;
    let mut hunk_shown: usize = 0;
    let mut hunk_skipped: usize = 0;
    let max_hunk_lines = 80;
    let max_lines = 400;

    for line in raw.lines() {
        if line.starts_with("diff --git") {
            if hunk_skipped > 0 {
                result.push(format!("  ...({} lines skipped)", hunk_skipped));
                hunk_skipped = 0;
            }
            if !current_file.is_empty() && (added > 0 || removed > 0) {
                result.push(format!("  +{} -{}", added, removed));
            }
            current_file = line.split(" b/").nth(1).unwrap_or("unknown").to_string();
            result.push(format!("\n{}", current_file));
            added = 0;
            removed = 0;
            in_hunk = false;
            hunk_shown = 0;
        } else if line.starts_with("@@") {
            if hunk_skipped > 0 {
                result.push(format!("  ...({} lines skipped)", hunk_skipped));
                hunk_skipped = 0;
            }
            in_hunk = true;
            hunk_shown = 0;
            result.push(format!("  {}", line));
        } else if in_hunk {
            if line.starts_with('+') && !line.starts_with("+++") {
                added += 1;
                if hunk_shown < max_hunk_lines {
                    result.push(format!("  {}", line));
                    hunk_shown += 1;
                } else {
                    hunk_skipped += 1;
                }
            } else if line.starts_with('-') && !line.starts_with("---") {
                removed += 1;
                if hunk_shown < max_hunk_lines {
                    result.push(format!("  {}", line));
                    hunk_shown += 1;
                } else {
                    hunk_skipped += 1;
                }
            } else if hunk_shown < max_hunk_lines && !line.starts_with('\\') && hunk_shown > 0 {
                result.push(format!("  {}", line));
                hunk_shown += 1;
            }
        }

        if result.len() >= max_lines {
            result.push("\n...(diff truncated)".to_string());
            break;
        }
    }

    if hunk_skipped > 0 {
        result.push(format!("  ...({} lines skipped)", hunk_skipped));
    }
    if !current_file.is_empty() && (added > 0 || removed > 0) {
        result.push(format!("  +{} -{}", added, removed));
    }

    result.join("\n")
}

// ── git status ──────────────────────────────────

pub struct GitStatusCompressor;

impl Compressor for GitStatusCompressor {
    fn matches(&self, cmd: &str) -> bool {
        cmd_matches(cmd, &["git status"])
    }

    fn compress(&self, _cmd: &str, output: &str) -> String {
        let mut out = String::new();
        for line in output.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("(use \"git ") || trimmed.starts_with("(use 'git ") {
                continue;
            }
            out.push_str(line);
            out.push('\n');
        }
        normalize_blanks(&out)
    }
}

// ── git log ─────────────────────────────────────

pub struct GitLogCompressor;

impl Compressor for GitLogCompressor {
    fn matches(&self, cmd: &str) -> bool {
        cmd_matches(cmd, &["git log"])
    }

    fn compress(&self, _cmd: &str, output: &str) -> String {
        let lines: Vec<&str> = output.lines().collect();
        if lines.len() <= 30 {
            return normalize_blanks(output);
        }

        let mut out = String::new();
        let mut commit_count = 0;
        let mut seen_message = false;

        for line in &lines {
            let trimmed = line.trim();
            if trimmed.starts_with("commit ") && trimmed.len() > 10 {
                if commit_count > 0 {
                    out.push('\n');
                }
                out.push_str(trimmed);
                out.push('\n');
                commit_count += 1;
                seen_message = false;
            } else if trimmed.starts_with("Author:") || trimmed.starts_with("Date:") {
                continue;
            } else if !trimmed.is_empty() && commit_count > 0 && !seen_message {
                out.push_str("  ");
                out.push_str(trimmed);
                out.push('\n');
                seen_message = true;
            }
        }

        if commit_count == 0 {
            return normalize_blanks(output);
        }
        out
    }
}

// ── git add/commit/push/pull/fetch ──────────────

pub struct GitActionCompressor;

impl Compressor for GitActionCompressor {
    fn matches(&self, cmd: &str) -> bool {
        cmd_matches(
            cmd,
            &["git add", "git commit", "git push", "git pull", "git fetch"],
        )
    }

    fn compress(&self, _cmd: &str, output: &str) -> String {
        let mut out = String::new();
        for line in output.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if trimmed.starts_with("Counting objects:")
                || trimmed.starts_with("Compressing objects:")
                || trimmed.starts_with("Writing objects:")
                || trimmed.starts_with("Receiving objects:")
                || trimmed.starts_with("Resolving deltas:")
                || trimmed.starts_with("remote: Counting")
                || trimmed.starts_with("remote: Compressing")
                || trimmed.starts_with("remote: Total")
                || trimmed.contains("Enumerating objects:")
            {
                continue;
            }
            out.push_str(trimmed);
            out.push('\n');
        }
        if out.is_empty() {
            "OK\n".to_string()
        } else {
            out
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_diff_compact() {
        let raw = "diff --git a/src/main.rs b/src/main.rs\n\
                   index abc..def 100644\n\
                   --- a/src/main.rs\n\
                   +++ b/src/main.rs\n\
                   @@ -1,3 +1,4 @@\n\
                   +use std::io;\n\
                    fn main() {\n\
                   -    println!(\"old\");\n\
                   +    println!(\"new\");\n\
                    }\n";
        let out = compact_diff(raw);
        assert!(out.contains("src/main.rs"));
        assert!(out.contains("+use std::io;"));
        assert!(out.contains("+2 -1"));
    }

    #[test]
    fn test_status_strips_hints() {
        let c = GitStatusCompressor;
        let raw = "On branch main\n\
                   Changes not staged for commit:\n\
                     (use \"git add <file>...\" to update what will be committed)\n\
                     (use \"git restore <file>...\" to discard changes in working directory)\n\
                   \tmodified:   src/main.rs\n";
        let out = c.compress("git status", raw);
        assert!(out.contains("modified:   src/main.rs"));
        assert!(!out.contains("use \"git add"));
    }

    #[test]
    fn test_push_strips_progress() {
        let c = GitActionCompressor;
        let raw = "Enumerating objects: 5, done.\n\
                   Counting objects: 100% (5/5), done.\n\
                   Writing objects: 100% (3/3), 300 bytes | 300.00 KiB/s, done.\n\
                   remote: Resolving deltas: 100% (1/1), done.\n\
                   To github.com:user/repo.git\n\
                      abc1234..def5678  main -> main\n";
        let out = c.compress("git push", raw);
        assert!(!out.contains("Counting objects"));
        assert!(out.contains("main -> main"));
    }
}
