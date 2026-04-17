//! Compressor for test runner output (cargo test, npm test, vitest, jest, pytest).
//! Keeps summary + failure context, strips passing test noise.

use super::{cmd_matches, normalize_blanks, Compressor};

pub struct TestCompressor;

impl Compressor for TestCompressor {
    fn matches(&self, cmd: &str) -> bool {
        cmd_matches(
            cmd,
            &["cargo test", "npm test", "npx vitest", "npx jest", "pytest"],
        )
    }

    fn compress(&self, _cmd: &str, output: &str) -> String {
        let lines: Vec<&str> = output.lines().collect();
        if lines.len() <= 60 {
            return normalize_blanks(output);
        }

        let mut out = String::new();
        let mut in_failure = false;
        let mut failure_lines = 0;
        let max_failure_context = 30;

        for line in &lines {
            let trimmed = line.trim();

            if trimmed.starts_with("test result:")
                || trimmed.starts_with("Tests:")
                || trimmed.starts_with("Test Suites:")
                || trimmed.starts_with("FAIL ")
                || trimmed.starts_with("PASS ")
                || trimmed.starts_with("ok ")
                || trimmed.starts_with("FAILED")
                || trimmed.starts_with("failures:")
                || trimmed.starts_with("test ")
                || trimmed.contains("passed")
                || trimmed.contains("failed")
                || trimmed.contains("error[")
                || trimmed.contains("Error:")
            {
                in_failure = trimmed.contains("FAIL")
                    || trimmed.contains("failed")
                    || trimmed.contains("error");
                failure_lines = 0;
                out.push_str(line);
                out.push('\n');
                continue;
            }

            if in_failure && failure_lines < max_failure_context {
                out.push_str(line);
                out.push('\n');
                failure_lines += 1;
                if failure_lines >= max_failure_context {
                    out.push_str("  ...(failure context truncated)\n");
                    in_failure = false;
                }
            }
        }

        if out.is_empty() {
            normalize_blanks(output)
        } else {
            out
        }
    }
}
