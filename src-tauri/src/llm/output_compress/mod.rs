//! Post-process bash command output to reduce token consumption.
//!
//! Inspired by RTK (Rust Token Killer). Each command type has its own
//! compressor module. Add new compressors by implementing `Compressor`
//! and registering in `COMPRESSORS`.

mod build;
mod fallback;
mod git;
mod grep;
mod ls;
mod test_output;

// ── Compressor trait ────────────────────────────

pub trait Compressor: Send + Sync {
    /// Return true if this compressor handles the given command.
    fn matches(&self, cmd: &str) -> bool;

    /// Compress the (already ANSI-stripped) output.
    fn compress(&self, cmd: &str, output: &str) -> String;
}

/// Registry of all compressors, checked in order. First match wins.
/// Fallback must be last.
fn compressors() -> Vec<Box<dyn Compressor>> {
    vec![
        Box::new(ls::LsCompressor),
        Box::new(git::GitDiffCompressor),
        Box::new(git::GitStatusCompressor),
        Box::new(git::GitLogCompressor),
        Box::new(git::GitActionCompressor),
        Box::new(grep::GrepCompressor),
        Box::new(test_output::TestCompressor),
        Box::new(build::BuildCompressor),
        Box::new(fallback::FallbackCompressor), // must be last
    ]
}

// ── public entry point ──────────────────────────

/// Compress `raw` output based on the `command` that produced it.
pub fn compress(command: &str, raw: &str) -> String {
    if raw.is_empty() {
        return raw.to_string();
    }

    let clean = strip_ansi(raw);
    let cmd = command.trim();

    for c in compressors() {
        if c.matches(cmd) {
            return c.compress(cmd, &clean);
        }
    }

    // Should never reach here (fallback always matches), but just in case
    clean
}

// ── shared helpers (pub(crate) for sub-modules) ─

/// Check if `cmd` (first segment before `|`) matches any of the prefixes.
pub(crate) fn cmd_matches(cmd: &str, prefixes: &[&str]) -> bool {
    let first_cmd = cmd.split('|').next().unwrap_or(cmd).trim();
    prefixes.iter().any(|p| {
        first_cmd == *p
            || first_cmd.starts_with(&format!("{} ", p))
            || first_cmd.ends_with(&format!("/{}", p))
    })
}

/// Strip ANSI escape sequences.
pub(crate) fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            if let Some(next) = chars.next() {
                if next == '[' {
                    for c2 in chars.by_ref() {
                        if c2.is_ascii_alphabetic() {
                            break;
                        }
                    }
                }
            }
        } else {
            out.push(c);
        }
    }
    out
}

/// Collapse runs of 2+ blank lines into a single blank line.
pub(crate) fn normalize_blanks(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut blank_count = 0;
    for line in s.lines() {
        if line.trim().is_empty() {
            blank_count += 1;
            if blank_count <= 1 {
                out.push('\n');
            }
        } else {
            blank_count = 0;
            out.push_str(line);
            out.push('\n');
        }
    }
    let trimmed = out.trim().to_string();
    if trimmed.is_empty() {
        trimmed
    } else {
        trimmed + "\n"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_input() {
        assert_eq!(compress("ls", ""), "");
    }

    #[test]
    fn test_ansi_stripped() {
        let raw = "\x1b[32mgreen text\x1b[0m\n";
        let out = compress("echo test", raw);
        assert!(out.contains("green text"));
        assert!(!out.contains("\x1b["));
    }

    #[test]
    fn test_unknown_normalizes_blanks() {
        let raw = "line1\n\n\n\n\nline2\n";
        let out = compress("some-unknown-cmd", raw);
        assert_eq!(out, "line1\n\nline2\n");
    }

    #[test]
    fn test_fallback_is_last() {
        // Fallback should match anything
        let fb = fallback::FallbackCompressor;
        assert!(fb.matches("anything"));
        assert!(fb.matches("random-command --flag"));
    }
}
