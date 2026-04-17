//! Compressor for grep/rg output — groups matches by file, caps per-file.
//!
//! Ported from RTK (https://github.com/rtk-ai/rtk) src/cmds/system/grep_cmd.rs

use super::{cmd_matches, normalize_blanks, Compressor};

pub struct GrepCompressor;

impl Compressor for GrepCompressor {
    fn matches(&self, cmd: &str) -> bool {
        cmd_matches(cmd, &["grep", "rg"])
    }

    fn compress(&self, _cmd: &str, output: &str) -> String {
        let lines: Vec<&str> = output.lines().collect();
        let total = lines.len();

        if total <= 50 {
            return normalize_blanks(output);
        }

        let mut groups: Vec<(String, Vec<String>)> = Vec::new();
        let max_line_len = 200;

        for line in &lines {
            let parts: Vec<&str> = line.splitn(3, ':').collect();
            if parts.len() >= 2 {
                let file = parts[0].to_string();
                let content = if parts.len() == 3 { parts[2] } else { parts[1] };
                let truncated: String = content.chars().take(max_line_len).collect();

                if let Some(last) = groups.last_mut() {
                    if last.0 == file {
                        last.1.push(truncated);
                        continue;
                    }
                }
                groups.push((file, vec![truncated]));
            }
        }

        if groups.is_empty() {
            return normalize_blanks(output);
        }

        let mut out = format!("{} matches in {} files:\n\n", total, groups.len());
        let max_per_file = 10;
        let mut shown = 0;

        for (file, matches) in &groups {
            if shown >= 200 {
                break;
            }
            out.push_str(&format!("[{}] ({}):\n", file, matches.len()));
            for m in matches.iter().take(max_per_file) {
                out.push_str("  ");
                out.push_str(m.trim());
                out.push('\n');
                shown += 1;
            }
            if matches.len() > max_per_file {
                out.push_str(&format!("  +{} more\n", matches.len() - max_per_file));
            }
            out.push('\n');
        }

        if total > shown {
            out.push_str(&format!("...+{} more matches\n", total - shown));
        }
        out
    }
}
