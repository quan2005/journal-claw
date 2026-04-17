//! Compressor for build output (cargo build, cargo clippy, npm run build, tsc).
//! Strips "Compiling" progress lines, keeps errors/warnings/summary.

use super::{cmd_matches, normalize_blanks, Compressor};

pub struct BuildCompressor;

impl Compressor for BuildCompressor {
    fn matches(&self, cmd: &str) -> bool {
        cmd_matches(
            cmd,
            &["cargo build", "cargo clippy", "npm run build", "tsc"],
        )
    }

    fn compress(&self, _cmd: &str, output: &str) -> String {
        let lines: Vec<&str> = output.lines().collect();
        if lines.len() <= 40 {
            return normalize_blanks(output);
        }

        let mut out = String::new();
        for line in &lines {
            let trimmed = line.trim();
            if trimmed.starts_with("Compiling ") || trimmed.starts_with("Downloading ") {
                continue;
            }
            if trimmed.contains("error")
                || trimmed.contains("warning")
                || trimmed.starts_with("Finished")
                || trimmed.starts_with("Built")
                || trimmed.contains("Error:")
                || trimmed.contains("Warning:")
                || trimmed.starts_with("error[")
            {
                out.push_str(line);
                out.push('\n');
            }
        }

        if out.is_empty() {
            if let Some(last) = lines.last() {
                last.trim().to_string() + "\n"
            } else {
                "OK\n".to_string()
            }
        } else {
            out
        }
    }
}
